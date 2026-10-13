'use strict';
(function () {
  const button = document.getElementById('memory-open');
  const panel = document.getElementById('memory-panel');
  if (!button || !panel) return;
  const closeButton = document.getElementById('memory-close');
  const search = document.getElementById('memory-search');
  const list = document.getElementById('memory-list');
  const status = document.getElementById('memory-state');
  const form = document.getElementById('memory-create');
  const newText = document.getElementById('memory-new');
  const consolidate = document.getElementById('memory-consolidate');
  let memories = [];

  async function request(path, options) {
    const response = await fetch(path, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Не удалось связаться с памятью');
    return payload;
  }
  const json = (method, payload) => ({
    method, headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  function message(text) {
    list.replaceChildren();
    const note = document.createElement('p');
    note.className = 'memory-note';
    note.textContent = text;
    list.append(note);
  }
  function render() {
    list.replaceChildren();
    const term = search.value.trim().toLocaleLowerCase('ru');
    const filtered = memories.filter(m => m.content.toLocaleLowerCase('ru').includes(term));
    status.textContent = memories.length + ' воспоминаний';
    if (!filtered.length) return message(term ? 'Ничего не найдено' : 'Пока нет воспоминаний');
    for (const memory of filtered) {
      const item = document.createElement('article');
      item.className = 'memory-item';
      const body = document.createElement('p');
      body.className = 'memory-item-text';
      body.textContent = memory.content;
      const controls = document.createElement('div');
      controls.className = 'memory-item-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn--ghost';
      edit.textContent = 'Изменить';
      edit.addEventListener('click', async () => {
        const content = prompt('Исправить воспоминание:', memory.content);
        if (content === null || !content.trim() || content.trim() === memory.content) return;
        edit.disabled = true;
        try {
          await request('api/memory/' + encodeURIComponent(memory.id), json('PATCH', { content: content.trim() }));
          await reload();
        } catch (error) { status.textContent = error.message; edit.disabled = false; }
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--ghost';
      remove.textContent = 'Удалить';
      remove.addEventListener('click', async () => {
        if (!confirm('Удалить это воспоминание?')) return;
        remove.disabled = true;
        try {
          await request('api/memory/' + encodeURIComponent(memory.id), { method: 'DELETE' });
          await reload();
        } catch (error) { status.textContent = error.message; remove.disabled = false; }
      });
      controls.append(edit, remove);
      item.append(body, controls);
      list.append(item);
    }
  }
  async function reload() {
    status.textContent = 'Загрузка…';
    try {
      const payload = await request('api/memory');
      memories = Array.isArray(payload.memories) ? payload.memories.filter(m => m && typeof m.id === 'string' && typeof m.content === 'string') : [];
      render();
    } catch (error) {
      memories = [];
      status.textContent = 'Недоступна';
      message('Память MemOS недоступна: ' + error.message + '. Запустите Рэйку через приложение, а не как отдельную HTML-страницу.');
    }
  }
  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) { reload(); search.focus(); }
    else button.focus();
  }
  button.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.stopPropagation(); setOpen(false); }
  });
  search.addEventListener('input', render);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const content = newText.value.trim();
    if (!content) return;
    const submit = form.querySelector('button');
    submit.disabled = true;
    try {
      await request('api/memory', json('POST', { content }));
      newText.value = '';
      await reload();
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  consolidate.addEventListener('click', async () => {
    if (!confirm('Упорядочить воспоминания? MemOS может объединить и архивировать похожие записи.')) return;
    consolidate.disabled = true;
    status.textContent = 'Упорядочиваю…';
    try {
      await request('api/memory/consolidate', { method: 'POST' });
      await reload();
    } catch (error) { status.textContent = error.message; }
    finally { consolidate.disabled = false; }
  });
  window.addEventListener('reika:history-restored', () => { if (!panel.hidden) reload(); });
})();
