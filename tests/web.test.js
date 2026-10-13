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
  for (const file of ['app.js', 'update.js', 'shell.js', 'orb.js', 'sky.js', 'toast.js', 'palette.js']) {
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
  assert.match(side, /id="update-card"[^>]*hidden/, 'the update block stays hidden until a server answers');
  assert.match(side, /id="nav-update"[\s\S]*>Обновления</);
  const bottom = side.slice(side.indexOf('class="side-bottom"'));
  assert.ok(bottom.includes('id="nav-update"') && bottom.includes('id="side-toggle"') && bottom.indexOf('id="nav-update"') < bottom.indexOf('id="side-toggle"'), 'the update entry sits in the bottom block, above the footer');
  assert.ok(!side.slice(0, side.indexOf('class="side-bottom"')).includes('id="nav-update"'), 'not in the menu list');
  for (const id of ['palette-open', 'about-open', 'presence', 'side-mood', 'update-mini', 'update-install-quick', 'update-news']) assert.ok(side.includes(`id="${id}"`), `#${id} is missing in the menu`);
  assert.ok(!side.includes('id="menu-mode"'));
  assert.ok(!side.includes('id="update-status"'), 'no status text in the menu');
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

test('the supplied logo set is used everywhere: menu, floating logo, favicon and the Windows tray', () => {
  const html = read('index.html');
  const logo = (f) => path.join(web, 'assets', 'logo', f);
  for (const f of ['brand.webp', 'orb.webp', 'logo-256.webp', 'favicon.ico', 'windows.ico']) assert.ok(fs.existsSync(logo(f)), `${f} is missing`);
  for (const f of ['brand.webp', 'orb.webp', 'logo-256.webp', 'favicon.ico']) assert.ok(fs.statSync(logo(f)).size < 60_000, `${f} should stay small`);
  // the images are drawn at 2x their CSS size, so they stay sharp on high-density screens
  assert.match(html, /<img class="logo" src="assets\/logo\/brand\.webp" width="44" height="44"/);
  assert.match(html, /<button id="orb"[^>]*>\s*<img src="assets\/logo\/orb\.webp" width="64" height="64"/);
  assert.match(html, /<link rel="icon" href="assets\/logo\/favicon\.ico" sizes="any">/);
  assert.ok(!/reika-logo|<symbol/.test(html), 'no leftovers of the previous (drawn) logo');
  assert.ok(!fs.existsSync(path.join(web, 'icon.svg')), 'the old drawn icon is gone');
  // windows.ico holds several sizes (an ICO header: reserved=0, type=1, then the image count)
  const ico = fs.readFileSync(logo('windows.ico'));
  assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1); assert.ok(ico.readUInt16LE(4) >= 4, 'several icon sizes');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'launcher', 'start.ps1'), 'utf8'), /assets\\logo\\windows\.ico/, 'the tray uses the icon');
});

test('shell.js does not depend on script load order for the update menu item (a lost event used to hide it)', () => {
  assert.match(read('update.js'), /window\.ReikaUpdaterPresent = true/);
  assert.match(read('update.js'), /window\.ReikaUpdateSummary = /);
  assert.match(read('shell.js'), /if \(window\.ReikaUpdaterPresent\) onUpdaterPresent\(\)/);
  assert.match(read('shell.js'), /if \(window\.ReikaUpdateSummary\) onUpdateSummary\(window\.ReikaUpdateSummary\)/);
});

test('motion is optional: petals and glow respect prefers-reduced-motion', () => {
  assert.match(read('sky.js'), /prefers-reduced-motion: reduce/);
  assert.match(allCss(), /@media \(prefers-reduced-motion: reduce\)/);
});

test('side panel features: quick search, about dialog, toasts, update card states and ZIP upload are wired', () => {
  const html = read('index.html');
  for (const f of ['toast.js', 'update-state.js', 'palette.js']) assert.ok(fs.existsSync(path.join(web, f)) && html.includes(`src="${f}"`), `${f} must exist and be loaded`);
  assert.ok(html.indexOf('update-state.js') < html.indexOf('src="update.js"'), 'update-state.js loads before update.js');
  assert.match(html, /<dialog id="palette"/); assert.match(html, /<dialog id="about-dialog"/); assert.match(html, /id="toasts"[^>]*aria-live/);
  assert.match(html, /id="up-file"[^>]*type="file"[^>]*accept="[^"]*zip/);
  const palette = read('palette.js');
  assert.match(palette, /KeyK/); assert.match(palette, /ArrowDown/); assert.match(palette, /showModal/);
  const update = read('update.js');
  assert.match(update, /api\/update\/from-archive/); assert.match(update, /X-File-Name/); assert.match(update, /ReikaToast/); assert.match(update, /reika\.notified\.v1/);
  assert.match(read('app.js'), /reika:mood/);
  const css = allCss();
  for (const k of ['@keyframes spin', '@keyframes ping', '@keyframes toast-in']) assert.ok(css.includes(k), `${k} is missing`);
  for (const s of ['available', 'busy', 'ready', 'error']) assert.ok(css.includes(`.update-card[data-state="${s}"]`), `update card state ${s} has no style`);
});
