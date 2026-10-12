'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const inst = require('../update/installer');
const { safeUpdatePath, gitHash } = require('../update/shared');
const { SHA_A, SHA_B, tmpProject, write, read, readJsonl, prepareUpdate } = require('./update-helpers');

const history = (root) => readJsonl(path.join(root, '.updates', 'history.jsonl'));
const skipHealth = { healthCheck: async () => {} };

test('safeUpdatePath rejects traversal, user data, Windows aliases', () => {
  for (const bad of ['../x', 'a/../b', '/etc/passwd', 'a\\b', 'C:/x', 'data/history.json', 'config.json', '.env', '.updates/ready.json', 'node_modules/x', 'web/con.js', 'a/b.', 'a?b', 'a*b', 'a<b', 'a|b', 'a"b', 'a\tb', 'a/b\u0000', '']) assert.equal(safeUpdatePath(bad), false, bad);
  for (const ok of ['web/app.js', 'update/installer.js', 'README.md']) assert.equal(safeUpdatePath(ok), true, ok);
});

test('gitHash equals `git hash-object`', () => {
  assert.equal(gitHash(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('installs verified files, records history, awaits confirmation, frees staging', async () => {
  const root = tmpProject({ 'a.txt': 'old', 'keep.txt': 'same' });
  prepareUpdate(root, { 'a.txt': 'новое', 'b/new.txt': 'добавлено', 'keep.txt': 'same' });
  assert.equal(await inst.applyPreparedUpdate(root, skipHealth), true);
  assert.equal(read(root, 'a.txt'), 'новое');
  assert.equal(read(root, 'b/new.txt'), 'добавлено');
  assert.equal(read(root, '.reika-version').trim(), SHA_B);
  assert.ok(fs.existsSync(path.join(root, '.updates', 'pending-confirm.json')));
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'ready.json')));
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'staging')));
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'install-journal.json')));
  const h = history(root);
  assert.equal(h[0].kind, 'install');
  assert.equal(h[0].files, 2, 'an identical file is neither backed up nor rewritten');
  await inst.confirmUpdate(root);
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'pending-confirm.json')));
});

test('a corrupted staged file aborts before ANY project file changes', async () => {
  const root = tmpProject({ 'a.txt': 'old-a', 'b.txt': 'old-b' });
  prepareUpdate(root, { 'a.txt': 'new-a', 'b.txt': 'new-b' });
  fs.writeFileSync(path.join(root, '.updates', 'staging', 'b.txt'), 'tampered');
  await assert.rejects(inst.applyPreparedUpdate(root, skipHealth), /контроля целостности/);
  assert.equal(read(root, 'a.txt'), 'old-a');
  assert.equal(read(root, 'b.txt'), 'old-b');
});

test('unsafe manifests are refused (traversal, protected files, duplicates)', async () => {
  for (const files of [['../evil.txt'], ['data/history.json'], ['config.json']]) {
    const root = tmpProject({ 'data/history.json': 'mine', 'config.json': '{"port":1}' });
    const manifest = { sha: SHA_B, files: files.map((p) => ({ path: p, sha: SHA_A })), removals: [] };
    write(root, '.updates/ready.json', JSON.stringify(manifest));
    await assert.rejects(inst.applyPreparedUpdate(root, skipHealth), /небезопасен/);
    assert.equal(read(root, 'data/history.json'), 'mine');
  }
});

test('a failing health check restores files and the version marker', async () => {
  const root = tmpProject({ 'a.txt': 'old', '.reika-version': SHA_A + '\n' });
  prepareUpdate(root, { 'a.txt': 'new' });
  await assert.rejects(inst.applyPreparedUpdate(root, { healthCheck: async () => { throw new Error('сломано'); } }), /сломано/);
  assert.equal(read(root, 'a.txt'), 'old');
  assert.equal(read(root, '.reika-version').trim(), SHA_A);
  assert.equal(history(root)[0].kind, 'failed');
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'install-journal.json')));
});

test('default health check catches a script with a syntax error', async () => {
  const root = tmpProject({ 'run.js': 'ok();' });
  prepareUpdate(root, { 'run.js': 'function (' });
  await assert.rejects(inst.applyPreparedUpdate(root), /Синтаксическая ошибка/);
  assert.equal(read(root, 'run.js'), 'ok();');
});

test('CRASH in the middle of an install: the next start restores the originals, then installs', async () => {
  const root = tmpProject({ 'a.js': '// old a', 'b.js': '// old b', 'c.js': '// old c', '.reika-version': SHA_A + '\n' });
  prepareUpdate(root, { 'a.js': '// new a', 'b.js': '// new b', 'c.js': '// new c' });
  // A real process that is killed (exit 9) right after the first file was replaced.
  const script = `const i=require(${JSON.stringify(path.resolve(__dirname, '../update/installer'))});
    i.applyPreparedUpdate(${JSON.stringify(root)},{healthCheck:async()=>{},hooks:{afterFile:(n)=>{ if(n===0) process.exit(9); }}});`;
  const crashed = spawnSync(process.execPath, ['-e', script]);
  assert.equal(crashed.status, 9);
  const half = ['a.js', 'b.js', 'c.js'].map((f) => read(root, f));
  assert.ok(half.some((t) => t.includes('new')) && half.some((t) => t.includes('old')), 'the folder really is half-updated');
  assert.ok(fs.existsSync(path.join(root, '.updates', 'install-journal.json')));
  // Next start: recovery restores the originals first, so the second install backs up the TRUE originals.
  assert.equal(await inst.applyPreparedUpdate(root, skipHealth), true);
  assert.deepEqual(['a.js', 'b.js', 'c.js'].map((f) => read(root, f)), ['// new a', '// new b', '// new c']);
  const installs = history(root).filter((h) => h.kind === 'install');
  assert.equal(installs.length, 1);
  assert.equal(installs[0].files, 3);
  // A rollback now returns EVERY file to its original content.
  await inst.rollbackInstall(root, installs[0].backup);
  assert.deepEqual(['a.js', 'b.js', 'c.js'].map((f) => read(root, f)), ['// old a', '// old b', '// old c']);
  assert.equal(read(root, '.reika-version').trim(), SHA_A);
});

test('recoverInterrupted restores a half-installed folder even without a new update', async () => {
  const root = tmpProject({ 'a.js': '// old a', 'b.js': '// old b' });
  prepareUpdate(root, { 'a.js': '// new a', 'b.js': '// new b' });
  const script = `require(${JSON.stringify(path.resolve(__dirname, '../update/installer'))}).applyPreparedUpdate(${JSON.stringify(root)},{healthCheck:async()=>{},hooks:{afterFile:()=>process.exit(9)}});`;
  assert.equal(spawnSync(process.execPath, ['-e', script]).status, 9);
  fs.rmSync(path.join(root, '.updates', 'ready.json'));
  assert.equal(await inst.applyPreparedUpdate(root, skipHealth), false);
  assert.equal(read(root, 'a.js'), '// old a');
  assert.ok(!fs.existsSync(path.join(root, '.updates', 'install-journal.json')));
});

test('two launchers cannot install at once; a stale lock is taken over', async () => {
  const root = tmpProject({ 'a.txt': 'old' });
  prepareUpdate(root, { 'a.txt': 'new' });
  const slow = { healthCheck: () => new Promise((r) => setTimeout(r, 150)) };
  const results = await Promise.allSettled([inst.applyPreparedUpdate(root, slow), inst.applyPreparedUpdate(root, slow)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled' && r.value === true).length, 1);
  assert.ok(results.some((r) => r.status === 'rejected' && r.reason.code === 'EBUSY_UPDATE') || results.some((r) => r.value === false));
  assert.equal(history(root).filter((h) => h.kind === 'install').length, 1);

  const root2 = tmpProject({ 'a.txt': 'old' });
  prepareUpdate(root2, { 'a.txt': 'new' });
  write(root2, '.updates/install.lock', JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now() })); // a dead owner
  assert.equal(await inst.applyPreparedUpdate(root2, skipHealth), true);
});

test('startup failure puts back files AND the data snapshot; a manual rollback leaves user data alone', async () => {
  const root = tmpProject({ 'a.txt': 'old', 'data/history.json': '{"messages":["v1"]}' });
  prepareUpdate(root, { 'a.txt': 'new' });
  await inst.applyPreparedUpdate(root, skipHealth);
  write(root, 'data/history.json', '{"migrated":"by the new version"}'); // the new version rewrote the data
  assert.equal(await inst.rollbackFailedStart(root, 'не запустилась'), true);
  assert.equal(read(root, 'a.txt'), 'old');
  assert.equal(read(root, 'data/history.json'), '{"messages":["v1"]}');
  assert.equal(history(root).at(-1).kind, 'startup_failed');

  const root2 = tmpProject({ 'a.txt': 'old', 'data/history.json': 'before' });
  prepareUpdate(root2, { 'a.txt': 'new' });
  await inst.applyPreparedUpdate(root2, skipHealth);
  await inst.confirmUpdate(root2);
  write(root2, 'data/history.json', 'new chat messages');
  await inst.rollbackInstall(root2, history(root2)[0].backup);
  assert.equal(read(root2, 'a.txt'), 'old');
  assert.equal(read(root2, 'data/history.json'), 'new chat messages', 'manual rollback never touches user data');
});

test('removals happen only for files confirmed for this exact update, and are restored on rollback', async () => {
  const root = tmpProject({ 'gone.txt': 'bye', 'stay.txt': 'stay' });
  prepareUpdate(root, { 'x.txt': 'x' }, { removals: ['gone.txt', 'stay.txt'] });
  await inst.applyPreparedUpdate(root, skipHealth);
  assert.ok(fs.existsSync(path.join(root, 'gone.txt')), 'unconfirmed removal is ignored');

  const root2 = tmpProject({ 'gone.txt': 'bye', 'stay.txt': 'stay' });
  prepareUpdate(root2, { 'x.txt': 'x' }, { removals: ['gone.txt', 'stay.txt'] });
  write(root2, '.updates/removals-confirmed.json', JSON.stringify({ sha: SHA_B, paths: ['gone.txt'] }));
  await inst.applyPreparedUpdate(root2, skipHealth);
  assert.ok(!fs.existsSync(path.join(root2, 'gone.txt')));
  assert.ok(fs.existsSync(path.join(root2, 'stay.txt')));
  await inst.rollbackInstall(root2, history(root2)[0].backup);
  assert.equal(read(root2, 'gone.txt'), 'bye');

  const root3 = tmpProject({ 'gone.txt': 'bye' });
  prepareUpdate(root3, { 'x.txt': 'x' }, { removals: ['gone.txt'] });
  write(root3, '.updates/removals-confirmed.json', JSON.stringify({ sha: SHA_A, paths: ['gone.txt'] })); // another update's confirmation
  await inst.applyPreparedUpdate(root3, skipHealth);
  assert.ok(fs.existsSync(path.join(root3, 'gone.txt')));
});

test('rollback refuses unsafe backup names and damaged metadata', async () => {
  const root = tmpProject({});
  await assert.rejects(inst.rollbackInstall(root, '../x'), /Некорректное имя/);
  write(root, '.updates/backups/bad/.meta.json', JSON.stringify({ changes: [{ name: '../x', existed: true }] }));
  await assert.rejects(inst.rollbackInstall(root, 'bad'), /Повреждён/);
});

test('only the newest backups are kept', async () => {
  const root = tmpProject({ 'a.txt': '0' });
  for (let i = 1; i <= 5; i++) {
    prepareUpdate(root, { 'a.txt': String(i) }, { sha: String(i).repeat(40) });
    await inst.applyPreparedUpdate(root, skipHealth);
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(fs.readdirSync(path.join(root, '.updates', 'backups')).length, 3);
});
