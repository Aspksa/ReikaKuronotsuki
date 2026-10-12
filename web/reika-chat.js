'use strict';
// Reika chat engine: text normalisation, emotion detection and the offline reply engine.
// Pure code with no Node APIs: the same file runs in the browser (window.ReikaChat) and in Node (require).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReikaChat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_TEXT = 2000;

  function normalizeText(input) {
    if (typeof input !== 'string') return '';
    return input
      .normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[\uFFFD]/g, '')
      .trim()
      .slice(0, MAX_TEXT);
  }

  // Lower-case, ё -> е, strip punctuation: used only for matching.
  function foldForMatch(text) {
    return text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  const RULES = [
    { name: 'greeting', emotion: 'happy', test: /(^| )(привет|здравствуй|здарова|добрый (день|вечер)|доброе утро|хай|hello|hi)( |$)/,
      replies: ['Привет! Я Рэйка. Рада тебя видеть.', 'Здравствуй. Луна сегодня красивая, правда?', 'О, ты пришёл! Я как раз ждала.'] },
    { name: 'farewell', emotion: 'sad', test: /(^| )(пока|до свидания|до встречи|спокойной ночи|прощай|bye)( |$)/,
      replies: ['Уже уходишь? Возвращайся скорее.', 'Спокойной ночи. Я подожду под луной.'] },
    { name: 'thanks', emotion: 'shy', test: /(^| )(спасибо|благодарю|thanks|thx)( |$)/,
      replies: ['Ой… не стоит. Мне приятно помогать.', 'Пожалуйста. Обращайся в любое время.'] },
    { name: 'name', emotion: 'neutral', test: /(как тебя зовут|твое имя|кто ты)/,
      replies: ['Меня зовут Рэйка Куроноцуки. Я девятихвостая кицунэ и твоя виртуальная спутница.'] },
    { name: 'howareyou', emotion: 'playful', test: /(как дела|как ты|как настроение|как жизнь)/,
      replies: ['Хорошо, особенно когда ты рядом. А у тебя как?', 'Хвосты в порядке, настроение спокойное. Расскажешь, как ты?'] },
    { name: 'tails', emotion: 'playful', test: /(хвост|уш[ки]|лиса|лисиц|кицунэ|кицуне)/,
      replies: ['У меня девять хвостов, и каждый живёт своей жизнью. Только не дёргай!', 'Уши — моя гордость. Они всегда слышат, когда ты пишешь.'] },
    { name: 'time', emotion: 'neutral', test: /(который час|сколько времени|сколько время|какое сейчас время|какое число|какая дата)/,
      reply: (ctx) => `Сейчас ${ctx.now.toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'short' })}.` },
    { name: 'sad', emotion: 'sad', test: /(груст|плохо|одиноко|устал|тревож|страшно|обидно)/,
      replies: ['Мне жаль это слышать. Я рядом, можешь рассказать подробнее.', 'Иногда нужно просто выдохнуть. Я послушаю.'] },
    { name: 'joy', emotion: 'happy', test: /(рад|ура|круто|класс|отлично|здорово|люблю)/,
      replies: ['Как чудесно! Я тоже радуюсь вместе с тобой.', 'Это замечательно. Расскажи ещё!'] },
    { name: 'surprise', emotion: 'surprised', test: /(неужели|правда\?|серьезно|ничего себе|вау)/,
      replies: ['Правда-правда! Я бы не стала выдумывать.'] },
    { name: 'help', emotion: 'serious', test: /(помоги|помощь|что ты умеешь|что умеешь|команды)/,
      replies: ['Пока я умею болтать, помнить нашу переписку и подсказывать время. Скоро научусь большему.'] },
  ];

  const FALLBACKS = [
    'Интересно. Расскажи мне об этом подробнее.',
    'Я слушаю. Что ты чувствуешь по этому поводу?',
    'Хм, давай подумаем вместе.',
    'Понимаю. Продолжай, пожалуйста.',
  ];

  function hashString(text) {
    let h = 2166136261;
    for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }

  function detectEmotion(text) {
    const folded = foldForMatch(normalizeText(text));
    for (const rule of RULES) if (rule.test.test(folded)) return rule.emotion;
    return 'neutral';
  }

  // Deterministic: the same input always gives the same reply, which keeps tests stable.
  function reply(input, ctx = {}) {
    const text = normalizeText(input);
    if (!text) return { text: 'Ты ничего не написал. Я всё ещё слушаю.', emotion: 'neutral', rule: 'empty' };
    const folded = foldForMatch(text);
    const context = { now: ctx.now || new Date() };
    for (const rule of RULES) {
      if (!rule.test.test(folded)) continue;
      const answer = rule.reply ? rule.reply(context) : rule.replies[hashString(folded) % rule.replies.length];
      return { text: answer, emotion: rule.emotion, rule: rule.name };
    }
    return { text: FALLBACKS[hashString(folded) % FALLBACKS.length], emotion: 'neutral', rule: 'fallback' };
  }

  return { normalizeText, foldForMatch, detectEmotion, reply, MAX_TEXT };
});
