'use strict';
// Visual language of the statistics: an icon that matches each metric's name, its own calm colour, and a small diagram
// whose KIND depends on what the metric is (a history line, counted pips, a gauge, an age scale ...).
// Pure functions that return strings, so they are tested in Node (tests/stats-visual.test.js) and used by update-stats.js.
// A diagram only draws what the data really says: no data, no line (an empty outline is shown instead).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReikaStatsVisual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ---------- icons: 24x24, stroke only (colour and width come from CSS) ----------
  const ICONS = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    disk: '<rect x="3" y="12" width="18" height="7" rx="2"/><path d="M6 15.5h.01M10 15.5h.01M5 12l2-7h10l2 7"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    files: '<path d="M8 3h7l4 4v12H8zM15 3v4h4M5 7v14h11"/>',
    folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
    braces: '<path d="M9 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-6-4-11-8-11z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>',
    lines: '<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>',
    blank: '<path d="M4 8h3M10 8h4M17 8h3M4 16h3M10 16h4M17 16h3"/>',
    comment: '<path d="M4 5h16v11H9l-5 4z"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    func: '<path d="M10 4C8 4 8 6 8 8v8c0 2 0 4-2 4M5 11h6M14 10l5 6M19 10l-5 6"/>',
    link: '<path d="M10 14a4 4 0 005.6 0l3-3a4 4 0 00-5.6-5.6l-1 1M14 10a4 4 0 00-5.6 0l-3 3a4 4 0 005.6 5.6l1-1"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-12 6"/>',
    commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
    tag: '<path d="M4 4h8l8 8-8 8-8-8zM8 8h.01"/>',
    warning: '<path d="M12 4l9 16H3zM12 10v4M12 17v.01"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 8h-3"/>',
    refresh: '<path d="M20 12a8 8 0 11-2.5-5.8M20 4v5h-5"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    memory: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v8M12 8v8M17 8v8M6 19v-3M18 19v-3"/>',
    hex: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>',
    laptop: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M3 19h18"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3v3c0 3 8 3 8 6s-8 3-8 6v3M16 3v3c0 3-8 3-8 6"/>',
    gauge: '<path d="M4 17a8 8 0 1116 0M12 17l4-5"/>',
    trend: '<path d="M4 17l6-6 4 4 6-8M15 7h5v5"/>',
    hash: '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>',
    text: '<path d="M5 19L12 5l7 14M8 14h8"/>',
    ruler: '<path d="M3 15L15 3l6 6L9 21zM8 10l2 2M11 7l2 2M5 13l2 2"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
    cancel: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 5a3 3 0 010 6M18 14c2 1 3 3 3 6"/>',
    wifi: '<path d="M3 9a14 14 0 0118 0M6 12.5a9.5 9.5 0 0112 0M9 16a5 5 0 016 0M12 19.5v.01"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    pencil: '<path d="M4 20l1-4 11-11 3 3-11 11zM14 7l3 3"/>',
    ghost: '<path d="M6 21V10a6 6 0 0112 0v11l-3-2-3 2-3-2zM10 11h.01M14 11h.01"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    underscore: '<path d="M5 19h14M8 5v8a4 4 0 008 0V5"/>',
    caps: '<path d="M3 18L8 6l5 12M5 14h6M15 18V6h4a3 3 0 010 6h-4"/>',
    percent: '<path d="M19 5L5 19M7.5 8.5a1.5 1.5 0 100-.01M16.5 17.5a1.5 1.5 0 100-.01"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    rocket: '<path d="M12 3c4 2 6 6 5 11l-5 4-5-4c-1-5 1-9 5-11zM9 18l-2 3M15 18l2 3"/>',
    newline: '<path d="M19 6v7H6M10 9l-4 4 4 4"/>',
    stairs: '<path d="M4 20h5v-5h5v-5h6"/>',
    bars: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
  };

  // First matching rule wins; the key says what the metric measures.
  const RULES = [
    [/^status\.latest\.ci$/, 'shield'], [/^status\.latest\.sha$/, 'hash'], [/^status\.localVersion$/, 'tag'], [/changesTotal$/, 'pencil'],
    [/^status\.phase$/, 'flag'], [/^status\.percent$/, 'gauge'], [/^status\.downloadedBytes$/, 'download'], [/^status\.totalBytes$/, 'archive'],
    [/^status\.downloadedFiles$/, 'files'], [/^status\.totalFiles$/, 'list'], [/^status\.reusedFiles$/, 'refresh'], [/^status\.checkedAt$/, 'refresh'],
    [/config\.channel$/, 'branch'], [/config\.autoCheck$/, 'refresh'], [/rateLimitedUntil$/, 'hourglass'],
    [/^uptimeMs$|^processStartedAt$/, 'clock'], [/^cores$|^cpu/, 'cpu'], [/^memory/, 'memory'], [/^node$/, 'hex'], [/^platform$/, 'laptop'], [/^freeDiskBytes$|^scan\.bytes$/, 'disk'],
    [/scan\.largest|largeFiles|largeRatio/, 'expand'], [/scan\.smallest|tinyFiles|tinyRatio/, 'shrink'], [/scan\.deepest/, 'stairs'], [/scan\.directories|PerDir|DirectoryFiles|filesPerDirectory/, 'folder'],
    [/scan\.js$|jsRatio/, 'braces'], [/scan\.css$|cssRatio|extensionKinds/, 'palette'], [/scan\.html$/, 'code'], [/scan\.json$/, 'box'], [/scan\.images$|imageRatio/, 'image'],
    [/scan\.blank|blankRatio/, 'blank'], [/scan\.comments|commentRatio/, 'comment'], [/scan\.text$/, 'text'], [/scan\.lines$|nonblank|avgLines|linesPerKb/, 'lines'], [/noncomment|codeWeight/, 'code'],
    [/emptyFiles|emptyRatio|extensionless/, 'ghost'], [/longNames|longRatio|NameBytes|avgFileBytes/, 'ruler'], [/underscore/i, 'underscore'], [/uppercase/i, 'caps'],
    [/todo/i, 'pencil'], [/console/i, 'terminal'], [/function/i, 'func'], [/import/i, 'link'], [/ewlineFiles|railingNewline/, 'newline'],
    [/^scan\.files$|otherFiles|installedFiles|filesPerInstall|uniqueFiles/, 'files'], [/^scan\.(newest)$/, 'bolt'], [/^scan\.oldest$/, 'hourglass'],
    [/rollback.*Pending/i, 'undo'], [/rollbacks|rollbackRatio|sinceRollback|lastRollback/, 'undo'], [/backups/, 'archive'], [/uniqueVersions|installsPerVersion|historyPerVersion|versionAgeDays|localVersion/, 'tag'],
    [/failures|failure|failToSuccess|errorCount|errorPerInstall|eventErrorRatio|sinceFailure|lastFailure/, 'warning'], [/cancel/i, 'cancel'], [/blocked/, 'ban'],
    [/installs|lastInstall|sinceInstall|successRatio|installSuccessRate|installsPerKLines|checkDone|derived\.ready|removalsConfirmed/, 'check'],
    [/reuse|reusedVs/i, 'refresh'], [/verify/i, 'eye'], [/events\.starts/, 'search'], [/downloadsStarted/, 'rocket'], [/preparations/, 'archive'],
    [/download|BytesPerDownload|bytesPerDownload|eventsPerDownload|downloadToFiles/i, 'download'],
    [/git\.authors/, 'users'], [/firstCommit|gitAge/, 'calendar'], [/commit|Commit/, 'commit'],
    [/^growth\./, 'trend'], [/^history\.(first|last)$/, 'calendar'], [/^history\.count$|events\.count|eventsPer|pendingRemovals/, 'list'],
    [/^since|historySpan|sinceCheck/, 'hourglass'],
  ];
  const UNIT_ICONS = { bytes: 'disk', duration: 'clock', days: 'calendar', date: 'calendar', percent: 'percent', yesno: 'shield', number: 'hash', text: 'text', short: 'hash' };

  /** Name of the icon for a metric (a key of ICONS). */
  function iconName(key, unit) {
    for (const [re, name] of RULES) if (re.test(key)) return name;
    return UNIT_ICONS[unit] || 'dot';
  }
  const iconSvg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`;

  // ---------- colour: one calm family per category, every metric its own shade ----------
  const GROUP_HUES = [200, 38, 335, 268, 150, 235, 22]; // one per section: now, files, quirks, code, updates, downloads, versions
  const hueOf = (g, i) => (((GROUP_HUES[g % GROUP_HUES.length] + (((i * 7) % 11) - 5) * 4.4) % 360) + 360) % 360;
  const shadeOf = (i) => [0.8, 0.74, 0.77, 0.71, 0.83][i % 5];
  const chromaOf = (i) => [0.095, 0.11, 0.085, 0.105, 0.09][(i * 3) % 5];

  /** { hue, color } of a metric: section hue spread over its items; failures lean warm, successes lean green. */
  function tone(group, index, key = '') {
    let hue = hueOf(group, index);
    if (/error|failure|fail|warning|blocked|cancel/i.test(key)) hue = 22 + ((index * 7) % 14);
    else if (/success|ready|checkDone|installs$/i.test(key)) hue = 148 + ((index * 5) % 16);
    hue = (hue + group * 0.13 + index * 0.017) % 360; // keeps every metric's colour distinct even where the rules overlap
    const l = shadeOf(index), c = chromaOf(index);
    const h = Math.round(hue * 100) / 100;
    return { hue: h, color: `oklch(${l} ${c} ${h})` };
  }
  /** The colour of a whole category (tabs). */
  const groupColor = (g) => `oklch(0.78 0.1 ${GROUP_HUES[g % GROUP_HUES.length]})`;

  // ---------- which diagram a metric gets ----------
  const AREA = /^(scan\.(bytes|files|lines)|memoryRss|freeDiskBytes)$/;
  const BARS = /^(history\.installs|history\.failures|events\.downloadedBytes)$/;
  const PIPS = /^(history\.|events\.|git\.authors|cores$|derived\.(checkDone|pendingRemovals)|status\.(downloadedFiles|totalFiles|reusedFiles))/;
  // Counts that are a part of a whole: shown as a share of the total (the total is another metric).
  const SHARE_OF = {};
  for (const k of ['js', 'css', 'html', 'json', 'images', 'text', 'emptyFiles', 'largeFiles', 'tinyFiles', 'longNames', 'underscoreNames', 'uppercaseNames', 'newlineFiles', 'trailingNewlineFiles']) SHARE_OF['scan.' + k] = 'scan.files';
  for (const k of ['blank', 'comments', 'todoLines', 'consoleLines', 'functionLines', 'importLines']) SHARE_OF['scan.' + k] = 'scan.lines';
  Object.assign(SHARE_OF, { 'derived.nonblank': 'scan.lines', 'derived.noncomment': 'scan.lines', 'derived.otherFiles': 'scan.files', 'events.uniqueFiles': 'events.downloadedFiles', 'status.reusedFiles': 'status.totalFiles', 'status.downloadedFiles': 'status.totalFiles', 'scan.directories': 'scan.files' });
  const shareTotalKey = (key) => SHARE_OF[key] || null;
  const SCALE = /^derived\.(avg(?!FileBytes|NameBytes)|.*Per(?!Dir$|Download$|Commit$))|^derived\.(avgLines|linesPerKb|filesPerDirectory|filesPerCore|errorPerInstall|installsPerVersion|historyPerVersion|filesPerInstall|eventsPerInstall|downloadsPerInstall|verifiesPerDownload|eventsPerDownload|commitsPerGitDay|linesPerCommit|installsPerKLines|todoPerKLines|consolePerKLines|functionsPerText|importsPerText)$/;
  /** area | bars | compare | toggle | chip | gauge | meter | age | share | scale | signal | pips */
  function chartKind(key, unit) {
    if (AREA.test(key)) return 'area';
    if (BARS.test(key)) return 'bars';
    if (/^growth\./.test(key)) return 'compare';
    if (unit === 'yesno') return 'toggle';
    if (unit === 'text' || unit === 'short') return 'chip';
    if (unit === 'percent') return /Ratio$/.test(key) ? 'gauge' : 'meter';
    if (unit === 'duration' || unit === 'date' || unit === 'days') return 'age';
    if (unit === 'bytes') return 'signal';
    if (SHARE_OF[key]) return 'share';
    if (SCALE.test(key)) return 'scale';
    return PIPS.test(key) ? 'pips' : 'signal';
  }

  // ---------- diagrams (strings) ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const f = (n) => (Math.round(n * 100) / 100).toString();
  const svg = (kind, inner, label = '') => `<svg class="stats-viz stats-viz--${kind}" viewBox="0 0 120 32" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const dashed = (kind) => svg(kind, '<path class="viz-off" d="M4 24h112" stroke-dasharray="3 4"/>', 'Нет данных для диаграммы');

  function area(series) {
    const good = (series || []).filter(num);
    if (good.length < 2) return dashed('area');
    const lo = Math.min(...good), hi = Math.max(...good);
    const span = hi - lo || 1;
    const pts = good.map((v, i) => [4 + (i * 112) / (good.length - 1), 27 - ((v - lo) * 21) / span]);
    const line = pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
    const last = pts[pts.length - 1];
    return svg('area', `<polygon class="viz-fill" points="4,30 ${line} ${f(last[0])},30"/><polyline class="viz-line" points="${line}"/><circle class="viz-dot" cx="${f(last[0])}" cy="${f(last[1])}" r="2.4"/>`, 'История изменения');
  }
  function bars(series) {
    const good = (series || []).filter(num).slice(-24);
    if (good.length < 2) return dashed('bars');
    const hi = Math.max(...good, 1);
    const w = 112 / good.length;
    const rects = good.map((v, i) => { const h = Math.max(1.5, (v / hi) * 24); return `<rect class="${i === good.length - 1 ? 'viz-on' : 'viz-bar'}" x="${f(4 + i * w + w * 0.15)}" y="${f(29 - h)}" width="${f(w * 0.7)}" height="${f(h)}" rx="1"/>`; }).join('');
    return svg('bars', rects, 'История изменения столбиками');
  }
  function gauge(percent) {
    if (!num(percent)) return dashed('gauge');
    const p = Math.max(0, Math.min(100, percent));
    return svg('gauge', `<path class="viz-track" d="M34 30A26 26 0 0 1 86 30" pathLength="100"/><path class="viz-arc" d="M34 30A26 26 0 0 1 86 30" pathLength="100" stroke-dasharray="${f(p)} 100"/>`, `Заполнено ${f(p)}%`);
  }
  function meter(percent) {
    if (!num(percent)) return dashed('meter');
    const p = Math.max(0, Math.min(100, percent));
    const lit = p > 0 ? Math.max(1, Math.round(p / 5)) : 0;
    let cells = '';
    for (let i = 0; i < 20; i++) cells += `<rect class="${i < lit ? 'viz-on' : 'viz-off-cell'}" x="${f(2.6 + i * 5.8)}" y="11" width="4.6" height="10" rx="1.2"/>`;
    return svg('meter', cells, `Заполнено ${f(p)}%`);
  }
  function toggle(value) {
    if (value === null || value === undefined) return dashed('toggle');
    const on = !!value;
    return svg('toggle', `<rect class="${on ? 'viz-on' : 'viz-off-cell'}" x="38" y="8" width="44" height="16" rx="8"/><circle class="viz-knob" cx="${on ? 74 : 46}" cy="16" r="6"/>`, on ? 'Да' : 'Нет');
  }
  /** Age on a scale you can read: 24 ticks = hours (up to a day and a half), else 7 ticks = days. */
  function age(ms) {
    if (!num(ms) || ms < 0) return dashed('age');
    const hours = ms / 3_600_000;
    const inHours = hours < 36;
    const total = inHours ? 24 : 7;
    const lit = Math.min(total, Math.max(1, Math.ceil(inHours ? hours : hours / 24)));
    const gap = inHours ? 1.2 : 4, w = inHours ? 3.3 : 12.5;
    const x0 = 2 + (116 - (total * w + (total - 1) * gap)) / 2;
    let ticks = '';
    for (let i = 0; i < total; i++) ticks += `<rect class="${i < lit ? 'viz-on' : 'viz-off-cell'}" x="${f(x0 + i * (w + gap))}" y="3" width="${w}" height="15" rx="1.2"/>`;
    const caption = inHours ? 'шкала: 24 часа' : (hours / 24 > 7 ? 'шкала: 7 дней и больше' : 'шкала: 7 дней');
    return svg('age', `${ticks}<text class="viz-text" x="60" y="29" text-anchor="middle">${caption}</text>`, caption);
  }
  function compare(baseline, now) {
    if (!num(baseline) || !num(now)) return dashed('compare');
    const hi = Math.max(Math.abs(baseline), Math.abs(now), 1);
    const a = Math.max(2, (Math.abs(baseline) / hi) * 80), b = Math.max(2, (Math.abs(now) / hi) * 80);
    return svg('compare', `<text class="viz-text" x="0" y="12">старт</text><rect class="viz-bar" x="34" y="5" width="${f(a)}" height="9" rx="2"/><text class="viz-text" x="0" y="28">сейчас</text><rect class="viz-on" x="34" y="19" width="${f(b)}" height="9" rx="2"/>`, 'Старт и сейчас');
  }
  /** Counted pips: exactly as many as the number (up to ten; more shows a plus). */
  function pips(value) {
    if (!num(value) || value < 0) return dashed('pips');
    const n = Math.round(value);
    let dots = '';
    for (let i = 0; i < 10; i++) {
      const x = 10 + i * 11.2;
      if (n > 10 && i === 9) dots += `<text class="viz-plus" x="${f(x)}" y="20" text-anchor="middle">+</text>`;
      else dots += `<circle class="${i < n ? 'viz-on' : 'viz-off-cell'}" cx="${f(x)}" cy="16" r="3.6"/>`;
    }
    return svg('pips', dots, `Число: ${n}`);
  }
  const BYTE_STEPS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const DIGIT_STEPS = ['1', '10', '100', '1К', '10К', '100К', '1М'];
  /** Order of magnitude as rising bars: bytes by unit, other numbers by digits. */
  function signal(value, unit) {
    if (!num(value) || value < 0) return dashed('signal');
    const isBytes = unit === 'bytes';
    const steps = isBytes ? BYTE_STEPS : DIGIT_STEPS;
    let lit;
    if (value === 0) lit = 0;
    else if (isBytes) lit = Math.min(steps.length, Math.max(1, Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024)) + 1));
    else lit = Math.min(steps.length, Math.max(1, Math.floor(Math.log10(Math.max(value, 1))) + 1));
    const n = steps.length, w = 9, gap = 4;
    const x0 = (120 - (n * w + (n - 1) * gap)) / 2;
    let out = '';
    const shown = (i) => isBytes || i % 2 === 0; // seven digit steps would crowd their labels: name every other one
    steps.forEach((label, i) => {
      const h = 5 + (i * 11) / (n - 1);
      out += `<rect class="${i < lit ? 'viz-on' : 'viz-off-cell'}" x="${f(x0 + i * (w + gap))}" y="${f(20 - h)}" width="${w}" height="${f(h)}" rx="1.2"/>`;
      if (shown(i)) out += `<text class="viz-text" x="${f(x0 + i * (w + gap) + w / 2)}" y="30" text-anchor="middle">${label}</text>`;
    });
    return svg('signal', out, 'Порядок величины');
  }
  /** A part of a whole: a pill filled to the share, with "N из M" under it. */
  function share(value, total) {
    if (!num(value) || !num(total) || total <= 0) return dashed('share');
    const p = Math.max(0, Math.min(100, (value / total) * 100));
    const w = value > 0 ? Math.max(3, p * 1.12) : 0;
    return svg('share', `<rect class="viz-track-rect" x="4" y="6" width="112" height="11" rx="5.5"/><rect class="viz-on" x="4" y="6" width="${f(w)}" height="11" rx="5.5"/><text class="viz-text" x="60" y="29" text-anchor="middle">${esc(Math.round(value))} из ${esc(Math.round(total))}</text>`, `${f(p)}% от целого`);
  }
  /** A logarithmic ruler (0.1 ... 1000) with a marker: for "how many of X per Y" values. */
  function scale(value) {
    if (!num(value) || value < 0) return dashed('scale');
    const pos = value > 0 ? Math.max(0, Math.min(4, Math.log10(value) + 1)) : 0;
    const x = 10 + pos * 25;
    let marks = '';
    ['0,1', '1', '10', '100', '1К'].forEach((label, i) => {
      marks += `<path class="viz-tick" d="M${10 + i * 25} 12v6"/><text class="viz-text" x="${10 + i * 25}" y="30" text-anchor="middle">${label}</text>`;
    });
    return svg('scale', `<path class="viz-axis" d="M10 15h100"/>${marks}<circle class="viz-on" cx="${f(x)}" cy="15" r="4.2"/>`, 'Логарифмическая шкала');
  }
  const chip = (text) => `<span class="stats-chip">${esc(text === null || text === undefined || text === '' ? '—' : String(text).slice(0, 24))}</span>`;

  /**
   * HTML/SVG of the diagram. input: { value, unit, series, baseline, now, text }
   *  - area/bars take the saved history (`series`), compare takes `baseline` (+ `value` = growth), age takes the time in ms.
   */
  function chart(kind, input = {}) {
    const { value, unit, series, baseline } = input;
    switch (kind) {
      case 'area': return area(series);
      case 'bars': return bars(series);
      case 'gauge': return gauge(value);
      case 'meter': return meter(value);
      case 'toggle': return toggle(value);
      case 'age': return age(input.ageMs);
      case 'compare': return num(baseline) && num(value) ? compare(baseline, baseline + value) : dashed('compare');
      case 'pips': return Number.isInteger(value) ? pips(value) : signal(value, unit);
      case 'share': return share(value, input.total);
      case 'scale': return scale(value);
      case 'chip': return chip(input.text);
      default: return signal(value, unit);
    }
  }

  return { ICONS, iconName, iconSvg, tone, groupColor, chartKind, chart, shareTotalKey, KINDS: ['area', 'bars', 'compare', 'toggle', 'chip', 'gauge', 'meter', 'age', 'share', 'scale', 'signal', 'pips'] };
});
