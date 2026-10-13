'use strict';
// Page shell: left menu (routes, collapse, presence, mood, "about"), status cards on the home page. (The scene lives in sky.js.)
(function () {
  const $ = (id) => document.getElementById(id);
  const shell = $('shell');
  const KEY = 'reika.sidebar.v1';
  let updaterPresent = false;
  let version = null;

  // ---- collapsible menu (remembered per browser) ----
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
  };
  function setCollapsed(on) {
    shell.classList.toggle('collapsed', on);
    const btn = $('side-toggle');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Развернуть меню' : 'Свернуть меню');
    btn.title = btn.getAttribute('aria-label');
  }
  function toggleCollapsed() { const on = !shell.classList.contains('collapsed'); setCollapsed(on); store.set(on ? '1' : '0'); }
  setCollapsed(store.get() === '1');
  $('side-toggle').addEventListener('click', toggleCollapsed);
  window.ReikaShell = { toggleCollapsed, about: () => openAbout() };

  // ---- routes: #/home, #/update ----
  const pages = Array.from(document.querySelectorAll('[data-page]'));
  const navs = Array.from(document.querySelectorAll('[data-route]'));
  // Pages that need the local server: in a plain browser build they are hidden and their links fall back to the home page.
  const needsServer = { update: () => updaterPresent, settings: () => serverSeen };
  function currentRoute() {
    const wanted = location.hash.replace(/^#\/?/, '') || 'home';
    const exists = pages.some((p) => p.dataset.page === wanted);
    return exists && (!needsServer[wanted] || needsServer[wanted]()) ? wanted : 'home';
  }
  function route() {
    const r = currentRoute();
    for (const p of pages) p.hidden = p.dataset.page !== r;
    for (const n of navs) { if (n.dataset.route === r) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); }
    const titles = { update: 'Обновление · Reika Kuronotsuki', settings: 'Настройки · Reika Kuronotsuki' };
    document.title = titles[r] || 'Reika Kuronotsuki';
    $('content').scrollTop = 0;
    window.dispatchEvent(new CustomEvent('reika:route', { detail: r }));
  }
  window.addEventListener('hashchange', route);

  // ---- presence light on the logo: browser only / local server / server not answering ----
  const PRESENCE = { browser: 'Работает в браузере', server: 'Локальный сервер на связи', down: 'Сервер не отвечает' };
  function setPresence(state) {
    const el = $('presence');
    el.dataset.state = state;
    el.title = PRESENCE[state];
    $('about-mode').textContent = state === 'server' ? 'Локальный сервер' : state === 'down' ? 'Локальный сервер (не отвечает)' : (location.protocol === 'file:' ? 'Файл (без сервера)' : 'Браузер');
    $('card-mode').textContent = state === 'server' ? 'Локальный сервер' : state === 'down' ? 'Сервер не отвечает' : (location.protocol === 'file:' ? 'Файл (без сервера)' : 'Браузер');
  }
  $('card-version').textContent = '—';
  $('card-update').textContent = 'Нужен локальный сервер';
  setPresence('browser');

  function showVersion(v) {
    version = v;
    const text = v || 'не определена';
    $('card-version').textContent = text;
    $('about-version').textContent = text;
  }
  showVersion(null);

  let serverSeen = false;
  async function health() {
    if (location.protocol === 'file:') return;
    try {
      const h = await (await fetch('api/health', { cache: 'no-store' })).json();
      if (!h || !h.ok) throw new Error('not ok');
      const first = !serverSeen;
      serverSeen = true;
      setPresence('server');
      $('nav-settings').hidden = false;
      if (first) route(); // a direct link to #/settings works once the server is known to be there
      const v = h.version && /^[0-9a-f]{40}$/.test(h.version) ? h.version.slice(0, 8) : null;
      if (v && version === null) showVersion(v);
    } catch { if (serverSeen) setPresence('down'); }
    setTimeout(health, serverSeen ? 15000 : 60000);
  }
  health();
  window.addEventListener('reika:server-state', (e) => { if (e.detail === 'down' && serverSeen) setPresence('down'); else if (e.detail === 'up') setPresence('server'); });

  // ---- mood line under the name ----
  const setMood = (text) => { if (text) $('side-mood').textContent = text; };
  setMood(window.ReikaMood);
  window.addEventListener('reika:mood', (e) => setMood(e.detail));

  // ---- "О проекте" ----
  const about = $('about-dialog');
  function openAbout() { if (typeof about.showModal === 'function' && !about.open) about.showModal(); }
  $('about-open').addEventListener('click', openAbout);
  about.addEventListener('click', (e) => { if (e.target === about) about.close(); }); // a click on the backdrop

  // ---- the update entry ----
  function onUpdaterPresent() {
    updaterPresent = true;
    $('update-card').hidden = false;
    $('hero-update').hidden = false;
    $('card-update').textContent = 'Проверяется…';
    route(); // a direct link to #/update works once the updater is known to exist
  }
  function onUpdateSummary(d) {
    $('card-update').textContent = d.available ? (d.phase === 'ready' ? 'Готово к установке' : 'Доступна новая версия') : 'Установлена последняя';
    if (d.version && /^[0-9a-f]{40}$/.test(d.version)) showVersion(d.version.slice(0, 8));
  }
  window.addEventListener('reika:updater-present', onUpdaterPresent);
  window.addEventListener('reika:update-summary', (event) => onUpdateSummary(event.detail));
  // update.js may have heard from the server before this file loaded: take what it already knows.
  if (window.ReikaUpdaterPresent) onUpdaterPresent();
  if (window.ReikaUpdateSummary) onUpdateSummary(window.ReikaUpdateSummary);

  route();
})();
