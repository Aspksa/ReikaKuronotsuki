'use strict';
// Local address / port helpers: find a free port without guessing, and list usable LAN addresses.

const net = require('node:net');
const os = require('node:os');

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

function isPrivateIPv4(address) {
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// LAN IPv4 addresses a phone could reach: private ranges only, no loopback and no 169.254.x.x link-local.
function lanAddresses(interfaces = os.networkInterfaces()) {
  const found = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const item of list || []) {
      if (item && item.family === 'IPv4' && !item.internal && isPrivateIPv4(item.address)) found.push({ name, address: item.address });
    }
  }
  return found;
}

module.exports = { isPortFree, findFreePort, isPrivateIPv4, lanAddresses };
