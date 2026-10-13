'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../web/update-state');

const A = 'a'.repeat(40), B = 'b'.repeat(40);
const base = (extra = {}) => ({ phase: 'idle', percent: 0, localVersion: A, latest: null, rollbackPending: false, blocked: null, pendingRemovals: [], removalsConfirmed: false, ...extra });
const latest = (extra = {}) => ({ sha: B, version: 'bbbbbbbb', changes: [], changesTotal: 0, description: '', ...extra });

test('state of the entry: idle, available, busy, ready, error', () => {
  assert.equal(S.cardState(base()), 'idle');
  assert.equal(S.cardState(null), 'idle');
  assert.equal(S.cardState(base({ latest: latest({ sha: A }) })), 'idle', 'the same version is not news');
  assert.equal(S.cardState(base({ latest: latest() })), 'available');
  assert.equal(S.cardState(base({ latest: latest(), phase: 'downloading' })), 'busy');
  assert.equal(S.cardState(base({ phase: 'testing' })), 'busy');
  assert.equal(S.cardState(base({ phase: 'ready' })), 'ready');
  assert.equal(S.cardState(base({ rollbackPending: true })), 'ready', 'a rollback also waits for a restart');
  assert.equal(S.cardState(base({ phase: 'error', error: 'x' })), 'error');
  assert.equal(S.cardState(base({ localVersion: 'не определена', latest: latest() })), 'idle', 'unknown installed version: no claim of "newer"');
  assert.equal(S.cardState(base({ latest: latest({ source: 'archive' }) })), 'idle', 'an archive is ready, not "newer"');
});

test('the status line says what is going on', () => {
  assert.equal(S.statusText(base()), '', 'idle: only the name, no version');
  assert.equal(S.statusText(base({ latest: latest() })), 'Есть новая версия');
  assert.match(S.statusText(base({ latest: latest(), blocked: 'CI' })), /проверок CI/);
  assert.equal(S.statusText(base({ phase: 'downloading', percent: 41.6 })), 'Скачивание… 42%');
  assert.equal(S.statusText(base({ phase: 'downloading', percent: 900 })), 'Скачивание… 100%');
  assert.equal(S.statusText(base({ phase: 'testing' })), 'Проверка и тесты…');
  assert.equal(S.statusText(base({ phase: 'ready' })), 'Готово к установке');
  assert.match(S.statusText(base({ phase: 'ready', pendingRemovals: ['x'] })), /подтвердите удаление/);
  assert.equal(S.statusText(base({ phase: 'ready', pendingRemovals: ['x'], removalsConfirmed: true })), 'Готово к установке');
  assert.equal(S.statusText(base({ rollbackPending: true })), 'Откат ждёт перезапуска');
  assert.equal(S.statusText(base({ phase: 'error', error: 'Тесты упали\nподробности\nещё' })), 'Ошибка: Тесты упали');
  assert.ok(S.statusText(base({ phase: 'error', error: 'x'.repeat(500) })).length < 90, 'long errors are cut');
});

test('"what is new": titles, "and N more", description fallback, nothing when not relevant', () => {
  const st = base({ latest: latest({ changes: [{ title: 'Первое' }, { title: 'Второе' }, { title: '' }, { nonsense: 1 }, { title: 'Третье' }], changesTotal: 12 }) });
  assert.deepEqual(S.news(st), { version: 'bbbbbbbb', items: ['Первое', 'Второе', 'Третье'], text: '', more: 9 });
  assert.equal(S.news(st, 2).items.length, 2);
  assert.deepEqual(S.news(base({ latest: latest({ description: 'Обновление проекта из GitHub. Коммит: X' }) })).items, []);
  assert.match(S.news(base({ latest: latest({ description: 'Коммит: X' }) })).text, /X/);
  assert.equal(S.news(base()), null);
  assert.equal(S.news(base({ latest: latest({ sha: A, changes: [{ title: 'a' }] }) })), null, 'no news for the installed version');
  assert.equal(S.news(null), null);
});

test('notify once per version; phase changes are announced only when work finished', () => {
  const st = base({ latest: latest() });
  assert.equal(S.shouldNotifyNew(st, null), true);
  assert.equal(S.shouldNotifyNew(st, B), false, 'already told about this version');
  assert.equal(S.shouldNotifyNew(st, A), true, 'a newer one appeared');
  assert.equal(S.shouldNotifyNew(base(), null), false);
  assert.equal(S.phaseNotice('downloading', base({ phase: 'ready' })), 'ready');
  assert.equal(S.phaseNotice('testing', base({ phase: 'error' })), 'error');
  assert.equal(S.phaseNotice('idle', base({ phase: 'ready' })), null, 'a ready update found at start-up is not a "finished" event');
  assert.equal(S.phaseNotice('downloading', base({ phase: 'idle' })), null, 'cancelled');
  assert.equal(S.phaseNotice(null, base({ phase: 'ready' })), null);
});

test('every state has an icon, and the entry never throws on odd data', () => {
  for (const s of ['idle', 'available', 'busy', 'ready', 'error']) assert.match(S.ICONS[s], /^M/);
  assert.doesNotThrow(() => S.statusText({}));
  assert.doesNotThrow(() => S.news({ latest: { sha: B, changes: 'nope' }, localVersion: A }));
  assert.equal(S.shortVersion(undefined), 'не определена');
});

test('describe(): headline and sub line for every state of the update page', () => {
  assert.equal(S.describe(null).title, 'Проверяем…');
  assert.equal(S.describe(base()).title, 'Проверьте наличие обновлений');
  const checked = S.describe(base({ checkedAt: Date.UTC(2026, 0, 1, 12, 40) }));
  assert.equal(checked.title, 'У вас последняя версия'); assert.match(checked.sub, /Установлена aaaaaaaa · проверено \d\d:\d\d/);
  const found = S.describe(base({ latest: latest({ changesTotal: 7 }) }));
  assert.equal(found.title, 'Доступна новая версия'); assert.match(found.sub, /bbbbbbbb · изменений: 7/);
  assert.equal(S.describe(base({ phase: 'downloading' })).title, 'Скачиваем обновление');
  assert.equal(S.describe(base({ phase: 'testing' })).title, 'Проверяем обновление');
  assert.equal(S.describe(base({ phase: 'ready' })).title, 'Готово к установке');
  assert.match(S.describe(base({ phase: 'ready', pendingRemovals: ['x'] })).sub, /Подтвердите удаление/);
  assert.equal(S.describe(base({ rollbackPending: true })).title, 'Откат ждёт перезапуска');
  assert.equal(S.describe(base({ phase: 'error', error: 'x' })).title, 'Не удалось обновить');
  assert.doesNotThrow(() => S.describe({}));
});
