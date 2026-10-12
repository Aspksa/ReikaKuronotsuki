'use strict';
// The web build must also work without the server (file://, GitHub Pages, any static host).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const web = path.join(__dirname, '..', 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');

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
  for (const file of ['app.js', 'update.js', 'shell.js', 'orb.js']) {
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
  assert.match(read('style.css'), /\.shell\s*\{[^}]*grid-template-columns:\s*var\(--sidebar\)\s+1fr/);
});

test('the chat opens from the floating logo: hidden panel, draggable orb with keyboard and remembered place', () => {
  const html = read('index.html');
  assert.match(html, /<section id="chat-panel"[^>]*hidden/);
  assert.match(html, /<button id="orb"[^>]*aria-controls="chat-panel"[^>]*aria-expanded="false"/);
  for (const id of ['log', 'form', 'input', 'send', 'chat-clear', 'chat-close']) assert.ok(new RegExp(`id="${id}"`).test(html.slice(html.indexOf('id="chat-panel"'), html.indexOf('id="orb"'))), `#${id} must live inside the chat panel`);
  const orb = read('orb.js');
  assert.match(orb, /pointerdown/); assert.match(orb, /setPointerCapture/); assert.match(orb, /ArrowLeft/); assert.match(orb, /localStorage/); assert.match(orb, /Escape/);
  assert.match(read('style.css'), /\.orb\s*\{[^}]*position:\s*fixed/);
  assert.ok(html.indexOf('orb.js') > html.indexOf('app.js'));
});

test('the artwork used by the home page and the chat avatar exists and is a reasonable size', () => {
  const file = path.join(web, 'assets', 'reika.jpg');
  assert.ok(fs.existsSync(file));
  assert.ok(fs.statSync(file).size < 1_500_000, 'keep the repository light');
  assert.match(read('index.html'), /assets\/reika\.jpg/);
  assert.match(read('style.css'), /assets\/reika\.jpg/);
});

test('motion is optional: petals and glow respect prefers-reduced-motion', () => {
  assert.match(read('shell.js'), /prefers-reduced-motion: reduce/);
  assert.match(read('style.css'), /@media \(prefers-reduced-motion: reduce\)/);
});
