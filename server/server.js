'use strict';
// Tiny dependency-free HTTP server: static web UI + JSON chat API.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../core/reika-core');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const MAX_BODY = 16 * 1024;

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

function createApp({ webRoot, dataDir, updater = null, restart = () => false }) {
  const store = core.createStore(dataDir);
  const root = path.resolve(webRoot);

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
        return sendJson(res, 404, { error: 'Не найдено' });
      }
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
      if (route === 'check') return sendJson(res, 200, await updater.check());
      if (route === 'download') {
        if (updater.isBusy()) return sendJson(res, 409, { error: 'Обновление уже выполняется' });
        updater.start().catch(() => {});
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
      if (url.pathname === '/api/history') {
        if (req.method === 'GET') return sendJson(res, 200, { messages: store.all() });
        if (req.method === 'DELETE') { store.clear(); return sendJson(res, 200, { ok: true }); }
        return sendJson(res, 405, { error: 'method not allowed' });
      }
      if (url.pathname === '/api/chat') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
        let payload;
        try { payload = JSON.parse(await readBody(req)); } catch (error) {
          return sendJson(res, error.status || 400, { error: error.status === 413 ? 'Сообщение слишком большое' : 'Некорректный JSON' });
        }
        const text = core.normalizeText(payload && payload.text);
        if (!text) return sendJson(res, 400, { error: 'Пустое сообщение' });
        const answer = core.reply(text);
        const user = store.add('user', text, core.detectEmotion(text));
        const reika = store.add('reika', answer.text, answer.emotion);
        return sendJson(res, 200, { user, reika });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      serveStatic(req, res, url.pathname);
    } catch (error) {
      sendJson(res, 500, { error: 'Внутренняя ошибка' });
    }
  });
}

module.exports = { createApp };
