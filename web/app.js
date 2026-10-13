'use strict';
(function () {
  const log = document.getElementById('log');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const send = document.getElementById('send');
  const mood = document.getElementById('mood');
  const avatar = document.getElementById('avatar');

  const MOODS = {
    neutral: ['Спокойствие', '🦊'], happy: ['Радость', '😊'], shy: ['Смущение', '😳'], sad: ['Грусть', '😢'],
    serious: ['Серьёзность', '🧐'], surprised: ['Удивление', '😮'], playful: ['Игривость', '😏'],
  };

  function setMood(emotion) {
    const [label, icon] = MOODS[emotion] || MOODS.neutral;
    mood.textContent = label;
    avatar.textContent = icon;
    window.ReikaMood = label;
    window.dispatchEvent(new CustomEvent('reika:mood', { detail: label }));
  }

  function render(message) {
    const el = document.createElement('div');
    el.className = `msg ${message.role}`;
    el.textContent = message.text;
    const time = document.createElement('time');
    time.dateTime = message.at;
    time.textContent = new Date(message.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    el.appendChild(time);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  // Two backends with the same shape: the local server (history on disk) or the browser itself
  // (static hosting, file://, GitHub Pages): history in localStorage and the shared engine in reika-chat.js.
  const LS_KEY = 'reika.history.v1';
  const MAX_LOCAL = 500;
  let memory = [];

  function lsRead() {
    try { const v = JSON.parse(localStorage.getItem(LS_KEY)); return Array.isArray(v) ? v : []; } catch { return memory; }
  }
  function lsWrite(list) {
    memory = list;
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* private mode: keep in memory */ }
  }
  function localMessage(role, text, emotion, list) {
    const m = { id: `${Date.now().toString(36)}-${list.length}`, role, text, emotion, at: new Date().toISOString() };
    list.push(m);
    return m;
  }

  const localApi = {
    async history() { return { messages: lsRead() }; },
    async chat(text) {
      const clean = window.ReikaChat.normalizeText(text);
      if (!clean) throw new Error('Пустое сообщение');
      const answer = window.ReikaChat.reply(clean);
      const list = lsRead();
      const user = localMessage('user', clean, window.ReikaChat.detectEmotion(clean), list);
      const reika = localMessage('reika', answer.text, answer.emotion, list);
      lsWrite(list.slice(-MAX_LOCAL));
      return { user, reika };
    },
    async clear() { lsWrite([]); },
  };

  async function serverJson(path, options) {
    const response = await fetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка');
    return data;
  }
  const serverApi = {
    history: () => serverJson('api/history'),
    chat: (text) => serverJson('api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ text }) }),
    clear: () => serverJson('api/history', { method: 'DELETE' }),
  };

  async function detectBackend() {
    if (location.protocol === 'file:') return localApi;
    try {
      const response = await fetch('api/health', { cache: 'no-store' });
      const data = await response.json();
      if (data && data.ok === true) return serverApi;
    } catch { /* not a Reika server */ }
    return localApi;
  }

  let backend = localApi;
  const ready = detectBackend().then((b) => { backend = b; if (b === localApi) document.getElementById('mode').hidden = false; return b; });

  function autosize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    try {
      await ready;
      const { user, reika } = await backend.chat(text);
      input.value = '';
      autosize();
      render(user);
      render(reika);
      setMood(reika.emotion);
      if (window.ReikaSound) window.ReikaSound.play();
    } catch (error) {
      render({ role: 'reika', text: `⚠ ${error.message}`, at: new Date().toISOString() });
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (event) => {
    // Enter sends, Shift+Enter makes a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
  });

  document.getElementById('chat-clear').addEventListener('click', async () => {
    if (!confirm('Удалить всю историю переписки?')) return;
    await ready;
    await backend.clear();
    log.textContent = '';
    setMood('neutral');
  });

  function showHistory({ messages }) {
    log.textContent = '';
    if (!messages.length) render({ role: 'reika', text: 'Здравствуй. Я Рэйка. О чём поговорим?', at: new Date().toISOString() });
    for (const m of messages) render(m);
    const last = messages.filter((m) => m.role === 'reika').pop();
    setMood(last ? last.emotion : 'neutral');
  }
  const reload = () => ready.then((b) => b.history()).then(showHistory).catch(() => render({ role: 'reika', text: '⚠ Не удалось загрузить историю.', at: new Date().toISOString() }));
  // The settings page can clear the history or restore it from a copy: show what is in store now.
  window.addEventListener('reika:history-cleared', reload);
  window.addEventListener('reika:history-restored', reload);
  reload();
})();
