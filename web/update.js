'use strict';
// "Обновление проекта" window. Shown only when the local server (with the updater) answers; the static web build has none.
(function () {
  const $ = (id) => document.getElementById(id);
  const page = $('page-update');
  if (!page || location.protocol === 'file:') return;
  const onPage = () => !page.hidden;
  let timer = null;

  async function call(path, method = 'GET', body) {
    const response = await fetch(`api/update/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
    return data;
  }
  const show = (el, on) => { el.hidden = !on; };
  const label = { todo: '', active: 'active', done: 'done', error: 'error' };

  function render(st) {
    $('up-local').textContent = /^[0-9a-f]{40}$/.test(st.localVersion || '') ? st.localVersion.slice(0, 8) : (st.localVersion || 'не определена');
    $('up-latest').textContent = st.latest ? st.latest.version : '—';
    $('up-message').textContent = st.message || '';
    $('up-bar').style.width = `${st.percent || 0}%`;
    show($('up-blocked'), !!st.blocked); $('up-blocked').textContent = st.blocked || '';
    show($('up-error'), !!st.error); $('up-error').textContent = st.error ? `${st.error}${st.logTail ? '\n' + st.logTail : ''}` : '';
    $('up-checks').innerHTML = '';
    for (const c of st.checks || []) { const li = document.createElement('li'); li.className = label[c.status]; li.textContent = c.title; $('up-checks').appendChild(li); }
    const working = st.phase === 'downloading' || st.phase === 'testing';
    $('node-github').classList.toggle('on', st.phase === 'downloading');
    $('node-check').classList.toggle('on', st.phase === 'testing');
    $('node-project').classList.toggle('on', st.phase === 'ready');
    show($('fly'), working);
    show($('up-cancel'), working);
    show($('up-check'), !working); show($('up-download'), !working && st.phase !== 'ready');
    $('up-download').disabled = !!st.blocked || !st.latest;
    show($('up-install'), st.phase === 'ready' || st.rollbackPending);
    const needConfirm = st.phase === 'ready' && st.pendingRemovals.length > 0 && !st.removalsConfirmed;
    show($('up-removals'), st.pendingRemovals.length > 0 && st.phase === 'ready');
    $('up-removals-list').innerHTML = '';
    for (const p of st.pendingRemovals) { const li = document.createElement('li'); li.textContent = p; $('up-removals-list').appendChild(li); }
    show($('up-confirm'), needConfirm);
    $('up-channel').value = st.config.channel; $('up-auto').value = st.config.autoCheck;
    return working;
  }

  async function refresh() {
    try {
      const working = render(await call('status'));
      clearTimeout(timer);
      if (onPage()) timer = setTimeout(refresh, working ? 700 : 5000);
    } catch (e) { $('up-error').hidden = false; $('up-error').textContent = e.message; }
  }
  async function refreshHistory() {
    try {
      const h = await call('history');
      $('up-history').innerHTML = '';
      for (const item of h.items) {
        const li = document.createElement('li');
        const kinds = { install: 'Установка', rollback: 'Откат', failed: 'Неудачная установка', startup_failed: 'Не запустилась, возвращена прежняя' };
        li.textContent = `${new Date(item.at).toLocaleString('ru-RU')} · ${kinds[item.kind] || item.kind}${item.to ? ' · ' + item.to.slice(0, 8) : ''}${item.message ? ' · ' + item.message : ''}`;
        $('up-history').appendChild(li);
      }
      show($('up-rollback'), !!h.canRollback && !h.rollbackPending);
    } catch { /* history is informative */ }
  }
  const act = (id, fn) => $(id).addEventListener('click', async () => { try { await fn(); } catch (e) { $('up-error').hidden = false; $('up-error').textContent = e.message; } refresh(); refreshHistory(); });

  act('up-check', () => call('check', 'POST', {}));
  act('up-download', () => call('download', 'POST', {}));
  act('up-cancel', () => call('cancel', 'POST', {}));
  act('up-confirm', () => call('confirm-removals', 'POST', {}));
  act('up-rollback', async () => { if (confirm('Откатить последнюю установку? Данные чата не изменятся. Рэйка перезапустится.')) { await call('rollback', 'POST', {}); await install(); } });
  act('up-install', install);
  $('up-channel').addEventListener('change', () => call('settings', 'POST', { channel: $('up-channel').value }).then(refresh).catch((e) => alert(e.message)));
  $('up-auto').addEventListener('change', () => call('settings', 'POST', { autoCheck: $('up-auto').value }).then(refresh).catch((e) => alert(e.message)));

  async function install() {
    const st = await call('status');
    if (st.pendingRemovals.length && !st.removalsConfirmed && !confirm('Файлы из списка удаления не подтверждены и останутся на месте. Продолжить установку?')) return;
    await call('install-now', 'POST', {});
    $('up-message').textContent = 'Перезапуск… страница обновится сама.';
    const wait = setInterval(async () => { try { const r = await fetch('api/health', { cache: 'no-store' }); if (r.ok) { clearInterval(wait); location.reload(); } } catch { /* restarting */ } }, 1000);
  }

  // Polling runs only while the page is on screen (the shell announces route changes).
  window.addEventListener('reika:route', (event) => {
    clearTimeout(timer);
    if (event.detail === 'update') { refresh(); refreshHistory(); }
  });

  // Is there something new? One quiet request at start-up feeds the dot in the menu and the cards on the home page.
  // The answers are kept in window.ReikaUpdaterPresent / window.ReikaUpdateSummary as well as announced by events: the answer can
  // arrive before shell.js has even loaded, and a lost event would hide the menu item for good.
  const hasNewVersion = (st) => !!st.latest && /^[0-9a-f]{40}$/.test(st.localVersion || '') && st.latest.sha !== st.localVersion;
  async function summary() {
    try {
      const st = await call('status');
      window.ReikaUpdateSummary = { available: hasNewVersion(st) || st.phase === 'ready', version: st.localVersion, phase: st.phase, latest: st.latest ? st.latest.version : null };
      window.dispatchEvent(new CustomEvent('reika:update-summary', { detail: window.ReikaUpdateSummary }));
    } catch { /* the server (or its updater) is not there */ }
  }
  fetch('api/update/status').then((r) => { if (r.ok) { window.ReikaUpdaterPresent = true; window.dispatchEvent(new CustomEvent('reika:updater-present')); summary(); } }).catch(() => {});
})();
