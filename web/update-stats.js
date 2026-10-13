'use strict';
// 150 read-only metrics. A dash means not captured, never an invented zero.
(function () {
  const sections = window.ReikaStatsCatalog.sections;
  const $ = id => document.getElementById(id);
  const root = $('up-stats');
  if (!root) return;
  const get = (o, path) => path.split('.').reduce((v,k)=>v == null ? null : v[k],o);
  const ratio = (a,b) => Number.isFinite(a) && Number.isFinite(b) && b>0 ? 100*a/b : null;
  const divide = (a,b) => Number.isFinite(a) && Number.isFinite(b) && b>0 ? a/b : null;
  function expand(d) {
    const s=d.scan || {}, h=d.history || {}, e=d.events || {}, st=d.status || {};
    const now=d.capturedAt || Date.now();
    const since=v=>Number.isFinite(v)?Math.max(0,now-v):null;
    d.derived={
      nonblank:Number.isFinite(s.lines)&&Number.isFinite(s.blank)?s.lines-s.blank:null,
      noncomment:Number.isFinite(s.lines)&&Number.isFinite(s.comments)?s.lines-s.comments:null,
      blankRatio:ratio(s.blank,s.lines),commentRatio:ratio(s.comments,s.lines),
      avgFileBytes:divide(s.bytes,s.files),avgLines:divide(s.lines,s.text),
      gitAgeDays:d.git?.firstCommit?since(d.git.firstCommit)/86400000:null,
      versionAgeDays:st.latest?.date?since(Date.parse(st.latest.date))/86400000:null,
      blocked:!!st.blocked,ready:st.phase==='ready',
      removalsConfirmed:!!st.removalsConfirmed,pendingRemovals:st.pendingRemovals?.length??0,
      checkDone:(st.checks||[]).filter(x=>x.status==='done').length,
      sinceCheck:since(st.checkedAt),sinceInstall:since(h.lastInstall),
      sinceFailure:since(h.lastFailure),sinceRollback:since(h.lastRollback),
      sinceFirstEvent:since(e.first),sinceLastEvent:since(e.last),
      historySpan:Number.isFinite(h.first)&&Number.isFinite(h.last)?h.last-h.first:null,
      gitAgeDuration:since(d.git?.firstCommit),
      jsRatio:ratio(s.js,s.files),cssRatio:ratio(s.css,s.files),imageRatio:ratio(s.images,s.files),
      otherFiles:Number.isFinite(s.files)?s.files-(s.js||0)-(s.css||0)-(s.html||0)-(s.json||0)-(s.images||0):null,
      extensionless:s.extensions?.['(без расширения)'] ?? 0,
      extensionKinds:s.extensions?Object.keys(s.extensions).length:null,
      todoPerKLines:divide(s.todoLines*1000,s.lines),
      consolePerKLines:divide(s.consoleLines*1000,s.lines),
      functionsPerText:divide(s.functionLines,s.text),
      importsPerText:divide(s.importLines,s.text),
      emptyRatio:ratio(s.emptyFiles,s.files),
      largeRatio:ratio(s.largeFiles,s.files),
      tinyRatio:ratio(s.tinyFiles,s.files),
      longRatio:ratio(s.longNames,s.files),
      underscoreRatio:ratio(s.underscoreNames,s.files),
      uppercaseRatio:ratio(s.uppercaseNames,s.files),
      codeWeightRatio:ratio(s.js+s.css+s.html+s.json,s.files),
      bytesPerDir:divide(s.bytes,s.directories),
      linesPerKb:divide(s.lines*1024,s.bytes),
      filesPerCore:divide(s.files,d.cores),
      failToSuccess:ratio(h.failures,h.installs),
      rollbackRatio:ratio(h.rollbacks,h.installs),
      installsPerVersion:divide(h.installs,h.uniqueVersions),
      filesPerInstall:divide(h.installedFiles,h.installs),
      eventsPerInstall:divide(e.count,h.installs),
      eventErrorRatio:ratio(e.errorCount,e.count),
      installSuccessRate:ratio(h.installs,h.installs+h.failures),
      historyPerVersion:divide(h.count,h.uniqueVersions),
      bytesPerDownload:divide(e.downloadedBytes,e.downloadedFiles),
      downloadsPerInstall:divide(e.downloadedFiles,h.installs),
      downloadToFiles:ratio(e.downloadedFiles,s.files),
      reusedVsDownloaded:ratio(st.reusedFiles,st.downloadedFiles),
      verifiesPerDownload:divide(e.verifyCount,e.downloadedFiles),
      eventsPerDownload:divide(e.count,e.downloadedFiles),
      commitsPerGitDay:divide(d.git?.commitCount,d.git?.firstCommit?Math.max(1,since(d.git.firstCommit)/86400000):null),
      linesPerCommit:divide(s.lines,d.git?.commitCount),
      bytesPerCommit:divide(s.bytes,d.git?.commitCount),
      installsPerKLines:divide(h.installs*1000,s.lines),
      avgNameBytes:divide(s.filenameBytes,s.files),filesPerDirectory:divide(s.files,s.directories),
      errorPerInstall:divide(h.failures,h.installs),successRatio:ratio(h.installs,h.installs+h.failures),
      installPerRollback:divide(h.installs,h.rollbacks),reuseRatio:ratio(st.reusedFiles,(st.totalFiles||0)+(st.reusedFiles||0))
    };
    return d;
  }
  const num=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(v);
  const format=(value,unit)=>{
    if(value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value)))return '—';
    if(unit==='text')return String(value);
    if(unit==='short')return String(value).slice(0,12);
    if(unit==='yesno')return value?'Да':'Нет';
    if(unit==='date')return Number.isFinite(Number(value))&&Number(value)>0?new Date(Number(value)).toLocaleString('ru-RU'): '—';
    if(unit==='duration'){const n=Math.round(Number(value)/1000);return n<60?n+' сек':n<3600?num(n/60)+' мин':n<86400?num(n/3600)+' ч':num(n/86400)+' д';}
    if(unit==='days')return num(value)+' д';
    if(unit==='percent')return num(value)+'%';
    if(unit==='bytes'){if(value<1024)return num(value)+' Б';const units=['КБ','МБ','ГБ','ТБ'];let n=value,i=-1;do{n/=1024;i++;}while(n>=1024&&i<units.length-1);return num(n)+' '+units[i];}
    return typeof value==='number'?num(value):String(value);
  };
  const V=window.ReikaStatsVisual;
  // All 150 metrics have distinct sources; switch categories without a global search.
  const tabs=$('up-stats-tabs');
  const highlights=$('up-stats-highlights');
  const cards=[];
  const traces=new Map();
  const selected={index:0};
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const numeric=value=>typeof value==='number'&&Number.isFinite(value);
  // Every metric: its own icon (matches the name), its own colour, and a diagram of the kind that fits what it measures.
  const positions=new Map();
  sections.forEach((sec,g)=>{let n=0;for(const grp of sec.groups)for(const [,key] of grp.items)positions.set(key,[g,n++]);});
  function createCard(label,key,unit,index,compact=false){
    const [g,i]=positions.get(key)||[index%sections.length,index];
    const tone=V.tone(g,i,key);
    const card=document.createElement('div');card.className='stats-tile'+(compact?' stats-tile--hero':'');
    card.style.setProperty('--tone',tone.color);
    const kind=V.chartKind(key,unit);
    card.dataset.kind=kind;card.dataset.unit=unit;
    const icon=document.createElement('span');icon.className='stats-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=V.iconSvg(V.iconName(key,unit));
    const name=document.createElement('span');name.className='stats-name';name.textContent=label;
    const value=document.createElement('strong');value.className='stats-number';value.textContent='—';
    const trend=document.createElement('span');trend.className='stats-trend';trend.textContent='';
    const chart=document.createElement('div');chart.className='stats-chart';
    const detail=document.createElement('button');detail.type='button';detail.className='stats-open';detail.setAttribute('aria-label','Подробнее: '+label);detail.textContent='↗';
    detail.addEventListener('click',()=>openDetail({key,unit,label}));
    const foot=document.createElement('div');foot.className='stats-foot';foot.append(chart,trend);
    card.append(icon,name,value,foot,detail);
    const c={key,unit,kind,value,trend,chart,card};
    card.dataset.metricKey=key;
    cards.push(c);
    return card;
  }
  const tabButtons=[];
  let ordinal=0;
  const STORE='reika.stats.section.v1';
  const saved=()=>{try{return localStorage.getItem(STORE);}catch{return null;}};
  const remember=id=>{try{localStorage.setItem(STORE,id);}catch{/* private mode */}};
  sections.forEach((sec,i)=>{
    const count=sec.groups.reduce((n,g)=>n+g.items.length,0);
    const tab=document.createElement('button');
    tab.type='button';tab.className='stats-tab';tab.id='up-stats-tab-'+sec.id;tab.setAttribute('role','tab');tab.style.setProperty('--tone',V.groupColor(i));
    const titleSpan=document.createElement('span');titleSpan.textContent=sec.title;
    const countSpan=document.createElement('small');countSpan.textContent=String(count);
    tab.append(titleSpan,countSpan);
    tab.setAttribute('aria-controls','up-stats-section-'+sec.id);
    tab.addEventListener('click',()=>activate(i));
    tab.addEventListener('keydown',e=>{
      const next={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];
      if(e.key==='Home'||e.key==='End'||next){e.preventDefault();const to=e.key==='Home'?0:e.key==='End'?sections.length-1:(i+next+sections.length)%sections.length;activate(to);tabButtons[to].focus();}
    });
    tabs.appendChild(tab);tabButtons.push(tab);
    const section=document.createElement('section');
    section.className='stats-category';section.hidden=true;section.id='up-stats-section-'+sec.id;
    section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',tab.id);
    for(const grp of sec.groups){
      const part=document.createElement('div');part.className='stats-part';
      const head=document.createElement('h4');head.className='stats-part-title';
      const ht=document.createElement('span');ht.textContent=grp.title;const hc=document.createElement('small');hc.textContent=grp.items.length;
      head.append(ht,hc);
      const grid=document.createElement('div');grid.className='stats-grid';
      for(const [label,key,unit] of grp.items)grid.appendChild(createCard(label,key,unit,ordinal++));
      part.append(head,grid);section.appendChild(part);
    }
    root.appendChild(section);
  });
  const dialog=$('up-stats-detail');
  $('up-stats-detail-close').addEventListener('click',()=>dialog.close());
  function openDetail(item) {
    $('up-stats-detail-title').textContent=item.label;
    const value=lastData?get(lastData,item.key):null;
    $('up-stats-detail-value').textContent=format(value,item.unit);
    const rows=lastData?.samples||[];
    const field=persisted[item.key];
    const points=field?rows.filter(x=>Number.isFinite(x.at)&&numeric(x[field])).map(x=>({at:x.at,value:x[field]})).filter(x=>x.at>=Date.now()-Number(period.value)):[];
    $('up-stats-detail-desc').textContent=points.length>=2?'Измерения из сохранённой истории за выбранный период.':'Недостаточно сохранённых измерений для подробного графика.';
    const target=$('up-stats-detail-chart');target.replaceChildren();
    const list=$('up-stats-detail-points');list.replaceChildren();
    if(points.length>=2){
      const sampled=points.length>80?points.filter((_,i)=>i%Math.ceil(points.length/80)===0).concat(points.at(-1)):points;
      const lo=Math.min(0,...sampled.map(x=>x.value)),hi=Math.max(...sampled.map(x=>x.value)),span=hi-lo||1;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 500 145');svg.setAttribute('role','img');svg.setAttribute('aria-label','Исторический график '+item.label);
      const path=document.createElementNS('http://www.w3.org/2000/svg','polyline');
      path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');
      path.setAttribute('points',sampled.map((x,i)=>(8+i*484/(sampled.length-1)).toFixed(1)+','+(135-(x.value-lo)*120/span).toFixed(1)).join(' '));
      svg.appendChild(path);
      for(const [i,x] of sampled.entries()){
        const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
        dot.setAttribute('cx',String(8+i*484/(sampled.length-1)));
        dot.setAttribute('cy',String(135-(x.value-lo)*120/span));dot.setAttribute('r','3');
        const tip=document.createElementNS('http://www.w3.org/2000/svg','title');
        tip.textContent=new Date(x.at).toLocaleString('ru-RU')+' · '+format(x.value,item.unit);
        dot.appendChild(tip);svg.appendChild(dot);
      }
      target.appendChild(svg);
      for(const x of [points[0],points.at(-1)]){
        const row=document.createElement('p');row.textContent=new Date(x.at).toLocaleString('ru-RU')+' — '+format(x.value,item.unit);list.appendChild(row);
      }
    }
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.open=true;
  }
  function activate(i){
    selected.index=i;
    const sec=sections[i];
    $('up-stats-section-title').textContent=sec.title;
    $('up-stats-section-count').textContent=sec.hint;
    root.querySelectorAll('.stats-category').forEach((node,n)=>node.hidden=n!==i);
    tabButtons.forEach((tab,n)=>{tab.setAttribute('aria-selected',String(n===i));tab.tabIndex=n===i?0:-1;});
    remember(sec.id);
  }
  { const start=sections.findIndex(sec=>sec.id===saved()); activate(start>=0?start:0); }
  // Highlight six useful signals; duplicates share the same historic samples.
  const heroes=[
    ['Время работы','uptimeMs','duration'],
    ['Скачано всего','events.downloadedBytes','bytes'],
    ['Размер проекта','scan.bytes','bytes'],
    ['Рост проекта','growth.bytes','bytes'],
    ['Установок','history.installs','number'],
    ['Ошибок','events.errorCount','number']
  ];
  heroes.forEach(([label,key,unit],i)=>highlights.appendChild(createCard(label,key,unit,100+i,true)));
  let lastData=null;
  const period=$('up-stats-period');
  period.addEventListener('change',()=>{if(lastData){replaySamples(lastData);for(const c of cards)renderValue(c,lastData);}});
  const persisted = {'events.downloadedBytes':'downloads','scan.bytes':'bytes','scan.files':'files','scan.lines':'lines','memoryRss':'rss','freeDiskBytes':'freeDiskBytes','history.installs':'installs','history.failures':'failures'};
  function replaySamples(data) {
    const now=data.capturedAt||Date.now();
    const cutoff=now-Number(period.value);
    const rows=(Array.isArray(data.samples)?data.samples:[]).filter(x=>Number.isFinite(x.at)&&x.at>=cutoff);
    for(const [key,field] of Object.entries(persisted)){
      const all=rows.map(row=>row[field]).filter(numeric);
      const series=all.length>36?all.filter((_,i)=>i%Math.ceil(all.length/36)===0).concat(all.at(-1)).slice(-36):all;
      if(series.length)traces.set(key,series);
    }
  }
  function renderValue(c,data){
    const value=get(data,c.key);
    const previous=c.previous;
    const formatted=format(value,c.unit);
    if(c.value.textContent!==formatted){
      c.value.textContent=formatted;
      if(previous!==undefined&&!reduced()){
        c.card.classList.remove('stats-changed');
        void c.card.offsetWidth;
        c.card.classList.add('stats-changed');
      }
    }
    if(numeric(value)){
      const arr=traces.get(c.key)||[];
      // A fresh poll with the same value is still a real sample, not fake chart data.
      if(c.sampleAt!==data.capturedAt && !persisted[c.key]){arr.push(value);if(arr.length>24)arr.shift();traces.set(c.key,arr);c.sampleAt=data.capturedAt;}
      if(arr.length<2||c.unit==='date'||c.unit==='days'){c.trend.textContent='';c.card.dataset.direction='unknown';}
      else{
        const change=arr.at(-1)-arr[0];
        const direction=change>0?'up':change<0?'down':'flat';
        c.card.dataset.direction=direction;
        c.trend.textContent=change>0?'↗ Растёт':change<0?'↘ Снижается':'→ Ровно';
      }
    }else{
      c.trend.textContent='';
      c.card.dataset.direction='unknown';
    }
    const totalKey=V.shareTotalKey(c.key);
    const ageMs=c.kind!=='age'?null:c.unit==='date'?(Number.isFinite(Number(value))&&Number(value)>0?Math.max(0,(data.capturedAt||Date.now())-Number(value)):null):numeric(value)?(c.unit==='days'?value*86400000:value):null;
    const base=data.baseline||{};
    const baseline=c.key==='growth.bytes'?base.bytes:c.key==='growth.files'?base.files:c.key==='growth.lines'?base.lines:null;
    c.chart.innerHTML=V.chart(c.kind,{value,unit:c.unit,series:traces.get(c.key)||[],baseline,total:totalKey?get(data,totalKey):null,ageMs,text:Array.isArray(value)?'':value});
    c.previous=value;
  }
  let lastFetch=0, busy=false;
  async function load(force=false){
    if(busy||(!force&&Date.now()-lastFetch<15000))return;
    busy=true;
    try{
      const res=await fetch('api/update/stats',{cache:'no-store'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=expand(await res.json());lastData=data;lastFetch=Date.now();
      replaySamples(data);
      for(const c of cards)renderValue(c,data);
      $('stats-live-time').textContent=new Date(data.capturedAt).toLocaleTimeString('ru-RU');

    }catch(e){console.warn('Не удалось получить статистику:',e);$('stats-live-time').textContent='Нет данных';}
    finally{busy=false;}
  }
  window.ReikaStats={load,count:cards.length};
  window.addEventListener('reika:route',e=>{if(e.detail==='update')load(true);});
  setInterval(()=>{if(!$('page-update').hidden)load();},15000);
})();
