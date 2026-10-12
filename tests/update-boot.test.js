'use strict';
// End-to-end: the real launcher (launcher/boot.js) with a real server in a throw-away copy of the project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { tmpProject, read, prepareUpdate, SHA_B } = require('./update-helpers');

const projectRoot = path.join(__dirname, '..');

function copyProject(port) {
  const root = tmpProject();
  for (const dir of ['core', 'server', 'web', 'update', 'launcher']) fs.cpSync(path.join(projectRoot, dir), path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ port }));
  return root;
}

function boot(root) {
  const child = spawn(process.execPath, [path.join(root, 'launcher', 'boot.js')], { env: { ...process.env, REIKA_STABLE_MS: '400', REIKA_READY_TIMEOUT_MS: '8000' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { out += c; });
  const until = async (re, ms = 15000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const m = re.exec(out); if (m) return m; await new Promise((r) => setTimeout(r, 50)); }
    throw new Error(`timeout waiting for ${re}\n--- output ---\n${out}`);
  };
  const stop = () => new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 3000).unref(); });
  return { child, until, stop, output: () => out };
}

const health = async (url) => (await fetch(url + 'api/health')).json();

test('a new version that dies at start is rolled back automatically and the old one keeps serving', async () => {
  const root = copyProject(39100);
  const original = read(root, 'server/main.js');
  prepareUpdate(root, { 'server/main.js': "process.exit(3); // broken release\n" }, { sha: SHA_B });
  const b = boot(root);
  try {
    await b.until(/Возвращаю прежнюю/);
    const ready = await b.until(/REIKA_READY (\{.*\})/);
    const info = JSON.parse(ready[1]);
    assert.equal((await health(info.url)).ok, true);
    assert.equal(read(root, 'server/main.js'), original);
    assert.ok(!fs.existsSync(path.join(root, '.reika-version')));
    const history = fs.readFileSync(path.join(root, '.updates', 'history.jsonl'), 'utf8');
    assert.match(history, /startup_failed/);
  } finally { await b.stop(); }
});

test('a good update is installed, the new version is confirmed after it stays up', async () => {
  const root = copyProject(39200);
  const patched = read(root, 'web/style.css') + '\n/* new release */\n';
  prepareUpdate(root, { 'web/style.css': patched }, { sha: SHA_B });
  const b = boot(root);
  try {
    const info = JSON.parse((await b.until(/REIKA_READY (\{.*\})/))[1]);
    await b.until(/Новая версия подтверждена/);
    assert.equal(read(root, 'web/style.css'), patched);
    assert.equal(read(root, '.reika-version').trim(), SHA_B);
    assert.ok(!fs.existsSync(path.join(root, '.updates', 'pending-confirm.json')));
    const h = await health(info.url);
    assert.equal(h.version, SHA_B, 'the health endpoint reports the installed version');
    assert.match(await (await fetch(info.url + 'style.css')).text(), /new release/);
  } finally { await b.stop(); }
});

test('a server that answers 500 to the health check does not count as a working version', async () => {
  const root = copyProject(39300);
  // A release whose server starts but whose health endpoint is broken (HTTP 500).
  const brokenServer = fs.readFileSync(path.join(root, 'server', 'server.js'), 'utf8').replace(/return sendJson\(res, 200, \{ ok: true, name: 'Reika Kuronotsuki'/, "return sendJson(res, 500, { ok: false, name: 'Reika Kuronotsuki'");
  assert.notEqual(brokenServer, fs.readFileSync(path.join(root, 'server', 'server.js'), 'utf8'), 'test setup: the patch applied');
  prepareUpdate(root, { 'server/server.js': brokenServer }, { sha: SHA_B });
  const b = boot(root);
  try {
    await b.until(/Возвращаю прежнюю/);
    assert.ok(!fs.readFileSync(path.join(root, 'server', 'server.js'), 'utf8').includes('sendJson(res, 500, { ok: false'));
  } finally { await b.stop(); }
});
