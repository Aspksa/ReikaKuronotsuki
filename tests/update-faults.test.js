'use strict';
// Fault injection: a real local HTTP server plays "GitHub" and misbehaves the way real networks do
// (cut connections, stalls, endless streams, HTML error pages, bad headers). The updater must fail
// cleanly, quickly and without leaving a "ready" update, or recover when the network does.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { ProjectUpdater } = require('../update/updater');
const { gitHash, REPO } = require('../update/shared');
const { SHA_B, tmpProject, write } = require('./update-helpers');

const ok = [{ name: 'tests', status: 'completed', conclusion: 'success' }];
const buf = (x) => (Buffer.isBuffer(x) ? x : Buffer.from(x));

// site: { files: {path: content}, ci, tree (override), api: {route: handler}, raw: {path: handler}, hits: [] }
async function githubServer(site) {
  site.hits = []; site.attempts = {};
  const base = `/repos/${REPO}`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    site.hits.push(url.pathname);
    const sendJson = (body, status = 200, headers = {}) => { const t = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(t), ...headers }); res.end(t); };
    const custom = site.api?.[url.pathname.replace(base, '')];
    if (custom) return custom(req, res, sendJson);
    if (url.pathname === `${base}/commits/main`) return sendJson({ sha: SHA_B, commit: { message: 'Новая версия', committer: { date: '2026-01-01T00:00:00Z' } } });
    if (url.pathname.includes('/check-runs')) return sendJson({ total_count: (site.ci ?? ok).length, check_runs: site.ci ?? ok });
    if (url.pathname.includes('/compare/')) return sendJson({}, 404);
    if (url.pathname.startsWith(`${base}/git/trees/`)) return sendJson(site.tree ?? { truncated: false, tree: Object.entries(site.files).map(([p, c]) => ({ path: p, mode: '100644', type: 'blob', sha: gitHash(buf(c)), size: buf(c).length })) });
    if (url.pathname.startsWith(`/raw/${SHA_B}/`)) {
      const rel = decodeURIComponent(url.pathname.slice(`/raw/${SHA_B}/`.length));
      site.attempts[rel] = (site.attempts[rel] ?? 0) + 1;
      const handler = site.raw?.[rel];
      if (handler) return handler(req, res, site.attempts[rel]);
      const body = buf(site.files[rel] ?? '');
      res.writeHead(site.files[rel] === undefined ? 404 : 200, { 'content-length': body.length });
      return res.end(body);
    }
    res.writeHead(404); res.end();
  });
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { apiBase: `http://127.0.0.1:${port}${base}`, rawBase: `http://127.0.0.1:${port}/raw`, close: () => { for (const s of sockets) s.destroy(); return new Promise((r) => server.close(r)); } };
}

async function withSite(site, fn, { root = tmpProject(), opts = {} } = {}) {
  const gh = await githubServer(site);
  const u = new ProjectUpdater(root, { apiBase: gh.apiBase, rawBase: gh.rawBase, retryDelaysMs: [0, 0], freeBytes: () => 1e12, runner: async () => {}, timeouts: { api: 600, file: 4000, idle: 300 }, ...opts });
  try { await fn(u, root, site); } finally { await gh.close(); }
}
const withinMs = (ms, promise, label) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`HUNG: ${label} did not finish within ${ms} ms`)), ms).unref())]);
const readyFile = (root) => path.join(root, '.updates', 'ready.json');

test('baseline: the fake GitHub works end to end (Cyrillic, spaces and URL-special characters in names; empty and binary files)', () => {
  const binary = crypto.randomBytes(300_000);
  const site = { files: { 'документ Рэйки #1 ?x %y+z.txt': 'привет', 'пустой.txt': '', 'bin/data.bin': binary, 'a b/c.js': '1' } };
  return withSite(site, async (u, root) => {
    await u.start();
    assert.equal(u.status().phase, 'ready', u.status().error);
    assert.deepEqual(fs.readFileSync(path.join(root, '.updates/staging/bin/data.bin')), binary);
    assert.equal(fs.readFileSync(path.join(root, '.updates/staging/документ Рэйки #1 ?x %y+z.txt'), 'utf8'), 'привет');
    assert.equal(fs.readFileSync(path.join(root, '.updates/staging/пустой.txt')).length, 0);
  });
});

test('a connection cut in the middle of a file is retried and finally reported; nothing is left ready', () => {
  const site = { files: { 'a.txt': 'x'.repeat(5000) }, raw: { 'a.txt': (req, res) => { res.writeHead(200, { 'content-length': 5000 }); res.write('x'.repeat(100)); setTimeout(() => res.socket.destroy(), 20); } } };
  return withSite(site, async (u, root, s) => {
    await withinMs(8000, u.start(), 'start');
    assert.equal(u.status().phase, 'error');
    assert.equal(s.attempts['a.txt'], 3, 'three attempts, then give up');
    assert.ok(!fs.existsSync(readyFile(root)));
  });
});

test('an instantly reset connection and then recovery: the next attempt succeeds', () => {
  const site = { files: { 'a.txt': 'hello' }, raw: { 'a.txt': (req, res, n) => { if (n < 3) return res.socket.destroy(); res.writeHead(200, { 'content-length': 5 }); res.end('hello'); } } };
  return withSite(site, async (u) => { await u.start(); assert.equal(u.status().phase, 'ready', u.status().error); });
});

test('a body that ends early (short but cleanly closed) is an integrity error, not an install', () => {
  const site = { files: { 'a.txt': 'abcdefghij' }, raw: { 'a.txt': (req, res) => { res.writeHead(200); res.end('abcde'); } } };
  return withSite(site, async (u, root) => {
    await u.start();
    assert.equal(u.status().phase, 'error');
    assert.match(u.status().error, /контроля целостности/);
    assert.ok(!fs.existsSync(readyFile(root)));
  });
});

test('same length but one flipped byte, and an HTML error page served as 200, are both rejected', () => {
  const good = 'const x = 1;\n';
  const flipped = good.replace('1', '2');
  const portal = '<html><body>Please sign in to the Wi-Fi</body></html>'.padEnd(good.length, ' ').slice(0, good.length);
  return Promise.all([flipped, portal].map((bad) => withSite({ files: { 'a.js': good }, raw: { 'a.js': (req, res) => { res.writeHead(200, { 'content-length': Buffer.byteLength(bad) }); res.end(bad); } } }, async (u, root) => {
    await u.start();
    assert.equal(u.status().phase, 'error');
    assert.match(u.status().error, /контроля целостности/);
    assert.ok(!fs.existsSync(readyFile(root)));
  })));
});

test('an endless stream is cut off at the declared size: bounded memory, quick failure', () => {
  let sent = 0;
  const site = { files: { 'a.txt': 'x'.repeat(1000) }, raw: { 'a.txt': (req, res) => {
    res.writeHead(200); // no content-length: the server just keeps going
    const chunk = Buffer.alloc(65536, 120);
    const pump = () => { if (res.destroyed || res.writableEnded) return; sent += chunk.length; if (res.write(chunk)) setImmediate(pump); else res.once('drain', pump); };
    pump();
  } } };
  return withSite(site, async (u, root) => {
    await withinMs(8000, u.start(), 'start (endless stream)');
    assert.equal(u.status().phase, 'error');
    assert.ok(sent < 30 * 1024 * 1024, `the server was allowed to send ${sent} bytes`);
    assert.ok(!fs.existsSync(readyFile(root)));
  });
});

test('a declared Content-Length larger than the file is refused before downloading it', () => {
  let sent = 0;
  const site = { files: { 'a.txt': 'x'.repeat(1000) }, raw: { 'a.txt': (req, res) => { res.writeHead(200, { 'content-length': 50_000_000 }); const pump = () => { if (res.destroyed) return; sent += 65536; if (res.write(Buffer.alloc(65536))) setImmediate(pump); else res.once('drain', pump); }; pump(); } } };
  return withSite(site, async (u, root, s2) => {
    await withinMs(8000, u.start(), 'start (huge content-length)');
    assert.equal(u.status().phase, 'error');
    assert.ok(sent < 25 * 1024 * 1024, `the server pushed ${sent} of the declared 50 MB`);
    assert.equal(site.attempts['a.txt'], 1, 'an oversized answer is not retried');
  });
});

test('a server that sends headers and then stalls does not hang the update (idle timeout, retried)', () => {
  const site = { files: { 'a.txt': 'x'.repeat(1000) }, raw: { 'a.txt': (req, res) => { res.writeHead(200, { 'content-length': 1000 }); res.write('x'.repeat(10)); /* then silence */ } } };
  return withSite(site, async (u, root, s) => {
    await withinMs(8000, u.start(), 'start (stalled body)');
    assert.equal(u.status().phase, 'error');
    assert.match(u.status().error, /время ожидания|Истекло/);
    assert.equal(s.attempts['a.txt'], 3);
  });
});

test('a slow but steady download is NOT treated as stalled', () => {
  const body = 'y'.repeat(40);
  const site = { files: { 'a.txt': body }, raw: { 'a.txt': (req, res) => { res.writeHead(200, { 'content-length': body.length }); let i = 0; const t = setInterval(() => { res.write(body[i++]); if (i === body.length) { clearInterval(t); res.end(); } }, 25); res.on('close', () => clearInterval(t)); } } };
  return withSite(site, async (u) => { await withinMs(8000, u.start(), 'slow drip'); assert.equal(u.status().phase, 'ready', u.status().error); });
});

test('the GitHub API answering with headers and then stalling times out instead of hanging', () => {
  const site = { files: { 'a.txt': 'x' }, api: { '/commits/main': (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"sha":'); } } };
  return withSite(site, async (u) => { await assert.rejects(withinMs(5000, u.check(), 'check (stalled API)'), /время ожидания|Истекло|abort/i); });
});

test('malformed API answers fail with a clear error and never crash or corrupt state', async () => {
  const bodies = ['not json', '[]', 'null', '"text"', '{"sha":123}', '<html>502 Bad Gateway</html>', ''];
  for (const text of bodies) {
    await withSite({ files: { 'a.txt': 'x' }, api: { '/commits/main': (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(text); } } }, async (u) => {
      await assert.rejects(u.check(), Error, `body ${JSON.stringify(text)}`);
      assert.equal(u.status().latest, null);
      assert.equal(u.status().phase, 'idle');
    });
  }
});

test('a truncated file list, symlinks, submodules and case/Unicode duplicates are refused', async () => {
  const entry = (p, extra = {}) => ({ path: p, mode: '100644', type: 'blob', sha: gitHash(Buffer.from('x')), size: 1, ...extra });
  const cases = [
    [{ truncated: true, tree: [entry('a.txt')] }, /Неполный список/],
    [{ truncated: false, tree: [entry('link', { mode: '120000' })] }, /символическ|symlink/i],
    [{ truncated: false, tree: [entry('sub', { type: 'commit', mode: '160000' })] }, /подмодул|submodule/i],
    [{ truncated: false, tree: [entry('A.txt'), entry('a.txt')] }, /повтор/],
    [{ truncated: false, tree: [entry('café.txt'), entry('café.txt')] }, /повтор/],
    [{ truncated: false, tree: [entry('a.txt', { size: -5 })] }, /размер/i],
    [{ truncated: false, tree: [entry('a.txt', { size: 'big' })] }, /размер/i],
    [{ truncated: false, tree: [entry('a.txt', { sha: 'zzz' })] }, /Недопустимый/],
    [{ truncated: false, tree: 'nope' }, /Неполный/],
  ];
  for (const [tree, message] of cases) {
    await withSite({ files: { 'a.txt': 'x' }, tree }, async (u, root) => {
      await u.start();
      assert.equal(u.status().phase, 'error', JSON.stringify(tree).slice(0, 80));
      assert.match(u.status().error, message);
      assert.ok(!fs.existsSync(readyFile(root)));
    });
  }
});

test('a bogus rate-limit reset time cannot lock the updater out for years (and survives no restart)', () => {
  const site = { files: { 'a.txt': 'x' }, api: { '/commits/main': (req, res) => { res.writeHead(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '99999999999' }); res.end('{}'); } } };
  return withSite(site, async (u, root) => {
    await assert.rejects(u.check(), /Лимит запросов/);
    assert.ok(u.rateLimitUntil <= Date.now() + 3_600_000 + 5000, `locked until ${new Date(u.rateLimitUntil).toISOString()}`);
    const again = new ProjectUpdater(root, {});
    assert.ok(again.rateLimitUntil <= Date.now() + 3_600_000 + 5000, 'the saved lock must be clamped too');
    for (const header of ['-5', 'abc', '0', '1e999']) {
      u.rateLimitUntil = 0;
      site.api['/commits/main'] = (req, res) => { res.writeHead(429, { 'retry-after': header }); res.end('{}'); };
      await assert.rejects(u.check());
      assert.ok(u.rateLimitUntil <= Date.now() + 3_600_000 + 5000 && Number.isFinite(u.rateLimitUntil), `retry-after ${header}`);
    }
  });
});

test('a damaged check-cache.json is ignored: no crash, no strange values shown on the page', () => {
  const root = tmpProject();
  write(root, '.updates/check-cache.json', JSON.stringify({ checkedAt: 'yesterday', rateLimitUntil: 9e15, channel: 'fresh', latest: { sha: 123, version: { x: 1 }, ci: 'weird', changes: 'x', date: 5 } }));
  const u = new ProjectUpdater(root, {});
  const st = u.status();
  assert.equal(st.latest, null);
  assert.equal(st.rateLimitedUntil, null);
  assert.equal(typeof st.localVersion, 'string');
  write(root, '.updates/check-cache.json', '{ this is not json');
  assert.doesNotThrow(() => new ProjectUpdater(root, {}).status());
  write(root, '.updates/config.json', JSON.stringify({ channel: ['x'], autoCheck: 5 }));
  assert.deepEqual(new ProjectUpdater(root, {}).getConfig(), { channel: 'fresh', autoCheck: 'hourly' });
});

test('cancel works while a download is stalled, immediately', () => {
  const site = { files: { 'a.txt': 'x'.repeat(1000) }, raw: { 'a.txt': (req, res) => { res.writeHead(200, { 'content-length': 1000 }); res.write('x'); } } };
  return withSite(site, async (u, root, s) => {
    const running = u.start();
    while (!s.attempts['a.txt']) await new Promise((r) => setTimeout(r, 10));
    const t0 = Date.now();
    u.cancel();
    await withinMs(2000, running, 'cancel during a stalled download');
    assert.ok(Date.now() - t0 < 1500);
    assert.equal(u.status().phase, 'idle');
    assert.ok(!fs.existsSync(readyFile(root)));
  }, { opts: { timeouts: { api: 600, file: 60_000, idle: 60_000 } } });
});

test('a second start() while one runs is rejected; the first still completes', () => {
  const site = { files: { 'a.txt': 'x' }, raw: { 'a.txt': (req, res) => setTimeout(() => { res.writeHead(200, { 'content-length': 1 }); res.end('x'); }, 150) } };
  return withSite(site, async (u) => {
    const first = u.start();
    await assert.rejects(u.start(), /уже выполняется/);
    await first;
    assert.equal(u.status().phase, 'ready', u.status().error);
  });
});

test('redirects are followed and verified; a redirect loop fails instead of spinning', () => {
  const site = { files: { 'a.txt': 'real' }, raw: { 'a.txt': (req, res) => { res.writeHead(302, { location: '/raw/' + SHA_B + '/moved.txt' }); res.end(); }, 'moved.txt': (req, res) => { res.writeHead(200, { 'content-length': 4 }); res.end('real'); } } };
  return withSite(site, async (u) => {
    await u.start();
    assert.equal(u.status().phase, 'ready', u.status().error);
  }).then(() => withSite({ files: { 'a.txt': 'real' }, raw: { 'a.txt': (req, res) => { res.writeHead(302, { location: req.url }); res.end(); } } }, async (u) => {
    await withinMs(8000, u.start(), 'redirect loop');
    assert.equal(u.status().phase, 'error');
  }));
});

test('after a failed attempt the next one recovers and reuses what was already verified', () => {
  let failing = true;
  const site = { files: { 'a.txt': 'aaa', 'b.txt': 'bbb' }, raw: { 'b.txt': (req, res) => { if (failing) return res.socket.destroy(); res.writeHead(200, { 'content-length': 3 }); res.end('bbb'); } } };
  return withSite(site, async (u, root, s) => {
    await u.start();
    assert.equal(u.status().phase, 'error');
    failing = false;
    const before = s.attempts['a.txt'];
    await u.start();
    assert.equal(u.status().phase, 'ready', u.status().error);
    assert.equal(s.attempts['a.txt'], before, 'the verified file was kept, not downloaded again');
  });
});

test('a stray file where the staging folder belongs heals itself; a file where .updates belongs is a clean error', async () => {
  const root = tmpProject();
  write(root, '.updates/staging', 'a FILE where the folder should be');
  await withSite({ files: { 'a.txt': 'x' } }, async (u) => { await u.start(); assert.equal(u.status().phase, 'ready', u.status().error); }, { root });

  const blocked = tmpProject();
  write(blocked, '.updates', 'a FILE where the whole update folder should be');
  await withSite({ files: { 'a.txt': 'x' } }, async (u) => {
    await u.start();
    assert.equal(u.status().phase, 'error');
    assert.equal(typeof u.status().error, 'string');
    assert.equal(u.isBusy(), false, 'the updater must be usable again');
  }, { root: blocked });
});

test('gzip answers: a tiny file whose COMPRESSED size is bigger than the file is accepted (found with the real GitHub)', () => {
  const body = Buffer.from('{ "port": 8731 }\n'); // 17 bytes; gzip makes it 37
  const gz = zlib.gzipSync(body);
  assert.ok(gz.length > body.length);
  const site = { files: { 'config.default.json': body }, raw: { 'config.default.json': (req, res) => { res.writeHead(200, { 'content-encoding': 'gzip', 'content-length': gz.length }); res.end(gz); } } };
  return withSite(site, async (u, root) => {
    await u.start();
    assert.equal(u.status().phase, 'ready', u.status().error);
    assert.deepEqual(fs.readFileSync(path.join(root, '.updates/staging/config.default.json')), body);
  });
});

test('a gzip bomb (tiny on the wire, huge when decoded) is cut off at the declared size', () => {
  const bomb = zlib.gzipSync(Buffer.alloc(200 * 1024 * 1024, 0)); // ~200 KB compressed, 200 MB decoded
  const site = { files: { 'a.txt': 'x'.repeat(1000) }, raw: { 'a.txt': (req, res) => { res.writeHead(200, { 'content-encoding': 'gzip', 'content-length': bomb.length }); res.end(bomb); } } };
  return withSite(site, async (u, root) => {
    const before = process.memoryUsage().arrayBuffers;
    await withinMs(15000, u.start(), 'gzip bomb');
    assert.equal(u.status().phase, 'error');
    assert.ok(process.memoryUsage().arrayBuffers - before < 60 * 1024 * 1024, 'the decoded bytes must not pile up in memory');
    assert.ok(!fs.existsSync(readyFile(root)));
  });
});
