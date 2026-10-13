'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { applyPreparedUpdate } = require('../update/installer');

test('installer must not steal an old lock owned by a living process', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reika-lock-'));
  try {
    const updateDir = path.join(root, '.updates');
    await fs.mkdir(updateDir);
    await fs.writeFile(path.join(updateDir, 'ready.json'), '{}');
    await fs.writeFile(path.join(updateDir, 'install.lock'), JSON.stringify({
      pid: process.pid, at: Date.now() - 11 * 60_000,
    }));
    await assert.rejects(
      applyPreparedUpdate(root),
      (error) => error.code === 'EBUSY_UPDATE',
    );
    assert.ok(await fs.stat(path.join(updateDir, 'install.lock')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a lock that nobody refreshes goes stale even if its PID is alive (a reused PID must not block installs for ever)', async () => {
  const { acquireLock } = require('../update/installer');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reika-lock-'));
  try {
    const file = path.join(root, 'install.lock');
    await fs.writeFile(file, JSON.stringify({ pid: process.pid, at: Date.now() - 600_000 }));
    const old = new Date(Date.now() - 600_000);
    await fs.utimes(file, old, old);
    const release = await acquireLock(root);
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).at > Date.now() - 5_000, true, 'the lock was taken over');
    await release();
    assert.rejects(fs.stat(file));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a lock refreshed by a live owner is kept, however old its creation time is', async () => {
  const { acquireLock } = require('../update/installer');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reika-lock-'));
  try {
    const first = await acquireLock(root);
    await assert.rejects(acquireLock(root), (e) => e.code === 'EBUSY_UPDATE');
    await first();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
