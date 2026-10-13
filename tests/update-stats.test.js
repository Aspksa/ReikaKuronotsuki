'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { collect, inspect } = require('../update/stats');

test('statistics scan excludes user data and maintains project growth baseline', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reika-stats-'));
  try {
    await fs.mkdir(path.join(root, 'data'));
    await fs.writeFile(path.join(root, 'data', 'secret.txt'), 'do not read');
    await fs.writeFile(path.join(root, 'sample.js'), 'const value = 1;\n');
    const updater = { root, status: () => ({ phase:'idle', checks:[], pendingRemovals:[], config:{} }) };
    const first = await collect(updater);
    assert.equal(first.scan.files, 1);
    assert.equal(first.growth.bytes, 0);
    await fs.writeFile(path.join(root, 'another.js'), 'console.log("hello");\n');
    const second = await collect(updater);
    assert.equal(second.growth.files, 1);
    assert.ok(second.growth.bytes > 0);
    assert.equal(second.history.installs, 0);
    assert.equal(second.events.downloadedFiles, 0);
  } finally { await fs.rm(root, { recursive:true, force:true }); }
});
test('100 named statistics are present in the browser catalog', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'web', 'update-stats.js'), 'utf8');
  const start = source.indexOf('const groups = ');
  assert.ok(start !== -1);
  const end = source.indexOf(';', start);
  const catalog = JSON.parse(source.slice(start + 'const groups = '.length, end));
  assert.equal(catalog.length, 10);
  assert.equal(catalog.reduce((n,g)=>n+g[1].length,0),100);
  assert.equal(new Set(catalog.flatMap(g=>g[1].map(x=>x[0]))).size, 100);
});

test('statistics live in a separate right column with accessible icon decorations', async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(__dirname, '..', 'web', 'css', 'update.css'), 'utf8');
  const js = await fs.readFile(path.join(__dirname, '..', 'web', 'update-stats.js'), 'utf8');
  assert.match(html, /class="update-columns"/);
  assert.match(html, /class="stats-panel panel"/);
  assert.match(css, /grid-template-columns: minmax\(320px/);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(js, /stats-icon/);
  assert.match(js, /aria-hidden/);
  assert.match(js, /toneFor\(key,cards.length\)/);
});
