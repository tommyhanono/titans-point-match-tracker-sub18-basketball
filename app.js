'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════════════════ */
const QUARTER_SECS = 10 * 60;
const QUARTERS     = ['Q1','Q2','Q3','Q4','OT'];
const STORAGE_KEY  = 'titans_game_v2';
const HISTORY_KEY  = 'titans_history_v1';

const DEFAULT_PLAYERS = [
  'Aaron Breziner', 'Andre Setton',    'Zury Attia',       'Joseph Gabay',
  'Saul Piciotto',  'Daniel Abadi',    'Ilay Mendelson',   'Alberto Yahni',
  'Ramon Malca',    'Ariel Gean',      'Ariel Ghershfeld', 'Toby Burstein',
];

/* Tiros: cada par = (Encestado, Fallado) */
const SHOT_CFG = [
  { label:'2 Puntos',  madeKey:'2PT_MADE', attKey:'2PT_ATT',  pts:2,
    madeColor:'#1a5e35', missColor:'#5c0a0a' },
  { label:'3 Puntos',  madeKey:'3PT_MADE', attKey:'3PT_ATT',  pts:3,
    madeColor:'#0e4d3f', missColor:'#5c0a0a' },
  { label:'Tiro Libre',madeKey:'FT_MADE',  attKey:'FT_ATT',   pts:1,
    madeColor:'#0b5e4e', missColor:'#5c0a0a' },
];

/* Stats sin par (botón simple) */
const STAT_CFG = [
  { key:'REB_OFF', label:'Reb. Ofensivo',  color:'#8a6914' },
  { key:'REB_DEF', label:'Reb. Defensivo', color:'#7d5d12' },
  { key:'AST',     label:'Asistencia',     color:'#1f6090' },
  { key:'TOV',     label:'Pérdida',        color:'#7b241c' },
  { key:'STL',     label:'Robo',           color:'#6c3483' },
  { key:'BLK',     label:'Bloqueo',        color:'#0e6251' },
  { key:'FOUL',    label:'Falta',          color:'#a93226' },
];

/* Todas las claves internas de stats */
const ALL_STAT_KEYS = [
  '2PT_MADE','2PT_ATT','3PT_MADE','3PT_ATT','FT_MADE','FT_ATT',
  'REB_OFF','REB_DEF','AST','TOV','STL','BLK','FOUL',
];

/* Helpers de totales (usados en TABLE_COLS y Excel) */
function totStat(key) { return S.players.reduce((n,p) => n + (S.stats[p]?.[key] || 0), 0); }

/* Columnas de la tabla */
const TABLE_COLS = [
  { h:'MIN',
    fn: p => fmtMin(S.minutesPlayed[p]||0),
    total: () => fmtMin(totalMins()) },
  { h:'PTS',
    fn: p => pts(p),
    total: () => S.players.reduce((n,p) => n + pts(p), 0) },
  { h:'2PT M/A',
    fn: p => `${S.stats[p]['2PT_MADE']}/${S.stats[p]['2PT_ATT']}`,
    total: () => `${totStat('2PT_MADE')}/${totStat('2PT_ATT')}` },
  { h:'3PT M/A',
    fn: p => `${S.stats[p]['3PT_MADE']}/${S.stats[p]['3PT_ATT']}`,
    total: () => `${totStat('3PT_MADE')}/${totStat('3PT_ATT')}` },
  { h:'TL M/A',
    fn: p => `${S.stats[p]['FT_MADE']}/${S.stats[p]['FT_ATT']}`,
    total: () => `${totStat('FT_MADE')}/${totStat('FT_ATT')}` },
  { h:'FG%',
    fn: p => fmtPct(fgPct(p)),
    total: () => {
      const m = totStat('2PT_MADE') + totStat('3PT_MADE');
      const a = totStat('2PT_ATT')  + totStat('3PT_ATT');
      return fmtPct(a > 0 ? m/a : null);
    }},
  { h:'3PT%',
    fn: p => fmtPct(threePct(p)),
    total: () => {
      const m = totStat('3PT_MADE'), a = totStat('3PT_ATT');
      return fmtPct(a > 0 ? m/a : null);
    }},
  { h:'FT%',
    fn: p => fmtPct(ftPct(p)),
    total: () => {
      const m = totStat('FT_MADE'), a = totStat('FT_ATT');
      return fmtPct(a > 0 ? m/a : null);
    }},
  { h:'R.Of',  fn: p => S.stats[p].REB_OFF,                   total: () => totStat('REB_OFF') },
  { h:'R.Def', fn: p => S.stats[p].REB_DEF,                   total: () => totStat('REB_DEF') },
  { h:'REB',   fn: p => S.stats[p].REB_OFF + S.stats[p].REB_DEF,
               total: () => totStat('REB_OFF') + totStat('REB_DEF') },
  { h:'AST',   fn: p => S.stats[p].AST,   total: () => totStat('AST') },
  { h:'TOV',   fn: p => S.stats[p].TOV,   total: () => totStat('TOV') },
  { h:'ROB',   fn: p => S.stats[p].STL,   total: () => totStat('STL') },
  { h:'BLQ',   fn: p => S.stats[p].BLK,   total: () => totStat('BLK') },
  { h:'FALT',  fn: p => S.stats[p].FOUL,  total: () => totStat('FOUL'),
               cellClass: p => S.stats[p].FOUL >= 5 ? 'falt-5' : (S.stats[p].FOUL >= 4 ? 'falt-4' : '') },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════════════════════ */
let S = newState();

function newState() {
  const players = [...DEFAULT_PLAYERS];
  return {
    gameName:      'Titans vs ___',
    quarter:       'Q1',
    secsLeft:      QUARTER_SECS,
    clockRunning:  false,
    players,
    stats:         makeStats(players),
    minutesPlayed: makeMinutes(players),
    onCourt:       [],
    fouledOut:     {},
    selected:      players[0],
    history:       [],
  };
}

function makeStats(players) {
  const obj = {};
  players.forEach(p => {
    obj[p] = {};
    ALL_STAT_KEYS.forEach(k => obj[p][k] = 0);
  });
  return obj;
}

function makeMinutes(players) {
  const obj = {};
  players.forEach(p => obj[p] = 0);
  return obj;
}

function ensurePlayer(p) {
  if (!S.stats[p]) S.stats[p] = {};
  ALL_STAT_KEYS.forEach(k => { if (S.stats[p][k] === undefined) S.stats[p][k] = 0; });
  if (S.minutesPlayed[p] === undefined) S.minutesPlayed[p] = 0;
  if (!S.fouledOut) S.fouledOut = {};
}

/* ═══════════════════════════════════════════════════════════════════════════
   MIGRACIÓN DE DATOS VIEJOS (2PT/3PT/FT → M/A)
═══════════════════════════════════════════════════════════════════════════ */
function migrateIfNeeded(d) {
  if (!d.stats) return d;
  Object.keys(d.stats).forEach(p => {
    const s = d.stats[p];
    if ('2PT' in s && !('2PT_MADE' in s)) {
      s['2PT_MADE'] = s['2PT'] || 0;
      s['2PT_ATT']  = s['2PT'] || 0;
      delete s['2PT'];
    }
    if ('3PT' in s && !('3PT_MADE' in s)) {
      s['3PT_MADE'] = s['3PT'] || 0;
      s['3PT_ATT']  = s['3PT'] || 0;
      delete s['3PT'];
    }
    if ('FT' in s && !('FT_MADE' in s)) {
      s['FT_MADE'] = s['FT'] || 0;
      s['FT_ATT']  = s['FT'] || 0;
      delete s['FT'];
    }
  });
  return d;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS DE CÁLCULO
═══════════════════════════════════════════════════════════════════════════ */
function pts(p) {
  const s = S.stats[p];
  return (s['2PT_MADE']||0)*2 + (s['3PT_MADE']||0)*3 + (s['FT_MADE']||0);
}

function fgPct(p) {
  const s = S.stats[p];
  const a = (s['2PT_ATT']||0) + (s['3PT_ATT']||0);
  return a > 0 ? ((s['2PT_MADE']||0) + (s['3PT_MADE']||0)) / a : null;
}

function threePct(p) {
  const s = S.stats[p];
  return s['3PT_ATT'] > 0 ? s['3PT_MADE'] / s['3PT_ATT'] : null;
}

function ftPct(p) {
  const s = S.stats[p];
  return s['FT_ATT'] > 0 ? s['FT_MADE'] / s['FT_ATT'] : null;
}

function fmtPct(v) {
  return v === null ? '--' : Math.round(v * 100) + '%';
}

function totalPts()  { return S.players.reduce((n, p) => n + pts(p), 0); }
function totalMins() { return Object.values(S.minutesPlayed).reduce((a,b) => a+b, 0); }

function fmtMin(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function shortName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return full;
  const first = parts[0];
  const hasDup = S.players.some(p => p !== full && p.split(/\s+/)[0] === first);
  return hasDup ? `${first} ${parts[1].slice(0,2)}.` : first;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERSISTENCIA
═══════════════════════════════════════════════════════════════════════════ */
let _saveTimer = null;

function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 1500);
}

function save() {
  try {
    const { history, ...toSave } = S;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch(e) { console.warn('Error guardando:', e); }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = migrateIfNeeded(JSON.parse(raw));
    S = {
      gameName:      d.gameName      ?? S.gameName,
      quarter:       d.quarter       ?? S.quarter,
      secsLeft:      d.secsLeft      ?? QUARTER_SECS,
      clockRunning:  false,
      players:       d.players       ?? S.players,
      stats:         d.stats         ?? S.stats,
      minutesPlayed: d.minutesPlayed ?? S.minutesPlayed,
      onCourt:       d.onCourt       ?? [],
      fouledOut:     d.fouledOut     ?? {},
      selected:      d.selected      ?? (d.players?.[0] ?? S.players[0]),
      history:       [],
    };
    S.players.forEach(ensurePlayer);
    return true;
  } catch(e) { console.warn('Error cargando:', e); return false; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RELOJ
═══════════════════════════════════════════════════════════════════════════ */
let _interval = null;

function startInterval() {
  if (_interval) return;
  _interval = setInterval(tick, 1000);
}

function tick() {
  if (!S.clockRunning) return;
  S.onCourt.forEach(p => { S.minutesPlayed[p] = (S.minutesPlayed[p]||0) + 1; });
  if (S.secsLeft > 0) {
    S.secsLeft--;
    if (S.secsLeft === 0) { S.clockRunning = false; onQuarterEnd(); }
  }
  renderClock();
  refreshMinCells();
}

function onQuarterEnd() {
  updateClockBtn();
  navigator.vibrate?.([200,100,200,100,200]);
  document.getElementById('clockDisplay')?.classList.add('flash');
  setTimeout(() => document.getElementById('clockDisplay')?.classList.remove('flash'), 2200);
  toast(`¡Fin del ${S.quarter}! 🏀`);
}

function toggleClock() {
  S.clockRunning = !S.clockRunning;
  updateClockBtn();
  scheduleSave();
}

function resetClock() {
  S.clockRunning = false;
  S.secsLeft = QUARTER_SECS;
  updateClockBtn();
  renderClock();
  scheduleSave();
}

function updateClockBtn() {
  const btn = document.getElementById('btnToggleClock');
  if (!btn) return;
  if (S.clockRunning) { btn.textContent = '⏸'; btn.classList.add('paused'); }
  else                { btn.textContent = '▶'; btn.classList.remove('paused'); }
}

function renderClock() {
  const el = document.getElementById('clockDisplay');
  if (!el) return;
  const m = Math.floor(S.secsLeft/60), s = S.secsLeft % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.className = 'clock-num';
  if (S.secsLeft <= 60)       el.classList.add('red');
  else if (S.secsLeft <= 180) el.classList.add('yellow');
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
function renderAll() {
  document.getElementById('gameName').value = S.gameName;
  renderQuarterBtns();
  document.getElementById('clockQuarter').textContent = S.quarter;
  renderClock();
  updateClockBtn();
  renderPlayers();
  renderStatButtons();
  renderActiveBadge();
  renderScore();
  const tbl = document.getElementById('tableSection');
  if (tbl && !tbl.classList.contains('hidden')) renderTable();
}

function renderScore() {
  const el = document.getElementById('scoreVal');
  if (el) el.textContent = totalPts();
}

function renderQuarterBtns() {
  const sel = document.getElementById('quarterSelector');
  if (!sel) return;
  sel.innerHTML = '';
  QUARTERS.forEach(q => {
    const b = document.createElement('button');
    b.textContent = q; b.dataset.q = q;
    if (S.quarter === q) b.classList.add('active');
    sel.appendChild(b);
  });
}

/* Jugadores */
function renderPlayers() {
  const list = document.getElementById('playerList');
  if (!list) return;
  list.innerHTML = '';
  S.players.forEach(p => {
    const wrap = document.createElement('div');
    wrap.className = 'player-wrap';

    const btn = document.createElement('button');
    btn.className = 'player-btn';
    btn.dataset.player = p;
    btn.textContent = shortName(p);
    if (p === S.selected) btn.classList.add('selected');

    const cBtn = document.createElement('button');
    cBtn.dataset.court = p;

    if (S.fouledOut[p]) {
      btn.classList.add('fouled-out');
      cBtn.className = 'court-btn fouled-out';
      cBtn.textContent = '✕ 5 Faltas';
    } else if (S.onCourt.includes(p)) {
      btn.classList.add('on-court');
      cBtn.className = 'court-btn in';
      cBtn.textContent = '● Cancha';
    } else {
      cBtn.className = 'court-btn';
      cBtn.textContent = '○ Fuera';
    }

    wrap.append(btn, cBtn);
    list.appendChild(wrap);
  });
}

/* Botones de stats */
function renderStatButtons() {
  const grid = document.getElementById('statGrid');
  if (!grid) return;
  grid.innerHTML = '';

  /* ── Sección: Tiros ── */
  const shotLbl = document.createElement('div');
  shotLbl.className = 'stat-section-label';
  shotLbl.textContent = 'TIROS';
  grid.appendChild(shotLbl);

  SHOT_CFG.forEach(cfg => {
    const s = S.selected ? S.stats[S.selected] : null;
    const madeVal = s ? (s[cfg.madeKey]||0) : 0;
    const missVal = s ? ((s[cfg.attKey]||0) - (s[cfg.madeKey]||0)) : 0;

    const makeBtn = document.createElement('button');
    makeBtn.className = 'stat-btn shot-made';
    makeBtn.dataset.stat = cfg.madeKey;
    makeBtn.style.setProperty('--btn-color', cfg.madeColor);
    makeBtn.innerHTML =
      `<span class="stat-label">✓ ${cfg.label}</span>` +
      `<span class="stat-count" id="sc_${cfg.madeKey}">${madeVal}</span>`;

    const missBtn = document.createElement('button');
    missBtn.className = 'stat-btn shot-miss';
    missBtn.dataset.stat = cfg.attKey + '_MISS';
    missBtn.style.setProperty('--btn-color', cfg.missColor);
    missBtn.innerHTML =
      `<span class="stat-label">✗ ${cfg.label}</span>` +
      `<span class="stat-count" id="sc_${cfg.attKey}_MISS">${missVal}</span>`;

    grid.append(makeBtn, missBtn);
  });

  /* ── Sección: Estadísticas ── */
  const otherLbl = document.createElement('div');
  otherLbl.className = 'stat-section-label';
  otherLbl.textContent = 'ESTADÍSTICAS';
  grid.appendChild(otherLbl);

  STAT_CFG.forEach(cfg => {
    const btn = document.createElement('button');
    btn.className = 'stat-btn';
    btn.dataset.stat = cfg.key;
    btn.style.setProperty('--btn-color', cfg.color);
    const count = S.selected ? (S.stats[S.selected]?.[cfg.key] ?? 0) : 0;
    btn.innerHTML =
      `<span class="stat-label">${cfg.label}</span>` +
      `<span class="stat-count" id="sc_${cfg.key}">${count}</span>`;
    if (cfg.key === 'FOUL') btn.style.gridColumn = '1 / -1';
    grid.appendChild(btn);
  });
}

/* Actualiza solo los contadores (sin re-render) */
function updateCounts() {
  if (!S.selected) return;
  const s = S.stats[S.selected];
  // Shot counters
  SHOT_CFG.forEach(cfg => {
    const madeEl = document.getElementById(`sc_${cfg.madeKey}`);
    const missEl = document.getElementById(`sc_${cfg.attKey}_MISS`);
    if (madeEl) madeEl.textContent = s[cfg.madeKey] || 0;
    if (missEl) missEl.textContent = (s[cfg.attKey]||0) - (s[cfg.madeKey]||0);
  });
  // Simple stat counters
  STAT_CFG.forEach(cfg => {
    const el = document.getElementById(`sc_${cfg.key}`);
    if (el) el.textContent = s[cfg.key] || 0;
  });
}

function renderActiveBadge() {
  const nameEl   = document.getElementById('activeName');
  const statusEl = document.getElementById('activeStatus');
  if (nameEl) nameEl.textContent = S.selected || '—';
  if (statusEl) {
    if (S.fouledOut[S.selected]) {
      statusEl.textContent = '✕ Eliminado (5F)';
      statusEl.className   = 'active-status fouled-out';
    } else if (S.onCourt.includes(S.selected)) {
      statusEl.textContent = '● En cancha';
      statusEl.className   = 'active-status in';
    } else {
      statusEl.textContent = '○ Fuera';
      statusEl.className   = 'active-status out';
    }
  }
}

/* Tabla completa */
function renderTable() {
  const tbl = document.getElementById('statsTable');
  if (!tbl) return;

  const headers = ['Jugador', ...TABLE_COLS.map(c => c.h)];
  let html = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';

  S.players.forEach(p => {
    const isSel = p === S.selected;
    const isFO  = S.fouledOut[p];
    const rowCls = [isSel ? 'selected' : '', isFO ? 'row-fouled-out' : ''].filter(Boolean).join(' ');
    html += `<tr${rowCls ? ` class="${rowCls}"` : ''}><td>${shortName(p)}${isFO ? '*' : ''}</td>`;
    TABLE_COLS.forEach(col => {
      const val = col.fn(p);
      const cls = col.cellClass ? col.cellClass(p) : '';
      html += `<td${cls ? ` class="${cls}"` : ''}>${val}</td>`;
    });
    html += '</tr>';
  });

  // Fila TOTAL
  html += '<tr class="total-row"><td>TOTAL</td>';
  TABLE_COLS.forEach(col => {
    html += `<td>${col.total()}</td>`;
  });
  html += '</tr></tbody>';

  // Nota al pie si hay eliminados
  const foList = S.players.filter(p => S.fouledOut[p]);
  if (foList.length) {
    html += `<tfoot><tr><td colspan="${headers.length}" class="foul-note">* Eliminado por 5 faltas</td></tr></tfoot>`;
  }

  tbl.innerHTML = html;
}

function refreshMinCells() {
  const tbl = document.getElementById('tableSection');
  if (!tbl || tbl.classList.contains('hidden')) return;
  const rows = document.querySelectorAll('#statsTable tbody tr:not(.total-row)');
  rows.forEach((row, i) => {
    const p = S.players[i];
    if (p) row.cells[1].textContent = fmtMin(S.minutesPlayed[p]||0);
  });
  const totRow = document.querySelector('#statsTable .total-row');
  if (totRow) totRow.cells[1].textContent = fmtMin(totalMins());
}

function updateTableRow(player) {
  const tbl = document.getElementById('tableSection');
  if (!tbl || tbl.classList.contains('hidden')) return;
  const rows = document.querySelectorAll('#statsTable tbody tr:not(.total-row)');
  const idx  = S.players.indexOf(player);
  if (idx < 0 || !rows[idx]) return;

  // Update player name (may need * for fouled out)
  rows[idx].cells[0].textContent = shortName(player) + (S.fouledOut[player] ? '*' : '');
  rows[idx].classList.toggle('row-fouled-out', !!S.fouledOut[player]);

  TABLE_COLS.forEach((col, i) => {
    const cell = rows[idx].cells[i+1];
    cell.textContent = col.fn(player);
    cell.className = col.cellClass ? (col.cellClass(player) || '') : '';
  });
  updateTotalRow();
}

function updateTotalRow() {
  const totRow = document.querySelector('#statsTable .total-row');
  if (!totRow) return;
  TABLE_COLS.forEach((col, i) => {
    totRow.cells[i+1].textContent = col.total();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCIONES DE JUGADORES
═══════════════════════════════════════════════════════════════════════════ */
function selectPlayer(name) {
  S.selected = name;
  document.querySelectorAll('.player-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.player === name)
  );
  renderActiveBadge();
  updateCounts();
  document.querySelectorAll('#statsTable tbody tr:not(.total-row)').forEach((row, i) => {
    row.classList.toggle('selected', S.players[i] === name);
  });
}

function toggleCourt(player) {
  if (S.fouledOut[player]) {
    toast(`${shortName(player)} fue eliminado por 5 faltas`);
    return;
  }
  haptic();
  const idx = S.onCourt.indexOf(player);
  if (idx === -1) S.onCourt.push(player);
  else            S.onCourt.splice(idx, 1);

  const on  = S.onCourt.includes(player);
  const pBtn = document.querySelector(`.player-btn[data-player="${CSS.escape(player)}"]`);
  if (pBtn) pBtn.classList.toggle('on-court', on);
  const cBtn = document.querySelector(`.court-btn[data-court="${CSS.escape(player)}"]`);
  if (cBtn) { cBtn.textContent = on ? '● Cancha' : '○ Fuera'; cBtn.classList.toggle('in', on); }

  if (player === S.selected) renderActiveBadge();
  scheduleSave();
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGISTRO DE STATS Y UNDO
═══════════════════════════════════════════════════════════════════════════ */
function logStat(key) {
  if (!S.selected) { toast('Selecciona un jugador primero'); return; }
  if (S.fouledOut[S.selected]) { toast(`${shortName(S.selected)} fue eliminado por 5 faltas`); return; }
  haptic();

  // Snapshot completo para undo (incluye fouledOut y onCourt)
  S.history.push({
    player: S.selected, key,
    snap:         JSON.stringify(S.stats),
    fouledOutSnap: JSON.stringify(S.fouledOut),
    onCourtSnap:   JSON.stringify(S.onCourt),
  });
  if (S.history.length > 60) S.history.shift();

  // Aplicar acción
  const st = S.stats[S.selected];
  if      (key === '2PT_MADE')          { st['2PT_MADE']++; st['2PT_ATT']++; }
  else if (key === '2PT_ATT_MISS')      { st['2PT_ATT']++; }
  else if (key === '3PT_MADE')          { st['3PT_MADE']++; st['3PT_ATT']++; }
  else if (key === '3PT_ATT_MISS')      { st['3PT_ATT']++; }
  else if (key === 'FT_MADE')           { st['FT_MADE']++; st['FT_ATT']++; }
  else if (key === 'FT_ATT_MISS')       { st['FT_ATT']++; }
  else                                   { st[key]++; }

  // Chequeo de eliminación por 5 faltas
  if (key === 'FOUL') checkFoulOut(S.selected);

  // Actualizar contadores del panel
  updateCounts();

  // Animación tap
  const statBtn = document.querySelector(`.stat-btn[data-stat="${CSS.escape(key)}"]`);
  if (statBtn) {
    statBtn.classList.remove('tapped');
    void statBtn.offsetWidth;
    statBtn.classList.add('tapped');
    statBtn.addEventListener('animationend', () => statBtn.classList.remove('tapped'), { once:true });
  }

  renderScore();
  updateTableRow(S.selected);
  appendLog(S.selected, key);
  scheduleSave();
}

function checkFoulOut(player) {
  if ((S.stats[player].FOUL || 0) < 5) return;
  S.fouledOut[player] = true;

  // Sacar de cancha automáticamente
  const idx = S.onCourt.indexOf(player);
  if (idx !== -1) S.onCourt.splice(idx, 1);

  // Actualizar botones del jugador
  const pBtn = document.querySelector(`.player-btn[data-player="${CSS.escape(player)}"]`);
  if (pBtn) { pBtn.classList.remove('on-court'); pBtn.classList.add('fouled-out'); }
  const cBtn = document.querySelector(`.court-btn[data-court="${CSS.escape(player)}"]`);
  if (cBtn) { cBtn.textContent = '✕ 5 Faltas'; cBtn.className = 'court-btn fouled-out'; }

  if (player === S.selected) renderActiveBadge();

  navigator.vibrate?.([100,50,100,50,300]);
  toast(`⚠️ ${shortName(player)} eliminado por 5 faltas`);
  appendFoulOutLog(player);
}

function undoLast() {
  if (!S.history.length) { toast('Nada que deshacer'); return; }
  haptic();
  const { player, key, snap, fouledOutSnap, onCourtSnap } = S.history.pop();
  S.stats    = JSON.parse(snap);
  S.fouledOut = fouledOutSnap ? JSON.parse(fouledOutSnap) : S.fouledOut;
  S.onCourt   = onCourtSnap   ? JSON.parse(onCourtSnap)   : S.onCourt;

  if (player === S.selected) updateCounts();
  renderScore();
  appendLog(player, key, true);
  updateTableRow(player);
  renderPlayers();          // re-renderizar para reflejar estado fouledOut/onCourt
  if (player === S.selected) renderActiveBadge();
  scheduleSave();
}

/* Log de acciones */
function actionLabel(key) {
  if (key === '2PT_MADE')     return '✓ 2PT';
  if (key === '2PT_ATT_MISS') return '✗ 2PT';
  if (key === '3PT_MADE')     return '✓ 3PT';
  if (key === '3PT_ATT_MISS') return '✗ 3PT';
  if (key === 'FT_MADE')      return '✓ TL';
  if (key === 'FT_ATT_MISS')  return '✗ TL';
  return STAT_CFG.find(c => c.key === key)?.label ?? key;
}

function appendLog(player, key, undo = false) {
  const log = document.getElementById('actionLog');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'log-entry' + (undo ? ' undo' : '');
  line.textContent = `${undo?'↩':'+'} ${shortName(player)} — ${actionLabel(key)} [${S.quarter}]`;
  log.insertBefore(line, log.firstChild);
  while (log.children.length > 25) log.removeChild(log.lastChild);
}

function appendFoulOutLog(player) {
  const log = document.getElementById('actionLog');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'log-entry foul-out-entry';
  line.textContent = `⚠ ${shortName(player)} ELIMINADO [${S.quarter}]`;
  log.insertBefore(line, log.firstChild);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GESTIÓN DE JUGADORES
═══════════════════════════════════════════════════════════════════════════ */
function addPlayer() {
  const raw = prompt('Nombre completo del jugador:');
  if (!raw) return;
  const name = raw.trim().replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  if (S.players.includes(name)) { toast(`${name} ya existe`); return; }
  S.players.push(name);
  ensurePlayer(name);
  renderPlayers();
  renderTable();
  scheduleSave();
}

function removePlayer() {
  if (!S.selected) return;
  if (S.players.length <= 1) { toast('Necesitas al menos un jugador'); return; }
  if (!confirm(`¿Quitar a ${S.selected}?`)) return;
  const idx = S.players.indexOf(S.selected);
  S.players.splice(idx, 1);
  delete S.stats[S.selected];
  delete S.minutesPlayed[S.selected];
  delete S.fouledOut[S.selected];
  S.onCourt = S.onCourt.filter(p => p !== S.selected);
  S.selected = S.players[Math.max(0, idx-1)];
  renderAll();
  scheduleSave();
}

/* ═══════════════════════════════════════════════════════════════════════════
   GUARDAR / CARGAR / NUEVO PARTIDO
═══════════════════════════════════════════════════════════════════════════ */
function manualSave() { save(); toast('Partido guardado ✓'); }

function manualLoad() {
  if (!confirm('¿Cargar el último partido guardado? Se perderán los cambios actuales.')) return;
  if (loadSaved()) { renderAll(); toast('Partido cargado ✓'); }
  else               toast('No hay partido guardado');
}

function newGame() {
  if (!confirm('¿Iniciar un nuevo partido?\n\nSe guardarán las estadísticas actuales en el historial.')) return;

  // Guardar partido actual al historial si tiene datos
  if (totalPts() > 0 || S.players.some(p => S.minutesPlayed[p] > 0)) {
    const rivalScoreRaw = prompt('¿Cuántos puntos anotó el rival? (Enter para saltar)', '');
    const rivalScore    = rivalScoreRaw !== null && rivalScoreRaw.trim() !== '' ? parseInt(rivalScoreRaw) : null;
    const rivalName     = S.gameName.replace(/titans\s*vs\s*/i, '').trim() || '???';
    saveToHistory(rivalName, rivalScore);
  }

  const opponent = prompt('Nombre del nuevo rival:', '___') || '___';
  S = newState();
  S.gameName = `Titans vs ${opponent.trim()}`;
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  toast('🔄 Nuevo partido iniciado');
}

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORIAL DE PARTIDOS
═══════════════════════════════════════════════════════════════════════════ */

/* Partidos de la temporada — se usan como semilla si el dispositivo no tiene
   historial guardado (primer acceso, navegador nuevo, datos borrados).        */
const SEASON_SEED = (function() {
  const pl = ['Aaron Breziner','Andre Setton','Zury Attia','Joseph Gabay',
               'Saul Piciotto','Daniel Abadi','Ilay Mendelson','Alberto Yahni',
               'Ramon Malca','Ariel Gean','Ariel Ghershfeld','Toby Burstein'];
  function es() {
    const s={};
    pl.forEach(p => s[p]={'2PT_MADE':0,'2PT_ATT':0,'3PT_MADE':0,'3PT_ATT':0,
      'FT_MADE':0,'FT_ATT':0,'REB_OFF':0,'REB_DEF':0,'AST':0,'TOV':0,'STL':0,'BLK':0,'FOUL':0});
    return s;
  }
  function em() { const m={}; pl.forEach(p=>m[p]=0); return m; }

  // ── Partido 1: Titans vs CJP  56-64  (1/5/2026) ──────────────────────────
  const cjpS=es(), cjpM=em();
  Object.assign(cjpS['Aaron Breziner'],  {  '2PT_MADE':2,'2PT_ATT':8,'3PT_MADE':1,'3PT_ATT':3,'FT_MADE':2,'FT_ATT':8,'TOV':2,'FOUL':1});
  Object.assign(cjpS['Joseph Gabay'],    {  '2PT_MADE':5,'2PT_ATT':9,'3PT_MADE':1,'3PT_ATT':2,'FT_MADE':6,'FT_ATT':7,'TOV':1,'FOUL':2});
  Object.assign(cjpS['Andre Setton'],    {  '2PT_MADE':3,'2PT_ATT':9,'3PT_MADE':1,'3PT_ATT':3,'FT_MADE':5,'FT_ATT':12,'TOV':5,'FOUL':4});
  Object.assign(cjpS['Zury Attia'],      {  '2PT_MADE':1,'2PT_ATT':4,'3PT_MADE':1,'3PT_ATT':2,'FT_MADE':5,'FT_ATT':8,'TOV':1,'FOUL':5});
  Object.assign(cjpS['Saul Piciotto'],   {  '2PT_MADE':2,'2PT_ATT':6,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':0,'FT_ATT':2,'TOV':3,'FOUL':3});
  Object.assign(cjpS['Alberto Yahni'],   {  'TOV':2,'FOUL':2});
  Object.assign(cjpS['Ramon Malca'],     {  'TOV':2,'FOUL':2});
  Object.assign(cjpS['Ariel Gean'],      {  'FOUL':1});
  Object.assign(cjpS['Toby Burstein'],   {  'TOV':1,'FOUL':1});
  cjpM['Aaron Breziner']=2400; cjpM['Joseph Gabay']=1920; cjpM['Andre Setton']=1980;
  cjpM['Zury Attia']=1620; cjpM['Saul Piciotto']=960; cjpM['Alberto Yahni']=1140;
  cjpM['Ramon Malca']=240; cjpM['Ariel Gean']=180; cjpM['Toby Burstein']=120;

  // ── Partido 2: Titans vs MET  40-46  (3/5/2026) ──────────────────────────
  const metS=es(), metM=em();
  Object.assign(metS['Aaron Breziner'],  {  '2PT_MADE':1,'2PT_ATT':4,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':1,'FT_ATT':2,'TOV':2,'FOUL':1});
  Object.assign(metS['Joseph Gabay'],    {  '2PT_MADE':2,'2PT_ATT':5,'3PT_MADE':1,'3PT_ATT':2,'FT_MADE':2,'FT_ATT':2,'TOV':2,'FOUL':3});
  Object.assign(metS['Andre Setton'],    {  '2PT_MADE':6,'2PT_ATT':12,'3PT_MADE':0,'3PT_ATT':2,'FT_MADE':3,'FT_ATT':5,'TOV':5,'FOUL':2});
  Object.assign(metS['Saul Piciotto'],   {  '2PT_MADE':0,'2PT_ATT':2,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':0,'FT_ATT':2,'TOV':0,'FOUL':0});
  Object.assign(metS['Zury Attia'],      {  '2PT_MADE':2,'2PT_ATT':5,'3PT_MADE':2,'3PT_ATT':4,'FT_MADE':1,'FT_ATT':1,'TOV':3,'FOUL':5});
  Object.assign(metS['Daniel Abadi'],    {  '2PT_MADE':1,'2PT_ATT':4,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':0,'FT_ATT':0,'TOV':2,'FOUL':2});
  Object.assign(metS['Alberto Yahni'],   {  'TOV':1,'FOUL':0});
  Object.assign(metS['Ariel Gean'],      {  'TOV':3,'FOUL':0});
  Object.assign(metS['Ilay Mendelson'],  {  'TOV':0,'FOUL':1});
  Object.assign(metS['Ariel Ghershfeld'],{  'TOV':0,'FOUL':1});

  // ── Partido 3: Titans vs AIP  60-49  (10/5/2026) ─────────────────────────
  const aipS=es(), aipM=em();
  Object.assign(aipS['Andre Setton'],    {  '2PT_MADE':9,'2PT_ATT':18,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':6,'FT_ATT':18,'TOV':0,'FOUL':1});
  Object.assign(aipS['Ilay Mendelson'],  {  '2PT_MADE':6,'2PT_ATT':12,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':1,'FT_ATT':2,'TOV':6,'FOUL':2});
  Object.assign(aipS['Aaron Breziner'], {  '2PT_MADE':4,'2PT_ATT':9,'3PT_MADE':0,'3PT_ATT':4,'FT_MADE':1,'FT_ATT':6,'TOV':5,'FOUL':2});
  Object.assign(aipS['Saul Piciotto'],  {  '2PT_MADE':3,'2PT_ATT':7,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':1,'FT_ATT':4,'TOV':2,'FOUL':3});
  Object.assign(aipS['Daniel Abadi'],   {  '2PT_MADE':1,'2PT_ATT':8,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':0,'FT_ATT':0,'TOV':5,'FOUL':4});
  Object.assign(aipS['Alberto Yahni'],  {  '2PT_MADE':1,'2PT_ATT':5,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':0,'FT_ATT':0,'TOV':1,'FOUL':0});
  Object.assign(aipS['Ariel Ghershfeld'],{'2PT_MADE':1,'2PT_ATT':1,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':0,'FT_ATT':0,'TOV':1,'FOUL':1});
  Object.assign(aipS['Ariel Gean'],     {  '2PT_MADE':0,'2PT_ATT':0,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':1,'FT_ATT':2,'TOV':0,'FOUL':0});
  Object.assign(aipS['Ramon Malca'],    {  '2PT_MADE':0,'2PT_ATT':1,'TOV':1});
  aipM['Andre Setton']=2280; aipM['Ilay Mendelson']=2100; aipM['Aaron Breziner']=1200;

  // ── Partido 4: Titans vs La Salle  65-62  (20/5/2026) ────────────────────
  const lsS=es(), lsM=em();
  Object.assign(lsS['Aaron Breziner'],  {  '2PT_MADE':3,'2PT_ATT':12,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':2,'FT_ATT':3,'TOV':0,'FOUL':4,'REB_OFF':3,'REB_DEF':8,'AST':4});
  Object.assign(lsS['Andre Setton'],    {  '2PT_MADE':11,'2PT_ATT':17,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':5,'FT_ATT':12,'TOV':7,'FOUL':4,'REB_OFF':4,'REB_DEF':8,'AST':0});
  Object.assign(lsS['Joseph Gabay'],    {  '2PT_MADE':5,'2PT_ATT':8,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':1,'FT_ATT':1,'TOV':4,'FOUL':5,'REB_OFF':2,'REB_DEF':5,'AST':0});
  Object.assign(lsS['Daniel Abadi'],    {  '2PT_MADE':4,'2PT_ATT':12,'3PT_MADE':0,'3PT_ATT':0,'FT_MADE':1,'FT_ATT':3,'TOV':4,'FOUL':2,'REB_OFF':4,'REB_DEF':8,'AST':1});
  Object.assign(lsS['Ilay Mendelson'],  {  '2PT_MADE':4,'2PT_ATT':7,'3PT_MADE':0,'3PT_ATT':1,'FT_MADE':2,'FT_ATT':4,'TOV':4,'FOUL':3,'REB_OFF':3,'REB_DEF':7,'AST':0});
  Object.assign(lsS['Alberto Yahni'],   {  '2PT_MADE':0,'2PT_ATT':2,'TOV':2,'FOUL':0,'REB_OFF':0,'REB_DEF':1,'AST':2});
  lsM['Aaron Breziner']=2400; lsM['Andre Setton']=2400; lsM['Joseph Gabay']=1018;
  lsM['Daniel Abadi']=1772; lsM['Ilay Mendelson']=2400; lsM['Alberto Yahni']=2018;

  return [
    { date:'1/5/2026',  gameName:'Titans vs CJP',      rivalName:'CJP',      titansScore:56, rivalScore:64, stats:cjpS, minutesPlayed:cjpM, fouledOut:{'Zury Attia':true},    players:[...pl] },
    { date:'3/5/2026',  gameName:'Titans vs MET',      rivalName:'MET',      titansScore:40, rivalScore:46, stats:metS, minutesPlayed:metM, fouledOut:{'Zury Attia':true},    players:[...pl] },
    { date:'10/5/2026', gameName:'Titans vs AIP',      rivalName:'AIP',      titansScore:60, rivalScore:49, stats:aipS, minutesPlayed:aipM, fouledOut:{},                     players:[...pl] },
    { date:'20/5/2026', gameName:'Titans vs La Salle', rivalName:'La Salle', titansScore:65, rivalScore:62, stats:lsS,  minutesPlayed:lsM,  fouledOut:{'Joseph Gabay':true},  players:[...pl] },
  ];
})();

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
    // Primer acceso: sembrar con datos de la temporada y guardar
    localStorage.setItem(HISTORY_KEY, JSON.stringify(SEASON_SEED));
    return SEASON_SEED;
  } catch(e) { return SEASON_SEED; }
}

function saveToHistory(rivalName, rivalScore) {
  try {
    const history = loadHistory();
    history.push({
      date:         new Date().toLocaleDateString('es-ES'),
      gameName:     S.gameName,
      rivalName,
      titansScore:  totalPts(),
      rivalScore,
      stats:        JSON.parse(JSON.stringify(S.stats)),
      minutesPlayed:JSON.parse(JSON.stringify(S.minutesPlayed)),
      fouledOut:    JSON.parse(JSON.stringify(S.fouledOut || {})),
      players:      [...S.players],
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    toast('📚 Partido guardado en historial');
  } catch(e) { console.warn('Error guardando historial:', e); }
}

function openHistorial() {
  const history = loadHistory();

  /* ── Season totals per player ── */
  const allPlayers = [...new Set(history.flatMap(g => g.players))];
  const seasonStats = {};
  allPlayers.forEach(p => {
    seasonStats[p] = { gp:0, pts:0, fg2m:0,fg2a:0, fg3m:0,fg3a:0, ftm:0,fta:0,
                       reb:0, ast:0, tov:0, stl:0, blk:0, foul:0, mins:0 };
  });
  history.forEach(g => {
    g.players.forEach(p => {
      const s = g.stats[p]; if (!s) return;
      const ss = seasonStats[p];
      const gpts = (s['2PT_MADE']||0)*2 + (s['3PT_MADE']||0)*3 + (s['FT_MADE']||0);
      if (gpts > 0 || (g.minutesPlayed[p]||0) > 0) ss.gp++;
      ss.pts  += gpts;
      ss.fg2m += s['2PT_MADE']||0; ss.fg2a += s['2PT_ATT']||0;
      ss.fg3m += s['3PT_MADE']||0; ss.fg3a += s['3PT_ATT']||0;
      ss.ftm  += s['FT_MADE']||0;  ss.fta  += s['FT_ATT']||0;
      ss.reb  += (s.REB_OFF||0)+(s.REB_DEF||0);
      ss.ast  += s.AST||0; ss.tov += s.TOV||0;
      ss.stl  += s.STL||0; ss.blk += s.BLK||0; ss.foul += s.FOUL||0;
      ss.mins += g.minutesPlayed[p]||0;
    });
  });

  const avg = (v, gp) => gp > 0 ? (v/gp).toFixed(1) : '--';
  const pct  = (m, a) => a > 0 ? Math.round(m/a*100)+'%' : '--';

  /* ── Record ── */
  let W=0, L=0, D=0;
  history.forEach(g => {
    if (g.rivalScore === null || g.rivalScore === undefined) return;
    if (g.titansScore > g.rivalScore) W++;
    else if (g.titansScore < g.rivalScore) L++;
    else D++;
  });

  /* ── SVG line chart ── */
  function sparkline(playerName) {
    const games = history.filter(g => g.players.includes(playerName));
    if (games.length < 2) return '<em style="color:#888;font-size:0.75rem">Pocos partidos</em>';
    const vals = games.map(g => {
      const s = g.stats[playerName] || {};
      return (s['2PT_MADE']||0)*2 + (s['3PT_MADE']||0)*3 + (s['FT_MADE']||0);
    });
    const max = Math.max(...vals, 1);
    const W2 = 160, H2 = 40, pad = 6;
    const points = vals.map((v, i) => {
      const x = pad + (i / (vals.length-1)) * (W2 - pad*2);
      const y = H2 - pad - (v / max) * (H2 - pad*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const dots = vals.map((v, i) => {
      const x = pad + (i / (vals.length-1)) * (W2 - pad*2);
      const y = H2 - pad - (v / max) * (H2 - pad*2);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#f1c40f"/>
              <title>Partido ${i+1}: ${v} pts</title>`;
    }).join('');
    return `<svg width="${W2}" height="${H2}" style="overflow:visible">
      <polyline points="${points}" fill="none" stroke="#c0392b" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }

  /* ── Games list HTML ── */
  const gamesHtml = history.length === 0
    ? '<p style="color:#888;padding:12px">No hay partidos registrados aún.</p>'
    : [...history].reverse().map((g, ri) => {
        const i = history.length - 1 - ri;
        const result = g.rivalScore !== null && g.rivalScore !== undefined
          ? (g.titansScore > g.rivalScore ? '✅' : g.titansScore < g.rivalScore ? '❌' : '🟡')
          : '';
        const scoreStr = g.rivalScore !== null && g.rivalScore !== undefined
          ? `${g.titansScore} — ${g.rivalScore}` : `${g.titansScore} — ?`;
        return `<details class="game-item">
          <summary>
            <span class="game-result">${result}</span>
            <span class="game-title">Titans vs ${g.rivalName}</span>
            <span class="game-score">${scoreStr}</span>
            <span class="game-date">${g.date}</span>
          </summary>
          <div class="game-detail">
            <table class="h-table">
              <thead><tr><th>Jugador</th><th>MIN</th><th>PTS</th><th>2PT M/A</th><th>3PT M/A</th><th>TL M/A</th><th>FG%</th><th>REB</th><th>AST</th><th>TOV</th><th>FALT</th></tr></thead>
              <tbody>${g.players.map(p => {
                const s = g.stats[p]||{};
                const gpts = (s['2PT_MADE']||0)*2+(s['3PT_MADE']||0)*3+(s['FT_MADE']||0);
                const fgm = (s['2PT_MADE']||0)+(s['3PT_MADE']||0);
                const fga = (s['2PT_ATT']||0)+(s['3PT_ATT']||0);
                return `<tr>
                  <td>${p}</td>
                  <td>${fmtMin(g.minutesPlayed[p]||0)}</td>
                  <td><b>${gpts}</b></td>
                  <td>${s['2PT_MADE']||0}/${s['2PT_ATT']||0}</td>
                  <td>${s['3PT_MADE']||0}/${s['3PT_ATT']||0}</td>
                  <td>${s['FT_MADE']||0}/${s['FT_ATT']||0}</td>
                  <td>${fga>0?Math.round(fgm/fga*100)+'%':'--'}</td>
                  <td>${(s.REB_OFF||0)+(s.REB_DEF||0)}</td>
                  <td>${s.AST||0}</td><td>${s.TOV||0}</td><td>${s.FOUL||0}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </details>`;
      }).join('');

  /* ── Season table HTML ── */
  const seasonHtml = allPlayers
    .filter(p => seasonStats[p].gp > 0)
    .sort((a,b) => seasonStats[b].pts - seasonStats[a].pts)
    .map(p => {
      const ss = seasonStats[p];
      return `<tr>
        <td><b>${p}</b></td>
        <td>${ss.gp}</td>
        <td>${avg(ss.pts, ss.gp)}</td>
        <td>${pct(ss.fg2m+ss.fg3m, ss.fg2a+ss.fg3a)}</td>
        <td>${pct(ss.fg3m, ss.fg3a)}</td>
        <td>${pct(ss.ftm, ss.fta)}</td>
        <td>${avg(ss.reb, ss.gp)}</td>
        <td>${avg(ss.ast, ss.gp)}</td>
        <td>${avg(ss.tov, ss.gp)}</td>
        <td>${avg(ss.foul, ss.gp)}</td>
        <td style="padding:4px 8px">${sparkline(p)}</td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Historial — Titans</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;color:#1a1a2e;font-size:14px}
  .page{max-width:900px;margin:0 auto;background:#fff;padding:32px}
  h1{font-size:1.6rem;font-weight:900;margin-bottom:4px}
  .subtitle{color:#888;font-size:0.85rem;margin-bottom:24px}
  .record{display:flex;gap:16px;margin-bottom:28px}
  .rec-box{text-align:center;padding:12px 20px;border-radius:10px;min-width:70px}
  .rec-box .num{font-size:2rem;font-weight:900;line-height:1}
  .rec-box .lbl{font-size:0.7rem;font-weight:700;letter-spacing:0.1em;margin-top:2px}
  .win{background:#1a5e35;color:#2ecc71}.loss{background:#5c0a0a;color:#e74c3c}.draw{background:#1a3a6e;color:#7ec8e3}
  section{margin-bottom:32px}
  section h2{font-size:0.72rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;
             color:#fff;background:#1a1a2e;padding:6px 12px;border-radius:4px;margin-bottom:12px}
  .game-item{border:1px solid #eee;border-radius:8px;margin-bottom:8px;overflow:hidden}
  .game-item summary{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;
                     list-style:none;background:#fafafa;font-weight:600}
  .game-item summary::-webkit-details-marker{display:none}
  .game-item[open] summary{background:#f0f0f0}
  .game-result{font-size:1rem;flex-shrink:0}
  .game-title{flex:1;font-size:0.95rem}
  .game-score{font-weight:900;font-size:1rem;color:#1a1a2e}
  .game-date{font-size:0.75rem;color:#888;flex-shrink:0}
  .game-detail{padding:12px;overflow-x:auto}
  .h-table{border-collapse:collapse;min-width:100%;font-size:0.78rem;white-space:nowrap}
  .h-table th{background:#1a1a2e;color:#f1c40f;padding:5px 8px;text-align:center;font-weight:700}
  .h-table th:first-child{text-align:left}
  .h-table td{padding:4px 8px;text-align:center;border-bottom:1px solid #eee}
  .h-table td:first-child{text-align:left}
  .h-table tr:nth-child(even) td{background:#f9f9f9}
  .season-table{border-collapse:collapse;min-width:100%;font-size:0.78rem;white-space:nowrap}
  .season-table th{background:#1a1a2e;color:#f1c40f;padding:6px 8px;text-align:center;font-weight:700;position:sticky;top:0}
  .season-table th:first-child{text-align:left}
  .season-table td{padding:5px 8px;text-align:center;border-bottom:1px solid #eee}
  .season-table td:first-child{text-align:left;font-weight:600}
  .season-table tr:nth-child(even) td{background:#f9f9f9}
  .tbl-wrap{overflow-x:auto}
  .print-btn{display:block;margin:0 auto 28px;padding:10px 28px;background:#1a1a2e;color:#fff;
             border:none;border-radius:8px;font-size:0.95rem;font-weight:700;cursor:pointer}
  @media print{.print-btn{display:none}}
</style>
</head><body><div class="page">
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <h1>📚 Historial — Titans</h1>
  <p class="subtitle">Copa Talento Sub-18 · ${history.length} partido${history.length!==1?'s':''} registrado${history.length!==1?'s':''}</p>

  <div class="record">
    <div class="rec-box win"><div class="num">${W}</div><div class="lbl">VICTORIAS</div></div>
    <div class="rec-box loss"><div class="num">${L}</div><div class="lbl">DERROTAS</div></div>
    <div class="rec-box draw"><div class="num">${D}</div><div class="lbl">EMPATES</div></div>
  </div>

  <section>
    <h2>Partidos Jugados</h2>
    ${gamesHtml}
  </section>

  <section>
    <h2>Promedios de Temporada</h2>
    <div class="tbl-wrap">
      <table class="season-table">
        <thead><tr>
          <th>Jugador</th><th>PJ</th><th>PTS/J</th><th>FG%</th><th>3PT%</th><th>FT%</th>
          <th>REB/J</th><th>AST/J</th><th>TOV/J</th><th>FALT/J</th><th>Progresión PTS</th>
        </tr></thead>
        <tbody>${seasonHtml || '<tr><td colspan="11" style="text-align:center;color:#888;padding:12px">Sin datos aún</td></tr>'}</tbody>
      </table>
    </div>
  </section>
</div></body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Permite ventanas emergentes para ver el historial');
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPORTE DE PARTIDO
═══════════════════════════════════════════════════════════════════════════ */
function pct1(v) { return v === null ? '--' : (Math.round(v * 1000)/10) + '%'; }

function reportSummaryText(rivalPts) {
  const teamPts = totalPts();
  const sorted  = [...S.players].filter(p => pts(p) > 0).sort((a,b) => pts(b)-pts(a));
  const mvp     = sorted[0];
  const second  = sorted[1];
  let txt = '';

  if (rivalPts !== null) {
    const diff = teamPts - rivalPts;
    if (diff > 0)      txt += `Los Titans se impusieron por ${teamPts} a ${rivalPts}, logrando una victoria por ${diff} punto${diff!==1?'s':''}. `;
    else if (diff < 0) txt += `Los Titans cayeron por ${rivalPts} a ${teamPts}, una derrota por ${Math.abs(diff)} punto${Math.abs(diff)!==1?'s':''}. `;
    else               txt += `El partido terminó en un empate ${teamPts}-${rivalPts}. `;
  } else {
    txt += `Los Titans anotaron ${teamPts} puntos en total. `;
  }

  if (mvp) {
    txt += `El equipo se apoyó en el rendimiento de ${mvp} (${pts(mvp)} PT`;
    const fg = fgPct(mvp);
    if (fg !== null) txt += `, ${pct1(fg)} FG`;
    txt += `). `;
  }
  if (second) txt += `${second} fue el segundo anotador con ${pts(second)} puntos. `;

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  if (ftA >= 5) {
    const fp = ftM / ftA;
    if (fp < 0.50) txt += `El equipo mostró debilidades en el tiro libre (${pct1(fp)}), un área clave a trabajar. `;
    else if (fp >= 0.75) txt += `El tiro libre fue una fortaleza del equipo (${pct1(fp)}). `;
  }

  const tov = totStat('TOV');
  if (tov > 15)     txt += `Las ${tov} pérdidas de balón fueron un factor negativo a corregir. `;
  else if (tov <= 8) txt += `El equipo manejó bien el balón con solo ${tov} pérdidas. `;

  return txt || 'Partido completado.';
}

function reportRecommendations() {
  const recs = [];

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  if (ftA >= 5 && ftM/ftA < 0.50)
    recs.push(`Práctica de tiros libres: el equipo estuvo al ${pct1(ftM/ftA)} — meta mínima 60%.`);

  const thA = totStat('3PT_ATT'), thM = totStat('3PT_MADE');
  if (thA === 0 || (thA > 0 && thM/thA < 0.25))
    recs.push('Desarrollar el juego perimetral: identificar tiradores de 3 puntos confiables para abrir la cancha.');

  const tov = totStat('TOV');
  if (tov > 15)
    recs.push(`Reducir pérdidas de balón: ${tov} turnovers totales. Trabajar transiciones y toma de decisiones.`);

  const elim = S.players.filter(p => S.fouledOut[p]);
  if (elim.length)
    recs.push(`Disciplina defensiva: ${elim.map(shortName).join(', ')} fue${elim.length>1?'ron':''} eliminado${elim.length>1?'s':''} por 5 faltas.`);

  const nearFO = S.players.filter(p => (S.stats[p].FOUL||0) >= 4 && !S.fouledOut[p]);
  if (nearFO.length)
    recs.push(`Control de faltas: ${nearFO.map(shortName).join(', ')} terminó con 4 faltas — cuidar la defensa individual.`);

  if (!recs.length) recs.push('Buen partido general. Mantener el nivel de ejecución y seguir trabajando la unidad de equipo.');
  return recs;
}

function generateReport() {
  const rivalRaw = prompt('¿Cuántos puntos anotó el rival? (deja vacío si no lo sabes)', '');
  const rivalPts = rivalRaw !== null && rivalRaw.trim() !== '' ? parseInt(rivalRaw.trim(), 10) : null;
  const teamPts  = totalPts();
  const gn       = S.gameName;
  const dateStr  = new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr  = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });

  /* ── Jugadores Destacados ── */
  const sorted  = [...S.players].sort((a,b) => pts(b)-pts(a));
  const topThree = sorted.filter(p => pts(p) > 0).slice(0, 3);

  const playerRowsHtml = S.players.map(p => {
    const s   = S.stats[p];
    const min = S.minutesPlayed[p] || 0;
    const noPlay = min === 0 && pts(p) === 0;
    let nota = '';
    if (noPlay)              nota = 'No jugó';
    else if (S.fouledOut[p]) nota = '⚠️ Eliminado (5F)';
    else if ((s.FOUL||0) >= 4) nota = '⚠️ 4 faltas';
    else if (p === topThree[0] && pts(p) > 0) nota = '⭐ MVP';

    const rowStyle = S.fouledOut[p] ? ' style="color:#c0392b"' : (noPlay ? ' style="color:#888"' : '');
    return `<tr${rowStyle}>
      <td>${p}${S.fouledOut[p] ? '*' : ''}</td>
      <td>${fmtMin(min)}</td>
      <td><strong>${pts(p)}</strong></td>
      <td>${s['2PT_MADE']||0}/${s['2PT_ATT']||0}</td>
      <td>${s['3PT_MADE']||0}/${s['3PT_ATT']||0}</td>
      <td>${s['FT_MADE']||0}/${s['FT_ATT']||0}</td>
      <td>${pct1(fgPct(p))}</td>
      <td>${pct1(ftPct(p))}</td>
      <td style="${(s.TOV||0)>=5?'color:#c0392b;font-weight:700':''}">${s.TOV||0}</td>
      <td>${(s.REB_OFF||0)+(s.REB_DEF||0)}</td>
      <td>${s.AST||0}</td>
      <td style="${(s.FOUL||0)>=4?'color:#c0392b;font-weight:700':''}">${s.FOUL||0}</td>
      <td style="font-size:0.8em;color:#555">${nota}</td>
    </tr>`;
  }).join('');

  const topPlayersHtml = topThree.map((p, i) => {
    const s      = S.stats[p];
    const label  = i === 0 ? '⭐ MVP del partido' : `${i+1}° Anotador`;
    const fg     = fgPct(p), ftp = ftPct(p), th3 = threePct(p);
    const bullets = [
      `${pts(p)} puntos anotados`,
      `${fmtMin(S.minutesPlayed[p]||0)} en cancha`,
      fg  !== null ? `${pct1(fg)} en tiros de campo` : null,
      th3 !== null && (s['3PT_ATT']||0) > 0 ? `${pct1(th3)} en triples` : null,
      ftp !== null && (s['FT_ATT']||0) > 0  ? `${pct1(ftp)} en tiros libres` : null,
      `${s.TOV||0} pérdidas`,
      `${s.FOUL||0} falta${(s.FOUL||0)!==1?'s':''}`,
    ].filter(Boolean);
    return `<div class="top-player">
      <div class="top-player-name">${i+1}. ${p} — <em>${label}</em></div>
      <ul>${bullets.map(b=>`<li>${b}</li>`).join('')}</ul>
    </div>`;
  }).join('') || '<p>Sin datos de anotación registrados.</p>';

  const recsHtml = reportRecommendations().map(r => `<li>${r}</li>`).join('');

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  const thA = totStat('3PT_ATT'), thM = totStat('3PT_MADE');
  const teamFgM = totStat('2PT_MADE')+totStat('3PT_MADE');
  const teamFgA = totStat('2PT_ATT')+totStat('3PT_ATT');
  const hasFO = S.players.some(p => S.fouledOut[p]);

  const scoreBlock = rivalPts !== null
    ? `<div class="score-block">
        <div class="score-team"><div class="score-name">TITANS</div><div class="score-pts">${teamPts}</div></div>
        <div class="score-vs">VS</div>
        <div class="score-team"><div class="score-name">RIVAL</div><div class="score-pts">${rivalPts}</div></div>
       </div>`
    : `<div class="score-block">
        <div class="score-team"><div class="score-name">TITANS</div><div class="score-pts">${teamPts}</div></div>
       </div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte — ${gn}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; color: #1a1a2e; font-size: 14px; }
  .page { max-width: 820px; margin: 0 auto; background: #fff; padding: 40px; }
  /* Header */
  .report-header { text-align: center; border-bottom: 3px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 24px; }
  .report-header .emoji { font-size: 2.5rem; }
  .report-header h1 { font-size: 1.1rem; letter-spacing: 0.15em; color: #555; margin: 4px 0; }
  .report-header h2 { font-size: 1.8rem; font-weight: 900; color: #1a1a2e; margin: 6px 0; }
  .report-header .meta { font-size: 0.8rem; color: #888; margin-top: 6px; }
  /* Score */
  .score-block { display: flex; justify-content: center; align-items: center; gap: 30px; margin: 16px 0; }
  .score-team { text-align: center; }
  .score-name { font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em; color: #555; }
  .score-pts { font-size: 3.5rem; font-weight: 900; color: #1a1a2e; line-height: 1; }
  .score-vs { font-size: 1.2rem; font-weight: 700; color: #888; }
  /* Sections */
  section { margin-bottom: 28px; }
  section h3 { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
               color: #fff; background: #1a1a2e; padding: 6px 12px; border-radius: 4px; margin-bottom: 12px; }
  section p { line-height: 1.65; color: #333; }
  /* Team stats table */
  .team-table { width: 100%; border-collapse: collapse; }
  .team-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  .team-table td:first-child { color: #555; width: 55%; }
  .team-table td:last-child { font-weight: 700; font-size: 1.05rem; }
  .team-table tr:last-child td { border-bottom: none; }
  /* Player stats table */
  .stats-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .stats-table th { background: #1a1a2e; color: #f1c40f; font-weight: 700; padding: 6px 8px;
                    text-align: center; white-space: nowrap; }
  .stats-table th:first-child { text-align: left; }
  .stats-table td { padding: 5px 8px; text-align: center; border-bottom: 1px solid #eee; }
  .stats-table td:first-child { text-align: left; font-weight: 600; }
  .stats-table tr:nth-child(even) td { background: #f9f9f9; }
  .stats-table .total-row td { background: #f0f0f0; font-weight: 700; border-top: 2px solid #1a1a2e; }
  .foul-note { font-size: 0.75rem; color: #c0392b; margin-top: 6px; }
  /* Top players */
  .top-player { margin-bottom: 14px; }
  .top-player-name { font-weight: 700; font-size: 1rem; margin-bottom: 4px; }
  .top-player ul { padding-left: 20px; }
  .top-player li { line-height: 1.7; color: #444; }
  /* Recs */
  .rec-list { padding-left: 20px; }
  .rec-list li { line-height: 1.8; color: #333; }
  /* Print button */
  .print-btn { display: block; margin: 0 auto 32px; padding: 12px 32px;
               background: #1a1a2e; color: #fff; border: none; border-radius: 8px;
               font-size: 1rem; font-weight: 700; cursor: pointer; letter-spacing: 0.05em; }
  .print-btn:hover { background: #0f3460; }
  @media print {
    .print-btn { display: none; }
    body { background: #fff; }
    .page { padding: 20px; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="page">
  <button class="print-btn" onclick="window.print()">🖨️ Guardar como PDF / Imprimir</button>

  <div class="report-header">
    <div class="emoji">🏀</div>
    <h1>REPORTE DE PARTIDO</h1>
    <h2>${gn}</h2>
    ${scoreBlock}
    <div class="meta">${dateStr} · ${timeStr} · Copa Talento Sub-18</div>
  </div>

  <section>
    <h3>Resumen Ejecutivo</h3>
    <p>${reportSummaryText(rivalPts)}</p>
  </section>

  <section>
    <h3>Estadísticas Generales del Equipo</h3>
    <table class="team-table">
      <tr><td>Puntos totales</td><td>${teamPts}</td></tr>
      <tr><td>FG% (tiros de campo)</td><td>${teamFgA>0 ? pct1(teamFgM/teamFgA) : '--'}</td></tr>
      <tr><td>3PT% (triples)</td><td>${thA>0 ? pct1(thM/thA) : '--'} (${thM}/${thA})</td></tr>
      <tr><td>FT% (tiros libres)</td><td>${ftA>0 ? pct1(ftM/ftA) : '--'} (${ftM}/${ftA}) ${ftA>=5&&ftM/ftA<0.5?'⚠️':''}</td></tr>
      <tr><td>Rebotes totales</td><td>${totStat('REB_OFF')+totStat('REB_DEF')} (Of: ${totStat('REB_OFF')} / Def: ${totStat('REB_DEF')})</td></tr>
      <tr><td>Asistencias totales</td><td>${totStat('AST')}</td></tr>
      <tr><td>Pérdidas de balón</td><td>${totStat('TOV')} ${totStat('TOV')>15?'⚠️':''}</td></tr>
      <tr><td>Robos / Bloqueos</td><td>${totStat('STL')} / ${totStat('BLK')}</td></tr>
      <tr><td>Faltas totales</td><td>${totStat('FOUL')}</td></tr>
      ${rivalPts!==null?`<tr><td>Diferencia final</td><td>${teamPts-rivalPts>0?'+':''}${teamPts-rivalPts} ${teamPts>rivalPts?'✅':'❌'}</td></tr>`:''}
    </table>
  </section>

  <section>
    <h3>Estadísticas Individuales</h3>
    <table class="stats-table">
      <thead><tr>
        <th>Jugador</th><th>MIN</th><th>PT</th>
        <th>2PT M/A</th><th>3PT M/A</th><th>TL M/A</th>
        <th>FG%</th><th>FT%</th>
        <th>TO</th><th>REB</th><th>AST</th><th>FALT</th><th>Notas</th>
      </tr></thead>
      <tbody>${playerRowsHtml}</tbody>
      <tfoot>
        <tr class="total-row">
          <td>TOTAL</td>
          <td>${fmtMin(totalMins())}</td>
          <td>${teamPts}</td>
          <td>${totStat('2PT_MADE')}/${totStat('2PT_ATT')}</td>
          <td>${totStat('3PT_MADE')}/${totStat('3PT_ATT')}</td>
          <td>${totStat('FT_MADE')}/${totStat('FT_ATT')}</td>
          <td>${teamFgA>0?pct1(teamFgM/teamFgA):'--'}</td>
          <td>${ftA>0?pct1(ftM/ftA):'--'}</td>
          <td>${totStat('TOV')}</td>
          <td>${totStat('REB_OFF')+totStat('REB_DEF')}</td>
          <td>${totStat('AST')}</td>
          <td>${totStat('FOUL')}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    ${hasFO ? '<p class="foul-note">* Eliminado por 5 faltas</p>' : ''}
  </section>

  <section>
    <h3>Jugadores Destacados</h3>
    ${topPlayersHtml}
  </section>

  <section>
    <h3>Recomendaciones para el Próximo Partido</h3>
    <ul class="rec-list">${recsHtml}</ul>
  </section>
</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Permite ventanas emergentes para ver el reporte');
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI UTILS
═══════════════════════════════════════════════════════════════════════════ */
let _toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function haptic() { navigator.vibrate?.(12); }

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════════════════ */
function bindEvents() {
  document.getElementById('gameName')?.addEventListener('change', e => {
    S.gameName = e.target.value; scheduleSave();
  });

  document.getElementById('btnToggleClock')?.addEventListener('click', toggleClock);
  document.getElementById('btnResetClock') ?.addEventListener('click', resetClock);

  document.getElementById('quarterSelector')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    S.quarter = b.dataset.q;
    document.querySelectorAll('.qtr-sel button').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.q === S.quarter)
    );
    document.getElementById('clockQuarter').textContent = S.quarter;
    scheduleSave();
  });

  document.getElementById('playerList')?.addEventListener('click', e => {
    const pb = e.target.closest('.player-btn');
    if (pb) { selectPlayer(pb.dataset.player); return; }
    const cb = e.target.closest('.court-btn');
    if (cb) toggleCourt(cb.dataset.court);
  });

  document.getElementById('statGrid')?.addEventListener('click', e => {
    const b = e.target.closest('.stat-btn');
    if (b) logStat(b.dataset.stat);
  });

  document.getElementById('btnUndo')    ?.addEventListener('click', undoLast);
  document.getElementById('btnSave')    ?.addEventListener('click', manualSave);
  document.getElementById('btnLoad')    ?.addEventListener('click', manualLoad);
  document.getElementById('btnReport')    ?.addEventListener('click', generateReport);
  document.getElementById('btnNewGame')   ?.addEventListener('click', newGame);
  document.getElementById('btnHistorial') ?.addEventListener('click', openHistorial);
  document.getElementById('btnAdd')     ?.addEventListener('click', addPlayer);
  document.getElementById('btnRemove')  ?.addEventListener('click', removePlayer);

  document.getElementById('btnTable')?.addEventListener('click', () => {
    const sec = document.getElementById('tableSection');
    if (!sec) return;
    sec.classList.toggle('hidden');
    if (!sec.classList.contains('hidden')) renderTable();
  });
  document.getElementById('btnCloseTable')?.addEventListener('click', () =>
    document.getElementById('tableSection')?.classList.add('hidden')
  );

  document.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE WORKER
═══════════════════════════════════════════════════════════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW registrado'))
      .catch(e => console.warn('SW error:', e));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadSaved();
  renderAll();
  bindEvents();
  startInterval();
  registerSW();
});
