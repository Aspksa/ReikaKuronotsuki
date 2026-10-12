'use strict';
// Page shell: left menu (routes, collapse), status line, home cards and the falling-petal sky.
(function () {
  const $ = (id) => document.getElementById(id);
  const shell = $('shell');
  const navUpdate = $('nav-update');
  const KEY = 'reika.sidebar.v1';
  let updaterPresent = false;

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
  setCollapsed(store.get() === '1');
  $('side-toggle').addEventListener('click', () => { const on = !shell.classList.contains('collapsed'); setCollapsed(on); store.set(on ? '1' : '0'); });

  // ---- routes: #/home, #/update ----
  const pages = Array.from(document.querySelectorAll('[data-page]'));
  const navs = Array.from(document.querySelectorAll('[data-route]'));
  function currentRoute() {
    const wanted = location.hash.replace(/^#\/?/, '') || 'home';
    const exists = pages.some((p) => p.dataset.page === wanted);
    return exists && !(wanted === 'update' && !updaterPresent) ? wanted : 'home';
  }
  function route() {
    const r = currentRoute();
    for (const p of pages) p.hidden = p.dataset.page !== r;
    for (const n of navs) { if (n.dataset.route === r) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); }
    document.title = r === 'update' ? 'Обновление · Reika Kuronotsuki' : 'Reika Kuronotsuki';
    $('content').scrollTop = 0;
    window.dispatchEvent(new CustomEvent('reika:route', { detail: r }));
  }
  window.addEventListener('hashchange', route);

  // ---- what we are running on ----
  const modeText = location.protocol === 'file:' ? 'Файл (без сервера)' : 'Браузер';
  $('menu-mode').textContent = modeText;
  $('card-mode').textContent = modeText;
  $('card-version').textContent = '—';
  $('card-update').textContent = 'Нужен локальный сервер';

  fetch('api/health', { cache: 'no-store' }).then((r) => r.json()).then((h) => {
    if (!h || !h.ok) return;
    const v = h.version && /^[0-9a-f]{40}$/.test(h.version) ? h.version.slice(0, 8) : null;
    $('menu-mode').textContent = 'Локальный сервер' + (v ? ' · ' + v : '');
    $('card-mode').textContent = 'Локальный сервер';
    $('card-version').textContent = v || 'не определена';
  }).catch(() => {});

  window.addEventListener('reika:updater-present', () => {
    updaterPresent = true;
    navUpdate.hidden = false;
    $('hero-update').hidden = false;
    $('card-update').textContent = 'Проверяется…';
    route(); // a direct link to #/update works once the updater is known to exist
  });
  window.addEventListener('reika:update-summary', (event) => {
    const d = event.detail;
    $('update-dot').hidden = !d.available;
    $('card-update').textContent = d.available ? (d.phase === 'ready' ? 'Готово к установке' : 'Доступна новая версия') : 'Установлена последняя';
    if (d.version && /^[0-9a-f]{40}$/.test(d.version)) $('card-version').textContent = d.version.slice(0, 8);
  });

  // ---- sky: petals (skipped when the user prefers reduced motion) ----
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    const box = $('petals');
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      p.style.left = `${Math.round(Math.random() * 100)}%`;
      p.style.animationDuration = `${14 + Math.random() * 14}s`;
      p.style.animationDelay = `${-Math.random() * 28}s`;
      p.style.setProperty('--sway', `${20 + Math.random() * 50}px`);
      p.style.setProperty('--size', `${7 + Math.random() * 8}px`);
      box.appendChild(p);
    }
  }

  route();
})();
