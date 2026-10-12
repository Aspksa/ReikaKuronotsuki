'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { isPortFree, findFreePort } = require('../server/ports');

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
