'use strict';
// Small notifications in the bottom-right corner. ReikaToast.show({ key, title, text, tone: 'info'|'ok'|'warn', actions: [{ label, run }], timeout }).
(function () {
  const host = document.getElementById('toasts');
  if (!host) return;
  const MAX = 3;

  function close(el) {
    if (!el.isConnected) return;
    clearTimeout(el._timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
  }

  function show(opts = {}) {
    if (opts.key) for (const old of host.querySelectorAll('.toast')) if (old.dataset.key === opts.key) old.remove();
    while (host.children.length >= MAX) host.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `toast toast--${opts.tone || 'info'}`;
    if (opts.key) el.dataset.key = opts.key;
    const body = document.createElement('div');
    body.className = 'toast__body';
    const title = document.createElement('b'); title.textContent = opts.title || '';
    body.appendChild(title);
    if (opts.text) { const p = document.createElement('p'); p.textContent = opts.text; body.appendChild(p); }
    el.appendChild(body);
    const row = document.createElement('div');
    row.className = 'toast__actions';
    for (const a of opts.actions || []) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn--gold btn--xs'; b.textContent = a.label;
      b.addEventListener('click', () => { close(el); try { a.run && a.run(); } catch { /* an action must not break the page */ } });
      row.appendChild(b);
    }
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'btn btn--icon btn--xs'; x.setAttribute('aria-label', 'Закрыть уведомление');
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener('click', () => close(el));
    row.appendChild(x);
    el.appendChild(row);
    host.appendChild(el);
    el._timer = setTimeout(() => close(el), opts.timeout || 12000);
    return el;
  }
  window.ReikaToast = { show };
})();
