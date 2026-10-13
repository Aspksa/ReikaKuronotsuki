'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { collect, inspect, readSamples, cachedInspect, findAnomalies, gitDiff } = require('../update/stats');
const metricsDb = require('../update/metrics-db');

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

test('statistics are their own section below the update controls, with accessible icon decorations', async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(__dirname, '..', 'web', 'css', 'stats.css'), 'utf8');
  const js = await fs.readFile(path.join(__dirname, '..', 'web', 'update-stats.js'), 'utf8');
  assert.match(html, /class="up-cards"/);
  assert.match(html, /class="stats-panel"/);
  assert.ok(html.indexOf('class="up-hero') < html.indexOf('class="stats-panel"'), 'update controls come first, statistics below');
  assert.match(css, /@media \(max-width:\s*1100px\)/);
  assert.match(js, /stats-icon/);
  assert.match(js, /aria-hidden/);
  assert.match(js, /V\.tone\(g,i,key\)/);
  assert.doesNotMatch(html, /100 фактов, которые никто не просил/);
  assert.match(html, /id="up-stats-tabs"/);
  assert.match(html, /id="up-stats-highlights"/);
  assert.match(js, /V\.chart\(c\.kind/);
  assert.match(css, /stats-explorer/);
  assert.match(css, /stats-content-head/);
  assert.doesNotMatch(html, /100 фактов/);
  assert.match(js, /function activate\(/);
  assert.match(await fs.readFile(path.join(__dirname, '..', 'web', 'css', 'base.css'), 'utf8'), /prefers-reduced-motion/);
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
  const css = await fs.readFile(path.join(__dirname,'..','web','css','stats.css'),'utf8');
  assert.doesNotMatch(html, /<h3>Статистика<\/h3>/);
  assert.doesNotMatch(html, /Состояние проекта/);
  assert.doesNotMatch(html, /id="up-stats-search"/);
  assert.doesNotMatch(js, /function filterMetrics\(/);
  assert.doesNotMatch(js, /search\.addEventListener\('input',filterMetrics\)/);
  assert.match(css, /stats-tile--hero:nth-child\(2\)/);
});

test('dashboard CSS uses one canonical declaration per base selector and breakpoint', async () => {
  const css = await fs.readFile(path.join(__dirname, '..', 'web', 'css', 'stats.css'), 'utf8');
  for (const selector of ['.stats-highlights', '.stats-tile--hero', '.stats-live', '.stats-tab[aria-pressed="true"]']) {
    const hits = css.split('\n').filter(line => line.startsWith(selector + ' {'));
    assert.equal(hits.length, 1, selector + ' must have one base declaration');
  }
  assert.equal((css.match(/@media \(max-width: 1100px\)/g) || []).length, 1);
  assert.doesNotMatch(css, /\.stats-heading/);
});

test('metric history stays on disk and repeated requests reuse scans', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reika-metric-history-'));
  try {
    await fs.writeFile(path.join(root,'before.js'),'const n=1;\n');
    const updater={root,status:()=>({phase:'idle',checks:[],pendingRemovals:[],config:{}})};
    const a=await collect(updater);
    const b=await collect(updater);
    assert.ok(Array.isArray(a.samples));
    assert.equal(b.samples.length,1);
    assert.equal((await readSamples(root)).length,1);
    assert.equal(a.samples[0].bytes,b.samples[0].bytes);
    const cached=await cachedInspect(root);
    assert.equal(cached.bytes,a.scan.bytes);
    assert.equal(a.versionComparison.baseline,'earliest-recorded-sample');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('comparison and findings are based on persisted samples', async () => {
  const html=await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  const js=await fs.readFile(path.join(__dirname,'..','web','update-stats.js'),'utf8');
  assert.doesNotMatch(html,/up-stats-comparison/);
  assert.doesNotMatch(html,/up-stats-insights/);
  assert.match(js,/replaySamples\(data\)/);
  assert.doesNotMatch(js,/function showContext\(data\)/);
});

test('dashboard provides hour, day and week histories with truthful trend context', async () => {
  const html=await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  const script=await fs.readFile(path.join(__dirname,'..','web','update-stats.js'),'utf8');
  assert.match(html,/id="up-stats-period"/);
  for(const ms of ['3600000','86400000','604800000'])assert.ok(html.includes('value="'+ms+'"'));
  assert.match(script,/const cutoff=now-Number\(period.value\)/);
  assert.doesNotMatch(script,/Размер проекта:/);
  assert.doesNotMatch(script,/С прошлой записанной версии/);
});

test('anomaly warnings require six real observations and a material departure', () => {
  assert.deepEqual(findAnomalies([{rss:100},{rss:100}]),[]);
  const rows=[100,101,100,100,99,150].map((rss,i)=>({at:1000+i*60000,rss,bytes:500,freeDiskBytes:1000,failures:0}));
  const alerts=findAnomalies(rows);
  assert.equal(alerts.length,1);
  assert.equal(alerts[0].key,'rss');
  assert.ok(alerts[0].changePercent>25);
  assert.equal(gitDiff(path.join(os.tmpdir(),'reika-git-nonexistent-'+Date.now())),null);
});
test('new metric interactions expose keyboard-accessible controls and dialog', async () => {
  const html=await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  const js=await fs.readFile(path.join(__dirname,'..','web','update-stats.js'),'utf8');
  const css=await fs.readFile(path.join(__dirname,'..','web','css','stats.css'),'utf8');
  for(const id of ['up-stats-detail','up-stats-detail-close'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(js,/function openDetail\(/);
  assert.match(js,/showModal\(\)/);
  assert.match(css,/\.stats-detail::backdrop/);
  assert.match(css,/\.stats-open:focus-visible/);
});

test('crimson dashboard retains usable controls and mobile accessibility', async () => {
  const css=await fs.readFile(path.join(__dirname,'..','web','css','stats.css'),'utf8');
  const html=await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  assert.match(css,/\.stats-tile:focus-within/);
  assert.match(css,/\.stats-tab\[aria-pressed="true"\]/);
  assert.match(css,/\.stats-open:focus-visible/);
  assert.match(css,/@media \(max-width: 780px\)/);
  for(const id of ['up-stats-period','up-stats-detail'])assert.ok(html.includes('id="'+id+'"'));
  assert.doesNotMatch(html, /<h3>Статистика<\/h3>/);
});

test('every metric has a distinct value source and removed controls cannot return', async () => {
  const js=await fs.readFile(path.join(__dirname,'..','web','update-stats.js'),'utf8');
  const html=await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  const css=await fs.readFile(path.join(__dirname,'..','web','css','stats.css'),'utf8');
  const begin=js.indexOf('const groups = '),end=js.indexOf(';',begin);
  const groups=JSON.parse(js.slice(begin+'const groups = '.length,end));
  const keys=groups.flatMap(g=>g[1].map(x=>x[1]));
  assert.equal(keys.length,150);
  assert.equal(new Set(keys).size,150);
  for(const word of ['up-stats-search','up-stats-favorites-toggle','up-stats-favorites-count','stats-star','toggleFavorite','favoriteStore']){
    assert.equal(js.includes(word),false,word);
    assert.equal(html.includes(word),false,word);
    assert.equal(css.includes(word),false,word);
  }
  assert.ok(keys.includes('derived.avgNameBytes'));
  assert.ok(keys.includes('derived.filesPerDirectory'));
});

test('dashboard data lives in dedicated SQLite without touching primary user data', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'reika-metrics-sqlite-'));
  try {
    const data=path.join(root,'data');
    await fs.mkdir(data);
    await fs.writeFile(path.join(data,'chat.json'),'untouched');
    await fs.writeFile(path.join(root,'hello.js'),'const value=1;\n');
    const updater={root,status:()=>({phase:'idle',checks:[],pendingRemovals:[],config:{}})};
    const result=await collect(updater);
    const database=path.join(root,'.updates','metrics.sqlite');
    const bytes=await fs.readFile(database);
    assert.equal(bytes.subarray(0,16).toString('utf8'),'SQLite format 3\0');
    assert.equal((await fs.readFile(path.join(data,'chat.json'),'utf8')),'untouched');
    assert.equal(result.samples.length,1);
    assert.equal((await readSamples(root)).length,1);
    assert.equal(await fs.stat(path.join(root,'.updates','metric-samples.json')).then(()=>true,()=>false),false);
    assert.equal(await fs.stat(path.join(root,'.updates','stats-baseline.json')).then(()=>true,()=>false),false);
  }finally {metricsDb.close(root);await fs.rm(root,{recursive:true,force:true});}
});
test('existing metric history migrates once and the SQLite timeline stays bounded', async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'reika-metrics-legacy-'));
  try{
    await fs.mkdir(path.join(root,'.updates'));
    const initial={at:Date.now()-120000,bytes:5,files:1,lines:2,version:'old'};
    await fs.writeFile(path.join(root,'.updates','metric-samples.json'),JSON.stringify([initial]));
    await fs.writeFile(path.join(root,'.updates','stats-baseline.json'),JSON.stringify({bytes:5,files:1,lines:2,at:initial.at}));
    const values=metricsDb.readSamples(root);
    assert.equal(values.length,1);
    assert.equal(values[0].bytes,5);
    const baseline=metricsDb.getBaseline(root,{bytes:10,files:2,lines:5});
    assert.equal(baseline.bytes,5);
    metricsDb.appendSample(root,{at:Date.now(),bytes:11,files:3,lines:6});
    assert.equal(metricsDb.readSamples(root).length,2);
    metricsDb.close(root);
    assert.equal(metricsDb.readSamples(root).length,2);
  }finally{metricsDb.close(root);await fs.rm(root,{recursive:true,force:true});}
});

test('dashboard does not show verbose diagnostics or automatic commentary',async()=>{
  const html=await fs.readFile(path.join(__dirname,'..','web','index.html'),'utf8');
  const js=await fs.readFile(path.join(__dirname,'..','web','update-stats.js'),'utf8');
  for(const term of ['up-stats-note','up-stats-comparison','up-stats-gitdiff','up-stats-alerts','up-stats-insights','Антон Александрович']){
    assert.equal(html.includes(term),false,term);
    assert.equal(js.includes(term),false,term);
  }
  assert.doesNotMatch(js,/Необычных изменений пока не обнаружено/);
  assert.match(html,/up-stats-highlights/);
});

test('Windows launcher rejects pre-22.13 portable Node without SQLite and upgrades it',async()=>{
  const ps=await fs.readFile(path.join(__dirname,'..','launcher','start.ps1'),'utf8');
  assert.match(ps,/\$nodeVersion = 'v22\.16\.0'/);
  assert.match(ps,/function Test-NodeRuntime/);
  assert.match(ps,/\[version\]'22\.13\.0'/);
  assert.match(ps,/Test-NodeRuntime -Candidate \$local/);
  assert.match(ps,/Install-PortableNode/);
});
