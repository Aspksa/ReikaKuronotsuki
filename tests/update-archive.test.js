'use strict';
// "Update from a file": the ZIP reader is strict, and an archive goes through the same staging + checks as a download.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { readZip } = require('../update/zip');
const { ProjectUpdater } = require('../update/updater');
const inst = require('../update/installer');
const { createApp } = require('../server/server');
const { tmpProject, write, read, makeZip, PROJECT_FILES } = require('./update-helpers');

const zipOf = (files, options) => makeZip(Object.entries(files).map(([name, data]) => ({ name, data })), options);
const make = (root, extra = {}) => new ProjectUpdater(root, { freeBytes: () => 1e12, runner: async () => {}, ...extra });

test('reads stored and deflated files, Cyrillic names, directories; round-trips the bytes', () => {
  const binary = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 7) % 256));
  const entries = [{ name: 'папка/', data: '' }, { name: 'папка/файл Рэйки.txt', data: 'привет' }, { name: 'bin.dat', data: binary, store: true }, { name: 'a.js', data: 'x'.repeat(5000) }];
  const out = readZip(makeZip(entries));
  assert.deepEqual(out.map((f) => f.name), ['папка/файл Рэйки.txt', 'bin.dat', 'a.js']);
  assert.equal(out[0].data.toString(), 'привет');
  assert.deepEqual(out[1].data, binary);
  assert.equal(out[2].data.length, 5000);
});

test('refuses anything unusual instead of guessing', () => {
  const ok = { name: 'a.txt', data: 'hello' };
  const cases = [
    ['not a zip', Buffer.from('this is not a zip file at all, really not'), /не ZIP/],
    ['empty', Buffer.alloc(0), /не ZIP/],
    ['truncated', makeZip([ok]).subarray(0, 40), /не ZIP|повреждён|обрезан/],
    ['encrypted', makeZip([{ ...ok, flags: 0x801 }]), /зашифрованные/],
    ['symlink', makeZip([{ name: 'link', data: '/etc/passwd', attrs: 0o120777 << 16 }]), /символическая ссылка/],
    ['bad crc', makeZip([{ ...ok, crc: 12345 }]), /контрольная сумма/],
    ['declared size lies', makeZip([{ ...ok, declaredSize: 99 }]), /размер|распаковать/],
    ['unknown method', makeZip([{ ...ok, method: 12 }]), /способ сжатия/],
    ['duplicate names', makeZip([ok, ok]), /повторяющееся/],
    ['case/unicode duplicate', makeZip([{ name: 'café.txt', data: 'a' }, { name: 'café.txt', data: 'b' }]), /повторяющееся/],
    ['zip64', makeZip([ok], { zip64: true }), /ZIP64/],
    ['non-utf8 names', makeZip([{ name: 'café', data: 'a', flags: 0 }]), /UTF-8/],
  ];
  for (const [label, buffer, message] of cases) assert.throws(() => readZip(buffer), message, label);
});

test('a zip bomb is stopped by the declared size, not by memory', () => {
  const bomb = makeZip([{ name: 'big.bin', data: Buffer.alloc(50 * 1024 * 1024) }]); // ~50 KB packed
  assert.throws(() => readZip(bomb, { maxFileBytes: 1_000_000 }), /слишком большой/);
  const lie = makeZip([{ name: 'big.bin', data: Buffer.alloc(5 * 1024 * 1024), declaredSize: 100 }]);
  assert.throws(() => readZip(lie), /размер|распаковать/);
  assert.throws(() => readZip(makeZip(Array.from({ length: 40 }, (_, i) => ({ name: `f${i}.txt`, data: 'x' }))), { maxEntries: 10 }), /слишком много/);
  assert.throws(() => readZip(makeZip([{ name: 'a', data: Buffer.alloc(900_000) }, { name: 'b', data: Buffer.alloc(900_000) }]), { maxTotalBytes: 1_000_000 }), /распакованный размер/);
});

test('an archive becomes a ready update: top folder stripped, user files skipped, staged and checked in staging', async () => {
  const root = tmpProject({ 'README.md': 'old', 'data/history.json': 'mine', 'config.json': '{"port":1}' });
  const files = { ...Object.fromEntries(Object.entries(PROJECT_FILES).map(([k, v]) => [`ReikaKuronotsuki-main/${k}`, v])), 'ReikaKuronotsuki-main/data/history.json': 'EVIL', 'ReikaKuronotsuki-main/config.json': 'EVIL', 'ReikaKuronotsuki-main/.env': 'EVIL' };
  const ran = [];
  const u = make(root, { runner: async (cwd) => { ran.push(cwd); } });
  await u.startFromArchive(zipOf(files), 'Рэйка main.zip');
  const st = u.status();
  assert.equal(st.phase, 'ready', st.error);
  assert.deepEqual(ran, [], 'archive-supplied scripts must never execute during preparation');
  const ready = JSON.parse(read(root, '.updates/ready.json'));
  assert.deepEqual(ready.files.map((f) => f.path).sort(), Object.keys(PROJECT_FILES).sort(), 'user files and secrets from the archive are skipped');
  assert.match(ready.sha, /^[0-9a-f]{40}$/);
  assert.equal(read(root, 'data/history.json'), 'mine');
  assert.equal(read(root, 'config.json'), '{"port":1}');
  assert.match(st.latest.version, /из файла/);
  assert.equal(st.blocked, null, 'an archive is not gated by GitHub CI');
  // install it like any other update, then roll it back
  assert.equal(await inst.applyPreparedUpdate(root, { healthCheck: async () => {} }), true);
  assert.equal(read(root, 'README.md'), '# hi');
  assert.equal(read(root, 'data/history.json'), 'mine');
  const history = fs.readFileSync(path.join(root, '.updates', 'history.jsonl'), 'utf8');
  assert.match(history, /Файл Рэйка main\.zip|из файла/);
});

test('an archive without the top folder works too, and the same content always gets the same version id', async () => {
  const a = make(tmpProject()), b = make(tmpProject());
  await a.startFromArchive(zipOf(PROJECT_FILES), 'one.zip');
  await b.startFromArchive(zipOf({ ...PROJECT_FILES }), 'two.zip');
  assert.equal(a.status().phase, 'ready');
  assert.equal(a.latest.sha, b.latest.sha);
  const c = make(tmpProject());
  await c.startFromArchive(zipOf({ ...PROJECT_FILES, 'README.md': 'changed' }), 'three.zip');
  assert.notEqual(c.latest.sha, a.latest.sha);
});

test('bad archives are clean errors: unsafe paths, not this project, damaged, too little disk, bad syntax', async () => {
  const check = async (buffer, message, extra) => {
    const root = tmpProject();
    const u = make(root, extra);
    await u.startFromArchive(buffer, 'x.zip');
    assert.equal(u.status().phase, 'error', String(message));
    assert.match(u.status().error, message);
    assert.ok(!fs.existsSync(path.join(root, '.updates', 'ready.json')));
    assert.equal(u.isBusy(), false);
  };
  await check(zipOf({ ...PROJECT_FILES, '../evil.txt': 'x' }), /Недопустимый путь/);
  await check(zipOf({ ...PROJECT_FILES, 'a/../../evil.txt': 'x' }), /Недопустимый путь/);
  await check(zipOf({ ...PROJECT_FILES, 'what?.txt': 'x' }), /Недопустимый путь/);
  await check(zipOf({ 'readme.txt': 'just some other project' }), /не архив проекта Рэйки/);
  await check(Buffer.from('definitely not a zip file, sorry about that'), /не ZIP/);
  await check(zipOf(PROJECT_FILES), /Недостаточно места/, { freeBytes: () => 1000 });
  await check(zipOf({ ...PROJECT_FILES, 'config.default.json': '{ invalid json' }), /JSON|Unexpected|property name|Expected/);
  await check(Buffer.alloc(0), /больше|пуст/);
});

test('the removal list is proposed for files the previous release installed but the archive lacks', async () => {
  const root = tmpProject({ 'old/legacy.js': 'x' });
  write(root, '.updates/installed.json', JSON.stringify({ sha: 'a'.repeat(40), paths: ['old/legacy.js', 'README.md'] }));
  const u = make(root);
  await u.startFromArchive(zipOf(PROJECT_FILES), 'x.zip');
  assert.deepEqual(u.status().pendingRemovals, ['old/legacy.js']);
});

test('only one update runs at a time', async () => {
  const u = make(tmpProject(), { runner: () => new Promise((r) => setTimeout(r, 150)) });
  const first = u.startFromArchive(zipOf(PROJECT_FILES), 'a.zip');
  await assert.rejects(u.startFromArchive(zipOf(PROJECT_FILES), 'b.zip'), /уже выполняется/);
  await first;
  assert.equal(u.status().phase, 'ready');
});

// ---- the HTTP route ----
async function withApi(fn) {
  const root = tmpProject();
  const updater = make(root);
  const server = createApp({ webRoot: path.join(__dirname, '..', 'web'), dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'reika-')), updater });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try { await fn(port, updater, root); } finally { await new Promise((r) => server.close(r)); }
}
const post = (port, body, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: '/api/update/from-archive', method: 'POST', headers: { 'content-type': 'application/zip', 'content-length': body.length, ...headers } }, (res) => { let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => resolve({ status: res.statusCode, body: t })); });
  req.on('error', reject); req.end(body);
});

test('POST /api/update/from-archive: accepted, becomes ready; foreign origins and oversized files are refused', () => withApi(async (port, updater) => {
  const zip = zipOf(PROJECT_FILES);
  assert.equal((await post(port, zip, { origin: 'https://evil.example' })).status, 403, 'CSRF');
  const res = await post(port, zip, { 'x-file-name': encodeURIComponent('Рэйка.zip') });
  assert.equal(res.status, 202);
  for (let i = 0; i < 100 && updater.status().phase !== 'ready'; i++) await new Promise((r) => setTimeout(r, 30));
  assert.equal(updater.status().phase, 'ready', updater.status().error);
  assert.match(fs.readFileSync(path.join(updater.root, '.updates', 'ready.json'), 'utf8'), /Рэйка\.zip/);
  const big = await post(port, Buffer.alloc(1000), { 'content-length': 61_000_000 }).catch(() => ({ status: 'closed' }));
  assert.ok([413, 'closed'].includes(big.status), 'declared size above the limit');
}));
