'use strict';
// The user's own settings (config.json next to the project). config.default.json ships with the project and
// is replaced by updates; config.json is yours and never touched by an update.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { port: 8731 };
const MIN_PORT = 1024;
const MAX_PORT = 65535;

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };

function read(projectRoot) {
  const defaults = { ...DEFAULTS, ...readJson(path.join(projectRoot, 'config.default.json')) };
  const own = readJson(path.join(projectRoot, 'config.json'));
  return { ...defaults, ...own };
}

/** Validate a patch. Returns the settings to store, or throws an error with a message for the page. */
function validate(patch) {
  const next = {};
  if (patch && patch.port !== undefined) {
    const port = Number(patch.port);
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      throw Object.assign(new Error(`Порт должен быть целым числом от ${MIN_PORT} до ${MAX_PORT}`), { status: 400 });
    }
    next.port = port;
  }
  if (!Object.keys(next).length) throw Object.assign(new Error('Нечего сохранять'), { status: 400 });
  return next;
}

/** Writes config.json atomically, keeping the settings it does not know about. */
function write(projectRoot, patch) {
  const file = path.join(projectRoot, 'config.json');
  const merged = { ...readJson(file), ...validate(patch) };
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return read(projectRoot);
}

module.exports = { read, write, validate, DEFAULTS, MIN_PORT, MAX_PORT };
