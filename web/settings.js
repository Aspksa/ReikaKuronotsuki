'use strict';
// "Настройки": the port, the chat sound, clearing the history and a copy of your data.
// Needs the local server; in a plain browser build the page stays hidden (shell.js decides by the route).
(function () {
  const $ = (id) => document.getElementById(id);
  const page = $('page-settings');
  if (!page) return;
  const SOUND_KEY = 'reika.sound.v1';
  let current = null;

  // ---- the quiet sound of an answer (no files: one short tone from the browser itself) ----
  const sound = {
    on() { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } },
    set(on) { try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* private mode */ } },
    play() {
      if (!sound.on()) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = sound.ctx || (sound.ctx = new Ctx());
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.3);
      } catch { /* a sound must never break the chat */ }
    },
  };
  window.ReikaSound = sound;

  if (location.protocol === 'file:') return; // no server: nothing below can work
  const show = (el, on) => { el.hidden = !on; };
  // Problems with the provider belong next to its settings; everything else to the data card.
  const fail = (e) => {
    const text = e.message || String(e);
    const box = /cloud|ключ|модел|провайдер|собеседник/i.test(text) ? $('set-ai-error') : $('set-error');
    box.hidden = false;
    box.textContent = text;
  };
  const clearError = () => { for (const id of ['set-error', 'set-ai-error']) { $(id).hidden = true; $(id).textContent = ''; } };

  async function call(path, options) {
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
    return data;
  }

  function renderAi(s) {
    const info = s.ai || { provider: 'reika', providers: [], key: { has: false, tail: '' } };
    const select = $('set-ai-provider');
    if (select.options.length <= 1) {
      for (const p of info.providers) {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.title} — по вашему ключу`;
        option.dataset.model = p.defaultModel || '';
        if (p.keyUrl) $('set-ai-help').href = p.keyUrl;
        select.appendChild(option);
      }
    }
    select.value = info.provider;
    const cloud = info.provider !== 'reika';
    show($('set-ai-cloud'), cloud);
    const chosen = select.selectedOptions[0];
    $('set-ai-model').placeholder = (chosen && chosen.dataset.model) || 'openai/gpt-oss-120b';
    $('set-ai-model').value = info.model || '';
    $('set-ai-key').value = '';
    $('set-ai-key').placeholder = info.key.has ? `сохранён ···${info.key.tail}` : 'вставьте ключ';
    show($('set-ai-key-clear'), info.key.has);
    $('set-ai-key-state').textContent = info.key.has
      ? 'Ключ сохранён на этом компьютере. Чтобы заменить его, вставьте новый и нажмите «Сохранить».'
      : 'Ключа пока нет: вставьте его и нажмите «Сохранить». Без ключа отвечает сама Рэйка.';
  }

  function render(s) {
    current = s;
    renderAi(s);
    $('set-port').value = s.port;
    $('set-port').min = s.limits ? s.limits.minPort : 1024;
    $('set-port').max = s.limits ? s.limits.maxPort : 65535;
    $('set-address').textContent = `127.0.0.1:${s.activePort || s.port}`;
    $('set-count').textContent = s.messages;
    $('set-datadir').textContent = s.dataDir || '—';
    const other = s.activePort && s.activePort !== s.port;
    show($('set-port-note'), !!other);
    if (other) $('set-port-note').textContent = `Сейчас занят другой порт: ${s.activePort}. Значит, порт ${s.port} был занят при запуске.`;
  }

  async function load() {
    try { render(await call('api/settings')); } catch { /* no server with this API: the page is not reachable anyway */ }
  }

  const save = (patch) => call('api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });

  $('set-save').addEventListener('click', async () => {
    clearError();
    show($('set-saved'), false);
    show($('set-ai-result'), false);
    const patch = { port: Number($('set-port').value), aiProvider: $('set-ai-provider').value, aiModel: $('set-ai-model').value };
    const key = $('set-ai-key').value.trim();
    if (key) patch.apiKey = key; // an empty field means "keep the stored key", not "remove it"
    try {
      render(await save(patch));
      show($('set-saved'), true);
    } catch (e) { fail(e); }
  });

  // ---- the AI provider ----
  $('set-ai-provider').addEventListener('change', () => {
    const cloud = $('set-ai-provider').value !== 'reika';
    show($('set-ai-cloud'), cloud);
    show($('set-ai-result'), false);
    const chosen = $('set-ai-provider').selectedOptions[0];
    if (chosen) $('set-ai-model').placeholder = chosen.dataset.model || 'openai/gpt-oss-120b';
  });

  $('set-ai-key-clear').addEventListener('click', async () => {
    if (!confirm('Убрать сохранённый ключ? Рэйка снова будет отвечать сама.')) return;
    clearError();
    try { render(await save({ apiKey: '' })); } catch (e) { fail(e); }
  });

  $('set-ai-check').addEventListener('click', async () => {
    clearError();
    const button = $('set-ai-check');
    const result = $('set-ai-result');
    button.disabled = true;
    result.hidden = false;
    result.textContent = 'Проверяю…';
    try {
      const key = $('set-ai-key').value.trim();
      // Check what will actually be used: save the provider (and a freshly typed key) first.
      await save({ aiProvider: $('set-ai-provider').value, aiModel: $('set-ai-model').value, ...(key ? { apiKey: key } : {}) });
      const answer = await call('api/ai/check', { method: 'POST' });
      const list = $('set-ai-models');
      list.textContent = '';
      for (const id of answer.models) { const option = document.createElement('option'); option.value = id; list.appendChild(option); }
      result.textContent = answer.models.length ? `Связь есть. Доступно моделей: ${answer.models.length} — список подсказок в поле «Модель».` : 'Связь есть, но список моделей пуст.';
      render(await call('api/settings'));
      show($('set-ai-result'), true);
    } catch (e) {
      result.hidden = true;
      fail(e);
      try { render(await call('api/settings')); } catch { /* the saved key is still shown on the next visit */ }
    } finally { button.disabled = false; }
  });

  $('set-sound').checked = sound.on();
  $('set-sound').addEventListener('change', (event) => {
    sound.set(event.target.checked);
    if (event.target.checked) sound.play(); // so you hear at once what you turned on
  });

  $('set-clear').addEventListener('click', async () => {
    if (!confirm('Очистить всю переписку с Рэйкой? Это нельзя отменить. Сохранённая копия не изменится.')) return;
    clearError();
    try {
      await call('api/history', { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('reika:history-cleared'));
      await load();
    } catch (e) { fail(e); }
  });

  $('set-import').addEventListener('change', async (event) => {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    clearError();
    if (!confirm(`Восстановить переписку из файла «${file.name}»? Текущая переписка будет заменена.`)) return;
    try {
      const result = await call('api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: file });
      window.dispatchEvent(new CustomEvent('reika:history-restored'));
      await load();
      alert(`Восстановлено сообщений: ${result.messages}.` + (result.skipped > 0 ? ` Пропущено непонятных записей: ${result.skipped}.` : ''));
    } catch (e) { fail(e); }
  });

  $('set-about').addEventListener('click', () => { if (window.ReikaShell) window.ReikaShell.about(); });

  window.addEventListener('reika:route', (event) => { if (event.detail === 'settings') { clearError(); show($('set-saved'), false); load(); } });
  load();
})();
