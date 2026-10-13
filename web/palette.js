'use strict';
// Command palette (Ctrl+K / ⌘K, or the search pill in the menu): jump to a page or run an action by typing a few letters.
(function () {
  const $ = (id) => document.getElementById(id);
  const dlg = $('palette');
  const input = $('palette-input');
  const list = $('palette-list');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  let items = [];
  let active = 0;

  const fold = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

  function commands() {
    const cmds = [
      { title: 'Главная', hint: 'страница', run: () => { location.hash = '#/home'; } },
      { title: 'Открыть или закрыть чат', hint: 'чат', run: () => { const nav = $('nav-chat'); if (nav) nav.click(); } },
      { title: 'Очистить историю чата', hint: 'чат', run: () => { if ($('chat-panel').hidden) $('nav-chat').click(); $('chat-clear').click(); } },
      { title: shellCollapsed() ? 'Развернуть меню' : 'Свернуть меню', hint: 'меню', run: () => window.ReikaShell && window.ReikaShell.toggleCollapsed() },
      { title: 'О проекте', hint: 'сведения', run: () => window.ReikaShell && window.ReikaShell.about() },
      { title: 'Стиль проекта', hint: 'образцы дизайна', run: () => { window.open('styleguide.html', '_blank', 'noopener'); } },
    ];
    if (window.ReikaUpdaterPresent && window.ReikaUpdate) {
      cmds.splice(1, 0,
        { title: 'Обновление проекта', hint: 'страница', run: () => window.ReikaUpdate.open() },
        { title: 'Проверить обновления', hint: 'обновление', run: () => { window.ReikaUpdate.open(); window.ReikaUpdate.check().catch(() => {}); } });
    }
    return cmds;
  }
  const shellCollapsed = () => $('shell').classList.contains('collapsed');

  function render() {
    const q = fold(input.value.trim());
    items = commands().filter((c) => !q || fold(c.title + ' ' + c.hint).includes(q));
    if (active >= items.length) active = Math.max(0, items.length - 1);
    list.textContent = '';
    items.forEach((c, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `palette-opt-${i}`;
      li.className = 'palette-item' + (i === active ? ' active' : '');
      li.setAttribute('aria-selected', String(i === active));
      const t = document.createElement('span'); t.textContent = c.title;
      const h = document.createElement('small'); h.textContent = c.hint;
      li.append(t, h);
      li.addEventListener('mousemove', () => { if (active !== i) { active = i; render(); } });
      li.addEventListener('click', () => run(i));
      list.appendChild(li);
    });
    if (!items.length) { const li = document.createElement('li'); li.className = 'palette-empty'; li.textContent = 'Ничего не найдено'; list.appendChild(li); }
    input.setAttribute('aria-activedescendant', items.length ? `palette-opt-${active}` : '');
  }
  function run(i) {
    const c = items[i];
    if (!c) return;
    dlg.close();
    setTimeout(() => { try { c.run(); } catch { /* a command must not break the page */ } }, 0);
  }
  function open() {
    if (dlg.open) return;
    input.value = ''; active = 0; render();
    dlg.showModal(); input.focus();
  }
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = items.length ? (active + 1) % items.length : 0; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = items.length ? (active - 1 + items.length) % items.length : 0; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('palette-open').addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyK') { e.preventDefault(); if (dlg.open) dlg.close(); else open(); }
  });
  const isMac = /Mac|iP(hone|ad)/.test(navigator.platform || '');
  if (isMac) document.querySelectorAll('.side-search .kbd').forEach((k) => { k.textContent = '⌘ K'; });
})();
