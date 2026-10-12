'use strict';
// Entry point used by the launcher. The first stdout line is `REIKA_READY <json>` so the launcher learns the port.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const core = require('../core/reika-core');
const { createApp } = require('./server');

const projectRoot = path.resolve(__dirname, '..');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(projectRoot, 'config.json'), 'utf8')); } catch { return {}; }
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

function listen(server, host, port, attempts = 20) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error.code === 'EADDRINUSE' && attempts > 0) { server.removeListener('error', onError); resolve(listen(server, host, port + 1, attempts - 1)); }
      else reject(error);
    };
    server.once('error', onError);
    server.listen(port, host, () => { server.removeListener('error', onError); resolve(server.address().port); });
  });
}

async function main() {
  const config = Object.assign({ port: 8731, lan: false }, readConfig());
  const dataDir = core.resolveDataDir(projectRoot);
  const server = createApp({ webRoot: path.join(projectRoot, 'web'), dataDir });
  const host = config.lan ? '0.0.0.0' : '127.0.0.1';
  const port = await listen(server, host, Number(config.port) || 8731);
  const runtime = { pid: process.pid, port, url: `http://127.0.0.1:${port}/`, lan: config.lan ? lanAddresses().map((a) => `http://${a}:${port}/`) : [], dataDir };
  console.log(`REIKA_READY ${JSON.stringify(runtime)}`);
  console.log(`Reika Kuronotsuki: ${runtime.url}`);
  for (const url of runtime.lan) console.log(`С телефона (та же Wi-Fi сеть): ${url}`);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

main().catch((error) => { console.error(error); process.exit(1); });
