'use strict';
// Reika core: re-exports the shared chat engine (web/reika-chat.js) and adds history storage on disk.
// No dependencies; works the same on any OS and from any folder (Cyrillic paths included).

const fs = require('node:fs');
const path = require('node:path');

const engine = require('../web/reika-chat');
const { normalizeText } = engine;
const MAX_HISTORY = 500;

function isWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

// Prefer <project>/data (portable on a flash drive); fall back to the user profile on read-only media.
function resolveDataDir(projectRoot, env = process.env, home = require('node:os').homedir()) {
  if (env.REIKA_DATA_DIR) { fs.mkdirSync(env.REIKA_DATA_DIR, { recursive: true }); return env.REIKA_DATA_DIR; }
  const portable = path.join(projectRoot, 'data');
  if (isWritableDir(portable)) return portable;
  const base = env.LOCALAPPDATA || env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const fallback = path.join(base, 'ReikaKuronotsuki');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function createStore(dataDir) {
  const file = path.join(dataDir, 'history.json');
  let messages = [];

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      messages = Array.isArray(parsed.messages) ? parsed.messages.filter(isValidMessage) : [];
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Corrupted file: keep a copy instead of silently losing it.
        try { fs.renameSync(file, `${file}.broken-${Date.now()}`); } catch { /* ignore */ }
      }
      messages = [];
    }
  }

  function save() {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, messages }, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  function add(role, text, emotion = 'neutral') {
    const message = { id: `${Date.now().toString(36)}-${messages.length}`, role, text, emotion, at: new Date().toISOString() };
    messages.push(message);
    if (messages.length > MAX_HISTORY) messages = messages.slice(-MAX_HISTORY);
    save();
    return message;
  }

  // Used by "restore from a copy": whatever is not a valid message is dropped, never written as is.
  function replace(list) {
    messages = (Array.isArray(list) ? list : []).filter(isValidMessage).slice(-MAX_HISTORY)
      .map((m) => ({ id: String(m.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`), role: m.role, text: normalizeText(m.text), emotion: typeof m.emotion === 'string' ? m.emotion.slice(0, 20) : 'neutral', at: m.at }));
    save();
    return messages.length;
  }

  load();
  return {
    file,
    all: () => messages.slice(),
    add,
    replace,
    clear() { messages = []; save(); },
  };
}

function isValidMessage(m) {
  return m && (m.role === 'user' || m.role === 'reika') && typeof m.text === 'string' && typeof m.at === 'string';
}

module.exports = { ...engine, createStore, resolveDataDir, isWritableDir, MAX_HISTORY };
