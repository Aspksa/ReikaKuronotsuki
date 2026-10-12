'use strict';
// Shared by the updater (server side) and the installer (launcher side), so the path rules can never drift apart.

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const REPO = 'Aspksa/ReikaKuronotsuki';
const SHA = /^[0-9a-f]{40}$/;
const BACKUP_NAME = /^[\w.-]{1,120}$/;
// Never touched by an update: user data, local settings, update bookkeeping, downloaded runtime, version marker.
const BLOCKED = new Set(['.git', '.updates', '.env', 'data', 'runtime', 'node_modules', '.reika-version', 'config.json']);
const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

function safeUpdatePath(p) {
  return typeof p === 'string' && p.length > 0 && p.length < 1024
    && !p.startsWith('/') && !p.includes('\\') && !p.includes(':') && !p.includes('\0')
    && p.split('/').every((s) => s && s !== '.' && s !== '..' && !BLOCKED.has(s) && !RESERVED_WINDOWS.test(s) && !/[. ]$/.test(s));
}

// Same value as `git hash-object`: lets file bytes be checked against the GitHub tree listing.
function gitHash(bytes) {
  return crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

async function readOrNull(file) {
  try { return await fs.readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// Write to a temporary neighbour and rename over the target: a reader never sees a half-written file.
async function atomicWrite(file, bytes) {
  const tmp = `${file}.update-${crypto.randomUUID()}`;
  try { await fs.writeFile(tmp, bytes, { flag: 'wx' }); await fs.rename(tmp, file); }
  finally { await fs.rm(tmp, { force: true }).catch(() => {}); }
}

// Refuses symlinks and non-directories anywhere on the way, so an update cannot write outside the project.
async function assertNoLinks(root, rel) {
  let current = root;
  const parts = rel.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try {
      const st = await fs.lstat(current);
      if (st.isSymbolicLink() || (i < parts.length - 1 && !st.isDirectory()) || (i === parts.length - 1 && !st.isFile())) {
        throw new Error('Небезопасный путь обновления: ' + rel);
      }
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}

module.exports = { REPO, SHA, BACKUP_NAME, BLOCKED, safeUpdatePath, gitHash, readOrNull, atomicWrite, assertNoLinks };
