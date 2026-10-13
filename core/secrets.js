'use strict';
// The API key lives apart from everything else: in the data folder, readable only by you, and it never leaves
// this computer except as the Authorization header of a request to the provider you chose.
// It is NOT in config.json and NOT in the copy of your data, so sharing either of them cannot leak it.
const fs = require('node:fs');
const path = require('node:path');

const FILE = 'secrets.json';
const MAX_KEY = 400;

const fileOf = (dataDir) => path.join(dataDir, FILE);

function readAll(dataDir) {
  try { const parsed = JSON.parse(fs.readFileSync(fileOf(dataDir), 'utf8')); return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch { return {}; }
}

/** The key itself. Only the code that talks to the provider may call this. */
function get(dataDir, name) {
  const value = readAll(dataDir)[name];
  return typeof value === 'string' && value ? value : null;
}

/** What the page is allowed to know: whether a key is stored and its last four characters. */
function hint(dataDir, name) {
  const value = get(dataDir, name);
  return value ? { has: true, tail: value.slice(-4) } : { has: false, tail: '' };
}

/** An empty value removes the key. Returns the hint. */
function set(dataDir, name, value) {
  const all = readAll(dataDir);
  const clean = typeof value === 'string' ? value.trim() : '';
  if (clean.length > MAX_KEY) throw Object.assign(new Error('Ключ слишком длинный'), { status: 400 });
  if (/[\u0000-\u001F\u007F\s]/.test(clean)) throw Object.assign(new Error('В ключе есть пробелы или управляющие символы — скопируйте его целиком, без переносов'), { status: 400 });
  if (clean) all[name] = clean; else delete all[name];
  fs.mkdirSync(dataDir, { recursive: true });
  const file = fileOf(dataDir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch { /* Windows has no POSIX modes */ }
  return hint(dataDir, name);
}

module.exports = { get, set, hint, FILE, MAX_KEY };
