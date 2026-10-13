'use strict';
// A small, strict ZIP reader for "update from a file". No dependencies. It refuses anything unusual instead of guessing:
// encryption, ZIP64, symlinks, odd compression methods, unsafe names, wrong CRC/size, zip bombs.

const zlib = require('node:zlib');
const { pathKey } = require('./shared');

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;
const DEFAULT_LIMITS = { maxEntries: 3000, maxFileBytes: 15_000_000, maxTotalBytes: 100_000_000 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const fail = (message) => { throw Object.assign(new Error('Архив: ' + message), { zip: true }); };

/** Returns [{ name, data }] for the files in the archive (directories are skipped). Names are as stored; the caller judges them. */
function readZip(buffer, limits = {}) {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) fail('это не ZIP-файл (слишком короткий).');
  // End Of Central Directory: scan back from the end (a comment may follow it)
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) { if (buffer.readUInt32LE(i) === EOCD) { eocd = i; break; } }
  if (eocd < 0) fail('это не ZIP-файл или он повреждён (нет оглавления).');
  const total = buffer.readUInt16LE(eocd + 10), cdSize = buffer.readUInt32LE(eocd + 12), cdOffset = buffer.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) fail('формат ZIP64 не поддерживается.');
  if (total > lim.maxEntries) fail(`слишком много файлов (${total}).`);
  if (cdOffset + cdSize > eocd || cdOffset > buffer.length) fail('оглавление повреждено.');

  const out = [];
  const seen = new Set();
  let pos = cdOffset, written = 0;
  for (let n = 0; n < total; n++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== CENTRAL) fail('оглавление повреждено.');
    const flags = buffer.readUInt16LE(pos + 8), method = buffer.readUInt16LE(pos + 10), crc = buffer.readUInt32LE(pos + 16);
    const compSize = buffer.readUInt32LE(pos + 20), size = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28), extraLen = buffer.readUInt16LE(pos + 30), commentLen = buffer.readUInt16LE(pos + 32);
    const attrs = buffer.readUInt32LE(pos + 38), localOffset = buffer.readUInt32LE(pos + 42);
    const nameBytes = buffer.subarray(pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;
    if (nameBytes.length !== nameLen) fail('оглавление повреждено.');
    if (flags & 0x1) fail('зашифрованные архивы не поддерживаются.');
    if (!(flags & 0x800) && nameBytes.some((b) => b > 127)) fail('имена файлов не в UTF-8.');
    const name = nameBytes.toString('utf8');
    if (name.endsWith('/')) continue; // a directory
    if (((attrs >>> 16) & 0o170000) === 0o120000) fail(`символическая ссылка не допускается: ${name}`);
    if (method !== 0 && method !== 8) fail(`неподдерживаемый способ сжатия (${method}): ${name}`);
    if (size > lim.maxFileBytes) fail(`файл слишком большой: ${name}`);
    written += size;
    if (written > lim.maxTotalBytes) fail('распакованный размер больше допустимого.');
    const key = pathKey(name);
    if (seen.has(key)) fail(`повторяющееся имя файла: ${name}`);
    seen.add(key);

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL) fail(`повреждён заголовок файла ${name}.`);
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    if (start + compSize > buffer.length) fail(`архив обрезан на файле ${name}.`);
    const raw = buffer.subarray(start, start + compSize);
    let data;
    try { data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw, { maxOutputLength: size + 1 }); }
    catch { fail(`не удалось распаковать ${name} (повреждён или слишком большой при распаковке).`); }
    if (data.length !== size) fail(`размер ${name} не совпадает с оглавлением.`);
    if (crc32(data) !== crc) fail(`контрольная сумма ${name} не совпадает.`);
    out.push({ name, data });
  }
  return out;
}

module.exports = { readZip, crc32, DEFAULT_LIMITS };
