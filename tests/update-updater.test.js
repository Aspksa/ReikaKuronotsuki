'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ProjectUpdater } = require('../update/updater');
const inst = require('../update/installer');
const { gitHash, REPO } = require('../update/shared');
const { SHA_A, SHA_B, tmpProject, write, read } = require('./update-helpers');

// A tiny fake GitHub. `site.files` is the release tree; `site.ci` the check runs of the target commit.
function fakeGithub(site) {
  const calls = [];
  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
  const fetch = async (url) => {
    url = String(url);
    calls.push(url);
    if (site.rateLimit) return json({}, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) });
    if (url.endsWith('/commits/main')) return json({ sha: SHA_B, commit: { message: 'Новая версия (#7)', committer: { date: '2026-01-01T00:00:00Z' } } });
    if (url.includes('/check-runs')) return json({ total_count: site.ci.length, check_runs: site.ci });
    if (url.includes('/compare/')) return json({}, 404);
    if (url.includes('/git/trees/')) return json({ truncated: false, tree: Object.entries(site.files).map(([p, c]) => ({ path: p, type: 'blob', sha: gitHash(Buffer.from(c)), size: Buffer.byteLength(c) })).concat(site.extraTree ?? []) });
    if (url.startsWith(`https://raw.githubusercontent.com/${REPO}/${SHA_B}/`)) {
      const rel = decodeURIComponent(url.split(SHA_B + '/')[1]);
      if (site.rawStatus?.[rel]) { const s = site.rawStatus[rel].shift() ?? 200; if (s !== 200) return new Response('x', { status: s }); }
      return new Response(site.tamper?.[rel] ?? site.files[rel], { status: 200 });
    }
    return json({}, 404);
  };
  return { fetch, calls };
}
const passing = [{ name: 'tests', status: 'completed', conclusion: 'success' }, { name: 'tests-windows', status: 'completed', conclusion: 'success' }];
const make = (root, site, extra = {}) => new ProjectUpdater(root, { fetch: fakeGithub(site).fetch, retryDelaysMs: [0, 0], freeBytes: () => 1e12, runner: async () => {}, ...extra });
const FILES = { 'a.txt': 'новое', 'web/b.txt': 'b' };

test('blocks installs unless the required CI job succeeded', async () => {
  const cases = [
    [[], /нет успешной проверки/], // none
    [[{ name: 'tests', status: 'in_progress', conclusion: null }], /ещё идут/],
    [[{ name: 'tests', status: 'completed', conclusion: 'failure' }], /не пройдены/],
    [[{ name: 'stats', status: 'completed', conclusion: 'success' }], /нет успешной проверки/], // only ANOTHER workflow is green
  ];
  for (const [ci, message] of cases) {
    const u = make(tmpProject(), { files: FILES, ci });
    await u.check();
    assert.match(u.blocked(), message);
  }
  const ok = make(tmpProject(), { files: FILES, ci: passing });
  await ok.check();
  assert.equal(ok.blocked(), null);
  const off = make(tmpProject(), { files: FILES, ci: [] }, { requireCi: false });
  await off.check();
  assert.equal(off.blocked(), null);
});

test('more check runs than one page can show are not trusted', async () => {
  const site = { files: FILES, ci: passing };
  const gh = fakeGithub(site);
  const fetch = async (url) => (String(url).includes('/check-runs') ? new Response(JSON.stringify({ total_count: 150, check_runs: passing }), { status: 200 }) : gh.fetch(url));
  const u = new ProjectUpdater(tmpProject(), { fetch });
  await u.check();
  assert.equal(u.latest.ci, 'unknown');
});

test('downloads, verifies, tests and leaves the update ready; unchanged files are reused', async () => {
  const root = tmpProject({ 'web/b.txt': 'b' }); // already identical
  const site = { files: FILES, ci: passing };
  const gh = fakeGithub(site);
  const ran = [];
  const u = new ProjectUpdater(root, { fetch: gh.fetch, freeBytes: () => 1e12, runner: async (cwd, cmd, args) => { ran.push({ cwd, args }); } });
  await u.start();
  const st = u.status();
  assert.equal(st.phase, 'ready', st.error);
  assert.equal(st.reusedFiles, 1);
  assert.deepEqual(gh.calls.filter((c) => c.includes('raw.githubusercontent')).map((c) => c.split(SHA_B + '/')[1]), ['a.txt']);
  assert.equal(read(root, '.updates/staging/a.txt'), 'новое');
  assert.deepEqual(ran.map((r) => r.cwd), [path.join(root, '.updates', 'staging')], 'tests run in the staging folder, not in the project');
  assert.equal(JSON.parse(read(root, '.updates/ready.json')).sha, SHA_B);
  assert.ok(!fs.existsSync(path.join(root, 'a.txt')), 'the running project is untouched until the installer runs');
});

test('a downloaded file that differs from its Git hash is rejected', async () => {
  const root = tmpProject();
  const u = make(root, { files: FILES, ci: passing, tamper: { 'a.txt': 'новоЕ' } });
  await u.start();
  assert.equal(u.status().phase, 'error');
  assert.match(u.status().error, /контроля целостности/);
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'ready.json')));
});

test('retries server errors but not 404', async () => {
  const u = make(tmpProject(), { files: FILES, ci: passing, rawStatus: { 'a.txt': [500, 502] } });
  await u.start();
  assert.equal(u.status().phase, 'ready', u.status().error);
  const u2 = make(tmpProject(), { files: FILES, ci: passing, rawStatus: { 'a.txt': [404] } });
  await u2.start();
  assert.equal(u2.status().phase, 'error');
  assert.match(u2.status().error, /HTTP 404/);
});

test('failed tests stop the preparation and nothing is left ready', async () => {
  const root = tmpProject();
  const u = make(root, { files: FILES, ci: passing }, { runner: async () => { throw new Error('Тесты завершились с кодом 1'); } });
  await u.start();
  assert.equal(u.status().phase, 'error');
  assert.equal(u.status().checks.find((c) => c.id === 'test').status, 'error');
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'ready.json')));
});

test('protected paths in the release are ignored; traversal in a path fails the download', async () => {
  const root = tmpProject({ 'data/history.json': 'mine', 'config.json': '{"port":9}' });
  const extraTree = [{ path: 'data/history.json', type: 'blob', sha: SHA_A, size: 3 }, { path: 'config.json', type: 'blob', sha: SHA_A, size: 3 }];
  const u = make(root, { files: FILES, ci: passing, extraTree });
  await u.start();
  assert.equal(u.status().phase, 'ready', u.status().error);
  assert.deepEqual(JSON.parse(read(root, '.updates/ready.json')).files.map((f) => f.path).sort(), ['a.txt', 'web/b.txt']);
  const evil = make(tmpProject(), { files: FILES, ci: passing, extraTree: [{ path: '../evil.txt', type: 'blob', sha: SHA_A, size: 1 }] });
  await evil.start();
  assert.match(evil.status().error, /Недопустимый путь/);
});

test('refuses to start when the disk is too full', async () => {
  const u = make(tmpProject(), { files: FILES, ci: passing }, { freeBytes: () => 1000 });
  await u.start();
  assert.match(u.status().error, /Недостаточно места/);
});

test('a prepared update is still shown after the server restarts (and so are confirmed removals)', async () => {
  const root = tmpProject({ 'old.txt': 'x' });
  write(root, '.updates/installed.json', JSON.stringify({ sha: SHA_A, paths: ['old.txt', 'a.txt'] }));
  const u = make(root, { files: FILES, ci: passing });
  await u.start();
  assert.deepEqual(u.status().pendingRemovals, ['old.txt']);
  await u.confirmRemovals();
  const restarted = new ProjectUpdater(root, {});
  const st = restarted.status();
  assert.equal(st.phase, 'ready');
  assert.deepEqual(st.pendingRemovals, ['old.txt']);
  assert.equal(st.removalsConfirmed, true);
});

test('cancel interrupts the preparation and leaves nothing ready, whichever step it hits', async () => {
  // Cancelling the instant the phase becomes "testing" used to race: the verify step ignored it and the tests still ran.
  for (let attempt = 0; attempt < 5; attempt++) {
    const root = tmpProject();
    let testsCompleted = 0;
    const runner = (cwd, cmd, args, signal) => new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('cancelled'));
      signal.addEventListener('abort', () => reject(new Error('cancelled')));
      setTimeout(() => { testsCompleted++; resolve(); }, 300);
    });
    const u = make(root, { files: FILES, ci: passing }, { runner });
    const running = u.start();
    while (u.status().phase !== 'testing') await new Promise((r) => setImmediate(r));
    u.cancel();
    await running;
    assert.equal(u.status().phase, 'idle', `attempt ${attempt}`);
    assert.match(u.status().message, /отменена/);
    assert.equal(testsCompleted, 0);
    assert.ok(!fs.existsSync(path.join(root, '.updates', 'ready.json')));
    assert.throws(() => u.cancel(), /Нечего отменять/);
  }
});

test('a GitHub rate limit is explained and not hammered', async () => {
  const site = { files: FILES, ci: passing, rateLimit: true };
  const gh = fakeGithub(site);
  const u = new ProjectUpdater(tmpProject(), { fetch: gh.fetch });
  await assert.rejects(u.check(), /Лимит запросов/);
  const before = gh.calls.length;
  await assert.rejects(u.check(), /Лимит запросов/);
  assert.equal(gh.calls.length, before);
});

test('settings are validated and survive a restart', async () => {
  const root = tmpProject();
  const u = make(root, { files: FILES, ci: passing });
  await assert.rejects(u.setConfig({ channel: 'beta' }), /fresh или stable/);
  await assert.rejects(u.setConfig({ autoCheck: 'minutely' }), /off, hourly или daily/);
  await u.setConfig({ channel: 'stable', autoCheck: 'daily' });
  assert.deepEqual(new ProjectUpdater(root, {}).getConfig(), { channel: 'stable', autoCheck: 'daily' });
});

test('after an install the UI can ask for a rollback of exactly that install', async () => {
  const root = tmpProject({ 'a.txt': 'old' });
  const u = make(root, { files: FILES, ci: passing });
  await u.start();
  await inst.applyPreparedUpdate(root, { healthCheck: async () => {} });
  assert.equal(read(root, 'a.txt'), 'новое');
  const h = await u.history();
  assert.ok(h.canRollback);
  await u.requestRollback();
  assert.equal(await inst.applyRollbackRequest(root), true);
  assert.equal(read(root, 'a.txt'), 'old');
  assert.equal((await u.history()).canRollback, null, 'an install is undone only once');
});

test('MemOS upstream benchmark file larger than 10 MB can be staged and hash-verified', async () => {
  const root = tmpProject();
  const benchmark = 'x'.repeat(13_899_729);
  const files = { 'vendor/memos/scripts/dataset/beam/data/beam_100k.json': benchmark };
  const u = make(root, { files, ci: passing });
  await u.start();
  assert.equal(u.status().phase, 'ready', JSON.stringify(u.status()));
  assert.equal(fs.statSync(path.join(root, '.updates/staging/vendor/memos/scripts/dataset/beam/data/beam_100k.json')).size, benchmark.length);
});

test('updater installs dependencies in isolated staging before running MemOS integration tests', async () => {
  const root = tmpProject();
  const site = { files: { ...FILES, 'package.json': JSON.stringify({ name: 'reika', dependencies: { '@mem-os/sdk': 'file:vendor/memos' } }) }, ci: passing };
  const calls = [];
  const u = make(root, site, { runner: async (cwd, command, args) => { calls.push({ cwd, command, args }); } });
  // Controlled runner: confirm the isolated dependency-install step is reached,
  // without contacting npm during mocked update tests.
  const originalInstall = u.installStagingDependencies.bind(u);
  u.installStagingDependencies = async (staging) => {
    assert.equal(staging, path.join(root, '.updates', 'staging'));
    assert.ok(fs.existsSync(path.join(staging, 'package.json')));
    await originalInstall(staging);
    calls.push({ cwd: staging, command: 'dependency-install-step', args: [] });
  };
  await u.start();
  assert.equal(u.status().phase, 'ready', u.status().error);
  assert.equal(calls[0].command, 'dependency-install-step');
  assert.equal(calls[1].args[0], 'tests/run.js');
  assert.equal(calls[1].cwd, path.join(root, '.updates', 'staging'));
});

test('update paths protect nested user directories except exact MemOS dataset', () => {
  const { safeUpdatePath } = require('../update/shared');
  for (const item of ['data/history.json','nested/data/user.json','nested/node_modules/x.js','nested/.env','vendor/memos/node_modules/package.json','nested/config.json','nested/.git/config','runtime/node.exe']) {
    assert.equal(safeUpdatePath(item), false, item);
  }
  assert.equal(safeUpdatePath('vendor/memos/scripts/dataset/beam/data/beam_100k.json'), true);
  assert.equal(safeUpdatePath('other/vendor/memos/scripts/dataset/beam/data/x'), false);
});
