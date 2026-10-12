'use strict';
// Header menu: opens on click, closes on outside click / Escape / choosing an item, arrow keys move between items.
(function () {
  const button = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  const mode = document.getElementById('menu-mode');
  if (!button || !menu) return;

  const items = () => Array.from(menu.querySelectorAll('[role=menuitem]')).filter((el) => !el.hidden);
  function setOpen(open, focusFirst = false) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && focusFirst) items()[0]?.focus();
    if (!open) button.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (event) => { if (event.target.closest('[role=menuitem]')) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('click', (event) => { if (!menu.hidden && !event.target.closest('.menu-wrap')) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) setOpen(false); });
  button.addEventListener('keydown', (event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true, true); } });
  menu.addEventListener('keydown', (event) => {
    const list = items(); const i = list.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
  });

  // What the page is running on, in one line (the update item appears by itself only when a server is present).
  mode.textContent = location.protocol === 'file:' ? 'Режим: файл (без сервера)' : 'Режим: ' + location.host;
  fetch('api/health', { cache: 'no-store' }).then((r) => r.json()).then((h) => {
    if (h && h.ok) mode.textContent = 'Локальный сервер' + (h.version && /^[0-9a-f]{40}$/.test(h.version) ? ' · версия ' + h.version.slice(0, 8) : '');
    else mode.textContent = 'Работает в браузере';
  }).catch(() => { mode.textContent = 'Работает в браузере'; });
})();
