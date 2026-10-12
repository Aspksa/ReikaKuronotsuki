'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/server');
const { ProjectUpdater } = require('../update/updater');
const { tmpProject, prepareUpdate } = require('./update-helpers');

async function withApi(fn, { ready = false, restart = () => true } = {}) {
  const root = tmpProject();
  if (ready) prepareUpdate(root, { 'a.txt': 'x' });
  const updater = new ProjectUpdater(root, { fetch: async () => { throw new Error('offline'); } });
  const server = createApp({ webRoot: path.join(__dirname, '..', 'web'), dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'reika-')), updater, restart });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (p, method = 'GET', body) => fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try { await fn(call, updater); } finally { await new Promise((r) => server.close(r)); }
}

test('status, events and history are served', () => withApi(async (call) => {
  const st = await (await call('/api/update/status')).json();
  assert.equal(st.phase, 'idle');
  assert.equal(st.config.channel, 'fresh');
  assert.deepEqual(await (await call('/api/update/events')).json(), []);
  assert.equal((await (await call('/api/update/history')).json()).canRollback, null);
  assert.equal((await call('/api/update/nope')).status, 404);
}));

test('settings validate input and persist', () => withApi(async (call) => {
  assert.equal((await call('/api/update/settings', 'POST', { channel: 'beta' })).status, 400);
  const ok = await call('/api/update/settings', 'POST', { autoCheck: 'daily' });
  assert.equal((await ok.json()).config.autoCheck, 'daily');
}));

test('install-now needs a prepared update and a launcher', async () => {
  await withApi(async (call) => assert.equal((await call('/api/update/install-now', 'POST', {})).status, 409));
  await withApi(async (call) => assert.equal((await call('/api/update/install-now', 'POST', {})).status, 409), { ready: true, restart: () => false });
  let restarted = 0;
  await withApi(async (call) => {
    const res = await call('/api/update/install-now', 'POST', {});
    assert.equal(res.status, 202);
    assert.equal(restarted, 1);
  }, { ready: true, restart: () => { restarted++; return true; } });
});

test('cancel with nothing running and rollback with no backup are 409, a check failure is reported', () => withApi(async (call) => {
  assert.equal((await call('/api/update/cancel', 'POST', {})).status, 409);
  assert.equal((await call('/api/update/rollback', 'POST', {})).status, 409);
  assert.equal((await call('/api/update/check', 'POST', {})).status >= 400, true);
}));
