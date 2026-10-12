'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { isPortFree, findFreePort, isPrivateIPv4, lanAddresses } = require('../server/ports');

function occupy(port = 0, host = '127.0.0.1') {
  return new Promise((resolve) => { const s = net.createServer(); s.listen(port, host, () => resolve(s)); });
}
const close = (s) => new Promise((resolve) => s.close(resolve));

test('isPortFree detects a busy and a free port', async () => {
  const busy = await occupy();
  const { port } = busy.address();
  assert.equal(await isPortFree(port), false);
  await close(busy);
  assert.equal(await isPortFree(port), true);
});

test('findFreePort returns the preferred port when it is free', async () => {
  const probe = await occupy();
  const { port } = probe.address();
  await close(probe);
  assert.deepEqual(await findFreePort(port), { port, preferred: true });
});

test('findFreePort skips busy ports', async () => {
  const probe = await occupy();
  const { port } = probe.address();
  const result = await findFreePort(port);
  assert.equal(result.preferred, false);
  assert.ok(result.port > port && result.port < port + 50);
  assert.equal(await isPortFree(result.port), true);
  await close(probe);
});

test('findFreePort lets the OS choose when the whole range is busy', async () => {
  const probe = await occupy();
  const { port } = probe.address();
  const result = await findFreePort(port, { range: 1 });
  assert.equal(result.port, 0);
  await close(probe);
});

test('findFreePort ignores invalid preferred ports', async () => {
  const result = await findFreePort('abc');
  assert.ok(result.port === 0 || result.port >= 8731);
});

test('isPrivateIPv4 recognises LAN ranges only', () => {
  for (const ok of ['10.0.0.5', '172.16.1.1', '172.31.255.1', '192.168.0.10']) assert.equal(isPrivateIPv4(ok), true, ok);
  for (const bad of ['8.8.8.8', '172.32.0.1', '169.254.3.4', '127.0.0.1']) assert.equal(isPrivateIPv4(bad), false, bad);
});

test('lanAddresses keeps only external private IPv4', () => {
  const fake = {
    lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    wifi: [{ family: 'IPv4', address: '192.168.1.20', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
    vpn: [{ family: 'IPv4', address: '169.254.9.9', internal: false }, { family: 'IPv4', address: '8.8.4.4', internal: false }],
  };
  assert.deepEqual(lanAddresses(fake), [{ name: 'wifi', address: '192.168.1.20' }]);
});
