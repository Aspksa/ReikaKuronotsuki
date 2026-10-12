'use strict';
// Static checks on the project files: encodings (Cyrillic!), launcher format, mobile-readiness.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'runtime', 'data'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}

test('all text sources are valid UTF-8 without replacement characters', () => {
  const exts = new Set(['.js', '.html', '.css', '.json', '.md', '.svg', '.webmanifest', '.ps1', '.bat']);
  const files = walk(root).filter((f) => exts.has(path.extname(f)));
  assert.ok(files.length > 10);
  for (const file of files) {
    const buf = fs.readFileSync(file);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    assert.ok(!text.includes(String.fromCharCode(0xFFFD)), `${path.relative(root, file)} contains U+FFFD`);
  }
});

test('launcher .bat exists, is ASCII-only, uses CRLF and switches to UTF-8', () => {
  const buf = read('Reika Kuronotsuki.bat');
  assert.ok(buf.every((b) => b < 128), 'non-ASCII byte in .bat');
  const text = buf.toString('ascii');
  assert.ok(!/(^|[^\r])\n/.test(text), 'LF-only line ending in .bat');
  assert.match(text, /chcp 65001/);
  assert.match(text, /%~dp0/, 'must use its own folder so it works from any drive');
  assert.match(text, /-Step check/);
  assert.ok(text.indexOf('-Step check') < text.indexOf('-Step run'), 'tests must run before launch');
});

test('PowerShell launcher has a UTF-8 BOM (Windows PowerShell 5.1 reads Cyrillic only then)', () => {
  const buf = read('launcher', 'start.ps1');
  assert.deepEqual([...buf.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
  const text = buf.toString('utf8');
  assert.match(text, /[А-Яа-я]/);
  assert.match(text, /NotifyIcon/);
  assert.match(text, /tests\\run\.js/);
});

test('launcher never uses absolute drive paths (portable on any medium)', () => {
  for (const f of [['Reika Kuronotsuki.bat'], ['launcher', 'start.ps1'], ['server', 'main.js']]) {
    assert.ok(!/\b[A-Z]:\\(?!\\)/.test(read(...f).toString('utf8').replace(/\$env:[A-Z]+/g, '')), `${f.join('/')} has an absolute path`);
  }
});

test('web UI is mobile-ready', () => {
  const html = read('web', 'index.html').toString('utf8');
  assert.match(html, /<meta name="viewport"[^>]*width=device-width/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<meta charset="utf-8">/i);
  assert.match(html, /manifest\.webmanifest/);
  const css = read('web', 'style.css').toString('utf8');
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-bottom/);
  const manifest = JSON.parse(read('web', 'manifest.webmanifest').toString('utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'ru');
});

test('config.json is valid and local-only by default', () => {
  const config = JSON.parse(read('config.json').toString('utf8'));
  assert.equal(config.lan, false);
  assert.ok(Number.isInteger(config.port));
});
