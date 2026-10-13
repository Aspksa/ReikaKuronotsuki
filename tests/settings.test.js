'use strict';
// "Настройки": the port in config.json, and a copy of the chat history you can save and restore.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/server');
const settings = require('../core/settings');
const core = require('../core/reika-core');

const webRoot = path.join(__dirname, '..', 'web');

async function withServer(fn) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reika-settings-'));
  const dataDir = path.join(projectRoot, 'данные Рэйки');
  fs.writeFileSync(path.join(projectRoot, 'config.default.json'), JSON.stringify({ port: 8731 }));
  const server = createApp({ webRoot, dataDir, projectRoot, port: 8731 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = (p, options) => fetch(base + p, options);
  const json = (p, body) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try { await fn({ base, api, json, projectRoot, dataDir }); } finally { await new Promise((resolve) => server.close(resolve)); }
}

const message = (text, role = 'user') => ({ id: 'x' + text, role, text, emotion: 'neutral', at: new Date().toISOString() });

test('settings are read from config.default.json plus the user\'s own config.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reika-cfg-'));
  fs.writeFileSync(path.join(root, 'config.default.json'), JSON.stringify({ port: 8731 }));
  assert.deepEqual(settings.read(root), { port: 8731 });
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ port: 9000 }));
  assert.equal(settings.read(root).port, 9000, 'the user\'s copy wins');
  fs.writeFileSync(path.join(root, 'config.json'), '{ broken');
  assert.equal(settings.read(root).port, 8731, 'a broken config.json falls back to the defaults instead of crashing');
});

test('a saved port is validated and written to config.json, keeping unknown settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reika-cfg-'));
  fs.writeFileSync(path.join(root, 'config.default.json'), JSON.stringify({ port: 8731 }));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ port: 8731, somethingElse: 'keep me' }));
  settings.write(root, { port: 8750 });
  const stored = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  assert.deepEqual(stored, { port: 8750, somethingElse: 'keep me' });
  for (const bad of [80, 0, -1, 70000, 1.5, 'восемь', null, undefined]) {
    assert.throws(() => settings.validate({ port: bad }), /Порт|Нечего/, `port ${bad} must be refused`);
  }
  assert.throws(() => settings.validate({}), /Нечего сохранять/);
});

test('the settings API answers with the port, the data folder and how many messages are stored', () => withServer(async ({ api, json, projectRoot }) => {
  const before = await (await api('/api/settings')).json();
  assert.equal(before.port, 8731);
  assert.equal(before.activePort, 8731);
  assert.equal(before.messages, 0);
  assert.ok(before.dataDir.length > 0);
  assert.deepEqual(before.limits, { minPort: settings.MIN_PORT, maxPort: settings.MAX_PORT });

  const bad = await json('/api/settings', { port: 80 });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /Порт должен быть/);
  assert.ok(!fs.existsSync(path.join(projectRoot, 'config.json')), 'a refused value is not written');

  const ok = await json('/api/settings', { port: 8750 });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).port, 8750);
  assert.equal(JSON.parse(fs.readFileSync(path.join(projectRoot, 'config.json'), 'utf8')).port, 8750);

  assert.equal((await api('/api/settings', { method: 'DELETE' })).status, 405);
}));

test('a copy of the data can be saved and restored, and the chat history survives the round trip', () => withServer(async ({ api, base, dataDir }) => {
  await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Привет, Рэйка' }) });
  const copy = await api('/api/backup');
  assert.equal(copy.status, 200);
  assert.match(copy.headers.get('content-disposition'), /attachment; filename="reika-backup-\d{4}-\d\d-\d\d\.json"/);
  const saved = await copy.json();
  assert.equal(saved.kind, 'reika-backup');
  assert.equal(saved.messages.length, 2, 'the question and the answer');
  assert.equal(saved.settings.port, 8731);

  await fetch(`${base}/api/history`, { method: 'DELETE' });
  assert.equal((await (await api('/api/history')).json()).messages.length, 0);

  const restored = await api('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saved) });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).messages, 2);
  const back = (await (await api('/api/history')).json()).messages;
  assert.equal(back.length, 2);
  assert.equal(back[0].text, 'Привет, Рэйка');
  assert.ok(fs.existsSync(path.join(dataDir, 'history.json')), 'the restored history is on disk, not only in memory');
}));

test('a file that is not a copy is refused, and junk inside a real copy is dropped', () => withServer(async ({ api }) => {
  const send = (body) => api('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  for (const bad of ['не json', JSON.stringify({ hello: 'world' }), JSON.stringify({ kind: 'reika-backup' }), JSON.stringify({ kind: 'other', messages: [] })]) {
    const res = await send(bad);
    assert.equal(res.status, 400, `refused: ${String(bad).slice(0, 20)}`);
    assert.ok((await res.json()).error.length > 0);
  }
  const mixed = await send({ kind: 'reika-backup', messages: [message('первое'), { role: 'нечто', text: 'нет' }, { role: 'reika' }, message('второе', 'reika')] });
  const result = await mixed.json();
  assert.equal(result.messages, 2);
  assert.equal(result.skipped, 2, 'the two broken records are reported, not stored');
}));

test('restoring keeps at most the usual number of messages and cleans the text it stores', () => {
  const store = core.createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'reika-store-')));
  const many = Array.from({ length: core.MAX_HISTORY + 50 }, (_, i) => message(`сообщение ${i}`));
  assert.equal(store.replace(many), core.MAX_HISTORY);
  assert.equal(store.all().length, core.MAX_HISTORY);
  assert.equal(store.all()[0].text, 'сообщение 50', 'the newest ones are kept');
  store.replace([{ role: 'user', text: '  привет\u0000  ', at: new Date().toISOString(), emotion: 'x'.repeat(100) }]);
  assert.equal(store.all()[0].text, 'привет', 'control characters and spaces are stripped');
  assert.ok(store.all()[0].emotion.length <= 20);
  assert.equal(store.replace('не массив'), 0);
});
