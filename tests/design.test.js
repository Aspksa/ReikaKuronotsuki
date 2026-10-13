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

test('raw colours live in tokens.css only (no #hex elsewhere; rgb() literals only in the background layer)', () => {
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
  const setByScripts = new Set(['--size', '--sway', '--tone']);
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

test('the night scene (moon, sky, stars, clouds, sea) is gone; only petals and the vignette remain; no pointer light', () => {
  const html = read('index.html');
  const sky = html.slice(html.indexOf('<div class="sky"'), html.indexOf('</div>', html.indexOf('class="sky-vignette"')) + 6);
  assert.match(sky, /id="petals"/);
  assert.match(sky, /class="sky-vignette"/);
  assert.ok(!/moon|star|cloud|sparkle|wave|water|mist|horizon|ripple/.test(sky + files['css/sky.css'].replace(/\/\*[\s\S]*?\*\//g, '')), 'scene leftovers in the markup or sky.css');
  assert.ok(!fs.existsSync(path.join(web, 'assets', 'scene')), 'scene images are removed');
  assert.ok(!fs.existsSync(path.join(web, 'assets', 'moon.webp')));
  const js = read('sky.js');
  assert.ok(!/moon|ripple|sparkle|shooting|'stars'|water/.test(js), 'scene code left in sky.js');
  assert.match(js, /className = 'petal'/);
  assert.ok(!/--lx|pointermove/.test(js), 'no light that follows the pointer');
  assert.match(files['css/sky.css'], /\.sky \{[^}]*background: var\(--bg\)/, 'a plain dark backdrop');
  assert.ok(!/lit/.test(html), 'no "lit" surfaces');
  assert.ok(!/\.lit\b/.test(Object.values(files).join('')), 'no .lit rules left');
  assert.ok(!/--moon-/.test(Object.values(files).join('')), 'no moon tokens are left');
});

test('the background markup is identical on the main page and in the style guide (no drift)', () => {
  const sky = (f) => { const h = read(f); const a = h.indexOf('<div class="sky"'); return h.slice(a, h.indexOf('</div>', h.indexOf('class="sky-vignette"')) + 6).replace(/\s+/g, ' '); };
  assert.equal(sky('styleguide.html'), sky('index.html'));
});

test('the style guide uses the same stylesheet and shows every component', () => {
  const guide = read('styleguide.html');
  assert.match(guide, /<link rel="stylesheet" href="style\.css">/);
  for (const cls of ['btn btn--primary', 'btn btn--gold', 'btn btn--outline', 'btn btn--ghost', 'btn btn--icon', 'card', 'panel', 'field', 'form-row', 'msg reika', 'msg user', 'bar']) assert.ok(guide.includes(cls), `style guide lacks ${cls}`);
  // every component class defined in components.css has an example
  for (const m of files['css/components.css'].matchAll(/^\.((?:btn--)?[a-z]+(?:--[a-z]+)?)\b/gm)) {
    const cls = m[1];
    if (['bar'].includes(cls)) continue;
    assert.ok(guide.includes(cls), `components.css defines .${cls} but styleguide.html never shows it`);
  }
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'DESIGN.md')));
});
