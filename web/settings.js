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
  const fail = (e) => { $('set-error').hidden = false; $('set-error').textContent = e.message || String(e); };
  const clearError = () => { $('set-error').hidden = true; $('set-error').textContent = ''; };

  async function call(path, options) {
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
    return data;
  }

  function render(s) {
    current = s;
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

  $('set-save').addEventListener('click', async () => {
    clearError();
    show($('set-saved'), false);
    try {
      render(await call('api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port: Number($('set-port').value) }) }));
      show($('set-saved'), true);
    } catch (e) { fail(e); }
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
