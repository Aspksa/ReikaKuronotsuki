'use strict';
// The design system's rules (see DESIGN.md): tokens are the only source of colours and sizes, nothing refers to an
// undefined token, layers and motion follow the shared scales, text stays readable, the style guide cannot drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');
const imports = [...read('style.css').matchAll(/@import url\("([^"]+)"\)/g)].map((m) => m[1]);
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const files = Object.fromEntries(imports.map((f) => [f, strip(read(f))]));
const tokens = files['css/tokens.css'];

test('style.css imports every stylesheet in order, tokens first, and every file exists', () => {
  assert.equal(imports[0], 'css/tokens.css');
  assert.equal(imports[1], 'css/base.css');
  for (const f of imports) assert.ok(fs.existsSync(path.join(web, f)), `${f} is imported but missing`);
  const onDisk = fs.readdirSync(path.join(web, 'css')).map((f) => `css/${f}`).sort();
  assert.deepEqual([...imports].sort(), onDisk, 'a stylesheet exists that style.css does not import (or the reverse)');
  assert.match(fs.readFileSync(path.join(web, 'index.html'), 'utf8'), /<link rel="stylesheet" href="style\.css">/);
});

test('raw colours live in tokens.css only (no #hex elsewhere; rgb() literals only in the sky scene)', () => {
  for (const [file, css] of Object.entries(files)) {
    if (file === 'css/tokens.css') continue;
    const noUrls = css.replace(/url\([^)]*\)/g, '');
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(noUrls), `${file}: raw hex colour (use a token)`);
    if (file !== 'css/sky.css') assert.ok(!/rgba?\(\s*\d/.test(noUrls), `${file}: literal rgb() (use rgb(var(--…-rgb) / α))`);
  }
});

test('every var(--token) used is defined in CSS or set by a script', () => {
  const defined = new Set();
  for (const css of Object.values(files)) for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
  const setByScripts = new Set(['--px', '--py', '--lx', '--ly', '--lit', '--s', '--c', '--d', '--delay', '--size', '--sway']);
  for (const [file, css] of Object.entries(files)) {
    for (const m of css.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(m[1]) || setByScripts.has(m[1]), `${file} uses ${m[1]} which nothing defines`);
  }
});

test('stacking uses the z-index scale', () => {
  for (const [file, css] of Object.entries(files)) {
    if (file === 'css/tokens.css') continue;
    for (const m of css.matchAll(/z-index:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^var\(--z-[a-z]+\)$/, `${file}: z-index ${m[1].trim()}`);
  }
});

test('every animation is declared with @keyframes and one rule switches all motion off for "reduced motion"', () => {
  const css = Object.values(files).join('\n');
  const declared = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const used = new Set();
  for (const m of css.matchAll(/animation(?:-name)?:\s*([^;}]+)/g)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+/).find((w) => /^[a-z][\w-]*$/.test(w) && !/^(linear|infinite|forwards|ease|ease-in-out|ease-out|alternate|none)$/.test(w) && !/^(var)$/.test(w)); if (n) used.add(n); }
  for (const name of used) assert.ok(declared.has(name), `animation "${name}" has no @keyframes`);
  assert.match(files['css/base.css'], /prefers-reduced-motion: reduce\)\s*\{[^}]*animation:\s*none\s*!important[^}]*transition:\s*none\s*!important/);
});

test('--orb-size equals the orb size used by orb.js', () => {
  const size = Number(/--orb-size:\s*(\d+)px/.exec(tokens)[1]);
  assert.equal(size, Number(/const SIZE = (\d+)/.exec(read('orb.js'))[1]));
});

// WCAG contrast of the main text/background pairs
const hex = (name) => { const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens); assert.ok(m, `token ${name}`); return m[1]; };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test('text stays readable: contrast of the main pairs is at least 4.5:1', () => {
  const pairs = [['--pearl', '--night-900'], ['--muted', '--night-900'], ['--faint', '--night-900'], ['--gold', '--night-900'], ['--blush', '--night-900'], ['--warn', '--night-900'],
    ['--pearl', '--crimson-lo'], ['--pearl', '--crimson-hi'], ['--gold-ink', '--gold-hi'], ['--gold-ink', '--gold-lo'], ['--pearl', '--night-700']];
  for (const [fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
});

test('the night scene has all its layers, the moon asset is light, and the pointer light is wired', () => {
  const html = read('index.html');
  for (const cls of ['sky-stars', 'moon-stage', 'moon-glow', 'moon-rays', 'moon-halo', 'moon-disc', 'moon-bloom', 'cloud cloud--a', 'sky-water', 'moon-path', 'mist', 'sky-vignette']) assert.ok(html.includes(`class="${cls}"`), `layer ${cls}`);
  const moon = path.join(web, 'assets', 'moon.webp');
  assert.ok(fs.existsSync(moon) && fs.statSync(moon).size < 400_000);
  assert.match(files['css/sky.css'], /assets\/moon\.webp/);
  assert.ok((html.match(/\blit\b/g) || []).length >= 6, 'cards, panel, chat and menu items use the "lit" light');
  assert.match(read('sky.js'), /--lx/);
  assert.match(files['css/components.css'], /\.lit::before/);
});

test('the style guide uses the same stylesheet and shows every component', () => {
  const guide = read('styleguide.html');
  assert.match(guide, /<link rel="stylesheet" href="style\.css">/);
  for (const cls of ['btn btn--primary', 'btn btn--gold', 'btn btn--outline', 'btn btn--ghost', 'btn btn--icon', 'card lit', 'panel lit', 'field', 'form-row', 'msg reika', 'msg user', 'bar']) assert.ok(guide.includes(cls), `style guide lacks ${cls}`);
  // every component class defined in components.css has an example
  for (const m of files['css/components.css'].matchAll(/^\.((?:btn--)?[a-z]+(?:--[a-z]+)?)\b/gm)) {
    const cls = m[1];
    if (['lit', 'bar'].includes(cls)) continue;
    assert.ok(guide.includes(cls), `components.css defines .${cls} but styleguide.html never shows it`);
  }
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'DESIGN.md')));
});
