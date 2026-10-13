'use strict';
// Tiny dependency-free HTTP server: static web UI + JSON chat API.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../core/reika-core');
const settings = require('../core/settings');
const secrets = require('../core/secrets');
const ai = require('../core/ai');
const { collect: collectStats } = require('../update/stats');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
};
const MAX_BODY = 16 * 1024;
const MAX_ARCHIVE = 60_000_000;
const MAX_BACKUP = 32 * 1024 * 1024; // chat and a bounded memory-graph restore

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        if (size - chunk.length <= MAX_BODY) reject(Object.assign(new Error('too large'), { status: 413 }));
        chunks.length = 0; // keep draining the request so the 413 reply is delivered instead of a reset
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// The server is for this computer only. Host/Origin checks stop other web pages in the user's browser from
// driving it (CSRF) and DNS-rebinding tricks: an update can be installed through this API.
function requestAllowed(req) {
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) return false;
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.origin;
  if (!origin) return true; // not a browser cross-site request (curl, tests, same-origin without header)
  try { return new URL(origin).host === host; } catch { return false; }
}

// Raw request body as a Buffer with its own (larger) limit; the rest of the request is drained so the answer can be delivered.
function readBuffer(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, tooBig = false;
    req.on('data', (chunk) => { size += chunk.length; if (size > max) { tooBig = true; chunks.length = 0; return; } chunks.push(chunk); });
    req.on('end', () => (tooBig ? reject(Object.assign(new Error('Файл слишком большой'), { status: 413 })) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

function createApp({ webRoot, dataDir, projectRoot = path.resolve(webRoot, '..'), port = null, updater = null, restart = () => false, aiClient = ai.createClient() }) {
  const store = core.createStore(dataDir);
  // MemOS lives in the chat pipeline itself. Its database is independent of
  // chat history and statistics; the optional native dependency cannot block startup.
  let memoryPromise = null;
  function memory() {
    if (!memoryPromise) memoryPromise = import('@mem-os/sdk').then(async ({ MemOS }) => {
      const instance = new MemOS({ dbPath: path.join(dataDir, 'reika-memory.sqlite') });
      await instance.init();
      return instance;
    }).catch(error => { console.warn('MemOS недоступен:', error.message); return null; });
    return memoryPromise;
  }
  // Persist only explicit, meaningful first-person statements; questions and commands
  // stay in chat history, not in the long-term fact graph.
  function memoryCandidate(text) {
    const value = String(text || '').trim();
    if (value.length < 12 || value.length > 350 || /[?？]/.test(value)) return null;
    if (/^запомни\s*[:：,]?\s+/i.test(value)) return value.replace(/^запомни\s*[:：,]?\s*/i, '').trim() || null;
    if (/^(?:привет|пока|спасибо|окей|хорошо|да|нет|сделай|покажи|найди|объясни|расскажи|помоги|проверь|переведи|напиши|запусти|открой|удали|поставь|установи)(?:\s|$|[,.!:])/i.test(value)) return null;
    if (!/(?:^|\s)(?:я\s+(?:люблю|предпочитаю|хочу|живу|работаю|учусь|ненавижу|использую|увлекаюсь|не люблю)|мне\s+(?:нравится|не нравится|важно|нужно)|мой\s+(?:любимый|адрес|город|проект|питомец)|моя\s+(?:любимая|работа|цель)|меня зовут|запомни\s*[:：,]?\s+)(?:\s|$|[,.!:]|\S)/i.test(value)) return null;
    return value.replace(/^запомни\s*[:：,]?\s*/i, '').trim() || null;
  }
  async function remember(text) {
    const content = memoryCandidate(text);
    if (!content) return { skipped: true };
    const mem = await memory();
    if (!mem) return { unavailable: true };
    try {
      const hits = await mem.search({ query: content, limit: 5 });
      if (hits.some(hit => String(hit.node?.content || '').trim().toLocaleLowerCase('ru') === content.toLocaleLowerCase('ru'))) return { duplicate: true };
      await mem.store(content, { type: /(?:люблю|предпочитаю|нравится|любим)/i.test(content) ? 'preference' : 'fact', tags: ['reika-chat'], source: 'user_input' });
      return { saved: true };
    } catch (error) { console.warn('MemOS store:', error.message); return { unavailable: true }; }
  }
  async function recall(text) {
    const mem = await memory();
    if (!mem) return [];
    try {
      const hits = await mem.search({ query: text, limit: 4 });
      return hits.map(hit => hit.node?.content).filter(x => typeof x === 'string').slice(0,4);
    } catch (error) { console.warn('MemOS search:', error.message); return []; }
  }
  const root = path.resolve(webRoot);

  // Everything the settings page may see. The key itself is never sent back: only whether it is stored and its last four characters.
  function settingsView() {
    const stored = settings.read(projectRoot);
    const provider = ai.isProvider(stored.aiProvider) ? stored.aiProvider : ai.OFFLINE;
    return {
      ...stored, aiProvider: provider, activePort: typeof port === 'function' ? port() : port, dataDir, messages: store.all().length,
      limits: { minPort: settings.MIN_PORT, maxPort: settings.MAX_PORT },
      ai: {
        provider,
        model: stored.aiModel || '',
        key: secrets.hint(dataDir, 'cloudru'),
        providers: Object.values(ai.PROVIDERS).map((p) => ({ id: p.id, title: p.title, defaultModel: p.defaultModel, keyUrl: p.keyUrl })),
      },
    };
  }

  function serveStatic(req, res, pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400); res.end(); return; }
    if (rel.includes('\0')) { res.writeHead(400); res.end(); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    const target = path.resolve(root, '.' + path.sep + rel);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Не найдено'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  async function handleUpdate(req, res, url) {
    if (!updater) return sendJson(res, 503, { error: 'Модуль обновления недоступен' });
    const route = url.pathname.slice('/api/update/'.length);
    const fail = (error) => sendJson(res, error.status || 409, { error: error.message });
    const body = async () => { try { return JSON.parse((await readBody(req)) || '{}'); } catch (e) { throw Object.assign(new Error(e.status === 413 ? 'Слишком большой запрос' : 'Некорректный JSON'), { status: e.status || 400 }); } };
    try {
      if (req.method === 'GET') {
        if (route === 'status') return sendJson(res, 200, updater.status());
        if (route === 'events') return sendJson(res, 200, await updater.events());
        if (route === 'history') return sendJson(res, 200, await updater.history());
        if (route === 'stats') return sendJson(res, 200, await collectStats(updater));
        return sendJson(res, 404, { error: 'Не найдено' });
      }
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
      if (route === 'check') return sendJson(res, 200, await updater.check());
      if (route === 'download') {
        if (updater.isBusy()) return sendJson(res, 409, { error: 'Обновление уже выполняется' });
        updater.start().catch(() => {});
        return sendJson(res, 202, updater.status());
      }
      if (route === 'from-archive') {
        if (updater.isBusy()) return sendJson(res, 409, { error: 'Обновление уже выполняется' });
        if (Number(req.headers['content-length']) > MAX_ARCHIVE) { req.resume(); return sendJson(res, 413, { error: 'Файл слишком большой (больше 60 МБ)' }); }
        const archive = await readBuffer(req, MAX_ARCHIVE);
        let fileName = 'archive.zip';
        try { fileName = decodeURIComponent(String(req.headers['x-file-name'] || fileName)); } catch { /* keep the default */ }
        updater.startFromArchive(archive, fileName).catch(() => {});
        return sendJson(res, 202, updater.status());
      }
      if (route === 'cancel') return sendJson(res, 200, updater.cancel());
      if (route === 'settings') { await updater.setConfig(await body()); return sendJson(res, 200, updater.status()); }
      if (route === 'confirm-removals') return sendJson(res, 200, await updater.confirmRemovals());
      if (route === 'rollback') { const b = await body(); return sendJson(res, 200, b.cancel === true ? await updater.cancelRollback() : await updater.requestRollback()); }
      if (route === 'install-now') {
        const st = updater.status();
        if (updater.isBusy()) return sendJson(res, 409, { error: 'Подготовка обновления ещё идёт' });
        if (st.phase !== 'ready' && !st.rollbackPending) return sendJson(res, 409, { error: 'Нет подготовленного обновления или отката' });
        if (!restart()) return sendJson(res, 409, { error: 'Рэйка запущена без лаунчера: закройте и откройте её снова вручную' });
        return sendJson(res, 202, { restarting: true });
      }
      return sendJson(res, 404, { error: 'Не найдено' });
    } catch (error) { return fail(error); }
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!requestAllowed(req)) return sendJson(res, 403, { error: 'Запрос отклонён' });
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true, name: 'Reika Kuronotsuki', version: updater ? updater.localVersion() : null });
      if (url.pathname.startsWith('/api/update/')) return handleUpdate(req, res, url);
      if (url.pathname === '/api/settings') {
        if (req.method === 'GET') return sendJson(res, 200, settingsView());
        if (req.method === 'POST') {
          let patch;
          try { patch = JSON.parse((await readBody(req)) || '{}'); } catch { return sendJson(res, 400, { error: 'Некорректный JSON' }); }
          const touchesKey = patch && typeof patch === 'object' && patch.apiKey !== undefined;
          try {
            const stored = settings.write(projectRoot, patch);
            // The key goes to its own file in the data folder, never into config.json.
            if (touchesKey) secrets.set(dataDir, 'cloudru', patch.apiKey);
            if (!Object.keys(settings.validate(patch)).length && !touchesKey) return sendJson(res, 400, { error: 'Нечего сохранять' });
            void stored;
            return sendJson(res, 200, settingsView());
          } catch (error) { return sendJson(res, error.status || 400, { error: error.message }); }
        }
        return sendJson(res, 405, { error: 'method not allowed' });
      }
      // "Проверить связь": does the key work, and which models does the provider offer?
      if (url.pathname === '/api/ai/check') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
        const provider = settings.read(projectRoot).aiProvider;
        if (!ai.providerInfo(provider)) return sendJson(res, 400, { error: 'Сейчас выбрана сама Рэйка — проверять нечего' });
        try { return sendJson(res, 200, await aiClient.check({ provider, key: secrets.get(dataDir, 'cloudru') })); }
        catch (error) { return sendJson(res, error.status === 401 ? 401 : 502, { error: error.message }); }
      }
      // A copy of everything of yours: the chat history and the settings, in one file you can keep anywhere.
      if (url.pathname === '/api/backup') {
        if (req.method === 'GET') {
          const mem = await memory();
          if (!mem) return sendJson(res, 503, { error: 'Невозможно создать полную копию: память MemOS недоступна' });
          const memoryGraph = await mem.getGraph();
          const body = Buffer.from(JSON.stringify({ kind: 'reika-backup', version: 2, createdAt: new Date().toISOString(), settings: settings.read(projectRoot), messages: store.all(), memory: memoryGraph }, null, 2), 'utf8');
          if (body.length > MAX_BACKUP) return sendJson(res, 413, { error: 'Полная резервная копия превысила допустимый размер (32 МБ)' });
          const name = `reika-backup-${new Date().toISOString().slice(0, 10)}.json`;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' });
          return res.end(body);
        }
        if (req.method === 'POST') {
          let payload;
          try { payload = JSON.parse((await readBuffer(req, MAX_BACKUP)).toString('utf8')); }
          catch (error) { return sendJson(res, error.status || 400, { error: error.status === 413 ? 'Файл слишком большой' : 'Это не похоже на файл копии' }); }
          if (!payload || payload.kind !== 'reika-backup' || !Array.isArray(payload.messages)) return sendJson(res, 400, { error: 'Это не копия Рэйки: нет списка сообщений' });
          const graph = payload.memory;
          if (graph !== undefined) {
            if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.nodes.length > 50000 || graph.edges.length > 200000 ||
                graph.nodes.some(n => !n || typeof n.id !== 'string' || n.id.length > 128 || typeof n.content !== 'string' || n.content.length > 10000 ||
                  !['fact','preference','context','relationship','entity','custom'].includes(n.type) || !Number.isSafeInteger(n.createdAt) || !Number.isSafeInteger(n.updatedAt)) ||
                graph.edges.some(e => !e || typeof e.sourceId !== 'string' || typeof e.targetId !== 'string' ||
                  !['relates_to','contradicts','supports','derived_from','part_of','temporal_precedes','custom'].includes(e.relation) ||
                  !Number.isFinite(e.weight) || e.weight < 0 || e.weight > 1) ) {
              return sendJson(res, 400, { error: 'В копии повреждены данные долговременной памяти' });
            }
            const ids = new Set(graph.nodes.map(n => n.id));
            if (ids.size !== graph.nodes.length || graph.edges.some(e => !ids.has(e.sourceId) || !ids.has(e.targetId))) {
              return sendJson(res, 400, { error: 'Повторяющиеся или отсутствующие идентификаторы памяти' });
            }
            const mem = await memory();
            if (!mem) return sendJson(res, 503, { error: 'Память MemOS недоступна, восстановление отменено' });
            // Keep the old memory intact if the import is impossible to start.
            await mem.clear();
            for (const n of graph.nodes) await mem.importRecord(n);
            for (const e of graph.edges) await mem.link(e.sourceId, e.targetId, e.relation, e.weight);
          }
          const restored = store.replace(payload.messages);
          return sendJson(res, 200, { ok: true, messages: restored, skipped: payload.messages.length - restored, memoryRestored: graph !== undefined, memories: graph?.nodes.length ?? null });
        }
        return sendJson(res, 405, { error: 'method not allowed' });
      }
      if (url.pathname === '/api/history') {
        if (req.method === 'GET') return sendJson(res, 200, { messages: store.all() });
        if (req.method === 'DELETE') { store.clear(); return sendJson(res, 200, { ok: true }); }
        return sendJson(res, 405, { error: 'method not allowed' });
      }
      // Memory controls are deliberately built into Reika's own HTTP handler.
      // Only loopback callers with the same-origin policy can access these routes.
      if (url.pathname === '/api/memory' || url.pathname.startsWith('/api/memory/')) {
        const mem = await memory();
        if (!mem) return sendJson(res, 503, { error: 'Память MemOS не установлена или недоступна' });
        const id = url.pathname.startsWith('/api/memory/') ? decodeURIComponent(url.pathname.slice('/api/memory/'.length)) : null;
        try {
          if (req.method === 'GET' && !id) {
            const result = await mem.export({ format: 'json' });
            return sendJson(res, 200, { memories: JSON.parse(result.data), count: result.count });
          }
          if (req.method === 'DELETE' && id && id.length <= 128) return sendJson(res, 200, { deleted: await mem.forget(id) });
          if (req.method === 'PATCH' && id && id.length <= 128) {
            const input = JSON.parse(await readBody(req));
            const content = core.normalizeText(input?.content);
            if (!content) return sendJson(res, 400, { error: 'Нужен текст воспоминания' });
            const updated = await mem.update(id, { content });
            return updated ? sendJson(res, 200, { memory: updated }) : sendJson(res, 404, { error: 'Воспоминание не найдено' });
          }
          if (req.method === 'POST' && !id) {
            const input = JSON.parse(await readBody(req));
            const content = core.normalizeText(input?.content);
            if (!content) return sendJson(res, 400, { error: 'Нужен текст воспоминания' });
            const saved = await mem.store(content, { type: 'fact', source: 'user_input', tags: ['reika-chat'] });
            return sendJson(res, 201, { memory: saved.node });
          }
          if (req.method === 'POST' && id === 'consolidate') {
            const result = await mem.consolidate({ summarize: true });
            return sendJson(res, 200, { result });
          }
        } catch (error) {
          return sendJson(res, 400, { error: 'Операция с памятью не выполнена: ' + error.message });
        }
        return sendJson(res, 405, { error: 'Метод не поддерживается' });
      }
      if (url.pathname === '/api/chat') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
        let payload;
        try { payload = JSON.parse(await readBody(req)); } catch (error) {
          return sendJson(res, error.status || 400, { error: error.status === 413 ? 'Сообщение слишком большое' : 'Некорректный JSON' });
        }
        const text = core.normalizeText(payload && payload.text);
        if (!text) return sendJson(res, 400, { error: 'Пустое сообщение' });
        const stored = settings.read(projectRoot);
        const provider = stored.aiProvider;
        const key = ai.providerInfo(provider) ? secrets.get(dataDir, 'cloudru') : null;
        let answer = null, warning = null, source = 'reika';
        const memories = await recall(text);
        if (ai.providerInfo(provider) && key) {
          try {
            const result = await aiClient.reply({ provider, key, model: stored.aiModel, text, history: store.all(), memories });
            answer = { text: result.text, emotion: core.detectEmotion(result.text) };
            source = provider;
          } catch (error) {
            // The answer must not be lost because the provider is down: Reika answers herself and says what happened.
            warning = error.message;
          }
        }
        if (!answer) {
          // Rules-based offline Reika has no LLM: expose relevant memories
          // transparently rather than pretending to perform semantic reasoning.
          if (/(?:помнишь|запомнила|вспомни|что ты знаешь обо мне|мои предпочтения)/i.test(text)) {
            answer = { text: memories.length ? 'Вот что я нашла в своей памяти:\\n' + memories.map(x => '• ' + x).join('\\n') : 'Пока не нашла подходящих воспоминаний. Можешь сказать «Запомни: …».', emotion: 'neutral' };
          } else answer = core.reply(text);
        }
        const user = store.add('user', text, core.detectEmotion(text));
        const reika = store.add('reika', answer.text, answer.emotion);
        const remembered = await remember(text);
        if (remembered.unavailable) warning = [warning, 'Долговременная память MemOS недоступна: сообщение сохранено только в истории чата'].filter(Boolean).join('. ');
        return sendJson(res, 200, { user, reika, source, ...(warning ? { warning } : {}) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      serveStatic(req, res, url.pathname);
    } catch (error) {
      sendJson(res, 500, { error: 'Внутренняя ошибка' });
    }
  });
}

module.exports = { createApp };
