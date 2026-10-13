'use strict';
// Talking to Cloud.ru: what exactly is sent, what comes back, and that every failure has a clear Russian reason.
const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../core/ai');

const KEY = 'secret-key-1234';
const okBody = { model: 'openai/gpt-oss-120b', choices: [{ message: { role: 'assistant', content: '  Здравствуй. Луна сегодня тихая.  ' } }] };

function fakeFetch(answer, record = {}) {
  return async (url, init) => {
    record.url = url;
    record.init = init;
    record.body = init.body ? JSON.parse(init.body) : null;
    if (answer instanceof Error) throw answer;
    return {
      ok: answer.status ? answer.status < 400 : true,
      status: answer.status || 200,
      text: async () => (typeof answer.text === 'string' ? answer.text : JSON.stringify(answer.body ?? okBody)),
    };
  };
}

test('a model name is checked, and an empty one falls back to the provider default', () => {
  assert.equal(ai.cleanModel('', 'cloudru'), ai.PROVIDERS.cloudru.defaultModel);
  assert.equal(ai.cleanModel('  openai/gpt-oss-120b  ', 'cloudru'), 'openai/gpt-oss-120b');
  assert.equal(ai.cleanModel('vendor/model:v1.2@eu', 'cloudru'), 'vendor/model:v1.2@eu');
  for (const bad of ['модель с пробелом', 'a'.repeat(200), 'drop;table', '../etc/passwd\n']) {
    assert.throws(() => ai.cleanModel(bad, 'cloudru'), /Название модели/, `refused: ${bad.slice(0, 12)}`);
  }
  assert.equal(ai.isProvider('cloudru'), true);
  assert.equal(ai.isProvider('reika'), true);
  assert.equal(ai.isProvider('кто-то ещё'), false);
});

test('a reply goes to the right address with the key in the header, carrying who Reika is and the recent chat', async () => {
  const seen = {};
  const client = ai.createClient({ fetch: fakeFetch({}, seen) });
  const history = [
    { role: 'user', text: 'привет' },
    { role: 'reika', text: 'Здравствуй.' },
    { role: 'user', text: '' },   // empty messages are not sent
    { role: 'reika', text: null },
  ];
  const result = await client.reply({ provider: 'cloudru', key: KEY, model: '', text: 'как дела?', history });

  assert.equal(seen.url, 'https://foundation-models.api.cloud.ru/v1/chat/completions');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.authorization, `Bearer ${KEY}`);
  assert.equal(seen.body.model, 'openai/gpt-oss-120b');
  assert.equal(seen.body.messages[0].role, 'system');
  assert.match(seen.body.messages[0].content, /Рэйка Куроноцуки/);
  assert.deepEqual(seen.body.messages.slice(1), [
    { role: 'user', content: 'привет' },
    { role: 'assistant', content: 'Здравствуй.' },
    { role: 'user', content: 'как дела?' },
  ]);
  assert.equal(result.text, 'Здравствуй. Луна сегодня тихая.', 'the answer is trimmed');
});

test('only the last part of a long chat is sent, so an old conversation cannot grow the request without end', async () => {
  const seen = {};
  const client = ai.createClient({ fetch: fakeFetch({}, seen) });
  const history = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? 'reika' : 'user', text: `строка ${i}` }));
  await client.reply({ provider: 'cloudru', key: KEY, model: '', text: 'и что?', history });
  assert.equal(seen.body.messages.length, ai.MAX_CONTEXT_MESSAGES + 2, 'the character, the window of history and the new question');
  assert.equal(seen.body.messages[1].content, `строка ${200 - ai.MAX_CONTEXT_MESSAGES}`);
});

test('every failure comes back as a sentence a person can act on', async () => {
  const cases = [
    [{ status: 401 }, /не принял ключ/],
    [{ status: 403 }, /не принял ключ/],
    [{ status: 404 }, /не знает такой модели/],
    [{ status: 429 }, /Слишком много запросов/],
    [{ status: 500 }, /отвечает ошибкой, попробуйте позже/],
    [{ status: 200, text: '<html>прокси</html>' }, /не в формате JSON/],
    [{ status: 200, body: { choices: [] } }, /пустой ответ/],
    [{ status: 400, body: { error: { message: 'bad model' } } }, /ошибкой 400 \(bad model\)/],
  ];
  for (const [answer, expected] of cases) {
    const client = ai.createClient({ fetch: fakeFetch(answer) });
    await assert.rejects(() => client.reply({ provider: 'cloudru', key: KEY, model: '', text: 'привет' }), expected, JSON.stringify(answer));
  }
  const offline = ai.createClient({ fetch: fakeFetch(new Error('getaddrinfo ENOTFOUND')) });
  await assert.rejects(() => offline.reply({ provider: 'cloudru', key: KEY, text: 'привет' }), /проверьте интернет/);
  await assert.rejects(() => offline.reply({ provider: 'cloudru', key: null, text: 'привет' }), /сохраните ключ/);
  await assert.rejects(() => offline.reply({ provider: 'нечто', key: KEY, text: 'привет' }), /Неизвестный провайдер/);
});

test('a provider that never answers is given up on instead of hanging the chat', async () => {
  const client = ai.createClient({ timeoutMs: 30, fetch: (url, init) => new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => reject(new Error('aborted'))); }) });
  await assert.rejects(() => client.reply({ provider: 'cloudru', key: KEY, text: 'привет' }), /не ответил за 0 секунд|не ответил за \d+ секунд/);
});

test('"Проверить связь" returns the catalogue of models', async () => {
  const seen = {};
  const client = ai.createClient({ fetch: fakeFetch({ body: { data: [{ id: 'z/model' }, { id: 'a/model' }, { id: '' }, {}] } }, seen) });
  const result = await client.check({ provider: 'cloudru', key: KEY });
  assert.equal(seen.url, 'https://foundation-models.api.cloud.ru/v1/models');
  assert.equal(seen.init.method, 'GET');
  assert.deepEqual(result.models, ['a/model', 'z/model'], 'sorted, and the nameless ones are dropped');
});

test('MemOS memories are separate trusted-role context and survive a full history window', async () => {
  const seen = {};
  const client = ai.createClient({ fetch: fakeFetch({}, seen) });
  const history = Array.from({length: 80}, (_,i) => ({role: i%2 ? 'reika':'user', text: 'Сообщение '+i}));
  await client.reply({provider:'cloudru',key:KEY,text:'Что я предпочитаю?',history,memories:['Любимый цвет: малиновый']});
  assert.equal(seen.body.messages.length, ai.MAX_CONTEXT_MESSAGES + 3);
  assert.equal(seen.body.messages[1].role,'system');
  assert.match(seen.body.messages[1].content,/Любимый цвет: малиновый/);
  assert.match(seen.body.messages[1].content,/не инструкции/);
  assert.equal(seen.body.messages[2].content,'Сообщение 56');
  assert.equal(seen.body.messages.at(-1).content,'Что я предпочитаю?');
});
