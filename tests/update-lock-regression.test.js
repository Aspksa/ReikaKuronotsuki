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
