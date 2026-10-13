'use strict';
// The user's own settings (config.json next to the project). config.default.json ships with the project and
// is replaced by updates; config.json is yours and never touched by an update.
const fs = require('node:fs');
const path = require('node:path');

const ai = require('./ai');

const DEFAULTS = { port: 8731, aiProvider: ai.OFFLINE, aiModel: '' };
const MIN_PORT = 1024;
const MAX_PORT = 65535;

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };

function read(projectRoot) {
  const defaults = { ...DEFAULTS, ...readJson(path.join(projectRoot, 'config.default.json')) };
  const own = readJson(path.join(projectRoot, 'config.json'));
  return { ...defaults, ...own };
}

/** Validate a patch. Returns the settings to store (an empty patch gives {}), or throws a message for the page. */
function validate(patch) {
  const next = {};
  const p = patch && typeof patch === 'object' ? patch : {};
  if (p.port !== undefined) {
    const port = Number(p.port);
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      throw Object.assign(new Error(`Порт должен быть целым числом от ${MIN_PORT} до ${MAX_PORT}`), { status: 400 });
    }
    next.port = port;
  }
  if (p.aiProvider !== undefined) {
    if (!ai.isProvider(p.aiProvider)) throw Object.assign(new Error('Неизвестный собеседник для чата'), { status: 400 });
    next.aiProvider = p.aiProvider;
  }
  if (p.aiModel !== undefined) next.aiModel = ai.cleanModel(p.aiModel, next.aiProvider || p.provider || 'cloudru');
  return next;
}

/** Writes config.json atomically, keeping the settings it does not know about. */
function write(projectRoot, patch) {
  const changes = validate(patch);
  if (!Object.keys(changes).length) return read(projectRoot);
  const file = path.join(projectRoot, 'config.json');
  const merged = { ...readJson(file), ...changes };
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return read(projectRoot);
}

module.exports = { read, write, validate, DEFAULTS, MIN_PORT, MAX_PORT };
