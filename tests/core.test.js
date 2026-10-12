'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../core/reika-core');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reika-'));

test('normalizeText trims, strips control chars and limits length', () => {
  assert.equal(core.normalizeText('  привет\u0000\u0007  '), 'привет');
  assert.equal(core.normalizeText(42), '');
  assert.equal(core.normalizeText('а'.repeat(5000)).length, core.MAX_TEXT);
});

test('normalizeText composes decomposed Cyrillic (й, ё) to NFC', () => {
  const decomposed = 'йё'.normalize('NFD');
  assert.equal(core.normalizeText(decomposed), 'йё'.normalize('NFC'));
});

test('Russian matching works for upper case and ё', () => {
  assert.equal(core.reply('ПРИВЕТ!').rule, 'greeting');
  assert.equal(core.reply('Расскажи про ХВОСТЫ').rule, 'tails');
  assert.equal(core.reply('Мне грустно').emotion, 'sad');
  assert.equal(core.reply('Сколько времени?', { now: new Date('2026-01-02T03:04:00Z') }).rule, 'time');
});

test('replies are deterministic and always Russian text', () => {
  const a = core.reply('расскажи что-нибудь');
  const b = core.reply('расскажи что-нибудь');
  assert.deepEqual(a, b);
  assert.match(a.text, /[А-Яа-яЁё]/);
});

test('empty input gets a gentle reply', () => {
  assert.equal(core.reply('   ').rule, 'empty');
});

test('detectEmotion defaults to neutral', () => {
  assert.equal(core.detectEmotion('qwerty'), 'neutral');
});

test('store round-trips Cyrillic and emoji through disk', () => {
  const dir = tmp();
  const store = core.createStore(dir);
  store.add('user', 'Привет, Рэйка! 🦊 ёЁйЙ', 'happy');
  const again = core.createStore(dir);
  assert.equal(again.all()[0].text, 'Привет, Рэйка! 🦊 ёЁйЙ');
  assert.ok(!fs.readFileSync(store.file).includes(0xEF) || !fs.readFileSync(store.file).slice(0, 3).equals(Buffer.from([0xEF, 0xBB, 0xBF])), 'no BOM');
});

test('store works in a folder with Cyrillic and spaces in its name', () => {
  const dir = path.join(tmp(), 'Папка Рэйки 日本');
  const store = core.createStore(dir);
  store.add('user', 'тест', 'neutral');
  assert.equal(core.createStore(dir).all().length, 1);
});

test('corrupted history is set aside, not crashed on', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'history.json'), '{ broken', 'utf8');
  const store = core.createStore(dir);
  assert.deepEqual(store.all(), []);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('history.json.broken-')));
  store.add('user', 'после сбоя');
  assert.equal(core.createStore(dir).all().length, 1);
});

test('history is capped', () => {
  const dir = tmp();
  const store = core.createStore(dir);
  for (let i = 0; i < core.MAX_HISTORY + 5; i++) store.add('user', `м${i}`);
  assert.equal(store.all().length, core.MAX_HISTORY);
});

test('resolveDataDir prefers <project>/data and honours REIKA_DATA_DIR', () => {
  const root = tmp();
  assert.equal(core.resolveDataDir(root, {}), path.join(root, 'data'));
  const custom = path.join(tmp(), 'свои данные');
  assert.equal(core.resolveDataDir(root, { REIKA_DATA_DIR: custom }), custom);
});

test('resolveDataDir falls back to the user profile when the project folder is read-only', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'data'), 'a file blocks creating the directory');
  const profile = tmp();
  const dir = core.resolveDataDir(root, { LOCALAPPDATA: profile });
  assert.equal(dir, path.join(profile, 'ReikaKuronotsuki'));
});
