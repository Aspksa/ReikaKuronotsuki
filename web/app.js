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

  async function api(path, options) {
    const response = await fetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка');
    return data;
  }

  function autosize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    try {
      const { user, reika } = await api('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ text }) });
      input.value = '';
      autosize();
      render(user);
      render(reika);
      setMood(reika.emotion);
    } catch (error) {
      render({ role: 'reika', text: `⚠ ${error.message}`, at: new Date().toISOString() });
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (event) => {
    // Desktop: Enter sends, Shift+Enter makes a new line. On touch keyboards Enter also sends via the "send" key.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
  });

  document.getElementById('clear').addEventListener('click', async () => {
    if (!confirm('Удалить всю историю переписки?')) return;
    await api('/api/history', { method: 'DELETE' });
    log.textContent = '';
    setMood('neutral');
  });

  api('/api/history').then(({ messages }) => {
    if (!messages.length) render({ role: 'reika', text: 'Здравствуй. Я Рэйка. О чём поговорим?', at: new Date().toISOString() });
    for (const m of messages) render(m);
    const last = messages.filter((m) => m.role === 'reika').pop();
    if (last) setMood(last.emotion);
  }).catch(() => render({ role: 'reika', text: '⚠ Не удалось загрузить историю.', at: new Date().toISOString() }));
})();
