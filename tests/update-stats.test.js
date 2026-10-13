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
test('150 named statistics are present in the browser catalog', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'web', 'update-stats.js'), 'utf8');
  const start = source.indexOf('const groups = ');
  assert.ok(start !== -1);
  const end = source.indexOf(';', start);
  const catalog = JSON.parse(source.slice(start + 'const groups = '.length, end));
  assert.equal(catalog.length, 15);
  assert.equal(catalog.reduce((n,g)=>n+g[1].length,0),150);
  assert.equal(new Set(catalog.flatMap(g=>g[1].map(x=>x[0]))).size, 150);
});

test('statistics live in a separate right column with accessible icon decorations', async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(__dirname, '..', 'web', 'css', 'update.css'), 'utf8');
  const js = await fs.readFile(path.join(__dirname, '..', 'web', 'update-stats.js'), 'utf8');
  assert.match(html, /class="update-columns"/);
  assert.match(html, /class="stats-panel panel"/);
  assert.match(css, /grid-template-columns: minmax\(320px/);
  assert.match(css, /@media \(max-width:\s*1180px\)/);
  assert.match(js, /stats-icon/);
  assert.match(js, /aria-hidden/);
  assert.match(js, /toneFor\(key,index\)/);
  assert.doesNotMatch(html, /100 фактов, которые никто не просил/);
  assert.match(html, /id="up-stats-tabs"/);
  assert.match(html, /id="up-stats-highlights"/);
  assert.match(js, /function sparkline\(/);
  assert.match(css, /stats-explorer/);
  assert.match(css, /stats-content-head/);
  assert.doesNotMatch(html, /100 фактов/);
  assert.match(js, /function activate\(/);
  assert.match(css, /prefers-reduced-motion/);
});

test('new file curiosities reflect actual files, not mock counters', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'reika-curiosities-'));
  try {
    await fs.writeFile(path.join(root,'nothing.txt'),'');
    await fs.writeFile(path.join(root,'SHOUTING_AND_LONG_FILENAME_123456789.js'),'// TODO: fix this\nconsole.log("hello");\n');
    const result=await inspect(root);
    assert.equal(result.emptyFiles,1);
    assert.equal(result.longNames,1);
    assert.equal(result.underscoreNames,1);
    assert.equal(result.uppercaseNames,1);
    assert.equal(result.todoLines,1);
    assert.equal(result.consoleLines,1);
    assert.equal(result.trailingNewlineFiles,1);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('refined dashboard has no redundant headings and supports searching all metrics', async () => {
  const html = await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  const js = await fs.readFile(path.join(__dirname,'..','web','update-stats.js'),'utf8');
  const css = await fs.readFile(path.join(__dirname,'..','web','css','update.css'),'utf8');
  assert.doesNotMatch(html, /<h3>Статистика<\/h3>/);
  assert.doesNotMatch(html, /Состояние проекта/);
  assert.match(html, /id="up-stats-search"/);
  assert.match(js, /function filterMetrics\(/);
  assert.match(js, /search\.addEventListener\('input',filterMetrics\)/);
  assert.match(css, /stats-tile--hero:nth-child\(2\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('dashboard CSS uses one canonical declaration per base selector and breakpoint', async () => {
  const css = await fs.readFile(path.join(__dirname, '..', 'web', 'css', 'update.css'), 'utf8');
  for (const selector of ['.stats-highlights', '.stats-tile--hero', '.stats-live', '.stats-tab[aria-pressed="true"]']) {
    const hits = css.split('\n').filter(line => line.startsWith(selector + ' {'));
    assert.equal(hits.length, 1, selector + ' must have one base declaration');
  }
  assert.equal((css.match(/@media \\(max-width:1180px\\)/g) || []).length, 1);
  assert.doesNotMatch(css, /\\.stats-heading/);
});
