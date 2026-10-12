'use strict';
// Local port helper: find a free port without guessing.

const net = require('node:net');

// Resolves true only if we can actually bind host:port right now (the only reliable "is it free" check).
function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', () => resolve(false));
    probe.listen({ port, host, exclusive: true }, () => probe.close(() => resolve(true)));
  });
}

// Tries preferred, preferred+1 ... preferred+range-1, then lets the OS pick any free port (port 0).
async function findFreePort(preferred = 8731, { host = '127.0.0.1', range = 50 } = {}) {
  const start = Number.isInteger(preferred) && preferred >= 1024 && preferred <= 65535 ? preferred : 8731;
  for (let port = start; port < start + range && port <= 65535; port++) {
    if (await isPortFree(port, host)) return { port, preferred: port === start };
  }
  return { port: 0, preferred: false };
}

module.exports = { isPortFree, findFreePort };
