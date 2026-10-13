'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createApp } = require('../server/server');

const webRoot = path.join(__dirname, '..', 'web');
// Old Reika updaters validate a downloaded tree without installing node_modules.
// The runtime-specific MemOS integration tests must be deferred in that one case,
// otherwise the update which fixes the updater cannot install itself.
const stagedWithoutDependencies = process.env.REIKA_UPDATE_CHECK === '1' &&
  !fs.existsSync(path.join(__dirname, '..', 'node_modules', '@mem-os', 'sdk', 'dist', 'index.js'));


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

test('MemOS is connected directly in the chat pipeline, without an adapter module',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','server','server.js'),'utf8');
 const launcher=fs.readFileSync(path.join(__dirname,'..','launcher','start.ps1'),'utf8');
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));
 assert.equal(pkg.dependencies['@mem-os/sdk'],'file:vendor/memos');
 assert.equal(fs.existsSync(path.join(__dirname,'..','vendor','memos','src','memory.ts')),true);
 assert.equal(fs.existsSync(path.join(__dirname,'..','vendor','memos','LICENSE')),true);
 assert.equal(fs.existsSync(path.join(__dirname,'..','vendor','memos','dist','index.js')),true);
 assert.match(src,/import\('@mem-os\/sdk'\)/);
 assert.match(src,/reika-memory\.sqlite/);
 assert.match(src,/await recall\(text\)/);
 assert.match(src,/await remember\(text\)/);
 assert.match(launcher,/npm-cli\.js/);
});

test('MemOS CRUD and consolidation are available through Reika directly', { skip: stagedWithoutDependencies }, ()=>withServer(async(base)=>{
  const create=await fetch(base+'/api/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'Рэйка любит ночное небо'})});
  assert.equal(create.status,201);
  const created=(await create.json()).memory;
  assert.ok(created.id);
  const list=await (await fetch(base+'/api/memory')).json();
  assert.ok(list.memories.some(x=>x.id===created.id));
  const patch=await fetch(base+'/api/memory/'+encodeURIComponent(created.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'Рэйка любит лунный свет'})});
  assert.equal(patch.status,200);
  const consolidate=await fetch(base+'/api/memory/consolidate',{method:'POST'});
  assert.equal(consolidate.status,200);
  const remove=await fetch(base+'/api/memory/'+encodeURIComponent(created.id),{method:'DELETE'});
  assert.equal(remove.status,200);
  assert.equal((await remove.json()).deleted,true);
}));

test('portable Windows launcher upgrades existing npm MemOS to bundled source',()=>{
 const script=fs.readFileSync(path.join(__dirname,'..','launcher','start.ps1'),'utf8');
 assert.match(script,/memos-vendored-installed\.txt/);
 assert.match(script,/REIKA_UPSTREAM\.txt/);
 assert.match(script,/\$currentStamp -ne \$requiredStamp/);
 assert.match(script,/Set-Content -LiteralPath \$installedStamp/);
});

test('full backup saves and restores MemOS records, not only chat JSON', { skip: stagedWithoutDependencies }, ()=>withServer(async(base)=>{
  const jsonHeaders={'Content-Type':'application/json'};
  const create=async content=> {
    const res=await fetch(base+'/api/memory',{method:'POST',headers:jsonHeaders,body:JSON.stringify({content})});
    assert.equal(res.status,201);
    return (await res.json()).memory;
  };
  const first=await create('Секретная любимая звезда: Вега');
  const exported=await fetch(base+'/api/backup');
  assert.equal(exported.status,200);
  const backup=await exported.json();
  assert.equal(backup.version,2);
  assert.ok(backup.memory.nodes.some(x=>x.id===first.id));
  assert.ok(Array.isArray(backup.memory.edges));
  const temporary=await create('Это временный факт, который удалится при восстановлении');
  const restore=await fetch(base+'/api/backup',{method:'POST',headers:jsonHeaders,body:JSON.stringify(backup)});
  assert.equal(restore.status,200,JSON.stringify(await restore.clone().json()));
  assert.equal((await restore.json()).memoryRestored,true);
  const current=(await (await fetch(base+'/api/memory')).json()).memories;
  assert.ok(current.some(x=>x.id===first.id));
  assert.equal(current.some(x=>x.id===temporary.id),false);
  const corrupted={...backup,memory:{nodes:backup.memory.nodes,edges:[{sourceId:'missing',targetId:first.id,relation:'relates_to',weight:0.5}]}};
  const rejected=await fetch(base+'/api/backup',{method:'POST',headers:jsonHeaders,body:JSON.stringify(corrupted)});
  assert.equal(rejected.status,400);
  assert.ok((await (await fetch(base+'/api/memory')).json()).memories.some(x=>x.id===first.id));
}));

test('MemOS bundled CLI has Russian help and translated memory errors without renaming API', { skip: stagedWithoutDependencies }, ()=>{
 const {spawnSync}=require('node:child_process');
 const root=path.join(__dirname,'..');
 const cli=path.join(root,'vendor','memos','dist','cli.js');
 const help=spawnSync(process.execPath,[cli,'--help'],{cwd:root,encoding:'utf8',timeout:15000});
 assert.equal(help.status,0,help.stderr);
 assert.match(help.stdout,/Использование:/);
 assert.match(help.stdout,/Команды:/);
 assert.match(help.stdout,/Сохранить новое воспоминание/);
 const ts=fs.readFileSync(path.join(root,'vendor','memos','src','memory.ts'),'utf8');
 const built=fs.readFileSync(path.join(root,'vendor','memos','dist','memory.js'),'utf8');
 assert.match(ts,/Узел памяти не найден/);
 assert.match(built,/Узел памяти не найден/);
 assert.match(ts,/async store\(/);
});

test('memory controls live inside chat and use the existing MemOS API', async () => withServer(async (base) => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /id="memory-open"/);
  assert.match(html, /id="memory-panel"/);
  assert.match(html, /id="memory-search"/);
  assert.match(html, /id="memory-consolidate"/);
  assert.match(html, /src="memory-ui.js"/);
  assert.doesNotMatch(html, /data-route="memory"/);
  const jsResponse = await fetch(base + '/memory-ui.js');
  assert.equal(jsResponse.status, 200);
  const script = await jsResponse.text();
  for (const action of ["api/memory", "PATCH", "DELETE", "consolidate"]) assert.ok(script.includes(action));
  assert.match(script, /textContent = memory.content/);
  const cssResponse = await fetch(base + '/css/memory.css');
  assert.equal(cssResponse.status, 200);
  assert.match(await cssResponse.text(), /memory-panel\[hidden\]/);
}));
