'use strict';
// The look of the statistics: every metric has a fitting icon, its own colour and a diagram of a kind that suits it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../web/stats-visual.js');

const catalog = require('../web/stats-catalog.js');
const metrics = catalog.sections.flatMap((sec, g) => { let i = 0; return sec.groups.flatMap((grp) => grp.items.map(([label, key, unit]) => ({ label, key, unit, g, i: i++ }))); });

test('there are 150 metrics and every one gets an icon that exists', () => {
  assert.equal(metrics.length, 150);
  for (const m of metrics) {
    const name = V.iconName(m.key, m.unit);
    assert.ok(V.ICONS[name], `${m.key}: icon "${name}" does not exist`);
    assert.match(V.iconSvg(name), /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  }
});

test('icons match what the metric is about', () => {
  const icon = (key, unit = 'number') => V.iconName(key, unit);
  assert.equal(icon('uptimeMs', 'duration'), 'clock');
  assert.equal(icon('scan.css'), 'palette');
  assert.equal(icon('scan.images'), 'image');
  assert.equal(icon('history.failures'), 'warning');
  assert.equal(icon('history.rollbacks'), 'undo');
  assert.equal(icon('git.authors'), 'users');
  assert.equal(icon('memoryRss', 'bytes'), 'memory');
  assert.equal(icon('cores'), 'cpu');
  assert.equal(icon('scan.consoleLines'), 'terminal');
  assert.equal(icon('scan.importLines'), 'link');
  assert.equal(icon('status.latest.ci', 'text'), 'shield');
  assert.equal(icon('someNewMetric', 'bytes'), 'disk', 'unknown metrics fall back by unit');
  assert.ok(new Set(metrics.map((m) => V.iconName(m.key, m.unit))).size >= 30, 'many different icons are in use');
});

test('every metric has its own colour, calm and readable on the dark background', () => {
  const colors = metrics.map((m) => V.tone(m.g, m.i, m.key).color);
  assert.equal(new Set(colors).size, 150, 'all 150 colours are different');
  for (const c of colors) {
    const [, l, chroma] = /^oklch\(([\d.]+) ([\d.]+) [\d.]+\)$/.exec(c).map(Number);
    assert.ok(l >= 0.7 && l <= 0.85, `lightness ${l}: bright enough to read, not glaring`);
    assert.ok(chroma <= 0.12, `chroma ${chroma}: calm, not neon`);
  }
  assert.match(V.groupColor(0), /^oklch\(/);
});

test('metrics get different kinds of diagrams that fit their meaning', () => {
  const kinds = {};
  for (const m of metrics) { const k = V.chartKind(m.key, m.unit); assert.ok(V.KINDS.includes(k)); kinds[k] = (kinds[k] || 0) + 1; }
  assert.ok(Object.keys(kinds).length >= 11, 'at least eleven kinds are used: ' + JSON.stringify(kinds));
  assert.ok(Math.max(...Object.values(kinds)) <= 40, 'no single kind dominates');
  assert.equal(V.chartKind('scan.bytes', 'bytes'), 'area');
  assert.equal(V.chartKind('history.installs', 'number'), 'bars');
  assert.equal(V.chartKind('derived.jsRatio', 'percent'), 'gauge');
  assert.equal(V.chartKind('derived.blocked', 'yesno'), 'toggle');
  assert.equal(V.chartKind('node', 'text'), 'chip');
  assert.equal(V.chartKind('history.lastInstall', 'date'), 'age');
  assert.equal(V.chartKind('growth.bytes', 'bytes'), 'compare');
  assert.equal(V.chartKind('scan.js', 'number'), 'share');
  assert.equal(V.shareTotalKey('scan.js'), 'scan.files');
  assert.equal(V.chartKind('derived.filesPerDirectory', 'number'), 'scale');
  assert.equal(V.chartKind('history.rollbacks', 'number'), 'pips');
});

test('every diagram renders real markup, never NaN, and shows an empty outline when there is no data', () => {
  const full = { value: 7, unit: 'number', series: [1, 3, 2, 5, 4], baseline: 100, total: 20, ageMs: 5_000_000, text: 'ok' };
  for (const kind of V.KINDS) {
    const out = V.chart(kind, full);
    assert.ok(out.length > 20, kind);
    assert.ok(!/NaN|undefined|Infinity|null/.test(out), `${kind}: ${out}`);
    const none = V.chart(kind, { value: null, unit: 'number', series: [], baseline: null, total: null, ageMs: null, text: null });
    assert.ok(!/NaN|undefined|Infinity/.test(none), `${kind} without data`);
  }
  assert.match(V.chart('area', { series: [] }), /viz-off/, 'no history: an empty outline, not an invented line');
  assert.match(V.chart('area', { series: [1, 2, 3] }), /<polyline/);
});

test('diagrams tell the truth: pips count exactly, gauges clamp, text is escaped', () => {
  assert.equal((V.chart('pips', { value: 3 }).match(/viz-on/g) || []).length, 3);
  assert.equal((V.chart('pips', { value: 0 }).match(/viz-on/g) || []).length, 0);
  assert.match(V.chart('pips', { value: 25 }), /viz-plus/);
  assert.match(V.chart('gauge', { value: 250 }), /stroke-dasharray="100 100"/);
  assert.match(V.chart('gauge', { value: -5 }), /stroke-dasharray="0 100"/);
  assert.equal((V.chart('meter', { value: 50 }).match(/viz-on/g) || []).length, 10);
  assert.match(V.chart('share', { value: 5, total: 20 }), /5 из 20/);
  assert.match(V.chart('toggle', { value: true }), /cx="74"/);
  assert.match(V.chart('toggle', { value: false }), /cx="46"/);
  assert.match(V.chart('age', { ageMs: 2 * 3600_000 }), /24 часа/);
  assert.match(V.chart('age', { ageMs: 3 * 86400_000 }), /7 дней/);
  assert.equal((V.chart('signal', { value: 5_000_000, unit: 'bytes' }).match(/viz-on/g) || []).length, 3, '5 MB = third step (Б, КБ, МБ)');
  assert.ok(!V.chart('chip', { text: '<img src=x onerror=alert(1)>' }).includes('<img'));
});
