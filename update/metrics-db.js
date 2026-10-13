'use strict';
// Dedicated SQLite database for the diagnostics dashboard; never touches chat data.
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const DATABASE='metrics.sqlite';
const MAX_POINTS=10080; // one week at one sample per minute
const INTERVAL=60000;
function open(root){
  const dir=path.join(root,'.updates');
  fs.mkdirSync(dir,{recursive:true});
  const db=new DatabaseSync(path.join(dir,DATABASE));
  db.exec('PRAGMA busy_timeout=1000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL;');
  db.exec('CREATE TABLE IF NOT EXISTS samples (at INTEGER PRIMARY KEY, version TEXT, bytes INTEGER, files INTEGER, lines INTEGER, rss INTEGER, freeDiskBytes INTEGER, installs INTEGER, failures INTEGER, downloads INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS samples_time ON samples(at)');
  const legacy=path.join(dir,'metric-samples.json');
  const migrated=db.prepare("SELECT value FROM metadata WHERE key='history_migrated'").get();
  if(!migrated){
    try{
      const samples=JSON.parse(fs.readFileSync(legacy,'utf8'));
      if(Array.isArray(samples)){
        const insert=db.prepare('INSERT OR IGNORE INTO samples (at,version,bytes,files,lines,rss,freeDiskBytes,installs,failures,downloads) VALUES (?,?,?,?,?,?,?,?,?,?)');
        for(const row of samples.slice(-MAX_POINTS)){
          if(!Number.isSafeInteger(row.at))continue;
          insert.run(row.at,typeof row.version==='string'?row.version:null,...['bytes','files','lines','rss','freeDiskBytes','installs','failures','downloads'].map(k=>Number.isFinite(row[k])?row[k]:null));
        }
      }
    }catch{/* No old history, or unreadable: begin a new isolated history. */}
    db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('history_migrated','1')").run();
  }
  return db;
}
function withDb(root,action){const db=open(root);try{return action(db);}finally{db.close();}}
function readSamples(root){
  return withDb(root,db=>db.prepare('SELECT at,version,bytes,files,lines,rss,freeDiskBytes,installs,failures,downloads FROM (SELECT * FROM samples ORDER BY at DESC LIMIT ?) ORDER BY at ASC').all(MAX_POINTS));
}
function appendSample(root,sample){
  return withDb(root,db=>{
  const prev=db.prepare('SELECT at FROM samples ORDER BY at DESC LIMIT 1').get();
  if(prev && sample.at-prev.at<INTERVAL)return false;
  db.prepare('INSERT OR IGNORE INTO samples(at,version,bytes,files,lines,rss,freeDiskBytes,installs,failures,downloads) VALUES(?,?,?,?,?,?,?,?,?,?)')
     .run(sample.at,typeof sample.version==='string'?sample.version:null,...['bytes','files','lines','rss','freeDiskBytes','installs','failures','downloads'].map(k=>Number.isFinite(sample[k])?sample[k]:null));
  db.prepare('DELETE FROM samples WHERE at < ?').run(sample.at-7*24*60*60*1000);
  // Also guard against corrupt clocks or unusually high sampling rates.
  db.prepare('DELETE FROM samples WHERE at NOT IN (SELECT at FROM samples ORDER BY at DESC LIMIT ?)').run(MAX_POINTS);
  return true;
  });
}
function getBaseline(root,scan){
  return withDb(root,db=>{
  const existing=db.prepare("SELECT value FROM metadata WHERE key='baseline'").get();
  if(existing){try{const parsed=JSON.parse(existing.value);if(Number.isFinite(parsed.bytes)&&Number.isFinite(parsed.files))return parsed;}catch{}}
  let baseline=null;
  try{const old=JSON.parse(fs.readFileSync(path.join(root,'.updates','stats-baseline.json'),'utf8'));if(Number.isFinite(old.bytes)&&Number.isFinite(old.files))baseline=old;}catch{}
  baseline=baseline||{bytes:scan.bytes,files:scan.files,lines:scan.lines,at:Date.now()};
  db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('baseline',?)").run(JSON.stringify(baseline));
  return baseline;
  });
}
// Connections are short-lived; provided for compatibility with callers/tests.
function close(){ /* no persistent SQLite handle */ }
module.exports={open,readSamples,appendSample,getBaseline,close,DATABASE,MAX_POINTS};
