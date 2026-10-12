'use strict';
// Entry point used by the launcher. The first stdout line is `REIKA_READY <json>` so the launcher learns the port.

const fs = require('node:fs');
const path = require('node:path');
const core = require('../core/reika-core');
const { createApp } = require('./server');
const { findFreePort } = require('./ports');
const { ProjectUpdater } = require('../update/updater');

const projectRoot = path.resolve(__dirname, '..');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(projectRoot, 'config.json'), 'utf8')); } catch { return {}; }
}

// If someone grabs the port between the check and the bind, fall back to any free port.
function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' && port !== 0) resolve(listen(server, host, 0));
      else reject(error);
    });
    server.listen(port, host, () => resolve(server.address().port));
  });
}

// Automatic checks only look for a new version: nothing is downloaded or installed without the user.
function scheduleUpdateChecks(updater) {
  const intervals = { off: 0, hourly: 60 * 60_000, daily: 24 * 60 * 60_000 };
  const tick = () => {
    const every = intervals[updater.getConfig().autoCheck];
    if (!every || updater.isBusy() || Date.now() - updater.lastCheckedAt() < every) return;
    updater.check(false).catch((e) => console.log(`Не удалось проверить обновления: ${e.message}`));
  };
  setTimeout(tick, 5000).unref();
  setInterval(tick, 15 * 60_000).unref();
}

async function main() {
  const config = Object.assign({ port: 8731 }, readConfig());
  const dataDir = core.resolveDataDir(projectRoot);
  const updater = new ProjectUpdater(projectRoot);
  // Only the launcher (launcher/boot.js) can install an update: it restarts this process with exit code 75.
  const restart = () => { if (process.env.REIKA_SUPERVISED !== '1') return false; setTimeout(() => process.exit(75), 300); return true; };
  const server = createApp({ webRoot: path.join(projectRoot, 'web'), dataDir, updater, restart });
  const host = '127.0.0.1'; // local only: the chat is never exposed to the network
  const free = await findFreePort(Number(process.env.REIKA_PORT) || Number(config.port) || 8731, { host });
  const port = await listen(server, host, free.port);
  if (!free.preferred) console.log(`Порт ${config.port} занят, использую свободный: ${port}`);
  const runtime = { pid: process.pid, port, url: `http://127.0.0.1:${port}/`, dataDir };
  console.log(`REIKA_READY ${JSON.stringify(runtime)}`);
  console.log(`Reika Kuronotsuki: ${runtime.url}`);
  scheduleUpdateChecks(updater);
  if (process.env.REIKA_SUPERVISED === '1') { process.stdin.resume(); process.stdin.on('end', () => process.exit(0)); }
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

main().catch((error) => { console.error(error); process.exit(1); });
