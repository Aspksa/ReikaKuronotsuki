'use strict';
// Helpers for the update tests: a throw-away project folder and a prepared (downloaded + checked) update.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gitHash } = require('../update/shared');

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

module.exports = { copyTree, SHA_A, SHA_B, tmpProject, write, read, readJsonl, prepareUpdate };
