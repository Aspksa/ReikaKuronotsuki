'use strict';
// Helpers for the update tests: a throw-away project folder and a prepared (downloaded + checked) update.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { gitHash } = require('../update/shared');
const { crc32 } = require('../update/zip');

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function tmpProject(files = {}) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reika-upd-')), 'Проект Рэйки');
  fs.mkdirSync(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  return root;
}
function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJsonl = (file) => fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);

// Writes .updates/staging + ready.json for `files` (path -> content), like a finished download.
function prepareUpdate(root, files, { sha = SHA_B, removals = [], extra = {} } = {}) {
  const manifest = { sha, files: [], removals, description: 'test update', ...extra };
  for (const [rel, content] of Object.entries(files)) {
    write(path.join(root, '.updates', 'staging'), rel, content);
    manifest.files.push({ path: rel, sha: gitHash(Buffer.from(content)) });
  }
  write(root, '.updates/ready.json', JSON.stringify(manifest));
  return manifest;
}

// Plain recursive copy: fs.cpSync misbehaves with non-ASCII destination paths on some Windows setups.
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
}

// A tiny ZIP writer for tests. entries: [{ name, data, store?, flags?, attrs?, crc?, declaredSize?, method? }]
function makeZip(entries, { zip64 = false } = {}) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data ?? '');
    const method = e.method ?? (e.store || e.name.endsWith('/') ? 0 : 8);
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const crc = e.crc ?? crc32(data);
    const flags = e.flags ?? 0x800;
    const size = e.declaredSize ?? data.length;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x031e, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE((e.attrs ?? 0o100644 << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(zip64 ? 0xffff : entries.length, 8); eocd.writeUInt16LE(zip64 ? 0xffff : entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

// The files an archive of this project must contain, plus a little more
const PROJECT_FILES = { 'server/main.js': "// server\n", 'update/installer.js': '// installer\n', 'launcher/boot.js': '// boot\n', 'web/index.html': '<!doctype html>', 'README.md': '# hi', 'web/style.css': 'body{}' };

module.exports = { makeZip, PROJECT_FILES, copyTree, SHA_A, SHA_B, tmpProject, write, read, readJsonl, prepareUpdate };
