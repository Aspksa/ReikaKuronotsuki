'use strict';
// Read-only aggregate facts. Missing historical instrumentation is reported as null, never zero.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { BLOCKED } = require('./shared');

const readLines = async (file) => {
  try { return (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean).slice(-20000).flatMap(line => {
    try { const x = JSON.parse(line); return x && typeof x === 'object' ? [x] : []; } catch { return []; }
  }); } catch { return []; }
};
const sum = (xs, key) => xs.reduce((n, x) => n + (Number.isFinite(Number(x[key])) ? Number(x[key]) : 0), 0);
const count = (xs, pred) => xs.filter(pred).length;
const dateMs = x => { const n = Date.parse(x || ''); return Number.isFinite(n) ? n : null; };
const optional = (arr, f) => arr.length ? f(arr) : null;
const CACHE_MS = 60_000;
const HISTORY_MAX = 1440;
const cache = new Map();
const writes = new Map();
async function cachedInspect(root) {
  const existing=cache.get(root);
  if(existing && Date.now()-existing.at<CACHE_MS)return existing.value;
  if(existing?.pending)return existing.pending;
  const pending=inspect(root);
  cache.set(root,{pending,at:Date.now()});
  try { const value=await pending;cache.set(root,{value,at:Date.now()});return value; }
  catch(e){cache.delete(root);throw e;}
}
async function readSamples(root){
  try {const value=JSON.parse(await fs.readFile(path.join(root,'.updates','metric-samples.json'),'utf8'));return Array.isArray(value)?value.slice(-HISTORY_MAX):[];}
  catch{return [];}
}
async function appendSample(root,sample){
  const previous=writes.get(root);
  if(previous?.pending)return previous.pending;
  if(previous?.at && sample.at-previous.at<60_000)return;
  const pending=(async()=>{
    const samples=await readSamples(root);
    if(samples.length && sample.at-samples.at(-1).at<60_000)return;
    samples.push(sample);
    const dir=path.join(root,'.updates');
    const filename=path.join(dir,'metric-samples.json');
    const temp=filename+'.'+process.pid+'.tmp';
    await fs.mkdir(dir,{recursive:true});
    try{await fs.writeFile(temp,JSON.stringify(samples.slice(-HISTORY_MAX)));await fs.rename(temp,filename);}
    finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  })();
  writes.set(root,{pending});
  try {await pending;writes.set(root,{at:sample.at});}catch{writes.delete(root);}
}

async function inspect(root) {
  const result = { files: 0, bytes: 0, js: 0, css: 0, html: 0, json: 0, images: 0, text: 0,
    lines: 0, blank: 0, comments: 0, largest: 0, smallest: null, deepest: 0, directories: 0,
    newest: null, oldest: null, names: 0, filenameBytes: 0, extensions: {}, emptyFiles: 0, largeFiles: 0, tinyFiles: 0, longNames: 0, underscoreNames: 0, uppercaseNames: 0, zeroByteDirs: 0, maxNameBytes: 0, minNameBytes: null, largestExt: null, newlineFiles: 0, trailingNewlineFiles: 0, todoLines: 0, consoleLines: 0, functionLines: 0, importLines: 0 };
  const visit = async (folder, depth) => {
    if (depth > 18 || result.files > 10000) return;
    let entries; try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (BLOCKED.has(e.name) || e.name === '.git' || e.name === '.updates') continue;
      const full = path.join(folder, e.name);
      if (e.isDirectory()) { result.directories++; await visit(full, depth + 1); continue; }
      if (!e.isFile()) continue;
      const st = await fs.stat(full).catch(() => null);
      if (!st) continue;
      result.files++; result.bytes += st.size;
      if (st.size === 0) result.emptyFiles++;
      if (st.size >= 1048576) result.largeFiles++;
      if (st.size > 0 && st.size < 1024) result.tinyFiles++;
      if (e.name.length > 30) result.longNames++;
      if (e.name.includes('_')) result.underscoreNames++;
      if (/[A-Z]/.test(e.name)) result.uppercaseNames++;
      const nameBytes=Buffer.byteLength(e.name);
      result.maxNameBytes=Math.max(result.maxNameBytes,nameBytes);
      result.minNameBytes=Math.min(result.minNameBytes ?? nameBytes,nameBytes);
      result.largest = Math.max(result.largest, st.size);
      result.smallest = Math.min(result.smallest ?? st.size, st.size);
      result.deepest = Math.max(result.deepest, depth);
      result.filenameBytes += Buffer.byteLength(e.name);
      const ext = path.extname(e.name).toLowerCase();
      result.extensions[ext || '(без расширения)'] = (result.extensions[ext || '(без расширения)'] || 0) + 1;
      const kind = ({'.js':'js','.css':'css','.html':'html','.json':'json'})[ext];
      if (kind) result[kind]++;
      if (/\.(png|jpe?g|webp|ico|gif|svg)$/i.test(ext)) result.images++;
      if (st.size <= 2_000_000 && /\.(js|css|html|json|md|txt|ps1|bat|yml|yaml)$/i.test(ext)) {
        try {
          const data = await fs.readFile(full, 'utf8');
          const lines = data.split(/\r?\n/);
          result.text++; result.lines += lines.length;
          result.blank += lines.filter(l => !l.trim()).length;
          result.comments += lines.filter(l => /^\s*(\/\/|#|\/\*|\*|<!--)/.test(l)).length;
          result.todoLines += lines.filter(l => /\b(?:TODO|FIXME)\b/.test(l)).length;
          result.consoleLines += lines.filter(l => /\bconsole\.(?:log|warn|error)\s*\(/.test(l)).length;
          result.functionLines += lines.filter(l => /\b(?:function|=>)\b/.test(l)).length;
          result.importLines += lines.filter(l => /\b(?:require\s*\(|import\s+)/.test(l)).length;
          if (data.includes('\n')) result.newlineFiles++;
          if (data.endsWith('\n')) result.trailingNewlineFiles++;
        } catch { /* unreadable */ }
      }
      result.newest = Math.max(result.newest ?? 0, st.mtimeMs);
      result.oldest = Math.min(result.oldest ?? st.mtimeMs, st.mtimeMs);
    }
  };
  await visit(root, 0);
  return result;
}
async function collect(updater) {
  const root = updater.root, dir = path.join(root, '.updates');
  const [events, history, scan, lifetime] = await Promise.all([
    readLines(path.join(dir, 'events.jsonl')), readLines(path.join(dir, 'history.jsonl')), cachedInspect(root), readLines(path.join(dir, 'telemetry.jsonl'))
  ]);
  const status = updater.status();
  const types = Object.create(null);
  for (const e of events) if (typeof e.type === 'string') types[e.type] = (types[e.type] || 0) + 1;
  const installs = history.filter(x => x.kind === 'install');
  const failures = history.filter(x => x.kind === 'failed' || x.kind === 'startup_failed');
  const rollbacks = history.filter(x => x.kind === 'rollback' || x.kind === 'startup_failed');
  const timestamps = history.map(x => dateMs(x.at)).filter(x => x !== null).sort((a,b)=>a-b);
  let backups = null, backupBytes = null;
  try {
    const names = await fs.readdir(path.join(dir, 'backups'), { withFileTypes: true });
    backups = names.filter(x => x.isDirectory()).length;
  } catch { backups = 0; }
  const downloadEvents = (lifetime.length ? lifetime : events).filter(e => e.type === 'file_download_done');
  const baselineFile = path.join(dir, 'stats-baseline.json');
  let baseline = null;
  try { baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8')); } catch { /* first observation */ }
  if (!baseline || !Number.isFinite(baseline.bytes) || !Number.isFinite(baseline.files)) {
    baseline = { bytes: scan.bytes, files: scan.files, lines: scan.lines, at: Date.now() };
    try { await fs.mkdir(dir, {recursive:true}); await fs.writeFile(baselineFile, JSON.stringify(baseline), {flag:'wx'}); } catch { /* another process may have written it */ }
  }
  const current = status;
  let git = { commitCount: null, firstCommit: null, lastCommit: null, authors: null };
  try {
    const run = args => execFileSync('git', ['-C', root, ...args], { timeout: 1800, encoding: 'utf8', stdio:['ignore','pipe','ignore'] }).trim();
    const countCommits = Number(run(['rev-list','--count','HEAD']));
    git.commitCount = Number.isFinite(countCommits) ? countCommits : null;
    git.firstCommit = dateMs(run(['log','--reverse','--format=%aI','HEAD']).split('\n')[0]) ?? null;
    git.lastCommit = dateMs(run(['log','-1','--format=%aI']));
    git.authors = run(['shortlog','-sne','HEAD']).split('\n').filter(Boolean).length;
  } catch { /* ZIP installations may not have git */ }
  const fsInfo = await fs.statfs(root).catch(() => null);
  const free = fsInfo ? Number(fsInfo.bavail) * Number(fsInfo.bsize) : null;
  const sample={at:Date.now(),bytes:scan.bytes,files:scan.files,lines:scan.lines,rss:process.memoryUsage().rss,freeDiskBytes:free,installs:installs.length,failures:failures.length,downloads:sum(downloadEvents,'bytes_done')};
  await appendSample(root,sample);
  const samples=await readSamples(root);
  const oldest=samples[0]||null;
  const versionComparison=oldest?{from:oldest.at,to:sample.at,bytes:sample.bytes-oldest.bytes,files:sample.files-oldest.files,lines:sample.lines-oldest.lines,baseline:'earliest-recorded-sample'}:null;
  return {
    samples,versionComparison,
    capturedAt: Date.now(), processStartedAt: Date.now() - Math.floor(process.uptime()*1000),
    uptimeMs: Math.floor(process.uptime()*1000), node: process.version, platform: process.platform,
    memoryRss: process.memoryUsage().rss, memoryHeap: process.memoryUsage().heapUsed,
    cpuUserMs: process.cpuUsage().user/1000, cpuSystemMs: process.cpuUsage().system/1000,
    cores: os.cpus().length, freeDiskBytes: free,
    scan, git, status: current, baseline, growth: { bytes: scan.bytes - baseline.bytes, files: scan.files - baseline.files, lines: scan.lines - baseline.lines },
    events: { count: events.length, types, first: optional(events, a => dateMs(a[0].timestamp)),
      last: optional(events, a => dateMs(a[a.length-1].timestamp)), downloadedFiles: downloadEvents.length,
      downloadedBytes: sum(downloadEvents,'bytes_done'),
      uniqueFiles: new Set(downloadEvents.map(e=>e.relative_path).filter(Boolean)).size,
      errorCount: count(events,e => e.status === 'failed' || e.status === 'error'),
      verifyCount: types.file_verify_done || 0, starts: types.update_check_started || 0,
      retries: types.download_retry || 0, cancellations: types.update_cancelled || 0,
      downloadsStarted: types.download_started || 0, preparations: types.update_prepared || 0,
      installs: types.update_completed || 0, rollbacks: types.rollback_done || 0 },
    history: {count: history.length, installs: installs.length, failures: failures.length, rollbacks: rollbacks.length,
      last: timestamps.at(-1) ?? null, first: timestamps[0] ?? null,
      lastInstall: optional(installs, a => dateMs(a.at(-1).at)),
      lastFailure: optional(failures, a => dateMs(a.at(-1).at)),
      lastRollback: optional(rollbacks, a => dateMs(a.at(-1).at)),
      installedFiles: sum(installs,'files'), uniqueVersions: new Set(installs.map(x=>x.to).filter(Boolean)).size,
      backups, backupBytes},
  };
}
module.exports = {collect, inspect, readLines, cachedInspect, readSamples};
