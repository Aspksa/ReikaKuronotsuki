'use strict';
// Pure helpers for the update entry in the side panel: which state it is in, what its status line says, what is "new".
// No DOM here, so it can be tested in Node (tests/update-state.test.js) and used by update.js in the browser.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReikaUpdateState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SHA = /^[0-9a-f]{40}$/;

  /** First 8 characters of a commit id; anything else (e.g. "не определена") as is. */
  const shortVersion = (v) => (SHA.test(v || '') ? v.slice(0, 8) : (v || 'не определена'));

  /** A newer version than the installed one is known (an archive picked by the user is not "newer", it is "ready"). */
  function hasNewVersion(st) {
    return !!st && !!st.latest && st.latest.source !== 'archive' && SHA.test(st.localVersion || '') && st.latest.sha !== st.localVersion;
  }

  /** idle | available | busy | ready | error */
  function cardState(st) {
    if (!st) return 'idle';
    if (st.phase === 'downloading' || st.phase === 'testing') return 'busy';
    if (st.phase === 'ready' || st.rollbackPending) return 'ready';
    if (st.phase === 'error') return 'error';
    return hasNewVersion(st) ? 'available' : 'idle';
  }

  const ICONS = {
    idle: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5',          // circular arrow
    busy: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5',          // the same arrow, spinning (CSS)
    available: 'M12 4v11M7 11l5 5 5-5M5 20h14',            // arrow down into a tray
    ready: 'M5 12.5l4.5 4.5L19 7.5',                      // check mark
    error: 'M12 4l9 16H3zM12 10v4M12 17v.01',             // warning triangle
  };

  /** The line under the entry's name. */
  function statusText(st, state = cardState(st)) {
    if (!st) return '';
    switch (state) {
      case 'busy': return st.phase === 'testing' ? 'Проверка и тесты…' : `Скачивание… ${Math.max(0, Math.min(100, Math.round(st.percent || 0)))}%`;
      case 'ready':
        if (st.rollbackPending) return 'Откат ждёт перезапуска';
        return st.pendingRemovals && st.pendingRemovals.length && !st.removalsConfirmed ? 'Готово · подтвердите удаление файлов' : 'Готово к установке';
      case 'error': return 'Ошибка: ' + String(st.error || 'неизвестная').split('\n')[0].slice(0, 70);
      case 'available': return st.blocked ? 'Ждёт проверок CI' : 'Есть новая версия';
      default: return ''; // nothing to say: the entry is just its name
    }
  }

  /** Headline and sub line of the big status card on the update page. */
  function describe(st) {
    if (!st) return { title: 'Проверяем…', sub: '' };
    const state = cardState(st);
    const installed = 'Установлена ' + shortVersion(st.localVersion);
    const count = st.latest && Number.isSafeInteger(st.latest.changesTotal) && st.latest.changesTotal > 0 ? ` · изменений: ${st.latest.changesTotal}` : '';
    switch (state) {
      case 'busy': return st.phase === 'testing'
        ? { title: 'Проверяем обновление', sub: 'Сверяем файлы и запускаем тесты в отдельной папке. Работающая версия не затрагивается.' }
        : { title: 'Скачиваем обновление', sub: st.latest ? `Версия ${st.latest.version}` : '' };
      case 'ready':
        if (st.rollbackPending) return { title: 'Откат ждёт перезапуска', sub: 'Предыдущая версия вернётся при следующем запуске Рэйки.' };
        return { title: 'Готово к установке', sub: st.pendingRemovals && st.pendingRemovals.length && !st.removalsConfirmed ? 'Подтвердите удаление файлов ниже, чтобы они были убраны при установке.' : 'Рэйка перезапустится сама. Данные и настройки не затрагиваются.' };
      case 'error': return { title: 'Не удалось обновить', sub: installed + '. Подробности ниже.' };
      case 'available': return { title: 'Доступна новая версия', sub: `Версия ${st.latest.version}${count} · ${installed.toLowerCase()}` };
      default: return st.checkedAt
        ? { title: 'У вас последняя версия', sub: installed + ' · проверено ' + timeOf(st.checkedAt) }
        : { title: 'Проверьте наличие обновлений', sub: installed };
    }
  }

  function timeOf(ms) {
    try { return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }

  /** "What's new" for the hover card: up to `max` change titles, how many more there are. Null when there is nothing to show. */
  function news(st, max = 5) {
    if (!st || !st.latest) return null;
    const state = cardState(st);
    if (state !== 'available' && state !== 'ready') return null;
    const items = (Array.isArray(st.latest.changes) ? st.latest.changes : []).map((c) => c && c.title).filter((t) => typeof t === 'string' && t).slice(0, max);
    if (!items.length) return st.latest.description ? { version: st.latest.version, items: [], text: String(st.latest.description).slice(0, 200), more: 0 } : null;
    const total = Number.isSafeInteger(st.latest.changesTotal) ? st.latest.changesTotal : items.length;
    return { version: st.latest.version, items, text: '', more: Math.max(0, total - items.length) };
  }

  /** Tell the user about a newly found version once per version. */
  const shouldNotifyNew = (st, seenSha) => cardState(st) === 'available' && !!st.latest && st.latest.sha !== seenSha;

  /** Notifications for phase changes seen between two polls (null = nothing to say). */
  function phaseNotice(prev, st) {
    if (!prev || !st) return null;
    const wasBusy = prev === 'downloading' || prev === 'testing';
    if (wasBusy && st.phase === 'ready') return 'ready';
    if (wasBusy && st.phase === 'error') return 'error';
    return null;
  }

  return { shortVersion, hasNewVersion, cardState, statusText, describe, news, shouldNotifyNew, phaseNotice, ICONS };
});
