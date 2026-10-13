'use strict';
// Supervisor: installs a prepared update, starts the server, confirms (or rolls back) a freshly installed version.
//   node launcher/boot.js
// Exit code 75 from the server means "restart me" (the user pressed "install now").
// The installer code used here is the one loaded at start: it stays the known-good one for the whole session.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { applyPreparedUpdate, applyRollbackRequest, confirmUpdate, rollbackFailedStart } = require('../update/installer');

const root = process.env.REIKA_ROOT ? path.resolve(process.env.REIKA_ROOT) : path.resolve(__dirname, '..');
const RESTART_CODE = 75;
const READY_TIMEOUT_MS = Number(process.env.REIKA_READY_TIMEOUT_MS) || 30_000;
const HEALTH_WAIT_MS = Number(process.env.REIKA_HEALTH_WAIT_MS) || 5_000; // how long a fresh server may take to answer /api/health
const STABLE_MS = Number(process.env.REIKA_STABLE_MS) || 15_000; // a new version must stay up this long to be final
const say = (text) => console.log(text);

function getJson(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, json: null }); } });
    }).on('error', () => resolve(null));
    request.setTimeout(3000, () => request.destroy(new Error('Health check timeout')));
  });
}
// Healthy = HTTP 2xx and {ok:true}. Any other answer (even a quick 500) is NOT a working version.
async function healthy(url) {
  const r = await getJson(url + 'api/health');
  return !!r && r.status >= 200 && r.status < 300 && r.json?.ok === true;
}

let child = null;
let readyPrinted = false;

function runServer({ updateApplied, port }) {
  return new Promise((resolve) => {
    let settled = false, confirmed = false, serverUrl = null;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    child = spawn(process.execPath, [path.join(root, 'server', 'main.js')], {
      cwd: root, stdio: ['pipe', 'pipe', 'inherit'], // stdin stays open: the server quits when it closes (supervisor died)
      env: { ...process.env, REIKA_SUPERVISED: '1', ...(port ? { REIKA_PORT: String(port) } : {}) },
    });
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) onLine(line);
    });
    async function onLine(line) {
      if (!line.startsWith('REIKA_READY ')) return say(line);
      let info; try { info = JSON.parse(line.slice(12)); } catch { return; }
      serverUrl = info.url;
      if (!(await waitHealthy(serverUrl))) { killChild(); return finish({ failedStart: true, message: 'Сервер не ответил на проверку состояния' }); }
      if (!readyPrinted) { readyPrinted = true; say(line); } // the tray reads the first READY line only
      if (updateApplied) setTimeout(async () => {
        if (settled || !child || child.exitCode !== null) return;
        try {
          await confirmUpdate(root);
          confirmed = true;
          say('Новая версия подтверждена.');
        } catch (e) {
          say('Не удалось подтвердить новую версию: ' + e.message);
          killChild();
        }
      }, STABLE_MS).unref?.();
      result.port = info.port;
    }
    const result = { port: null };
    child.on('exit', (code) => {
      if (code === RESTART_CODE) return finish({ restart: true, port: result.port });
      if (updateApplied && !confirmed) return finish({ failedStart: true, message: `Новая версия завершилась с кодом ${code}`, code });
      finish({ code: code ?? 0 });
    });
    child.on('error', (e) => finish({ failedStart: true, message: e.message }));
    setTimeout(() => { if (!serverUrl && !settled) { killChild(); finish({ failedStart: true, message: 'Сервер не запустился за отведённое время' }); } }, READY_TIMEOUT_MS).unref();
  });
}
async function waitHealthy(url) {
  const end = Date.now() + HEALTH_WAIT_MS;
  do { if (await healthy(url)) return true; await new Promise((r) => setTimeout(r, 250)); } while (Date.now() < end);
  return false;
}
function killChild() { try { child?.kill(); } catch { /* gone */ } }

async function main() {
  process.on('SIGINT', () => { killChild(); process.exit(0); });
  process.on('SIGTERM', () => { killChild(); process.exit(0); });
  let port = null;
  for (let round = 0; round < 10; round++) {
    let updateApplied = false;
    try { if (await applyRollbackRequest(root)) say('Выполнен откат на предыдущую версию.'); }
    catch (e) { say(`Откат не выполнен: ${e?.message ?? e}. Запускается текущая версия.`); }
    try { updateApplied = await applyPreparedUpdate(root); if (updateApplied) say('Обновление установлено.'); }
    catch (e) {
      say(`Обновление не установлено: ${e?.message ?? e}. Запускается текущая версия.`);
      // A busy lock is another launcher's work: leave the manifest. Anything else is set aside so it cannot block every start.
      if (e?.code !== 'EBUSY_UPDATE' && !fs.existsSync(path.join(root, '.updates', 'install-journal.json'))) {
        try { fs.renameSync(path.join(root, '.updates', 'ready.json'), path.join(root, '.updates', `ready.failed-${Date.now()}.json`)); } catch { /* keep going */ }
      }
    }
    // A power loss may happen after install() wrote pending-confirm.json but before
    // boot.js could confirm startup. Treat that version as unconfirmed on every launch.
    if (!updateApplied && fs.existsSync(path.join(root, '.updates', 'pending-confirm.json'))) updateApplied = true;
    const result = await runServer({ updateApplied, port });
    port = result.port || port;
    if (result.restart) continue;
    if (result.failedStart && updateApplied) {
      say(`Новая версия не запустилась (${result.message}). Возвращаю прежнюю.`);
      try { if (await rollbackFailedStart(root, result.message)) continue; } catch (e) { say(`Откат не удался: ${e?.message ?? e}`); }
    }
    process.exit(result.code ?? 1);
  }
  process.exit(1);
}
main();
