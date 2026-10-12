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
