'use strict';
// "Обновление проекта": the page, the entry in the side panel (status line, progress, quick install, "what's new"),
// notifications and installing from a ZIP file. Active only when the local server (with the updater) answers; the static build has none.
(function () {
  const $ = (id) => document.getElementById(id);
  const page = $('page-update');
  const S = window.ReikaUpdateState;
  if (!page || !S || location.protocol === 'file:') return;
  const onPage = () => !page.hidden;
  const SEEN_KEY = 'reika.notified.v1';
  const MAX_ARCHIVE = 60_000_000;
  let timer = null;
  let last = null;       // last status from the server
  let prevPhase = null;  // phase at the previous poll (for "ready"/"error" notices)
  let started = false;

  const store = {
    get() { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(SEEN_KEY, v); } catch { /* private mode */ } },
  };
  const toast = (o) => { if (window.ReikaToast) window.ReikaToast.show(o); };
  const show = (el, on) => { el.hidden = !on; };
  const fail = (e) => { $('up-error').hidden = false; $('up-error').textContent = e.message || String(e); };

  async function call(path, method = 'GET', body) {
    const response = await fetch(`api/update/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
    return data;
  }
  const label = { todo: '', active: 'active', done: 'done', error: 'error' };

  // ---------- the update page ----------
  function renderPage(st) {
    $('up-local').textContent = S.shortVersion(st.localVersion);
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
    $('up-file').disabled = working || st.phase === 'ready';
    show($('up-install'), st.phase === 'ready' || st.rollbackPending);
    const needConfirm = st.phase === 'ready' && st.pendingRemovals.length > 0 && !st.removalsConfirmed;
    show($('up-removals'), st.pendingRemovals.length > 0 && st.phase === 'ready');
    $('up-removals-list').innerHTML = '';
    for (const p of st.pendingRemovals) { const li = document.createElement('li'); li.textContent = p; $('up-removals-list').appendChild(li); }
    show($('up-confirm'), needConfirm);
    $('up-channel').value = st.config.channel; $('up-auto').value = st.config.autoCheck;
  }

  // ---------- the entry in the side panel ----------
  function renderCard(st) {
    const card = $('update-card');
    const state = S.cardState(st);
    card.dataset.state = state;
    $('update-ico-path').setAttribute('d', S.ICONS[state]);
    const status = S.statusText(st, state);
    $('update-status').textContent = status;
    show($('update-status'), !!status);
    show($('update-dot'), state === 'available' || state === 'ready');
    const bar = $('update-mini');
    show(bar, state === 'busy' && st.phase === 'downloading');
    const pct = Math.max(0, Math.min(100, Math.round(st.percent || 0)));
    bar.setAttribute('aria-valuenow', String(pct));
    $('update-mini-fill').style.width = `${pct}%`;
    const needConfirm = st.pendingRemovals && st.pendingRemovals.length > 0 && !st.removalsConfirmed;
    show($('update-install-quick'), state === 'ready' && !st.rollbackPending && !needConfirm);
    const n = S.news(st);
    const pop = $('update-news');
    pop.textContent = '';
    if (n) {
      const h = document.createElement('b'); h.textContent = 'Что нового'; pop.appendChild(h);
      if (n.items.length) {
        const ul = document.createElement('ul');
        for (const t of n.items) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
        pop.appendChild(ul);
        if (n.more) { const m = document.createElement('p'); m.textContent = `…и ещё ${n.more}`; pop.appendChild(m); }
      } else { const p = document.createElement('p'); p.textContent = n.text; pop.appendChild(p); }
    }
    show(pop, !!n);
  }

  // ---------- announcements to the shell (events and globals: the shell may load later than this answer) ----------
  function announce(st) {
    const state = S.cardState(st);
    window.ReikaUpdateSummary = { available: state === 'available' || state === 'ready', version: st.localVersion, phase: st.phase, latest: st.latest ? st.latest.version : null, state, text: S.statusText(st, state) };
    window.dispatchEvent(new CustomEvent('reika:update-summary', { detail: window.ReikaUpdateSummary }));
  }

  function notify(st) {
    const notice = S.phaseNotice(prevPhase, st);
    prevPhase = st.phase;
    if (notice === 'ready') {
      toast({ key: 'update-ready', title: 'Обновление готово к установке', text: 'Файлы проверены, тесты прошли.', tone: 'ok', actions: [{ label: 'Установить', run: install }] });
    } else if (notice === 'error') {
      toast({ key: 'update-error', title: 'Обновление не удалось', text: S.statusText(st, 'error'), tone: 'warn', actions: [{ label: 'Подробнее', run: () => { location.hash = '#/update'; } }] });
    }
    if (S.shouldNotifyNew(st, store.get())) {
      store.set(st.latest.sha);
      toast({ key: 'update-new', title: 'Доступна новая версия', text: 'Её можно скачать и проверить, пока вы работаете.', actions: [
        { label: 'Скачать', run: () => call('download', 'POST', {}).then(poll).catch(() => { location.hash = '#/update'; }) },
        { label: 'Подробнее', run: () => { location.hash = '#/update'; } },
      ] });
    }
  }

  // ---------- one polling loop: quick while working, slow otherwise ----------
  async function poll() {
    clearTimeout(timer);
    let delay = 20000;
    try {
      const st = await call('status');
      last = st;
      window.ReikaUpdateStatus = st;
      if (!started) { started = true; window.ReikaUpdaterPresent = true; window.dispatchEvent(new CustomEvent('reika:updater-present')); }
      notify(st);
      renderCard(st);
      announce(st);
      if (onPage()) renderPage(st);
      delay = S.cardState(st) === 'busy' ? 700 : (onPage() ? 5000 : 20000);
    } catch (e) {
      if (!started) return; // no updater here at all: stop asking
      if (onPage()) fail(e);
      delay = 8000;
    }
    timer = setTimeout(poll, delay);
  }

  async function refreshHistory() {
    try {
      const h = await call('history');
      $('up-history').innerHTML = '';
      const kinds = { install: 'Установка', rollback: 'Откат', failed: 'Неудачная установка', startup_failed: 'Не запустилась, возвращена прежняя' };
      for (const item of h.items) {
        const li = document.createElement('li');
        li.textContent = `${new Date(item.at).toLocaleString('ru-RU')} · ${kinds[item.kind] || item.kind}${item.to ? ' · ' + item.to.slice(0, 8) : ''}${item.message ? ' · ' + item.message : ''}`;
        $('up-history').appendChild(li);
      }
      show($('up-rollback'), !!h.canRollback && !h.rollbackPending);
    } catch { /* history is informative */ }
  }
  const act = (id, fn) => $(id).addEventListener('click', async () => { try { await fn(); } catch (e) { fail(e); } poll(); refreshHistory(); });

  async function install() {
    const st = await call('status');
    if (st.pendingRemovals.length && !st.removalsConfirmed && !confirm('Файлы из списка удаления не подтверждены и останутся на месте. Продолжить установку?')) return;
    await call('install-now', 'POST', {});
    $('up-message').textContent = 'Перезапуск… страница обновится сама.';
    toast({ key: 'update-restart', title: 'Рэйка перезапускается', text: 'Страница обновится сама.', timeout: 60000 });
    const wait = setInterval(async () => { try { const r = await fetch('api/health', { cache: 'no-store' }); if (r.ok) { clearInterval(wait); location.reload(); } } catch { /* restarting */ } }, 1000);
  }

  // ---------- update from a ZIP file ----------
  async function fromFile(file) {
    if (!file) return;
    if (file.size > MAX_ARCHIVE) throw new Error('Файл больше 60 МБ: это не архив проекта.');
    if (!confirm(`Подготовить обновление из файла «${file.name}»?\n\nАрхив не сверяется с GitHub, поэтому используйте только тот, которому доверяете. Данные и настройки не затрагиваются, перед установкой запустятся тесты.`)) return;
    const response = await fetch('api/update/from-archive', { method: 'POST', headers: { 'Content-Type': 'application/zip', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
  }
  $('up-file').addEventListener('change', async (event) => {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    try { await fromFile(file); } catch (e) { fail(e); }
    poll();
  });

  act('up-check', () => call('check', 'POST', {}));
  act('up-download', () => call('download', 'POST', {}));
  act('up-cancel', () => call('cancel', 'POST', {}));
  act('up-confirm', () => call('confirm-removals', 'POST', {}));
  act('up-rollback', async () => { if (confirm('Откатить последнюю установку? Данные чата не изменятся. Рэйка перезапустится.')) { await call('rollback', 'POST', {}); await install(); } });
  act('up-install', install);
  $('update-install-quick').addEventListener('click', () => install().catch(fail));
  $('up-channel').addEventListener('change', () => call('settings', 'POST', { channel: $('up-channel').value }).then(poll).catch((e) => alert(e.message)));
  $('up-auto').addEventListener('change', () => call('settings', 'POST', { autoCheck: $('up-auto').value }).then(poll).catch((e) => alert(e.message)));

  window.addEventListener('reika:route', (event) => { if (event.detail === 'update') { poll(); refreshHistory(); } });

  // for the command palette
  window.ReikaUpdate = {
    check: () => call('check', 'POST', {}).then(poll),
    open: () => { location.hash = '#/update'; },
    install,
    get status() { return last; },
  };
  poll();
})();
