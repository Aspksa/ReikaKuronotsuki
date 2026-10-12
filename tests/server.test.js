'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createApp } = require('../server/server');

const webRoot = path.join(__dirname, '..', 'web');

async function withServer(fn) {
  const dataDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reika-')), 'данные Рэйки');
  const server = createApp({ webRoot, dataDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, dataDir); } finally { await new Promise((resolve) => server.close(resolve)); }
}

const post = (base, body, raw = false) => fetch(`${base}/api/chat`, {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: raw ? body : JSON.stringify(body),
});

test('health endpoint', () => withServer(async (base) => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
}));

test('serves the UI as UTF-8 and the page declares Russian', () => withServer(async (base) => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html; charset=utf-8/);
  const html = await res.text();
  assert.match(html, /lang="ru"/);
  assert.match(html, /Рэйка Куроноцуки/);
}));

test('static assets have correct types', () => withServer(async (base) => {
  assert.match((await fetch(`${base}/app.js`)).headers.get('content-type'), /javascript; charset=utf-8/);
  assert.match((await fetch(`${base}/style.css`)).headers.get('content-type'), /text\/css; charset=utf-8/);
}));

test('chat answers Cyrillic and stores history', () => withServer(async (base) => {
  const res = await post(base, { text: 'Привет, Рэйка!' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.text, 'Привет, Рэйка!');
  assert.equal(data.reika.emotion, 'happy');
  assert.match(data.reika.text, /[А-Яа-яЁё]/);
  const history = await (await fetch(`${base}/api/history`)).json();
  assert.equal(history.messages.length, 2);
  assert.equal(history.messages[0].text, 'Привет, Рэйка!');
}));

test('history persists on disk in a Cyrillic folder and can be cleared', () => withServer(async (base, dataDir) => {
  await post(base, { text: 'Запомни меня' });
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'history.json'), 'utf8'));
  assert.equal(saved.messages[0].text, 'Запомни меня');
  assert.equal((await fetch(`${base}/api/history`, { method: 'DELETE' })).status, 200);
  assert.equal((await (await fetch(`${base}/api/history`)).json()).messages.length, 0);
}));

test('rejects empty, invalid and oversized input', () => withServer(async (base) => {
  assert.equal((await post(base, { text: '   ' })).status, 400);
  assert.equal((await post(base, '{ nope', true)).status, 400);
  assert.equal((await post(base, JSON.stringify({ text: 'а'.repeat(40000) }), true)).status, 413);
}));

test('blocks path traversal and unknown files', () => withServer(async (base) => {
  const { port } = new URL(base);
  const status = (p) => new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: p }, (r) => { r.resume(); resolve(r.statusCode); }));
  assert.ok([403, 404].includes(await status('/../package.json')));
  assert.ok([403, 404].includes(await status('/%2e%2e/%2e%2e/etc/passwd')));
  assert.equal(await status(encodeURI('/нет-такого-файла.html')), 404);
  assert.equal(await status('/%E0%A4%A'), 400);
}));

test('only expected methods are allowed', () => withServer(async (base) => {
  assert.equal((await fetch(`${base}/api/chat`)).status, 405);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
}));

test('rejects foreign Host and cross-site Origin (CSRF / DNS rebinding) but allows same-origin', () => withServer(async (base) => {
  const { port } = new URL(base);
  const send = (method, headers) => new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/history', method, headers }, (r) => { r.resume(); resolve(r.statusCode); });
    req.end();
  });
  assert.equal(await send('DELETE', { Host: `evil.example:${port}` }), 403, 'rebinding host');
  assert.equal(await send('DELETE', { Host: `127.0.0.1:${port}`, Origin: 'https://evil.example' }), 403, 'cross-site origin');
  assert.equal(await send('DELETE', { Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}` }), 200, 'same origin');
  assert.equal(await send('DELETE', { Host: `localhost:${port}` }), 200, 'no Origin (curl)');
}));

test('update API answers 503 when no updater is attached', () => withServer(async (base) => {
  assert.equal((await fetch(`${base}/api/update/status`)).status, 503);
}));
