'use strict';
// Server side of "Обновление проекта": finds a newer version on GitHub, downloads it into .updates/staging,
// checks it (hashes + the project's own tests in that folder) and leaves it "ready". It never touches the running
// files: the installer (update/installer.js) applies a ready update when the launcher starts.

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { readFileSync, existsSync, statfsSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { REPO, SHA, BLOCKED, pathKey, safeUpdatePath, gitHash } = require('./shared');
const { readZip } = require('./zip');

const API = 'https://api.github.com/repos/' + REPO;
const HEADERS = { 'user-agent': 'Reika-Updater', accept: 'application/vnd.github+json' };
const REQUIRED_CI_JOB = 'tests'; // the CI job whose success is mandatory (see .github/workflows/ci.yml)
const MAX_ATTEMPTS = 3;
const MAX_DOWNLOAD_BYTES = 50_000_000;
const MAX_FILES = 2000;
const MAX_FILE_BYTES = 20_000_000; // MemOS includes a tracked 13.9 MB benchmark dataset; stay bounded per file.
const AUTO_CHECK_MIN_MS = 30 * 60_000;
const TEST_TIMEOUT_MS = 300_000;
const MAX_API_BYTES = 20_000_000;
const MAX_ARCHIVE_BYTES = 60_000_000;
// A project archive must at least look like this project: these files must be in it.
const PROJECT_MARKERS = ['server/main.js', 'update/installer.js', 'launcher/boot.js', 'web/index.html'];
const MAX_LOCK_MS = 3_600_000; // whatever GitHub says, never stay silent for more than an hour
const CI_VALUES = ['success', 'pending', 'failure', 'none', 'unknown'];
const UNKNOWN_VERSION = 'не определена';
const CHECK_TITLES = { verify: 'Проверка файлов', test: 'Тесты' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freshChecks = () => Object.keys(CHECK_TITLES).map((id) => ({ id, title: CHECK_TITLES[id], status: 'todo' }));
const blankState = () => ({
  phase: 'idle', percent: 0, downloadedFiles: 0, totalFiles: 0, downloadedBytes: 0, totalBytes: 0, reusedFiles: 0, treeBytes: 0,
  message: 'Ожидание', checks: freshChecks(), pendingRemovals: [], removalsConfirmed: false,
});
const httpError = (message, status) => Object.assign(new Error(message), { status });

function scrubbedEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|COOKIE)/i.test(k)) env[k] = v;
  return env;
}

function failureTail(output) {
  const lines = output.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const key = [...new Set(lines.filter((l) => /(^|\s)(not ok|✖|FAIL)\s|Error|failed/.test(l)))].slice(0, 15);
  return (key.length ? [...key, '…', ...lines.slice(-10).filter((l) => !key.includes(l))] : lines.slice(-25)).join('\n').slice(-3000);
}

/** Pure: the newest install whose backup was not yet restored (installs are undone strictly in reverse order). */
function rollbackTarget(history, hasBackup = () => true) {
  const stack = [];
  for (const h of history) {
    if (h.kind === 'install' && h.backup) stack.push(h);
    if (h.rollbackOf) { const i = stack.findIndex((s) => s.backup === h.rollbackOf); if (i >= 0) stack.splice(i, 1); }
  }
  for (let i = stack.length - 1; i >= 0; i--) if (hasBackup(stack[i].backup)) return stack[i];
  return null;
}

/** Installed version: the marker written by the installer, else the commit checked out by git. */
function localVersion(root) {
  try { return readFileSync(path.join(root, '.reika-version'), 'utf8').trim().slice(0, 40) || UNKNOWN_VERSION; }
  catch { return gitHead(root) ?? UNKNOWN_VERSION; }
}
function gitHead(root) {
  try {
    const gitDir = path.join(root, '.git');
    const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (SHA.test(head)) return head;
    const ref = head.startsWith('ref: ') ? head.slice(5).trim() : '';
    if (!/^refs\/[\w./-]+$/.test(ref) || ref.includes('..')) return null;
    try { const sha = readFileSync(path.join(gitDir, ref), 'utf8').trim(); if (SHA.test(sha)) return sha; } catch { /* packed */ }
    for (const line of readFileSync(path.join(gitDir, 'packed-refs'), 'utf8').split(/\r?\n/)) {
      const m = /^([a-f0-9]{40}) (\S+)$/.exec(line.trim());
      if (m && m[2] === ref) return m[1];
    }
  } catch { /* not a git checkout */ }
  return null;
}

/** A cached "latest version" is trusted only if every field has the expected type: the page prints these values. */
function cleanLatest(l) {
  if (!l || typeof l !== 'object' || !SHA.test(l.sha) || typeof l.version !== 'string' || !CI_VALUES.includes(l.ci)) return null;
  const changes = Array.isArray(l.changes) ? l.changes.filter((c) => c && typeof c.title === 'string' && typeof c.sha === 'string').slice(0, 30).map((c) => ({ sha: c.sha.slice(0, 8), title: c.title.slice(0, 140) })) : [];
  return {
    sha: l.sha, version: l.version.slice(0, 100), channel: l.channel === 'stable' ? 'stable' : 'fresh', ...(typeof l.tag === 'string' ? { tag: l.tag.slice(0, 100) } : {}),
    description: typeof l.description === 'string' ? l.description.slice(0, 400) : '', date: typeof l.date === 'string' ? l.date.slice(0, 40) : '', ci: l.ci,
    changes, changesTotal: Number.isSafeInteger(l.changesTotal) && l.changesTotal >= 0 ? l.changesTotal : changes.length,
  };
}

class ProjectUpdater {
  constructor(root, opts = {}) {
    this.root = root;
    this.fetch = opts.fetch || globalThis.fetch;
    this.runner = opts.runner;
    this.requireCi = opts.requireCi ?? process.env.REIKA_UPDATE_REQUIRE_CI !== '0';
    this.token = (opts.token ?? process.env.GITHUB_TOKEN ?? '').trim();
    this.apiBase = opts.apiBase || API;
    this.rawBase = opts.rawBase || `https://raw.githubusercontent.com/${REPO}`;
    this.timeouts = { api: 20_000, file: 120_000, idle: 30_000, ...opts.timeouts };
    this.retryDelays = opts.retryDelaysMs ?? [1000, 3000];
    this.freeBytes = opts.freeBytes || (() => { const s = statfsSync(this.root); return Number(s.bavail) * Number(s.bsize); });
    this.state = blankState();
    this.latest = null;
    this.busy = false;
    this.operationId = crypto.randomUUID();
    this.abort = null;
    this.child = null;
    this.checkedAt = 0;
    this.rateLimitUntil = 0;
    this.config = { channel: 'fresh', autoCheck: 'hourly' };
    this.etags = new Map();
    this.loadSavedSettings();
    this.restoreState();
  }

  folder() { return path.join(this.root, '.updates'); }
  file(name) { return path.join(this.folder(), name); }
  localVersion() { return localVersion(this.root); }
  isBusy() { return this.busy; }
  getConfig() { return { ...this.config }; }
  lastCheckedAt() { return this.checkedAt; }

  loadSavedSettings() {
    try {
      const c = JSON.parse(readFileSync(this.file('config.json'), 'utf8'));
      if (c.channel === 'fresh' || c.channel === 'stable') this.config.channel = c.channel;
      if (['off', 'hourly', 'daily'].includes(c.autoCheck)) this.config.autoCheck = c.autoCheck;
    } catch { /* defaults */ }
    try {
      const c = JSON.parse(readFileSync(this.file('check-cache.json'), 'utf8'));
      const now = Date.now();
      if (Number.isFinite(c.checkedAt)) this.checkedAt = Math.min(c.checkedAt, now);
      // GitHub never asks for more than an hour: a larger saved value is corruption, not a real limit.
      if (Number.isFinite(c.rateLimitUntil) && c.rateLimitUntil <= now + MAX_LOCK_MS) this.rateLimitUntil = c.rateLimitUntil;
      const latest = cleanLatest(c.latest);
      if (latest && c.channel === this.config.channel) this.latest = latest; else this.checkedAt = 0;
    } catch { /* first run */ }
    this.rollbackPending = existsSync(this.file('rollback-request.json'));
  }

  /** A prepared update survives a server restart: the page must still show it (the launcher WILL install it). */
  restoreState() {
    try {
      const ready = JSON.parse(readFileSync(this.file('ready.json'), 'utf8'));
      if (!SHA.test(ready.sha) || !Array.isArray(ready.files)) return;
      let confirmed = false;
      try { const c = JSON.parse(readFileSync(this.file('removals-confirmed.json'), 'utf8')); confirmed = c.sha === ready.sha; } catch { /* none */ }
      this.state = {
        ...blankState(), phase: 'ready', percent: 100, message: 'Обновление подготовлено. Перезапустите Рэйку для установки.',
        checks: freshChecks().map((c) => ({ ...c, status: 'done' })),
        totalFiles: ready.files.length, downloadedFiles: ready.files.length,
        pendingRemovals: Array.isArray(ready.removals) ? ready.removals : [], removalsConfirmed: confirmed,
      };
    } catch { /* nothing prepared */ }
  }

  status() {
    return { ...this.state, latest: this.latest, checkedAt: this.checkedAt || null, localVersion: this.localVersion(), config: this.getConfig(), rollbackPending: this.rollbackPending, blocked: this.blocked(), rateLimitedUntil: Date.now() < this.rateLimitUntil ? this.rateLimitUntil : null };
  }

  /** Why the newest version cannot be installed right now (null = it can). */
  blocked() {
    if (!this.latest || !this.requireCi || this.latest.source === 'archive') return null; // an archive the user picked is not gated by GitHub's CI
    switch (this.latest.ci) {
      case 'success': return null;
      case 'pending': return 'Автоматические проверки (CI) этой версии ещё идут — обновление станет доступно, когда они завершатся.';
      case 'failure': return 'Автоматические проверки (CI) этой версии не пройдены — устанавливать её небезопасно.';
      case 'none': return `У этой версии нет успешной проверки «${REQUIRED_CI_JOB}» (CI) — обновление недоступно.`;
      default: return 'Не удалось получить результат автоматических проверок (CI) — повторите проверку позже.';
    }
  }

  async setConfig(patch) {
    const p = patch && typeof patch === 'object' ? patch : {};
    const next = { ...this.config };
    if (p.channel !== undefined) { if (p.channel !== 'fresh' && p.channel !== 'stable') throw httpError('Канал: fresh или stable', 400); next.channel = p.channel; }
    if (p.autoCheck !== undefined) { if (!['off', 'hourly', 'daily'].includes(p.autoCheck)) throw httpError('Автопроверка: off, hourly или daily', 400); next.autoCheck = p.autoCheck; }
    if (this.busy && next.channel !== this.config.channel) throw httpError('Дождитесь окончания подготовки обновления', 409);
    await this.writeJson('config.json', next);
    if (next.channel !== this.config.channel) { this.latest = null; this.checkedAt = 0; }
    this.config = next;
    return this.getConfig();
  }

  async writeJson(name, value) {
    await fs.mkdir(this.folder(), { recursive: true });
    const file = this.file(name);
    const tmp = `${file}.${crypto.randomUUID().slice(0, 8)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value)); await fs.rename(tmp, file);
  }
  saveCache() { return this.writeJson('check-cache.json', { checkedAt: this.checkedAt, rateLimitUntil: this.rateLimitUntil, latest: this.latest, channel: this.config.channel }).catch(() => {}); }

  async emit(type, relative_path = '', status = '', extra = {}) {
    await fs.mkdir(this.folder(), { recursive: true });
    const line = JSON.stringify({ event_id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), operation_id: this.operationId, relative_path, status, ...extra }) + '\n';
    await fs.appendFile(this.file('events.jsonl'), line);
    if (['file_download_done','update_cancelled','update_failed'].includes(type))
      await fs.appendFile(this.file('telemetry.jsonl'), line).catch(() => {});
  }
  async events() {
    try {
      const records = (await fs.readFile(this.file('events.jsonl'), 'utf8')).trim().split('\n').flatMap((s) => { try { return [JSON.parse(s)]; } catch { return []; } });
      const manifest = [...records].reverse().find((e) => e.type === 'manifest_ready');
      const recent = records.slice(-250);
      return manifest && !recent.some((e) => e.event_id === manifest.event_id) ? [manifest, ...recent] : recent;
    } catch { return []; }
  }

  // ---------- GitHub ----------
  /**
   * One request whose WHOLE life is time-limited: an overall limit and an idle limit (no bytes for a while), both also
   * covering the body. The body is read here, with a size cap, so a server that stalls or never stops cannot hang or
   * exhaust memory. A cancel from the user aborts it at once.
   */
  async fetchBody(url, init, { overallMs, idleMs, maxBytes, signal, onChunk }) {
    const ctl = new AbortController();
    let idle, overall;
    const stop = (message) => ctl.abort(new Error(message));
    const arm = () => { clearTimeout(idle); idle = setTimeout(() => stop('Истекло время ожидания: сервер не присылает данные'), idleMs); };
    const onAbort = () => ctl.abort(signal.reason ?? new Error('cancelled'));
    if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true }); }
    overall = setTimeout(() => stop('Истекло время ожидания'), overallMs);
    arm();
    try {
      const response = await this.fetch(url, { ...init, signal: ctl.signal });
      arm();
      const discard = () => response.body?.cancel().catch(() => {});
      if (!response.ok) { await discard(); return { response, body: null }; }
      // Content-Length of a compressed answer is the size of the COMPRESSED bytes (tiny files grow under gzip), so the early
      // check applies only to plain answers; the byte counter below caps the decoded size either way (also against zip bombs).
      const encoded = (response.headers.get('content-encoding') || 'identity').toLowerCase() !== 'identity';
      const declared = encoded ? NaN : Number(response.headers.get('content-length'));
      if (maxBytes != null && Number.isFinite(declared) && declared > maxBytes) { await discard(); throw Object.assign(new Error(`Размер ответа (${declared} Б) больше ожидаемого (${maxBytes} Б)`), { fatal: true }); }
      const chunks = [];
      let size = 0;
      if (!response.body) { const all = Buffer.from(await response.arrayBuffer()); if (maxBytes != null && all.length > maxBytes) throw Object.assign(new Error('Размер ответа больше ожидаемого'), { fatal: true }); return { response, body: all }; }
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        arm();
        size += value.byteLength;
        if (maxBytes != null && size > maxBytes) { await reader.cancel().catch(() => {}); throw Object.assign(new Error(`Размер ответа больше ожидаемого (${maxBytes} Б)`), { fatal: true }); }
        chunks.push(Buffer.from(value));
        onChunk?.(value.byteLength);
      }
      return { response, body: Buffer.concat(chunks) };
    } catch (error) {
      if (ctl.signal.aborted) throw ctl.signal.reason instanceof Error ? ctl.signal.reason : new Error('Запрос прерван');
      throw error;
    } finally { clearTimeout(idle); clearTimeout(overall); signal?.removeEventListener('abort', onAbort); }
  }

  rateLimitMessage() {
    const at = new Date(this.rateLimitUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `Лимит запросов GitHub исчерпан — повторите после ${at}.`;
  }

  async getJson(url, signal) {
    if (Date.now() < this.rateLimitUntil) throw httpError(this.rateLimitMessage(), 429);
    const cached = this.etags.get(url);
    const headers = { ...HEADERS, ...(this.token ? { authorization: 'Bearer ' + this.token } : {}), ...(cached ? { 'if-none-match': cached.etag } : {}) };
    const { response, body } = await this.fetchBody(url, { headers }, { overallMs: this.timeouts.api, idleMs: this.timeouts.api, maxBytes: MAX_API_BYTES, signal });
    if (response.status === 304 && cached) return JSON.parse(cached.body);
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const remaining = response.headers.get('x-ratelimit-remaining');
      if ((response.status === 403 || response.status === 429) && (remaining === '0' || retryAfter > 0 || response.status === 429)) {
        const reset = Number(response.headers.get('x-ratelimit-reset'));
        const now = Date.now();
        const wanted = retryAfter > 0 ? now + retryAfter * 1000 : reset > 0 ? reset * 1000 : now + 10 * 60_000;
        // A silly header (year 3000, NaN, negative) must not lock updates out for good: between now and one hour.
        this.rateLimitUntil = Number.isFinite(wanted) ? Math.min(Math.max(wanted, now), now + MAX_LOCK_MS) : now + 10 * 60_000;
        await this.saveCache();
        throw httpError(this.rateLimitMessage(), 429);
      }
      throw httpError('GitHub API: HTTP ' + response.status, response.status);
    }
    const text = body.toString('utf8');
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('GitHub ответил не в том формате (не JSON). Возможно, мешает прокси или сеть — повторите позже.'); }
    const etag = response.headers.get('etag');
    if (etag && text.length < 200_000 && !url.includes('/git/trees/')) this.etags.set(url, { etag, body: text });
    return json;
  }

  /** CI verdict. Success needs the required job to have succeeded; any doubt is "unknown"/"none", never a silent pass. */
  async ciState(sha) {
    try {
      const r = await this.getJson(`${this.apiBase}/commits/${sha}/check-runs?per_page=100`);
      const runs = Array.isArray(r.check_runs) ? r.check_runs : [];
      if (Number(r.total_count) > runs.length) return 'unknown'; // more than one page: not handled, so not trusted
      if (!runs.length) return 'none';
      if (runs.some((x) => x.status !== 'completed')) return 'pending';
      if (runs.some((x) => !['success', 'neutral', 'skipped'].includes(String(x.conclusion)))) return 'failure';
      return runs.some((x) => x.name === REQUIRED_CI_JOB && x.conclusion === 'success') ? 'success' : 'none';
    } catch { return 'unknown'; }
  }

  async whatChanged(sha) {
    const local = this.localVersion();
    if (!SHA.test(local) || local === sha) return { items: [], total: 0 };
    try {
      const r = await this.getJson(`${this.apiBase}/compare/${local}...${sha}`);
      const commits = Array.isArray(r.commits) ? r.commits : [];
      const items = commits.slice(-30).reverse().map((c) => ({ sha: String(c.sha ?? '').slice(0, 8), title: String(c.commit?.message ?? '').split('\n')[0].trim().slice(0, 140).replace(/\s*\(#\d+\)\s*$/, '') || 'без описания' }));
      return { items, total: Number.isSafeInteger(r.total_commits) ? r.total_commits : commits.length };
    } catch { return { items: [], total: 0 }; }
  }

  async check(force = true) {
    if (!force && (this.busy || (this.latest && Date.now() - this.checkedAt < AUTO_CHECK_MIN_MS) || Date.now() < this.rateLimitUntil)) return this.status();
    let target;
    if (this.config.channel === 'stable') {
      let rel;
      try { rel = await this.getJson(this.apiBase + '/releases/latest'); }
      catch (e) { if (e.status === 404) throw httpError('В репозитории пока нет стабильных выпусков. Выберите канал «Свежий».', 409); throw e; }
      const tag = String(rel.tag_name ?? '');
      if (!/^[\w.\-+/]{1,100}$/.test(tag)) throw new Error('Неверное имя выпуска GitHub');
      const c = await this.getJson(`${this.apiBase}/commits/${encodeURIComponent(tag)}`);
      target = { sha: String(c.sha), message: String(c.commit?.message ?? ''), date: String(c.commit?.committer?.date ?? ''), tag };
    } else {
      const c = await this.getJson(this.apiBase + '/commits/main');
      target = { sha: String(c.sha), message: String(c.commit?.message ?? ''), date: String(c.commit?.committer?.date ?? '') };
    }
    if (!SHA.test(target.sha)) throw new Error('Неверный идентификатор GitHub');
    const [ci, notes] = await Promise.all([this.ciState(target.sha), this.whatChanged(target.sha)]);
    const title = target.message.split('\n')[0].slice(0, 160);
    this.latest = {
      sha: target.sha, version: target.tag ?? target.sha.slice(0, 8), channel: this.config.channel, ...(target.tag ? { tag: target.tag } : {}),
      description: 'Обновление проекта из GitHub. Коммит: ' + (title || 'без описания'), date: target.date, ci, changes: notes.items, changesTotal: notes.total,
    };
    this.checkedAt = Date.now();
    await this.saveCache();
    return this.status();
  }

  // ---------- download + checks ----------
  async start() {
    if (this.busy) throw new Error('Обновление уже выполняется');
    this.busy = true; // claim the slot before any await so concurrent callers see it
    const abort = this.abort = new AbortController();
    const signal = abort.signal;
    this.operationId = crypto.randomUUID();
    this.state = { ...blankState(), phase: 'downloading', message: 'Подключение к GitHub' };
    try {
      await fs.mkdir(this.folder(), { recursive: true });
      await fs.rm(this.file('ready.json'), { force: true });
      await fs.rm(this.file('removals-confirmed.json'), { force: true });
      await fs.writeFile(this.file('events.jsonl'), '');
      await this.emit('update_check_started', '', 'checking');
      await this.check(true);
      const why = this.blocked();
      if (why) throw new Error(why);
      const sha = this.latest.sha;
      const tree = await this.getJson(`${this.apiBase}/git/trees/${sha}?recursive=1`, signal);
      if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Неполный список файлов GitHub');
      for (const x of tree.tree) {
        if (!x || typeof x !== 'object') throw new Error('Недопустимая запись в списке файлов GitHub');
        if (x.type === 'commit') throw new Error('Подмодули в обновлении не поддерживаются: ' + String(x.path).slice(0, 100));
        if (x.mode === '120000') throw new Error('Символические ссылки в обновлении не поддерживаются: ' + String(x.path).slice(0, 100));
      }
      // Paths the update must never touch (data/, config.json …) are simply not part of an update.
      const entries = tree.tree.filter((x) => x.type === 'blob' && !isProtected(x.path));
      if (entries.some((e) => !safeUpdatePath(e.path) || !SHA.test(e.sha)) || new Set(entries.map((e) => pathKey(e.path))).size !== entries.length) throw new Error('Недопустимый путь или повтор файла в манифесте');
      if (entries.length > MAX_FILES || entries.some((x) => !Number.isSafeInteger(x.size) || x.size < 0 || x.size > MAX_FILE_BYTES)) throw new Error('Превышены ограничения размера обновления');
      const changes = await Promise.all(entries.map(async (e) => {
        try { return { path: e.path, change_type: gitHash(await fs.readFile(path.join(this.root, e.path))) === e.sha ? 'unchanged' : 'modified', size: e.size }; }
        catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; return { path: e.path, change_type: 'added', size: e.size }; }
      }));
      const changeOf = new Map(changes.map((c) => [c.path, c.change_type]));
      const fetchBytes = entries.filter((e) => changeOf.get(e.path) !== 'unchanged').reduce((n, e) => n + e.size, 0);
      const treeBytes = entries.reduce((n, e) => n + e.size, 0);
      if (fetchBytes > MAX_DOWNLOAD_BYTES) throw new Error('Размер обновления превышает 50 МБ');
      const free = this.freeBytes(), need = treeBytes * 2 + 50_000_000; // staging copy + backup + room for tests
      if (free < need) throw new Error(`Недостаточно места на диске: нужно около ${Math.ceil(need / 1e6)} МБ, свободно ${Math.floor(free / 1e6)} МБ`);
      Object.assign(this.state, { totalFiles: entries.filter((e) => changeOf.get(e.path) !== 'unchanged').length, totalBytes: fetchBytes, treeBytes });
      const removals = await this.findRemovals(entries);
      this.state.pendingRemovals = removals;
      await this.emit('manifest_ready', '', 'ready', { files: [...changes, ...removals.map((p) => ({ path: p, change_type: 'removed', size: 0 }))], sha });

      // Verified files of an interrupted attempt for the SAME commit are kept; anything else starts clean.
      const staging = this.file('staging'), marker = this.file('staging.sha');
      const sameCommit = (await fs.readFile(marker, 'utf8').catch(() => '')).trim() === sha;
      if (!sameCommit) await fs.rm(staging, { recursive: true, force: true });
      await fs.mkdir(staging, { recursive: true });
      await fs.writeFile(marker, sha + '\n');
      for (const e of entries) {
        if (signal.aborted) throw new Error('cancelled');
        const change_type = changeOf.get(e.path);
        const dest = path.join(staging, e.path);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        if (change_type === 'unchanged') { await fs.copyFile(path.join(this.root, e.path), dest); this.state.reusedFiles++; continue; }
        await this.emit('download_started', e.path, 'downloading', { change_type, target_relative_path: e.path });
        const kept = sameCommit ? await fs.readFile(dest).catch(() => null) : null;
        if (kept && gitHash(kept) === e.sha) this.state.downloadedBytes += e.size; // resumed
        else {
          const data = await this.download(sha, e, signal);
          await this.emit('file_verify_started', e.path, 'verifying', { change_type });
          if (data.length !== e.size || gitHash(data) !== e.sha) throw new Error('Ошибка контроля целостности: ' + e.path);
          await fs.writeFile(dest, data);
        }
        this.state.percent = fetchBytes ? Math.min(100, Math.floor(100 * this.state.downloadedBytes / fetchBytes)) : 100;
        await this.emit('file_verify_done', e.path, 'verified', { change_type });
        this.state.downloadedFiles++;
        await this.emit('file_download_done', e.path, 'downloaded', { change_type, bytes_done: e.size, bytes_total: e.size, target_relative_path: e.path });
        this.state.message = 'Скачано: ' + e.path;
      }
      this.state.percent = 100;
      this.state.phase = 'testing';
      await this.step('verify', async () => {
        for (const e of entries) {
          const bytes = await fs.readFile(path.join(staging, e.path)).catch(() => null);
          if (!bytes || gitHash(bytes) !== e.sha) throw new Error('Файл в подготовке повреждён: ' + e.path);
        }
      });
      // The staged project has no node_modules (protected user installation).
      // MemOS tests need the local SDK and SQLite driver: provision them in
      // staging, never touching the running project's dependencies or data.
      await this.step('test', async () => {
        await this.installStagingDependencies(staging);
        await this.run(staging, process.execPath, ['tests/run.js']);
      });
      this.throwIfCancelled(); // never leave a cancelled update "ready"
      await this.writeJson('ready.json', { sha, files: entries.map((e) => ({ path: e.path, sha: e.sha })), removals, description: this.latest.description, notes: (this.latest.changes ?? []).slice(0, 12).map((c) => ({ title: c.title })), createdAt: new Date().toISOString() });
      await this.emit('update_prepared', '', 'ready', { sha });
      this.state.phase = 'ready';
      this.state.message = 'Проверки пройдены. Перезапустите Рэйку для установки.';
    } catch (e) {
      await fs.rm(this.file('ready.json'), { force: true }).catch(() => {});
      if (signal.aborted) {
        this.state = { ...blankState(), message: 'Подготовка обновления отменена' };
        await this.emit('update_cancelled', '', 'cancelled').catch(() => {});
      } else {
        await this.emit('update_failed', '', 'failed', { message: e instanceof Error ? e.message : String(e) }).catch(() => {});
        this.state.phase = 'error';
        this.state.error = e instanceof Error ? e.message : String(e);
        this.state.message = 'Не удалось подготовить обновление';
      }
    } finally { this.busy = false; this.abort = null; this.child = null; }
  }

  throwIfCancelled() {
    if (this.abort?.signal.aborted) throw new Error('cancelled');
  }

  /**
   * "Update from a file": the user picks a ZIP of the project (GitHub's "Download ZIP" works). It goes through the same staging,
   * file check and tests as a download and becomes "ready"; the installer then applies it like any other update.
   * Not checked against GitHub (no network needed), so the UI says to use archives you trust.
   */
  async startFromArchive(buffer, name = 'archive.zip') {
    if (this.busy) throw new Error('Обновление уже выполняется');
    this.busy = true; // claim the slot before any await
    const abort = this.abort = new AbortController();
    const signal = abort.signal;
    this.operationId = crypto.randomUUID();
    const label = String(name).replace(/[\u0000-\u001f]/g, '').slice(0, 120) || 'archive.zip';
    this.state = { ...blankState(), phase: 'downloading', message: 'Чтение архива' };
    try {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_ARCHIVE_BYTES) throw new Error(`Архив больше ${Math.floor(MAX_ARCHIVE_BYTES / 1e6)} МБ или пуст`);
      await fs.mkdir(this.folder(), { recursive: true });
      await fs.rm(this.file('ready.json'), { force: true });
      await fs.rm(this.file('removals-confirmed.json'), { force: true });
      await fs.writeFile(this.file('events.jsonl'), '');
      await this.emit('archive_started', '', 'reading', { name: label, bytes: buffer.length });
      const files = readZip(buffer, { maxEntries: MAX_FILES + 500, maxFileBytes: MAX_FILE_BYTES });
      // GitHub's ZIP wraps everything in one folder ("Repo-main/"): drop it
      let prefix = '';
      const tops = new Set(files.map((f) => (f.name.includes('/') ? f.name.slice(0, f.name.indexOf('/') + 1) : '')));
      if (tops.size === 1 && !tops.has('')) prefix = [...tops][0];
      const entries = [];
      for (const f of files) {
        const rel = f.name.slice(prefix.length);
        if (!rel || isProtected(rel)) continue; // user data, settings and bookkeeping never come from an update
        if (!safeUpdatePath(rel)) throw new Error('Недопустимый путь в архиве: ' + rel.slice(0, 120));
        entries.push({ path: rel, sha: gitHash(f.data), size: f.data.length, data: f.data });
      }
      entries.sort((a, b) => (a.path < b.path ? -1 : 1));
      if (new Set(entries.map((e) => pathKey(e.path))).size !== entries.length) throw new Error('Повтор файла в архиве');
      if (entries.length > MAX_FILES) throw new Error('Слишком много файлов в архиве');
      const missing = PROJECT_MARKERS.filter((m) => !entries.some((e) => e.path === m));
      if (missing.length) throw new Error('Это не архив проекта Рэйки: нет файлов ' + missing.join(', '));
      // the version id of an archive: a hash over the paths and contents (there is no commit to name)
      const sha = crypto.createHash('sha1').update(entries.map((e) => `${e.path}\0${e.sha}\n`).join('')).digest('hex');
      const treeBytes = entries.reduce((n, e) => n + e.size, 0);
      const free = this.freeBytes(), need = treeBytes * 2 + 50_000_000;
      if (free < need) throw new Error(`Недостаточно места на диске: нужно около ${Math.ceil(need / 1e6)} МБ, свободно ${Math.floor(free / 1e6)} МБ`);

      const changes = await Promise.all(entries.map(async (e) => {
        try { return { path: e.path, change_type: gitHash(await fs.readFile(path.join(this.root, e.path))) === e.sha ? 'unchanged' : 'modified', size: e.size }; }
        catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; return { path: e.path, change_type: 'added', size: e.size }; }
      }));
      const removals = await this.findRemovals(entries);
      Object.assign(this.state, { totalFiles: entries.length, totalBytes: treeBytes, treeBytes, pendingRemovals: removals });
      this.latest = { sha, version: `из файла · ${sha.slice(0, 8)}`, source: 'archive', channel: 'fresh', description: 'Установка из файла: ' + label, date: new Date().toISOString(), ci: 'none', changes: [], changesTotal: 0 };
      await this.emit('manifest_ready', '', 'ready', { files: [...changes, ...removals.map((p) => ({ path: p, change_type: 'removed', size: 0 }))], sha });

      const staging = this.file('staging');
      await fs.rm(staging, { recursive: true, force: true });
      await fs.mkdir(staging, { recursive: true });
      await fs.writeFile(this.file('staging.sha'), sha + '\n');
      for (const e of entries) {
        if (signal.aborted) throw new Error('cancelled');
        const dest = path.join(staging, e.path);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, e.data);
        this.state.downloadedFiles++; this.state.downloadedBytes += e.size;
        this.state.percent = Math.floor(100 * this.state.downloadedFiles / entries.length);
        await this.emit('file_download_done', e.path, 'downloaded', { change_type: changes.find((c) => c.path === e.path)?.change_type, bytes_done: e.size, bytes_total: e.size, target_relative_path: e.path });
      }
      this.state.percent = 100;
      this.state.phase = 'testing';
      await this.step('verify', async () => {
        for (const e of entries) {
          const bytes = await fs.readFile(path.join(staging, e.path)).catch(() => null);
          if (!bytes || gitHash(bytes) !== e.sha) throw new Error('Файл в подготовке повреждён: ' + e.path);
        }
      });
      // ZIP content is not authenticated by GitHub: never execute tests supplied by
      // an untrusted archive during preparation. Check syntax and file hashes
      // using the currently installed (trusted) installer instead.
      await this.step('test', () => require('./installer').defaultHealthCheck(staging, entries));
      this.throwIfCancelled();
      await this.writeJson('ready.json', { sha, files: entries.map((e) => ({ path: e.path, sha: e.sha })), removals, description: 'Установка из файла: ' + label, notes: [{ title: 'Файл ' + label }], createdAt: new Date().toISOString() });
      await this.emit('update_prepared', '', 'ready', { sha });
      this.state.phase = 'ready';
      this.state.message = 'Проверки пройдены. Перезапустите Рэйку для установки.';
    } catch (e) {
      await fs.rm(this.file('ready.json'), { force: true }).catch(() => {});
      if (signal.aborted) {
        this.state = { ...blankState(), message: 'Подготовка обновления отменена' };
        await this.emit('update_cancelled', '', 'cancelled').catch(() => {});
      } else {
        await this.emit('update_failed', '', 'failed', { message: e instanceof Error ? e.message : String(e) }).catch(() => {});
        this.state.phase = 'error';
        this.state.error = e instanceof Error ? e.message : String(e);
        this.state.message = 'Не удалось подготовить обновление из файла';
      }
    } finally { this.busy = false; this.abort = null; this.child = null; }
  }

  async step(id, work) {
    this.throwIfCancelled(); // a cancel that arrived between two steps must stop the next one
    const s = this.state.checks.find((c) => c.id === id);
    s.status = 'active'; this.state.message = s.title;
    try { await work(); s.status = 'done'; } catch (e) { s.status = 'error'; throw e; }
  }

  cancel() {
    if (!this.busy || !this.abort) throw new Error('Нечего отменять');
    this.abort.abort(new Error('cancelled'));
    this.killChild();
    return this.status();
  }

  async download(sha, e, signal) {
    const url = `${this.rawBase}/${sha}/${e.path.split('/').map(encodeURIComponent).join('/')}`;
    for (let attempt = 1; ; attempt++) {
      const before = this.state.downloadedBytes;
      try {
        // maxBytes = the size GitHub's file list declared: an endless or oversized body is cut off, not stored.
        const { response, body } = await this.fetchBody(url, { headers: HEADERS }, {
          overallMs: this.timeouts.file, idleMs: this.timeouts.idle, maxBytes: e.size, signal,
          onChunk: (n) => { this.state.downloadedBytes += n; if (this.state.totalBytes) this.state.percent = Math.min(100, Math.floor(100 * this.state.downloadedBytes / this.state.totalBytes)); },
        });
        if (!response.ok) throw httpError(`Не удалось скачать ${e.path}: HTTP ${response.status}`, response.status);
        return body;
      } catch (err) {
        this.state.downloadedBytes = before;
        const fatal = signal.aborted || err.fatal || (err.status && err.status < 500 && err.status !== 429 && err.status !== 408);
        if (fatal || attempt >= MAX_ATTEMPTS) throw err;
        this.state.message = `Повтор загрузки (${attempt + 1} из ${MAX_ATTEMPTS}): ${e.path}`;
        await sleep(this.retryDelays[attempt - 1] ?? 0);
      }
    }
  }

  /** Files installed by the previous release that the new tree no longer contains. Only ever files WE installed. */
  async findRemovals(entries) {
    let prev;
    try { prev = JSON.parse(await fs.readFile(this.file('installed.json'), 'utf8')); } catch { return []; }
    if (!prev || !Array.isArray(prev.paths)) return [];
    const keep = new Set(entries.map((e) => pathKey(e.path)));
    const out = [];
    for (const p of prev.paths) {
      if (typeof p !== 'string' || !safeUpdatePath(p) || keep.has(pathKey(p))) continue;
      if (await fs.stat(path.join(this.root, p)).then(() => true, () => false)) out.push(p);
    }
    return out.slice(0, 2500);
  }

  async confirmRemovals() {
    if (this.state.phase !== 'ready') throw new Error('Нет подготовленного обновления');
    const ready = JSON.parse(await fs.readFile(this.file('ready.json'), 'utf8'));
    if (!Array.isArray(ready.removals) || !ready.removals.length) throw new Error('Нечего удалять');
    await this.writeJson('removals-confirmed.json', { sha: ready.sha, paths: ready.removals });
    this.state.removalsConfirmed = true;
    await this.emit('removals_confirmed', '', 'confirmed', { count: ready.removals.length });
    return this.status();
  }

  // ---------- history and rollback (the launcher performs the rollback on the next start) ----------
  async readHistory() {
    try {
      return (await fs.readFile(this.file('history.jsonl'), 'utf8')).trim().split('\n').slice(-200)
        .flatMap((s) => { try { const h = JSON.parse(s); return h && typeof h.id === 'string' && typeof h.kind === 'string' ? [h] : []; } catch { return []; } });
    } catch { return []; }
  }
  hasBackup = (name) => /^[\w.-]+$/.test(name) && existsSync(path.join(this.folder(), 'backups', name, '.meta.json'));
  async history() {
    const all = await this.readHistory();
    const target = rollbackTarget(all, this.hasBackup);
    return { items: all.slice(-30).reverse(), canRollback: target && !existsSync(this.file('ready.json')) ? target : null, rollbackPending: this.rollbackPending };
  }
  async requestRollback() {
    if (this.busy) throw httpError('Дождитесь окончания подготовки обновления', 409);
    if (existsSync(this.file('ready.json'))) throw httpError('Сначала установите или отмените подготовленное обновление', 409);
    const target = rollbackTarget(await this.readHistory(), this.hasBackup);
    if (!target?.backup) throw httpError('Нет установки, которую можно откатить', 409);
    await this.writeJson('rollback-request.json', { backup: target.backup, at: new Date().toISOString() });
    this.rollbackPending = true;
    return this.status();
  }
  async cancelRollback() {
    await fs.rm(this.file('rollback-request.json'), { force: true });
    this.rollbackPending = false;
    return this.status();
  }

  // ---------- running the project's tests inside the staging folder ----------
  killChild() {
    const c = this.child;
    if (!c?.pid) return;
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => {});
      else process.kill(-c.pid, 'SIGTERM'); // the whole group: tests spawn children of their own
    } catch { /* already gone */ }
  }
  async installStagingDependencies(staging) {
    if (!existsSync(path.join(staging, 'package.json'))) return;
    // Test runners injected by unit tests simulate execution; no npm network.
    if (this.runner) return;
    const candidates = [
      path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(this.root, 'runtime', 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ];
    const cli = candidates.find((candidate) => existsSync(candidate));
    if (cli) return this.run(staging, process.execPath, [cli, 'install', '--omit=dev', '--no-audit', '--no-fund']);
    // Use the platform's npm only if portable npm isn't available.
    return this.run(staging, process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--no-audit', '--no-fund']);
  }
  async run(cwd, command, args) {
    this.throwIfCancelled();
    if (this.runner) return this.runner(cwd, command, args, this.abort?.signal ?? new AbortController().signal);
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...scrubbedEnv(), REIKA_UPDATE_CHECK: '1' }, detached: process.platform !== 'win32' });
      this.child = child;
      const timer = setTimeout(() => this.killChild(), TEST_TIMEOUT_MS);
      let output = '';
      const capture = (chunk) => { output = (output + chunk.toString('utf8')).slice(-32_000); };
      child.stdout.on('data', capture); child.stderr.on('data', capture);
      child.on('error', (e) => { clearTimeout(timer); reject(e); });
      child.on('exit', async (code) => {
        clearTimeout(timer); this.child = null;
        if (code === 0) return resolve();
        if (this.abort?.signal.aborted) return reject(new Error('cancelled'));
        this.state.logTail = failureTail(output);
        await fs.writeFile(this.file('test-output.log'), output).catch(() => {});
        reject(new Error(`Тесты завершились с кодом ${code}. Подробности: .updates/test-output.log`));
      });
    });
  }
}

const isProtected = (p) => typeof p === 'string' && BLOCKED.has(p.split('/')[0]); // protect only project-root user directories, not vendored library datasets

module.exports = { MAX_ARCHIVE_BYTES, ProjectUpdater, rollbackTarget, localVersion, failureTail, REQUIRED_CI_JOB };
