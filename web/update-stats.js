'use strict';
// 150 read-only metrics. A dash means not captured, never an invented zero.
(function () {
  const groups = [["Прямо сейчас",[["Сколько мы тут уже сидим?","uptimeMs","duration"],["Режим паники","status.phase","text"],["Всё под контролем. Наверное","status.percent","percent"],["Байты на свободе","status.downloadedBytes","bytes"],["Байты в розыске","status.totalBytes","bytes"],["Файлы в деле","status.downloadedFiles","number"],["Очередь на вход","status.totalFiles","number"],["Без повторной загрузки","status.reusedFiles","number"],["Проект на весах","scan.bytes","bytes"],["Свободная территория","freeDiskBytes","bytes"]]],["Файловый переполох",[["Файловый мегаполис","scan.files","number"],["Комнаты в лабиринте","scan.directories","number"],["Самый толстый файл","scan.largest","bytes"],["Самый скромный файл","scan.smallest","bytes"],["Глубина кроличьей норы","scan.deepest","number"],["Заклинатели JavaScript","scan.js","number"],["Портные интерфейса","scan.css","number"],["Сцены браузера","scan.html","number"],["Коробки с данными","scan.json","number"],["Картинки и иконки","scan.images","number"]]],["Код и его последствия",[["Армия строчек","scan.lines","number"],["Пустые, но важные строки","scan.blank","number"],["Шёпот в комментариях","scan.comments","number"],["Файлы, готовые говорить","scan.text","number"],["Строки не пустуют","derived.nonblank","number"],["Код без комментариев","derived.noncomment","number"],["Плотность пустоты","derived.blankRatio","percent"],["Разговорчивость комментариев","derived.commentRatio","percent"],["Средняя длина файла","derived.avgFileBytes","bytes"],["Среднее число строк","derived.avgLines","number"]]],["Хроники обновлений",[["Сколько всего пережито","history.count","number"],["Удивительно, но работает","history.installs","number"],["Это было близко","history.failures","number"],["Назад в прошлое","history.rollbacks","number"],["Запасные планы","history.backups","number"],["Непохожие версии","history.uniqueVersions","number"],["Файлы, прошедшие перерождение","history.installedFiles","number"],["Последняя победа обновлятора","history.lastInstall","date"],["Последний сюжетный поворот","history.lastFailure","date"],["Последний билет назад","history.lastRollback","date"]]],["Интернет пострадал",[["Файлов скачано по журналу","events.downloadedFiles","number"],["Байтов скачано по журналу","events.downloadedBytes","bytes"],["Уникальных файлов скачано","events.uniqueFiles","number"],["Попыток загрузки файлов","events.downloadsStarted","number"],["Суровые ревизоры","events.verifyCount","number"],["Разведывательных вылазок","events.starts","number"],["Подготовлено обновлений","events.preparations","number"],["Случилось ошибок","events.errorCount","number"],["Отменено обновлений","events.cancellations","number"],["Летопись происшествий","events.count","number"]]],["Git и временная машина",[["Сколько раз передумали","git.commitCount","number"],["День большого начала","git.firstCommit","date"],["Последний росчерк Git","git.lastCommit","date"],["Совет создателей","git.authors","number"],["Возраст со старта Git","derived.gitAgeDays","days"],["Сколько прожила версия","derived.versionAgeDays","days"],["Последняя проверка GitHub","status.checkedAt","date"],["Свежий отпечаток Git","status.latest.sha","short"],["То, что сейчас работает","status.localVersion","short"],["Что нового вообще","status.latest.changesTotal","number"]]],["Ресурсы компьютера",[["Байтов в среднем на имя","derived.avgNameBytes","number"],["Аппетит оперативки","memoryRss","bytes"],["Мозги движка","memoryHeap","bytes"],["CPU занимается делом","cpuUserMs","duration"],["CPU работает на систему","cpuSystemMs","duration"],["Ядер в распоряжении","cores","number"],["Двигатель под капотом","node","text"],["На какой планете запущено","platform","text"],["Жильцов на каждую папку","derived.filesPerDirectory","number"],["Когда всё запустилось","processStartedAt","date"]]],["Контроль и спокойствие",[["Статус CI","status.latest.ci","text"],["Доступный канал","status.config.channel","text"],["Частота автопроверки","status.config.autoCheck","text"],["Ограничение GitHub","status.rateLimitedUntil","date"],["Установка заблокирована?","derived.blocked","yesno"],["Готовность к установке","derived.ready","yesno"],["Отложен откат?","status.rollbackPending","yesno"],["Подтверждённых удалений","derived.removalsConfirmed","yesno"],["Удалений в очереди","derived.pendingRemovals","number"],["Проверок пройдено","derived.checkDone","number"]]],["Время — деньги",[["Время с последней проверки","derived.sinceCheck","duration"],["Время с последней установки","derived.sinceInstall","duration"],["Время с последней ошибки","derived.sinceFailure","duration"],["Время с последнего отката","derived.sinceRollback","duration"],["Возраст первого события","derived.sinceFirstEvent","duration"],["Возраст последнего события","derived.sinceLastEvent","duration"],["Промежуток истории","derived.historySpan","duration"],["Время с первого коммита","derived.gitAgeDuration","duration"],["Новорождённый файл","scan.newest","date"],["Ветеран файловой системы","scan.oldest","date"]]],["Интересности",[["Доля JS среди файлов","derived.jsRatio","percent"],["Доля CSS среди файлов","derived.cssRatio","percent"],["Доля картинок","derived.imageRatio","percent"],["Файлы без этих расширений","derived.otherFiles","number"],["Насколько потолстел проект","growth.bytes","bytes"],["Прирост файлов проекта","growth.files","number"],["Ошибок на успешную установку","derived.errorPerInstall","number"],["Процент удачных установок","derived.successRatio","percent"],["Прибавление в строках","growth.lines","number"],["Уровень экономии скачивания","derived.reuseRatio","percent"]]],["Подозрительные файлы",[["Файлы-призраки","scan.emptyFiles","number"],["Гиганты среди нас","scan.largeFiles","number"],["Мелочь пузатая","scan.tinyFiles","number"],["Имена длиннее биографии","scan.longNames","number"],["Фанаты подчёркиваний","scan.underscoreNames","number"],["С БОЛЬШОЙ БУКВЫ","scan.uppercaseNames","number"],["Самое длинное имя","scan.maxNameBytes","number"],["Самое короткое имя","scan.minNameBytes","number"],["Анонимы без расширения","derived.extensionless","number"],["Мода на разнообразие","derived.extensionKinds","number"]]],["Секреты исходников",[["Забытые обещания","scan.todoLines","number"],["Разговоры с консолью","scan.consoleLines","number"],["Фабрика функций","scan.functionLines","number"],["Зависимости зовут","scan.importLines","number"],["Файлы с переносами","scan.newlineFiles","number"],["Аккуратный последний Enter","scan.trailingNewlineFiles","number"],["TODO на тысячу строк","derived.todoPerKLines","number"],["Консольные признания на тысячу строк","derived.consolePerKLines","number"],["Функций на файл","derived.functionsPerText","number"],["Импорты на файл","derived.importsPerText","number"]]],["Анатомия проекта",[["Призрачная доля","derived.emptyRatio","percent"],["Доля гигантов","derived.largeRatio","percent"],["Процент малышей","derived.tinyRatio","percent"],["Доля длинных названий","derived.longRatio","percent"],["Подчёркнутый характер","derived.underscoreRatio","percent"],["Любители CAPS LOCK","derived.uppercaseRatio","percent"],["Код к общему весу","derived.codeWeightRatio","percent"],["Мегабайт на папку","derived.bytesPerDir","bytes"],["Строк на килобайт","derived.linesPerKb","number"],["Файлов на ядро","derived.filesPerCore","number"]]],["Хроники без прикрас",[["Ошибки против успехов","derived.failToSuccess","percent"],["Откаты против установок","derived.rollbackRatio","percent"],["Сколько жизней у версии","derived.installsPerVersion","number"],["Файлов на установку","derived.filesPerInstall","number"],["Событий на установку","derived.eventsPerInstall","number"],["Шанс встретить неприятность","derived.eventErrorRatio","percent"],["Успехи против всех попыток","derived.installSuccessRate","percent"],["Последняя история помнит","history.last","date"],["Первая запись в летописи","history.first","date"],["Сколько записей на версию","derived.historyPerVersion","number"]]],["Математика подозрений",[["Байтов на скачанный файл","derived.bytesPerDownload","bytes"],["Скачиваний на установку","derived.downloadsPerInstall","number"],["Загрузок больше, чем файлов?","derived.downloadToFiles","percent"],["Повторы экономят нервы","derived.reusedVsDownloaded","percent"],["Проверок на скачивание","derived.verifiesPerDownload","number"],["Событий на скачивание","derived.eventsPerDownload","number"],["Сколько раз Git рос за день","derived.commitsPerGitDay","number"],["Чернила на коммит","derived.linesPerCommit","number"],["Сколько весит один коммит","derived.bytesPerCommit","bytes"],["Обновлений на тысячу строк","derived.installsPerKLines","number"]]]];
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
  // Each card has its own symbol; tones reflect the metric's meaning, not random decoration.
  const symbols = [
    '◷','⚑','◉','⇩','↧','▣','☷','↺','▤','◫',
    '▦','⌗','▰','▱','⇣','⌘','▥','▧','{ }','▨',
    '≡','▫','※','¶','☰','∑','◔','✎','↔','№',
    '☷','✓','⚠','⟲','▣','◈','▥','◴','☁','↶',
    '↓','⇓','◇','⇢','⊙','⌕','✔','!','⊘','▤',
    '⑂','⌁','⌚','♙','⌛','◷','◉','#','◐','✦',
    '◴','▣','▥','◵','◔','◎','⬡','▧','◩','◷',
    '◈','▶','↕','◐','⌘','▥','⌥','▦','◴','◉',
    '⏱','◷','⌁','↶','◴','◵','↔','⌛','↑','↓',
    '%','▤','◧','⌗','◫','▦','÷','◉','≡','↻'
  ];
  const tones=['gold','blue','mint','violet','rose','orange','cyan','silver'];
  const toneFor=(key,i)=>{
    if(/error|failure|blocked|cancel|rollback/i.test(key))return 'rose';
    if(/download|Bytes|totalBytes|freeDisk/i.test(key))return 'blue';
    if(/success|ready|checkDone|verify|install/i.test(key))return 'mint';
    if(/cpu|memory|cores|node|platform/i.test(key))return 'violet';
    if(/date|At|uptime|since|Age|Duration/i.test(key))return 'cyan';
    if(/growth|lines|commit|git/i.test(key))return 'orange';
    return tones[i % tones.length];
  };
  // All 150 metrics have distinct sources; switch categories without a global search.
  const tabs=$('up-stats-tabs');
  const highlights=$('up-stats-highlights');
  const cards=[];
  const traces=new Map();
  const selected={index:0};
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const numeric=value=>typeof value==='number'&&Number.isFinite(value);
  function sparkline(values,key){
    const good=values.filter(numeric);
    if(good.length<2)return null; // never pretend there is a trend without samples
    const rawLo=Math.min(...good), hi=Math.max(...good);
    // Cumulative counters start at zero; fluctuating gauges keep an honest context band.
    const cumulative=/^(events\.|history\.|growth\.|scan\.|uptimeMs)/.test(key);
    const lo=cumulative?Math.min(0,rawLo):Math.min(0,rawLo-(Math.max(hi,1)*0.1));
    const upper=Math.max(hi,lo+Math.max(Math.abs(hi)*0.1,1));
    const range=upper-lo;
    const points=good.map((v,i)=>[4+i*112/(good.length-1),27-(v-lo)*22/range]);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 120 32');
    svg.setAttribute('aria-hidden','true');
    svg.classList.add('stats-sparkline');
    const path=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    path.setAttribute('points',points.map(p=>p.map(x=>x.toFixed(2)).join(',')).join(' '));
    path.setAttribute('fill','none');
    path.setAttribute('stroke','currentColor');
    path.setAttribute('stroke-width','2');
    path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');
    svg.appendChild(path);
    return svg;
  }
  function createCard(label,key,unit,index,compact=false){
    const card=document.createElement('div');card.className='stats-tile'+(compact?' stats-tile--hero':'');
    card.dataset.tone=toneFor(key,index);
    const icon=document.createElement('span');icon.className='stats-icon';icon.setAttribute('aria-hidden','true');icon.textContent=symbols[index % symbols.length];
    const name=document.createElement('span');name.className='stats-name';name.textContent=label;
    const value=document.createElement('strong');value.className='stats-number';value.textContent='—';
    const trend=document.createElement('span');trend.className='stats-trend';trend.textContent='Нет истории';
    const chart=document.createElement('div');chart.className='stats-chart';chart.setAttribute('aria-label','История изменения');
    const meta=document.createElement('div');meta.className='stats-meta';meta.append(value,trend);
    const detail=document.createElement('button');detail.type='button';detail.className='stats-open';detail.setAttribute('aria-label','Подробнее: '+label);detail.textContent='↗';
    detail.addEventListener('click',()=>openDetail({key,unit,label}));
    card.append(icon,name,meta,chart,detail);
    const c={key,unit,value,trend,chart,card};
    card.dataset.metricKey=key;
    cards.push(c);
    return card;
  }
  const tabButtons=[];
  let ordinal=0;
  groups.forEach(([title,items],i)=>{
    const tab=document.createElement('button');
    tab.type='button';tab.className='stats-tab';
    const titleSpan=document.createElement('span');titleSpan.textContent=title;
    const countSpan=document.createElement('small');countSpan.textContent=String(items.length).padStart(2,'0');
    tab.append(titleSpan,countSpan);
    tab.setAttribute('aria-controls',i===0?'up-stats-category':'up-stats-category-'+i);
    tab.setAttribute('aria-pressed',String(i===0));
    tab.addEventListener('click',()=>activate(i));
    tabs.appendChild(tab);tabButtons.push(tab);
    const section=document.createElement('section');
    section.className='stats-category';section.hidden=i!==0;
    section.setAttribute('aria-label',title);
    section.id=i===0?'up-stats-category':'up-stats-category-'+i;
    const grid=document.createElement('div');grid.className='stats-grid';
    for(const [label,key,unit] of items){grid.appendChild(createCard(label,key,unit,ordinal++));}
    section.appendChild(grid);root.appendChild(section);
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
    $('up-stats-section-title').textContent=groups[i][0];
    $('up-stats-section-count').textContent=groups[i][1].length+' показателей';
    root.querySelectorAll('.stats-category').forEach((node,n)=>node.hidden=n!==i);
    tabButtons.forEach((tab,n)=>tab.setAttribute('aria-pressed',String(n===i)));

  }
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
      c.chart.replaceChildren();
      const line=sparkline(arr,c.key);
      if(line)c.chart.appendChild(line);
      if(arr.length<2){c.trend.textContent='Набираем данные';c.card.dataset.direction='unknown';}
      else{
        const change=arr.at(-1)-arr[0];
        const direction=change>0?'up':change<0?'down':'flat';
        c.card.dataset.direction=direction;
        c.trend.textContent=change>0?'↗ Растёт':change<0?'↘ Снижается':'→ Ровно';
      }
    }else{
      c.chart.replaceChildren();
      c.trend.textContent='Нет временного ряда';
      c.card.dataset.direction='unknown';
    }
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
