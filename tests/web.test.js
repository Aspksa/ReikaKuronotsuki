'use strict';
// The web build must also work without the server (file://, GitHub Pages, any static host).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const web = path.join(__dirname, '..', 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');
// style.css is only the list of @imports: "the CSS" means all the files it pulls in
const allCss = () => [...read('style.css').matchAll(/@import url\("([^"]+)"\)/g)].map((m) => read(m[1])).join('\n');

test('reika-chat.js runs in a browser-like context and exposes window.ReikaChat', () => {
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('reika-chat.js'), sandbox);
  assert.equal(typeof sandbox.ReikaChat.reply, 'function');
  const answer = sandbox.ReikaChat.reply('Привет!');
  assert.equal(answer.emotion, 'happy');
  assert.match(answer.text, /[А-Яа-яЁё]/);
});

test('browser and server share the same engine', () => {
  const shared = require('../web/reika-chat');
  const core = require('../core/reika-core');
  for (const text of ['привет', 'как дела', 'мне грустно', 'qwerty']) assert.deepEqual(core.reply(text), shared.reply(text));
});

test('the engine uses no Node-only APIs', () => {
  assert.ok(!/require\(|process\.|node:/.test(read('reika-chat.js').replace(/typeof module[^\n]*\n/g, '')));
});

test('page loads the engine before the app and uses relative URLs (works under any sub-path)', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('reika-chat.js') < html.indexOf('app.js'));
  const app = read('app.js');
  assert.ok(!/fetch\(\s*['"`]\//.test(app), 'absolute fetch path would break hosting under a sub-path');
  assert.match(app, /localStorage/);
  assert.match(app, /file:/);
});

test('every file the page references exists', () => {
  const html = read('index.html');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) assert.ok(fs.existsSync(path.join(web, ref)), `${ref} is missing`);
});

test('every element id used by the page scripts exists in index.html (sidebar, orb, chat, update page)', () => {
  const html = read('index.html');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const file of ['app.js', 'update.js', 'shell.js', 'orb.js', 'sky.js']) {
    const code = read(file);
    const used = [...code.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]).concat([...code.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
    for (const id of used) assert.ok(ids.has(id), `${file} uses #${id} but index.html has no such element`);
  }
});

test('left menu: home, chat and (hidden until a server answers) update; no old header menu', () => {
  const html = read('index.html');
  const side = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'));
  assert.match(side, /id="nav-home"/);
  assert.match(side, /id="nav-chat"/);
  assert.match(side, /id="nav-update"[^>]*hidden/);
  assert.match(side, /id="side-toggle"/);
  assert.ok(!/id="menu-btn"|id="menu-update"|id="menu-clear"|id="open-update"/.test(html), 'leftovers of the old dropdown menu');
  assert.ok(html.indexOf('<aside') < html.indexOf('<main'), 'the menu is on the left (before the content)');
  assert.match(allCss(), /\.shell\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-w\)\s+1fr/);
});

test('the chat opens from the floating logo: hidden panel, draggable orb with keyboard and remembered place', () => {
  const html = read('index.html');
  assert.match(html, /<section id="chat-panel"[^>]*hidden/);
  assert.match(html, /<button id="orb"[^>]*aria-controls="chat-panel"[^>]*aria-expanded="false"/);
  for (const id of ['log', 'form', 'input', 'send', 'chat-clear', 'chat-close']) assert.ok(new RegExp(`id="${id}"`).test(html.slice(html.indexOf('id="chat-panel"'), html.indexOf('id="orb"'))), `#${id} must live inside the chat panel`);
  const orb = read('orb.js');
  assert.match(orb, /pointerdown/); assert.match(orb, /setPointerCapture/); assert.match(orb, /ArrowLeft/); assert.match(orb, /localStorage/); assert.match(orb, /Escape/);
  assert.match(allCss(), /\.orb\s*\{[^}]*position:\s*fixed/);
  assert.ok(html.indexOf('orb.js') > html.indexOf('app.js'));
});

test('the home page has no names/titles and no picture; the artwork is only the chat avatar', () => {
  const html = read('index.html');
  const home = html.slice(html.indexOf('id="page-home"'), html.indexOf('id="page-update"'));
  assert.ok(!/<img\b/.test(home), 'no picture on the home page');
  assert.ok(!/eyebrow|class="lead"|class="art/.test(home), 'no visible names or taglines on the home page');
  assert.match(home, /<h1 class="sr">/, 'the page keeps a heading for screen readers only');
  assert.ok(!/assets\/reika\.jpg/.test(html), 'index.html no longer shows the artwork');
  const file = path.join(web, 'assets', 'reika.jpg');
  assert.ok(fs.existsSync(file) && fs.statSync(file).size < 1_500_000, 'the avatar image exists and stays light');
  assert.match(allCss(), /assets\/reika\.jpg/);
});

test('one logo ("Black Moon": eclipse, fox ears, nine tails, red tassel) is used everywhere and the favicon is the same drawing', () => {
  const html = read('index.html');
  const symbol = html.slice(html.indexOf('<symbol id="reika-logo"'), html.indexOf('</symbol>'));
  assert.match(symbol, /data-logo="black-moon-v2"/);
  assert.equal((symbol.match(/transform="rotate\(/g) || []).length, 9, 'nine tails');
  assert.ok(html.includes('class="logo"') && html.includes('<use href="#reika-logo"/>'));
  assert.match(html.slice(html.indexOf('<button id="orb"'), html.indexOf('</button>', html.indexOf('<button id="orb"'))), /#reika-logo/, 'the floating logo uses it');
  assert.match(html.slice(html.indexOf('class="brand"'), html.indexOf('</nav>')), /#reika-logo/, 'the menu brand uses it');
  assert.ok(!/g-moon/.test(html), 'no leftovers of the previous logo');
  const icon = read('icon.svg');
  assert.match(icon, /data-logo="black-moon-v2"/);
  const shapes = (text) => [...text.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(shapes(icon), shapes(symbol), 'icon.svg must be the same drawing as the inline logo');
  assert.match(html, /rel="icon" href="icon\.svg"/);
});

test('motion is optional: petals and glow respect prefers-reduced-motion', () => {
  assert.match(read('sky.js'), /prefers-reduced-motion: reduce/);
  assert.match(allCss(), /@media \(prefers-reduced-motion: reduce\)/);
});
