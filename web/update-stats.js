'use strict';
// 150 read-only metrics. A dash means not captured, never an invented zero.
(function () {
  const groups = [["Прямо сейчас",[["Сколько мы тут уже сидим?","uptimeMs","duration"],["Режим паники","status.phase","text"],["Всё под контролем. Наверное","status.percent","percent"],["Байты на свободе","status.downloadedBytes","bytes"],["Байты в розыске","status.totalBytes","bytes"],["Файлы в деле","status.downloadedFiles","number"],["Очередь на вход","status.totalFiles","number"],["Без повторной загрузки","status.reusedFiles","number"],["Проект на весах","scan.bytes","bytes"],["Свободная территория","freeDiskBytes","bytes"]]],["Файловый переполох",[["Все файлы проекта","scan.files","number"],["Комнаты в лабиринте","scan.directories","number"],["Самый толстый файл","scan.largest","bytes"],["Самый скромный файл","scan.smallest","bytes"],["Глубина кроличьей норы","scan.deepest","number"],["Файлы JavaScript","scan.js","number"],["Файлы CSS","scan.css","number"],["HTML-страницы","scan.html","number"],["JSON-файлы","scan.json","number"],["Картинки и иконки","scan.images","number"]]],["Код и его последствия",[["Строки всего","scan.lines","number"],["Пустые, но важные строки","scan.blank","number"],["Комментарии разработчиков","scan.comments","number"],["Файлы с читаемым текстом","scan.text","number"],["Строки не пустуют","derived.nonblank","number"],["Код без комментариев","derived.noncomment","number"],["Плотность пустоты","derived.blankRatio","percent"],["Разговорчивость комментариев","derived.commentRatio","percent"],["Средняя длина файла","derived.avgFileBytes","bytes"],["Среднее число строк","derived.avgLines","number"]]],["Хроники обновлений",[["Сколько всего пережито","history.count","number"],["Удивительно, но работает","history.installs","number"],["Это было близко","history.failures","number"],["Назад в прошлое","history.rollbacks","number"],["Запасные планы","history.backups","number"],["Непохожие версии","history.uniqueVersions","number"],["Файлов обновлено исторически","history.installedFiles","number"],["Последняя удачная операция","history.lastInstall","date"],["Последняя неприятность","history.lastFailure","date"],["Последний билет назад","history.lastRollback","date"]]],["Интернет пострадал",[["Файлов скачано по журналу","events.downloadedFiles","number"],["Байтов скачано по журналу","events.downloadedBytes","bytes"],["Уникальных файлов скачано","events.uniqueFiles","number"],["Попыток загрузки файлов","events.downloadsStarted","number"],["Проверок файлов","events.verifyCount","number"],["Проверок новых версий","events.starts","number"],["Подготовлено обновлений","events.preparations","number"],["Случилось ошибок","events.errorCount","number"],["Отменено обновлений","events.cancellations","number"],["Всего событий в журнале","events.count","number"]]],["Git и временная машина",[["Сколько раз передумали","git.commitCount","number"],["Первый коммит","git.firstCommit","date"],["Последний коммит","git.lastCommit","date"],["Авторов в истории Git","git.authors","number"],["Возраст со старта Git","derived.gitAgeDays","days"],["Сколько прожила версия","derived.versionAgeDays","days"],["Последняя проверка GitHub","status.checkedAt","date"],["Новый коммит","status.latest.sha","short"],["Старая версия","status.localVersion","short"],["Что нового вообще","status.latest.changesTotal","number"]]],["Ресурсы компьютера",[["Сервер на ногах","uptimeMs","duration"],["Память процесса","memoryRss","bytes"],["Память JavaScript","memoryHeap","bytes"],["CPU занимается делом","cpuUserMs","duration"],["CPU работает на систему","cpuSystemMs","duration"],["Ядер в распоряжении","cores","number"],["Версия Node.js","node","text"],["Платформа","platform","text"],["Остаток места на диске","freeDiskBytes","bytes"],["Когда всё запустилось","processStartedAt","date"]]],["Контроль и спокойствие",[["Статус CI","status.latest.ci","text"],["Доступный канал","status.config.channel","text"],["Частота автопроверки","status.config.autoCheck","text"],["Ограничение GitHub","status.rateLimitedUntil","date"],["Установка заблокирована?","derived.blocked","yesno"],["Готовность к установке","derived.ready","yesno"],["Отложен откат?","status.rollbackPending","yesno"],["Подтверждённых удалений","derived.removalsConfirmed","yesno"],["Удалений в очереди","derived.pendingRemovals","number"],["Проверок пройдено","derived.checkDone","number"]]],["Время — деньги",[["Время с последней проверки","derived.sinceCheck","duration"],["Время с последней установки","derived.sinceInstall","duration"],["Время с последней ошибки","derived.sinceFailure","duration"],["Время с последнего отката","derived.sinceRollback","duration"],["Возраст первого события","derived.sinceFirstEvent","duration"],["Возраст последнего события","derived.sinceLastEvent","duration"],["Промежуток истории","derived.historySpan","duration"],["Время с первого коммита","derived.gitAgeDuration","duration"],["Самый свежий файл проекта","scan.newest","date"],["Самый старый файл проекта","scan.oldest","date"]]],["Интересности",[["Доля JS среди файлов","derived.jsRatio","percent"],["Доля CSS среди файлов","derived.cssRatio","percent"],["Доля картинок","derived.imageRatio","percent"],["Файлы без этих расширений","derived.otherFiles","number"],["Насколько потолстел проект","growth.bytes","bytes"],["Прирост файлов проекта","growth.files","number"],["Ошибок на успешную установку","derived.errorPerInstall","number"],["Процент удачных установок","derived.successRatio","percent"],["Прирост строк кода","growth.lines","number"],["Уровень экономии скачивания","derived.reuseRatio","percent"]]],["Подозрительные файлы",[["Файлы-призраки","scan.emptyFiles","number"],["Гиганты среди нас","scan.largeFiles","number"],["Мелочь пузатая","scan.tinyFiles","number"],["Имена длиннее биографии","scan.longNames","number"],["Фанаты подчёркиваний","scan.underscoreNames","number"],["С БОЛЬШОЙ БУКВЫ","scan.uppercaseNames","number"],["Самое длинное имя","scan.maxNameBytes","number"],["Самое короткое имя","scan.minNameBytes","number"],["Анонимы без расширения","derived.extensionless","number"],["Мода на разнообразие","derived.extensionKinds","number"]]],["Секреты исходников",[["Забытые обещания","scan.todoLines","number"],["Разговоры с консолью","scan.consoleLines","number"],["Фабрика функций","scan.functionLines","number"],["Зависимости зовут","scan.importLines","number"],["Файлы с переносами","scan.newlineFiles","number"],["Аккуратный последний Enter","scan.trailingNewlineFiles","number"],["TODO на тысячу строк","derived.todoPerKLines","number"],["Консольные признания на тысячу строк","derived.consolePerKLines","number"],["Функций на файл","derived.functionsPerText","number"],["Импорты на файл","derived.importsPerText","number"]]],["Анатомия проекта",[["Процент пустых файлов","derived.emptyRatio","percent"],["Процент тяжеловесов","derived.largeRatio","percent"],["Процент малышей","derived.tinyRatio","percent"],["Доля длинных названий","derived.longRatio","percent"],["Подчёркнутый характер","derived.underscoreRatio","percent"],["Любители CAPS LOCK","derived.uppercaseRatio","percent"],["Код к общему весу","derived.codeWeightRatio","percent"],["Мегабайт на папку","derived.bytesPerDir","bytes"],["Строк на килобайт","derived.linesPerKb","number"],["Файлов на ядро","derived.filesPerCore","number"]]],["Хроники без прикрас",[["Ошибки против успехов","derived.failToSuccess","percent"],["Откаты против установок","derived.rollbackRatio","percent"],["Установок на версию","derived.installsPerVersion","number"],["Файлов на установку","derived.filesPerInstall","number"],["Событий на установку","derived.eventsPerInstall","number"],["Ошибок на событие","derived.eventErrorRatio","percent"],["Успехи против всех попыток","derived.installSuccessRate","percent"],["Последняя история помнит","history.last","date"],["Первая запись в летописи","history.first","date"],["Сколько записей на версию","derived.historyPerVersion","number"]]],["Математика подозрений",[["Байтов на скачанный файл","derived.bytesPerDownload","bytes"],["Скачиваний на установку","derived.downloadsPerInstall","number"],["Загрузок больше, чем файлов?","derived.downloadToFiles","percent"],["Повторы экономят нервы","derived.reusedVsDownloaded","percent"],["Проверок на скачивание","derived.verifiesPerDownload","number"],["Событий на скачивание","derived.eventsPerDownload","number"],["Сколько раз Git рос за день","derived.commitsPerGitDay","number"],["Строк на коммит","derived.linesPerCommit","number"],["Сколько весит один коммит","derived.bytesPerCommit","bytes"],["Обновлений на тысячу строк","derived.installsPerKLines","number"]]]];
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
  // One category is visible at a time: all 100 metrics remain accessible without a long page.
  const tabs=$('up-stats-tabs');
  const highlights=$('up-stats-highlights');
  const cards=[];
  const favoriteStore='reika-stats-favorites-v1';
  let favorites=[];
  try {const value=JSON.parse(localStorage.getItem(favoriteStore)||'[]');if(Array.isArray(value))favorites=value.filter(x=>typeof x==='string').slice(0,150);}catch{favorites=[];}
  let favoritesOnly=false;
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
    const star=document.createElement('button');star.type='button';star.className='stats-star';star.setAttribute('aria-label','Добавить в избранное');star.textContent='☆';
    const detail=document.createElement('button');detail.type='button';detail.className='stats-open';detail.setAttribute('aria-label','Подробнее: '+label);detail.textContent='↗';
    star.addEventListener('click',()=>toggleFavorite(key));
    detail.addEventListener('click',()=>openDetail({key,unit,label}));
    card.append(icon,name,meta,chart,star,detail);
    const c={key,unit,value,trend,chart,card,star};
    star.dataset.favoriteKey=key;
    card.dataset.metricKey=key;
    if(!compact){card.dataset.search=label.toLocaleLowerCase('ru-RU');card.dataset.metricLabel=label;}
    cards.push(c);
    return card;
  }
  const search=$('up-stats-search');
  const empty=$('up-stats-empty');
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
  function filterMetrics(){
    const query=search.value.trim().toLocaleLowerCase('ru-RU');
    tabs.hidden=!!query||favoritesOnly;
    let shown=0;
    root.querySelectorAll('.stats-category').forEach((section,i)=>{
      const visibleRows=Array.from(section.querySelectorAll('.stats-tile')).filter(tile=>{
        const matched=(!query || tile.dataset.search.includes(query))&&(!favoritesOnly || favorites.includes(tile.dataset.metricKey));
        tile.hidden=!matched;
        if(matched)shown++;
        return matched;
      });
      section.hidden=(query||favoritesOnly)?visibleRows.length===0:i!==selected.index;
    });
    empty.hidden=shown!==0;
    $('up-stats-section-title').textContent=favoritesOnly?'Избранное':query?'Поиск: '+search.value.trim():groups[selected.index][0];
    $('up-stats-section-count').textContent=query?shown+' найдено':groups[selected.index][1].length+' показателей';
  }
  search.addEventListener('input',filterMetrics);
  const favoriteToggle=$('up-stats-favorites-toggle');
  favoriteToggle.addEventListener('click',()=>{favoritesOnly=!favoritesOnly;favoriteToggle.setAttribute('aria-pressed',String(favoritesOnly));filterMetrics();});
  function toggleFavorite(key) {
    favorites=favorites.includes(key)?favorites.filter(x=>x!==key):[...favorites,key];
    try{localStorage.setItem(favoriteStore,JSON.stringify(favorites));}catch{/* Private mode or quota */}
    syncFavorites();filterMetrics();
  }
  function syncFavorites() {
    for(const c of cards){const on=favorites.includes(c.key);c.star.textContent=on?'★':'☆';c.star.setAttribute('aria-pressed',String(on));c.star.setAttribute('aria-label',(on?'Убрать из избранного: ':'Добавить в избранное: ')+c.key);}
    $('up-stats-favorites-count').textContent=favorites.length?'Закреплено: '+favorites.length:'';
  }
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
  syncFavorites();
  function activate(i){
    selected.index=i;
    $('up-stats-section-title').textContent=groups[i][0];
    $('up-stats-section-count').textContent=groups[i][1].length+' показателей';
    root.querySelectorAll('.stats-category').forEach((node,n)=>node.hidden=n!==i);
    tabButtons.forEach((tab,n)=>tab.setAttribute('aria-pressed',String(n===i)));
    filterMetrics();
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
  function showContext(data) {
    const comparison=$('up-stats-comparison');
    const insights=$('up-stats-insights');
    const baseline=data.versionComparison;
    if(baseline){
      const when=new Date(baseline.from).toLocaleDateString('ru-RU');
      const signed=n=>(n>0?'+':'')+num(n);
      const currentSize=data.scan?.bytes;
      const previousSize=Number.isFinite(currentSize)?currentSize-baseline.bytes:null;
      const percent=previousSize>0?100*baseline.bytes/previousSize:null;
      comparison.textContent='Размер проекта: '+format(currentSize,'bytes')+' · изменение '+signed(baseline.bytes)+' Б'+(percent===null?'':' ('+(percent>0?'+':'')+num(percent)+'%)')+'. Файлы: '+signed(baseline.files)+' · строки: '+signed(baseline.lines)+'. Сравнение с измерением от '+when+'.';
    }else comparison.textContent='Сравнение появится после первого сохранённого измерения.';
    const git=$('up-stats-gitdiff');
    const d=data.gitDiff;
    git.textContent=d?'Последний коммит '+d.from+' → '+d.to+': файлов изменено '+d.changedFiles+', добавлено '+d.addedFiles+', удалено '+d.deletedFiles+'; строк +'+d.addedLines+' / −'+d.deletedLines+'.':'Сравнение коммитов недоступно: требуется локальная история Git с минимум двумя коммитами.';
    const alerts=$('up-stats-alerts');alerts.replaceChildren();
    for(const a of data.anomalies||[]){const p=document.createElement('p');p.textContent='Обратить внимание: '+a.title+' ('+(a.changePercent>0?'+':'')+a.changePercent+'% относительно последних пяти измерений)';alerts.appendChild(p);}
    const sentences=[];
    if(baseline){
      if(baseline.bytes>0 && baseline.files===0)sentences.push('Размер проекта вырос без увеличения числа файлов — вероятно, изменилось содержимое существующих.');
      if(baseline.files>0 && baseline.bytes<0)sentences.push('Файлов стало больше, но проект стал занимать меньше места.');
      if(baseline.lines>0 && baseline.bytes<0)sentences.push('Строк стало больше, хотя общий размер уменьшился.');
    }
    if(data.history?.failures>0)sentences.push('В истории есть неудачные установки: '+data.history.failures+'.');
    insights.replaceChildren();
    if(!sentences.length){insights.textContent='Необычных изменений пока не обнаружено.';return;}
    for(const msg of sentences.slice(0,3)){const p=document.createElement('p');p.textContent=msg;insights.appendChild(p);}
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
      showContext(data);
      for(const c of cards)renderValue(c,data);
      $('stats-live-time').textContent=new Date(data.capturedAt).toLocaleTimeString('ru-RU');
      $('up-stats-note').textContent='Данные из файлов проекта и локальных журналов. Графики отражают измерения текущей сессии; история до начала записи может отсутствовать.';
    }catch(e){$('up-stats-note').textContent='Статистика пока недоступна: '+e.message;}
    finally{busy=false;}
  }
  window.ReikaStats={load,count:cards.length};
  window.addEventListener('reika:route',e=>{if(e.detail==='update')load(true);});
  setInterval(()=>{if(!$('page-update').hidden)load();},15000);
})();
