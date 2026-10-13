'use strict';
// Installs a prepared update (.updates/ready.json + .updates/staging) and can undo it.
//
// Crash safety: before the first project file is touched a journal names the backup. If the process dies half way,
// the next start restores that backup first and only then installs again, so original files are never lost.
// A lock file keeps two launchers from installing at the same time.

const { existsSync } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { SHA, BACKUP_NAME, pathKey, safeUpdatePath, gitHash, readOrNull, atomicWrite, assertNoLinks } = require('./shared');

const KEEP_BACKUPS = 3;
const MAX_DATA_SNAPSHOT_BYTES = 500 * 1024 * 1024;
const folderOf = (root) => path.join(root, '.updates');

async function appendLine(file, object) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(object) + '\n');
}
const logEvent = (folder, operationId, type, relative_path = '', status = '', extra = {}) =>
  appendLine(path.join(folder, 'events.jsonl'), { event_id: randomUUID(), type, timestamp: new Date().toISOString(), operation_id: operationId, relative_path, status, ...extra });
async function addHistory(folder, item) {
  try { await appendLine(path.join(folder, 'history.jsonl'), { id: randomUUID(), at: new Date().toISOString(), ...item }); } catch { /* history is informative only */ }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

async function acquireLock(folder) {
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, 'install.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fs.writeFile(file, JSON.stringify({ pid: process.pid, at: Date.now() }), { flag: 'wx' });
      return () => fs.rm(file, { force: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const info = await fs.readFile(file, 'utf8').then(JSON.parse, () => null);
      if (info && Number.isInteger(info.pid) && info.pid > 0 && pidAlive(info.pid)) {
        throw Object.assign(new Error('Установка уже выполняется другим процессом'), { code: 'EBUSY_UPDATE' });
      }
      await fs.rm(file, { force: true }); // the owner is gone: a stale lock
    }
  }
  throw Object.assign(new Error('Не удалось получить блокировку установки'), { code: 'EBUSY_UPDATE' });
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(full) : (await fs.stat(full).catch(() => ({ size: 0 }))).size;
  }
  return total;
}
const skipTemporary = (src) => !/\.(tmp|lock)$|\.write-test-/.test(src);

// Copy of data/ taken before an install. Returns true when a snapshot exists.
async function snapshotData(root, backup) {
  const data = path.join(root, 'data');
  if (!existsSync(data)) return false;
  if (await dirSize(data) > MAX_DATA_SNAPSHOT_BYTES) return false;
  await fs.cp(data, path.join(backup, 'data-snapshot'), { recursive: true, filter: skipTemporary });
  return true;
}
async function restoreDataSnapshot(root, backup) {
  const snap = path.join(backup, 'data-snapshot');
  if (existsSync(snap)) await fs.cp(snap, path.join(root, 'data'), { recursive: true, force: true });
}

/** Post-install smoke test: bytes on disk match the manifest and every .js file parses. */
async function defaultHealthCheck(root, files) {
  for (const f of files) {
    const bytes = await fs.readFile(path.join(root, f.path));
    if (gitHash(bytes) !== f.sha) throw new Error('Файл после установки не совпадает с манифестом: ' + f.path);
    if (/\.json$/.test(f.path)) JSON.parse(bytes.toString('utf8'));
    if (/\.js$/.test(f.path) && !f.path.startsWith('web/')) {
      const r = spawnSync(process.execPath, ['--check', path.join(root, f.path)], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('Синтаксическая ошибка после установки: ' + f.path + ' ' + String(r.stderr).slice(0, 300));
    }
  }
}

/** Puts every changed file back from the backup and restores the version marker. Returns the list of failures. */
async function restoreFiles(root, backup, changes, oldVersion, oldInstalled) {
  const failures = [];
  for (const { name, existed } of [...changes].reverse()) {
    const dst = path.join(root, name);
    try {
      await assertNoLinks(root, name);
      if (existed) { await fs.mkdir(path.dirname(dst), { recursive: true }); await atomicWrite(dst, await fs.readFile(path.join(backup, name))); }
      else await fs.rm(dst, { force: true });
    } catch (e) { failures.push(`${name}: ${e}`); }
  }
  try {
    const marker = path.join(root, '.reika-version');
    if (oldVersion === null) await fs.rm(marker, { force: true }); else await atomicWrite(marker, Buffer.from(oldVersion));
    const installed = path.join(folderOf(root), 'installed.json');
    if (oldInstalled === null) await fs.rm(installed, { force: true }); else await atomicWrite(installed, Buffer.from(oldInstalled));
  } catch (e) { failures.push('version marker: ' + e); }
  return failures;
}

async function readMeta(backup) {
  let meta;
  try { meta = JSON.parse(await fs.readFile(path.join(backup, '.meta.json'), 'utf8')); }
  catch { throw new Error('Резервная копия не найдена или повреждена'); }
  if (!meta || !Array.isArray(meta.changes) || !meta.changes.every((c) => c && safeUpdatePath(c.name) && typeof c.existed === 'boolean')) {
    throw new Error('Повреждён список файлов резервной копии');
  }
  return meta;
}

/** Keeps only the newest backups (names start with an ISO date) and a few set-aside failed manifests. */
async function pruneUpdateFolder(folder, keep = KEEP_BACKUPS) {
  try {
    const dir = path.join(folder, 'backups');
    const names = (await fs.readdir(dir)).filter((n) => BACKUP_NAME.test(n)).sort();
    for (const n of names.slice(0, Math.max(0, names.length - keep))) await fs.rm(path.join(dir, n), { recursive: true, force: true });
  } catch { /* nothing to prune */ }
  try {
    const failed = (await fs.readdir(folder)).filter((n) => /^ready\.failed-\d+\.json$/.test(n)).sort();
    for (const n of failed.slice(0, Math.max(0, failed.length - keep))) await fs.rm(path.join(folder, n), { force: true });
  } catch { /* nothing to prune */ }
}

/**
 * Restores one earlier installation from its backup. `restoreData` also puts back the data/ snapshot: used only when the
 * new version never started (nothing legitimate was written by it); a manual rollback never touches user data.
 */
async function rollbackInstall(root, backupName, { kind = 'rollback', message = '', restoreData = false } = {}) {
  if (typeof backupName !== 'string' || !BACKUP_NAME.test(backupName)) throw new Error('Некорректное имя резервной копии');
  const folder = folderOf(root);
  const backup = path.join(folder, 'backups', backupName);
  const meta = await readMeta(backup);
  const operationId = 'rollback-' + randomUUID();
  const current = (await readOrNull(path.join(root, '.reika-version')) ?? '').trim();
  await logEvent(folder, operationId, 'rollback_started', '', 'rolling_back', { reason: kind }).catch(() => {});
  const failures = await restoreFiles(root, backup, meta.changes, meta.oldVersion ?? null, meta.oldInstalled ?? null);
  if (failures.length) {
    await logEvent(folder, operationId, 'rollback_failed', '', 'failed', { message: failures.join('; '), reason: kind }).catch(() => {});
    throw new AggregateError(failures.map((f) => new Error(f)), 'Откат завершился ошибками');
  }
  if (restoreData) await restoreDataSnapshot(root, backup);
  await logEvent(folder, operationId, 'rollback_done', '', 'rolled_back', { reason: kind, ...(message ? { message } : {}) }).catch(() => {});
  await addHistory(folder, { kind, from: current, to: String(meta.oldVersion ?? '').trim(), rollbackOf: backupName, ...(message ? { message } : {}) });
  await fs.rm(path.join(folder, 'pending-confirm.json'), { force: true });
  return true;
}

/** Performs the rollback the user asked for in the interface (the file is written by the server). */
async function applyRollbackRequest(root) {
  const file = path.join(folderOf(root), 'rollback-request.json');
  const raw = await readOrNull(file);
  if (raw === null) return false;
  await fs.rm(file, { force: true });
  return rollbackInstall(root, JSON.parse(raw)?.backup);
}
async function confirmUpdate(root) {
  await fs.rm(path.join(folderOf(root), 'pending-confirm.json'), { force: true }).catch(() => {});
}
/** The new version could not start: put the previous one (and its data snapshot) back. Returns true when rolled back. */
async function rollbackFailedStart(root, message) {
  const raw = await readOrNull(path.join(folderOf(root), 'pending-confirm.json')).catch(() => null);
  if (!raw) return false;
  let req; try { req = JSON.parse(raw); } catch { return false; }
  return rollbackInstall(root, req?.backup, { kind: 'startup_failed', message: String(message ?? '').slice(0, 300), restoreData: true });
}

/** An install that was interrupted (power loss, kill): restore its backup so the next attempt starts from the originals. */
async function recoverInterrupted(root) {
  const folder = folderOf(root);
  const journalFile = path.join(folder, 'install-journal.json');
  const raw = await readOrNull(journalFile);
  if (raw === null) return false;
  let journal; try { journal = JSON.parse(raw); } catch { journal = null; }
  if (!journal || typeof journal.backup !== 'string' || !BACKUP_NAME.test(journal.backup)) { await fs.rm(journalFile, { force: true }); return false; }
  const backup = path.join(folder, 'backups', journal.backup);
  const meta = await readMeta(backup);
  const operationId = 'recover-' + randomUUID();
  await logEvent(folder, operationId, 'recovery_started', '', 'rolling_back').catch(() => {});
  const failures = await restoreFiles(root, backup, meta.changes, meta.oldVersion ?? null, meta.oldInstalled ?? null);
  if (failures.length) throw new AggregateError(failures.map((f) => new Error(f)), 'Не удалось восстановить файлы после прерванной установки'); // the journal stays: retried next start
  await fs.rm(journalFile, { force: true });
  await logEvent(folder, operationId, 'recovery_done', '', 'rolled_back').catch(() => {});
  await addHistory(folder, { kind: 'failed', from: '', to: String(journal.sha ?? ''), message: 'Установка была прервана; прежняя версия восстановлена' });
  return true;
}

function validateManifest(manifest) {
  if (!manifest || !SHA.test(manifest.sha) || !Array.isArray(manifest.files) || manifest.files.length > 2500
    || !manifest.files.every((f) => f && safeUpdatePath(f.path) && SHA.test(f.sha))
    || new Set(manifest.files.map((f) => pathKey(f.path))).size !== manifest.files.length
    || (manifest.removals !== undefined && (!Array.isArray(manifest.removals) || manifest.removals.length > 2500
      || !manifest.removals.every((p) => safeUpdatePath(p) && !manifest.files.some((f) => pathKey(f.path) === pathKey(p)))))) {
    throw new Error('Повреждён или небезопасен манифест обновления');
  }
}

/** Staged, hash-verified installer. `hooks.afterFile(i, name)` exists for crash tests. */
async function applyPreparedUpdate(root, { healthCheck = defaultHealthCheck, hooks = {} } = {}) {
  const folder = folderOf(root);
  const manifestFile = path.join(folder, 'ready.json');
  if (!existsSync(manifestFile) && !existsSync(path.join(folder, 'install-journal.json'))) return false;
  const release = await acquireLock(folder);
  try {
    await recoverInterrupted(root);
    if (!existsSync(manifestFile)) return false;
    return await install(root, folder, manifestFile, healthCheck, hooks);
  } finally { await release(); }
}

async function install(root, folder, manifestFile, healthCheck, hooks) {
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  validateManifest(manifest);
  // Removals only for files the user explicitly confirmed for THIS exact update.
  let removals = [];
  if (manifest.removals?.length) {
    const confirmed = await fs.readFile(path.join(folder, 'removals-confirmed.json'), 'utf8').then(JSON.parse, () => null);
    if (confirmed?.sha === manifest.sha && Array.isArray(confirmed.paths)) { const ok = new Set(confirmed.paths); removals = manifest.removals.filter((p) => ok.has(p)); }
  }
  const staging = path.join(folder, 'staging');
  const backup = path.join(folder, 'backups', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
  const operationId = 'install-' + randomUUID();
  const event = (type, rel = '', status = '', extra = {}) => logEvent(folder, operationId, type, rel, status, extra);
  const changes = [];
  const oldInstalled = await fs.readFile(path.join(folder, 'installed.json')).catch(() => null);
  const oldVersion = await fs.readFile(path.join(root, '.reika-version')).catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));
  const oldVersionText = oldVersion === null ? null : oldVersion.toString('utf8');
  const oldInstalledText = oldInstalled === null ? null : oldInstalled.toString('utf8');
  const journalFile = path.join(folder, 'install-journal.json');
  try {
    // 1. Verify the ENTIRE package before modifying any installed file.
    const prepared = [];
    for (const file of manifest.files) {
      await assertNoLinks(root, file.path);
      await assertNoLinks(staging, file.path);
      const data = await fs.readFile(path.join(staging, file.path));
      if (gitHash(data) !== file.sha) throw new Error('Ошибка контроля целостности: ' + file.path);
      const same = await fs.readFile(path.join(root, file.path)).then((b) => gitHash(b) === file.sha, () => false);
      prepared.push({ ...file, data, same });
      if (!same) await event('file_verify_done', file.path, 'verified');
    }
    // 2. Back up everything that will change, plus a copy of data/, BEFORE any change.
    await event('backup_started', '', 'backing_up');
    for (const file of prepared.filter((f) => !f.same)) {
      const dst = path.join(root, file.path);
      let existed = false;
      try {
        const stat = await fs.lstat(dst);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Небезопасный файл назначения: ' + file.path);
        existed = true;
        await fs.mkdir(path.dirname(path.join(backup, file.path)), { recursive: true });
        await fs.copyFile(dst, path.join(backup, file.path));
      } catch (e) { if (e?.code !== 'ENOENT') throw e; }
      changes.push({ name: file.path, existed });
    }
    const doomed = [];
    for (const name of removals) {
      await assertNoLinks(root, name);
      try {
        const stat = await fs.lstat(path.join(root, name));
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Небезопасный файл для удаления: ' + name);
        await fs.mkdir(path.dirname(path.join(backup, name)), { recursive: true });
        await fs.copyFile(path.join(root, name), path.join(backup, name));
        changes.push({ name, existed: true });
        doomed.push(name);
      } catch (e) { if (e?.code !== 'ENOENT') throw e; }
    }
    await fs.mkdir(backup, { recursive: true });
    const dataSnapshot = await snapshotData(root, backup);
    await fs.writeFile(path.join(backup, '.meta.json'), JSON.stringify({ sha: manifest.sha, at: new Date().toISOString(), changes, oldVersion: oldVersionText, oldInstalled: oldInstalledText, dataSnapshot }));
    await event('backup_done', '', 'backed_up', { backup_relative_path: path.relative(root, backup), data_snapshot: dataSnapshot });
    // 3. Journal first, then change files: a crash from here on is recovered at the next start.
    await atomicWrite(journalFile, Buffer.from(JSON.stringify({ backup: path.basename(backup), sha: manifest.sha, at: new Date().toISOString() })));
    let index = 0;
    for (const file of prepared.filter((f) => !f.same)) {
      const dst = path.join(root, file.path);
      await assertNoLinks(root, file.path);
      await event('file_install_start', file.path, 'installing', { target_relative_path: file.path });
      try { await fs.mkdir(path.dirname(dst), { recursive: true }); await atomicWrite(dst, file.data); }
      catch (e) { await event('file_install_failed', file.path, 'failed', { message: String(e?.message ?? e), error_code: e?.code ?? 'EINSTALL' }).catch(() => {}); throw e; }
      await event('file_install_done', file.path, 'installed', { target_relative_path: file.path });
      await hooks.afterFile?.(index++, file.path);
    }
    for (const name of doomed) {
      try { await fs.rm(path.join(root, name)); }
      catch (e) { await event('file_install_failed', name, 'failed', { message: String(e?.message ?? e), change_type: 'removed' }).catch(() => {}); throw e; }
      await event('file_remove_done', name, 'removed', { change_type: 'removed' });
    }
    // 4. Health check, then the version marker.
    await event('health_check_started', '', 'health_check');
    try { await healthCheck(root, manifest.files); }
    catch (e) { await event('health_check_done', '', 'failed', { message: String(e?.message ?? e) }).catch(() => {}); throw e; }
    await event('health_check_done', '', 'healthy');
    await atomicWrite(path.join(root, '.reika-version'), Buffer.from(manifest.sha + '\n'));
    await atomicWrite(path.join(folder, 'installed.json'), Buffer.from(JSON.stringify({ sha: manifest.sha, paths: manifest.files.map((f) => f.path) })));
    // The launcher confirms this once the new version has really started; otherwise it puts the old one back.
    await atomicWrite(path.join(folder, 'pending-confirm.json'), Buffer.from(JSON.stringify({ backup: path.basename(backup), sha: manifest.sha })));
    await fs.rm(journalFile, { force: true });
    await fs.rm(path.join(folder, 'removals-confirmed.json'), { force: true });
    await fs.rm(manifestFile);
    await event('update_completed', '', 'completed', { sha: manifest.sha, backup_relative_path: path.relative(root, backup) });
    await addHistory(folder, { kind: 'install', from: (oldVersionText ?? '').trim(), to: manifest.sha, backup: path.basename(backup), files: changes.length, message: installNote(manifest) });
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fs.rm(path.join(folder, 'staging.sha'), { force: true }).catch(() => {});
    await pruneUpdateFolder(folder);
    return true;
  } catch (error) {
    await event('update_failed', '', 'failed', { message: String(error) }).catch(() => {});
    await event('rollback_started', '', 'rolling_back').catch(() => {});
    const failures = await restoreFiles(root, backup, changes, oldVersionText, oldInstalledText);
    if (failures.length) {
      // The journal stays: the next start retries the restore before anything else.
      await event('rollback_failed', '', 'failed', { message: failures.join('; ') }).catch(() => {});
      throw new AggregateError([error, ...failures.map((f) => new Error(f))], 'Установка и откат завершились ошибками');
    }
    await fs.rm(journalFile, { force: true });
    await event('rollback_done', '', 'rolled_back', { reason: 'install_failed' }).catch(() => {});
    await addHistory(folder, { kind: 'failed', from: (oldVersionText ?? '').trim(), to: manifest.sha, message: String(error?.message ?? error).slice(0, 300) });
    throw error;
  }
}

/** What an install brought, in words, for the history card. */
function installNote(manifest) {
  const notes = Array.isArray(manifest?.notes) ? manifest.notes.filter((n) => n && typeof n.title === 'string' && n.title.trim()).slice(0, 12).map((n) => n.title.trim().slice(0, 140)) : [];
  if (notes.length) return notes.join(' · ').slice(0, 600);
  return typeof manifest?.description === 'string' ? manifest.description.slice(0, 300) : '';
}

module.exports = { applyPreparedUpdate, applyRollbackRequest, rollbackInstall, rollbackFailedStart, confirmUpdate, recoverInterrupted, defaultHealthCheck, pruneUpdateFolder, installNote };
