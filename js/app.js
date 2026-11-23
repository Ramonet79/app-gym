import { EXERCISES, GROUPS, ALTERNATIVES, SLOT_OF, optionsFor } from './exercises.js';
import { artSVG, animate, stopAnim } from './art.js';
import * as P from './program.js';
import * as C from './coach.js';
import { S, save, uid, enqueue, initCloud, cloud, onCloud, user, sync, signIn, signUp, signOut, resetPassword, updatePassword, hasCloud } from './store.js';

const app = document.getElementById('app');
const ui = { tab: 'hoy', sheet: null, ex: null, inSession: !!S.active, summary: null, chartEx: 'press_pecho', toast: null, busy: false };
S.dayType = S.dayType || {};

// ───────── utilidades ─────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const dfLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dfShort = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDate = iso => cap(dfShort.format(P.parseISO(iso)));
const sessionsOn = d => Object.values(S.sessions).filter(s => s.date === d && s.status === 'done');
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  bike: '<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-8h5l3 8M10 9l-1.5-3H6M15 9l-2 8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  warn: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};

function toast(msg, kind = '') {
  ui.toast = { msg, kind, id: Date.now() };
  const id = ui.toast.id;
  render();
  setTimeout(() => { if (ui.toast?.id === id) { ui.toast = null; render(); } }, 2600);
}

// ───────── audio, voz, pantalla encendida ─────────
let ac = null;
function unlockAudio() {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { /* sin audio */ }
  try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); } } catch (e) { /* sin voz */ }
}
function beep(freq = 880, dur = 0.15, vol = 0.35) {
  if (!S.prefs.sound || !ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
  } catch (e) { /* sin audio */ }
}
function say(text) {
  if (!S.prefs.voice || !text || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { /* sin voz */ }
}
let wakeLock = null;
async function acquireWake() { try { if (navigator.wakeLock && S.active) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* no soportado */ } }
function releaseWake() { try { wakeLock?.release(); } catch (e) { /* nada */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.active && ui.inSession) acquireWake(); });

// ───────── lógica de día ─────────
// Sin calendario fijo: cada mañana eliges y el entrenador (coach.js) recomienda y ajusta según el histórico.
function todayInfo() {
  const now = new Date(), d = P.todayISO();
  const plan = C.planToday({ sessions: S.sessions, profile: S.profile, prefs: S.prefs, today: d });
  return { d, now, plan, phase: plan.phase, tpl: plan.tpl, choice: S.dayType[d] || null, done: sessionsOn(d) };
}
const REC_LABEL = { fuerza: 'Fuerza', spinning: 'Spinning', movilidad: 'Movilidad y core', descanso: 'Descanso' };
function nextPlanned() {
  const gd = C.gymDaysOf(S.prefs);
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    if (!gd.includes(d.getDay())) continue;
    const p = C.planToday({ sessions: S.sessions, profile: S.profile, prefs: S.prefs, today: P.iso(d) });
    return { date: d, type: p.rec, tpl: p.tpl };
  }
  return null;
}
const plannedLabel = nx => nx.type === 'fuerza' ? P.TEMPLATES[nx.tpl].name : REC_LABEL[nx.type];

// ───────── render ─────────
function render() {
  stopAnim();
  let html;
  if (cloud.recovery) html = viewRecovery();
  else if (!S.profile) html = viewOnboarding();
  else if (ui.summary) html = viewSummary();
  else if (S.active && ui.inSession) html = viewRunner();
  else if (ui.ex) html = viewExercise(ui.ex);
  else html = shell();
  app.innerHTML = html + (ui.sheet ? viewSheet() : '') + (ui.toast ? `<div class="toast ${ui.toast.kind}" role="status">${ui.toast.msg}</div>` : '');
  const a = app.querySelector('[data-anim]');
  if (a && !ui.sheet) animate(a.querySelector('svg'), EXERCISES[a.dataset.anim].art);
  document.body.classList.toggle('lock', !!ui.sheet);
}

function syncPill() {
  if (!hasCloud()) return '';
  const st = !user ? 'local' : cloud.status;
  const label = { local: 'Solo en el móvil', syncing: 'Sincronizando…', ok: 'Guardado en la nube', pending: 'Pendiente de subir', offline: 'Sin conexión', error: 'Error al sincronizar' }[st] || '';
  return `<button class="pill sync-${st}" data-a="${user ? 'syncNow' : 'goProfile'}">${icon('cloud')}<span>${label}</span></button>`;
}

function shell() {
  const tabs = [['hoy', 'Hoy', 'home'], ['hist', 'Progreso', 'chart'], ['lib', 'Ejercicios', 'dumbbell'], ['perfil', 'Perfil', 'user']];
  const body = ui.tab === 'hist' ? viewHistory() : ui.tab === 'lib' ? viewLibrary() : ui.tab === 'perfil' ? viewProfile() : viewToday();
  return `<main class="page">${body}</main>
  <nav class="tabbar">${tabs.map(([k, l, i]) => `<button class="${ui.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}">${icon(i)}<span>${l}</span></button>`).join('')}</nav>`;
}

// ───────── HOY ─────────
function viewToday() {
  const T = todayInfo();
  const hour = T.now.getHours();
  const hello = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const proj = C.projectWeek({ sessions: S.sessions, profile: S.profile, prefs: S.prefs, today: T.d, todayChoice: T.choice });
  const strip = P.weekDates().map(d => {
    const iso = P.iso(d), done = sessionsOn(iso).filter(s => s.type !== 'core');
    const isToday = iso === T.d, past = iso < T.d;
    let t, ok = false;
    if (done.length) { ok = true; t = done.some(s => s.type === 'fuerza') ? 'fuerza' : done.some(s => s.type === 'spinning') ? 'spinning' : 'movilidad'; }
    else t = past ? 'none' : proj[iso] || 'descanso';
    const lbl = { fuerza: 'F', spinning: 'S', movilidad: 'M' }[t] || '·';
    return `<div class="day ${isToday ? 'today' : ''} ${ok ? 'ok' : ''} ${!ok && !past ? 'plan' : ''} t-${t}"><span>${P.DAY_SHORT[d.getDay()]}</span><b>${ok ? icon('check') : lbl}</b></div>`;
  }).join('');
  const W = T.plan.week, TG = T.plan.targets;
  return `
  <header class="top">
    <div><p class="muted">${cap(dfLong.format(T.now))}</p><h1>${hello}, ${esc(S.profile.name || '')}</h1></div>
    ${syncPill()}
  </header>
  <section class="phase-card">
    <div class="phase-row"><span class="chip ph-${T.phase.key}">Semana ${T.phase.week} · ${T.phase.name}</span><span class="muted small">Fuerza <b class="${W.fuerza >= TG.fuerza ? 'met' : ''}">${W.fuerza}/${TG.fuerza}</b> · Spinning <b class="${W.spinning >= TG.spinning ? 'met' : ''}">${W.spinning}/${TG.spinning}</b></span></div>
    <div class="strip">${strip}</div>
    <p class="strip-legend">${icon('check')} hecho · letra tenue = previsión si sigues mis recomendaciones</p>
  </section>
  ${S.active ? resumeCard() : todayCard(T)}
  ${notesCards()}
  ${lastWins()}
  `;
}

function resumeCard() {
  const A = S.active;
  const done = A.items.filter(i => i.status !== 'todo').length;
  return `<section class="hero t-fuerza">
    <p class="eyebrow">Sesión en curso</p>
    <h2>${P.TEMPLATES[A.template]?.name || 'Sesión'}</h2>
    <p class="muted">${done} de ${A.items.length} ejercicios hechos</p>
    <button class="btn primary xl" data-a="resume">${icon('play')} Continuar</button>
  </section>`;
}

function todayCard(T) {
  const doneToday = T.done;
  if (doneToday.length && !ui.another) {
    const s = doneToday.at(-1);
    const nx = nextPlanned();
    return `<section class="hero done">
      <p class="eyebrow">${icon('check')} Hecho hoy</p>
      <h2>${s.type === 'spinning' ? 'Spinning' : P.TEMPLATES[s.template]?.name || cap(s.type)}</h2>
      <p class="muted">${s.durationMin ? Math.round(s.durationMin) + ' min' : ''}${s.painAfter != null ? ` · Espalda al terminar: ${s.painAfter}/10` : ''}</p>
      ${s.type === 'spinning' && !doneToday.some(x => x.type === 'core') ? `<button class="btn core" data-a="startCore">${icon('spark')} Core exprés (6 min)</button>` : ''}
      ${nx ? `<p class="next-line">Próximo día de gimnasio (${P.DAY_NAMES[nx.date.getDay()].toLowerCase()}): <b>${plannedLabel(nx)}</b></p>` : ''}
      <button class="btn ghost" data-a="another">Hacer otra cosa hoy</button>
    </section>`;
  }
  const c = T.choice;
  if (!c) return choiceCard(T);
  if (c === 'fuerza' || c === 'movilidad') return strengthCard(T, c);
  if (c === 'spinning') return spinCard(T);
  return `<section class="hero t-rest">
    <p class="eyebrow">${icon('moon')} Descanso</p>
    <h2>Hoy toca recuperar</h2>
    <ul class="tips"><li>Camina 20-30 minutos: el disco se nutre con movimiento suave</li><li>No estés más de 45 min seguidos sentado: levántate y muévete</li><li>Si te apetece: bird-dog y curl-up en casa (5 min)</li></ul>
    <button class="btn ghost" data-a="choose" data-v="">Cambiar: sí voy al gimnasio</button>
  </section>`;
}

function choiceCard(T) {
  const p = T.plan;
  const sp = sessionPlan(T, 'fuerza');
  const opts = [
    { v: 'fuerza', ic: 'dumbbell', title: P.TEMPLATES[p.tpl].name, sub: P.TEMPLATES[p.tpl].subtitle, meta: `${Math.round(sp.est / 60)} min`, tag: p.adj.tag },
    { v: 'spinning', ic: 'bike', title: 'Spinning', sub: p.spin.title, meta: '45 min', tag: null },
  ];
  const recTxt = { fuerza: 'fuerza', spinning: 'spinning', movilidad: 'movilidad y core', descanso: 'descansar' }[p.rec];
  return `<section class="choose">
    <p class="eyebrow">${icon('spark')} ¿Qué haces hoy?</p>
    <h2>Te recomiendo <span class="hl">${recTxt}</span></h2>
    <ul class="reasons">${p.why.map(w => `<li>${w}</li>`).join('')}</ul>
    <div class="choices">${opts.map(o => `<button class="choice c-${o.v} ${p.rec === o.v ? 'rec' : ''}" data-a="choose" data-v="${o.v}">
      ${p.rec === o.v ? '<span class="badge">Recomendado</span>' : ''}
      ${icon(o.ic)}<b>${o.title}</b><small>${o.sub}</small><span class="meta">${o.meta}${o.tag ? ` · <em>${o.tag}</em>` : ''}</span>
    </button>`).join('')}</div>
    <div class="choice-alt">
      <button class="btn sm ${p.rec === 'movilidad' ? 'rec' : ''}" data-a="choose" data-v="movilidad">${icon('spark')} Movilidad</button>
      <button class="btn sm ${p.rec === 'descanso' ? 'rec' : ''}" data-a="choose" data-v="descanso">${icon('moon')} Descanso</button>
    </div>
  </section>`;
}

function sessionPlan(T, kind) {
  const tpl = kind === 'movilidad' ? 'M' : T.tpl;
  const plan = P.buildSession(tpl, { phase: T.phase, settings: S.settings, mode: 'normal', adj: kind === 'fuerza' ? T.plan.adj : null });
  return { tpl, plan, est: P.estimateTotal(plan.items) };
}

function strengthCard(T, kind) {
  const { tpl, plan, est } = sessionPlan(T, kind);
  const t = P.TEMPLATES[tpl];
  const blocks = t.blocks.map(b => {
    const its = plan.items.filter(i => i.g === b.g);
    return { g: b.g, sec: its.reduce((a, i) => a + P.estimateItem(i), 0) };
  }).filter(b => b.sec > 0);
  const notes = [];
  if (kind === 'fuerza') {
    if (T.plan.adj.note) notes.push(T.plan.adj.note);
    if (T.phase.key !== 'build') notes.push(`<b>${T.phase.name}.</b> ${T.phase.info}`);
    if (T.phase.block > 0 && T.phase.week === 3 + 6 * T.phase.block) notes.push(`<b>Bloque nuevo.</b> ${T.phase.block % 2 === 0 ? 'Cambian los ejercicios principales y los accesorios' : 'Cambian los accesorios'} para seguir progresando. Los primeros días, pesos prudentes hasta calibrar.`);
  } else notes.push('Movilidad, core McGill y glúteo, sin carga para la columna. Para días con la espalda cargada o cuando no toca fuerza.');
  return `<section class="hero t-fuerza ${kind === 'movilidad' ? 't-mob' : ''}">
    <p class="eyebrow">Hoy · ${kind === 'movilidad' ? 'Movilidad' : 'Fuerza'}${kind === 'fuerza' && T.plan.adj.tag ? ` · <span class="tag">${T.plan.adj.tag}</span>` : ''}</p>
    <h2>${t.name}</h2>
    <p class="muted">${t.subtitle}</p>
    ${notes.length ? `<div class="adj">${notes.map(n => `<p>${n}</p>`).join('')}</div>` : ''}
    <div class="timeline">${blocks.map(b => `<i style="flex:${b.sec};--c:${GROUPS[b.g].color}"></i>`).join('')}</div>
    <div class="tl-legend">${blocks.map(b => `<span style="--c:${GROUPS[b.g].color}"><i></i>${GROUPS[b.g].short} ${Math.round(b.sec / 60)}'</span>`).join('')}</div>
    <button class="btn primary xl" data-a="sheet" data-s="pain">${icon('play')} Empezar · ${Math.round(est / 60)} min</button>
    <details class="preview"><summary>Ver los ${plan.items.length} ejercicios</summary>
      <ol>${plan.items.map(i => `<li style="--c:${GROUPS[i.g].color}"><b>${EXERCISES[i.id].name}</b><span>${setsSummary(i)}</span></li>`).join('')}</ol>
    </details>
    <button class="btn ghost" data-a="choose" data-v="">Cambiar: elegir otra cosa</button>
  </section>`;
}

function spinCard(T) {
  const sp = T.plan.spin;
  return `<section class="hero t-spin">
    <p class="eyebrow">Hoy · Spinning 45 min</p>
    <h2>${sp.title}</h2>
    <p class="muted">${sp.why}</p>
    <div class="zone"><div><b>${sp.zone}</b><small>pulsaciones (FC máx ≈ ${sp.fcmax})</small></div><div><b>${sp.rpe}</b><small>esfuerzo percibido</small></div></div>
    <div class="art-wrap small" data-anim="spinning">${artSVG(EXERCISES.spinning.art)}</div>
    <ul class="tips">${sp.tips.concat(EXERCISES.spinning.setup.slice(0, 2)).map(t => `<li>${t}</li>`).join('')}</ul>
    <button class="btn primary xl" data-a="spinSheet">${icon('check')} He hecho spinning</button>
    <p class="muted small center">Después: core exprés de 6 minutos. El multífido mejora con estímulo casi diario.</p>
    <button class="btn ghost" data-a="choose" data-v="">Cambiar: elegir otra cosa</button>
  </section>`;
}

function setsSummary(it) {
  const ex = EXERCISES[it.id];
  const work = it.sets.filter(s => !s.warmup);
  if (ex.kind === 'time') return `${ex.minutes} min`;
  const s = work[0];
  const t = P.targetText(it.id, s);
  return `${work.length} × ${t}${s.kg != null && !ex.bodyweight ? ' · ' + P.fmtKg(s.kg) + ' ' + P.kgUnit(ex) : ''}`;
}

function notesCards() {
  const notes = S.notes.filter(n => n.active && !n.readAt);
  const intro = !Object.keys(S.sessions).length ? [{ id: 'intro', kind: 'plan', title: 'Cómo funciona tu plan', body: 'Cada mañana eliges fuerza o spinning y te digo qué conviene más según lo que llevas de semana. Objetivo: 3 de fuerza (rutinas A, B y C en rotación, nunca dos días seguidos) y 2 de spinning. Si llevas días sin venir, la sesión vuelve con menos peso para que te reenganches sin riesgo. Cada sesión de fuerza empieza con core para el multífido y la zona lumbar, y sigue con tren superior en máquinas con la espalda apoyada. Antes de empezar te pregunto cómo está tu espalda y adapto la sesión.' }] : [];
  return [...intro, ...notes].map(n => `<section class="card note k-${n.kind}">
    <p class="eyebrow">${n.kind === 'warning' ? icon('warn') : icon('spark')} ${n.id === 'intro' ? 'Bienvenido' : 'Nota de tu entrenador'}</p>
    <h3>${esc(n.title)}</h3><p>${esc(n.body || '').replace(/\n/g, '<br>')}</p>
    ${n.id !== 'intro' ? `<button class="btn ghost sm" data-a="readNote" data-id="${n.id}">Entendido</button>` : ''}
  </section>`).join('');
}

function lastWins() {
  const last = Object.values(S.sessions).filter(s => s.status === 'done' && s.summary?.results).sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''))[0];
  if (!last) return '';
  const ups = Object.entries(last.summary.results).filter(([, r]) => r.dir === 'up');
  if (!ups.length) return '';
  return `<section class="card wins"><p class="eyebrow">${icon('up')} Lo que sube la próxima vez</p>
    ${ups.map(([id, r]) => `<div class="win"><b>${EXERCISES[id]?.name || id}</b><span>${esc(r.msg)}</span></div>`).join('')}</section>`;
}

// ───────── SESIÓN (pantalla de gimnasio) ─────────
function curSetIdx(it) { return it.sets.findIndex(s => !s.done); }

function viewRunner() {
  const A = S.active;
  const it = A.items[A.idx];
  const ex = EXERCISES[it.id];
  const g = GROUPS[it.g];
  const st = P.getSetting(S.settings, it.id);
  const blockItems = A.items.filter(i => i.g === it.g);
  const segs = A.items.map((i, k) => `<i class="seg s-${i.status} ${k === A.idx ? 'cur' : ''}" style="--c:${GROUPS[i.g].color}"></i>`).join('');
  const k = curSetIdx(it);
  const proj = projection();
  const guided = A.guided && A.guided.item === A.idx;
  return `<div class="runner g-${it.g}" style="--gc:${g.color}">
    <header class="r-top">
      <button class="icon-btn" data-a="sheet" data-s="exit" aria-label="Salir">${icon('x')}</button>
      <div class="r-clock"><b data-clock>${P.fmtClock((Date.now() - Date.parse(A.startedAt)) / 1000)}</b><span>de 45:00</span></div>
      <button class="icon-btn" data-a="sheet" data-s="map" aria-label="Lista">${icon('list')}</button>
    </header>
    <div class="segs">${segs}</div>
    ${A.mode !== 'normal' ? `<div class="mode-banner">${icon('warn')} ${A.mode === 'suave' ? 'Sesión suave: menos peso y series' : 'Día de protección: solo movilidad y core suave'}</div>` : ''}
    ${proj.over > 60 && !A.expressDone ? `<button class="mode-banner warn" data-a="express">${icon('clock')} Vas a acabar en ${Math.round(proj.total / 60)}'. Toca para ajustar a 45'</button>` : ''}
    <div class="r-body">
      <div class="r-head">
        <span class="block-chip">${g.name} · ${blockItems.indexOf(it) + 1}/${blockItems.length}</span>
        ${ex.levels ? `<span class="lvl">Nivel ${st.level + 1}: ${ex.levels[st.level].name}</span>` : ''}
      </div>
      <div class="art-wrap" data-anim="${it.id}">${artSVG(ex.art, 0, 'big')}</div>
      <h1 class="ex-name">${ex.name}</h1>
      <p class="where">${icon('pin')} ${ex.machine}</p>
      <button class="mynote ${st.note ? '' : 'empty'}" data-a="sheet" data-s="note" data-id="${it.id}">${icon('gear')} ${st.note ? 'Mi ajuste: ' + esc(st.note) : 'Apunta tu ajuste (asiento, altura, agarre…)'}</button>
      ${guided ? guidedPanel(it) : setsPanel(it, ex, k)}
      <details class="tech" ${A.techOpen ? 'open' : ''}><summary data-a="techToggle">Técnica y seguridad</summary>
        <div class="tech-body">
          <h4>Colócate</h4><ul>${ex.setup.map(x => `<li>${x}</li>`).join('')}</ul>
          <h4>Mientras lo haces</h4><ul class="ok">${ex.cues.map(x => `<li>${x}</li>`).join('')}</ul>
          <h4>Evita (protege tu zona lumbar)</h4><ul class="no">${ex.avoid.map(x => `<li>${x}</li>`).join('')}</ul>
          <p class="why">${ex.why}</p>
        </div>
      </details>
      <div class="r-actions">
        <button class="btn ghost" data-a="sheet" data-s="swap">Ocupada / cambiar</button>
        <button class="btn ghost" data-a="skipEx">Saltar</button>
      </div>
    </div>
    ${A.rest ? restPanel(it) : ''}
  </div>`;
}

function setsPanel(it, ex, k) {
  const timed = ['hold', 'holdreps', 'time', 'carry'].includes(ex.kind);
  const rows = it.sets.map((s, i) => {
    const cur = i === k;
    const label = s.warmup ? 'Aprox.' : ex.kind === 'time' ? 'Tiempo' : `Serie ${it.sets.filter((x, j) => !x.warmup && j <= i).length}`;
    let mid = '';
    if (ex.kind === 'reps') {
      mid = `${ex.bodyweight ? '' : stepper('kg', i, P.fmtKg(s.kg), P.kgUnit(ex), s.done)}${stepper('reps', i, s.reps, ex.perSide ? 'por lado' : 'reps', s.done)}`;
    } else if (ex.kind === 'carry') {
      mid = `${stepper('kg', i, P.fmtKg(s.kg), 'kg', s.done)}<div class="tgt">${s.hold} s/mano</div>`;
    } else {
      mid = `<div class="tgt">${P.targetText(it.id, s)}</div>`;
    }
    const btn = timed && !s.done
      ? `<button class="check play ${cur ? 'cur' : ''}" data-a="startGuided" data-i="${i}" aria-label="Empezar">${icon('play')}</button>`
      : `<button class="check ${s.done ? 'on' : ''}" data-a="toggleSet" data-i="${i}" aria-label="Marcar serie">${icon('check')}</button>`;
    return `<div class="set ${s.done ? 'done' : ''} ${cur ? 'cur' : ''} ${s.warmup ? 'wu' : ''}"><span class="n">${label}</span>${mid}${btn}</div>`;
  }).join('');
  const hint = k >= 0 && it.sets[k].warmup ? '<p class="hint">Serie de aproximación: 50 % del peso, para calentar la articulación.</p>' : '';
  const restTxt = it.rest ? `<span>Descanso ${it.rest} s</span>` : '';
  return `<div class="target"><b>${setsSummary(it)}</b>${restTxt}</div>${hint}<div class="sets">${rows}</div>`;
}

function stepper(field, i, val, unit, disabled) {
  return `<div class="stepper ${disabled ? 'dis' : ''}">
    <button data-a="step" data-f="${field}" data-i="${i}" data-d="-1" ${disabled ? 'disabled' : ''} aria-label="menos">−</button>
    <b>${val ?? '–'}<small>${unit}</small></b>
    <button data-a="step" data-f="${field}" data-i="${i}" data-d="1" ${disabled ? 'disabled' : ''} aria-label="más">+</button>
  </div>`;
}

function guidedPanel(it) {
  const G = S.active.guided;
  const step = G.steps[G.i];
  const rem = G.paused ? G.pausedRem : Math.max(0, (G.stepEnd - Date.now()) / 1000);
  const next = G.steps[G.i + 1];
  return `<div class="guided ${step.work ? 'work' : 'rest'}">
    <div class="ring" style="--p:${1 - rem / step.secs}"><div><b data-g-secs>${Math.ceil(rem)}</b><span>${step.label}</span></div></div>
    <p class="g-sub">${step.sub || ''}</p>
    <p class="muted small">${next ? 'Después: ' + next.label : 'Último tramo'}</p>
    <div class="row2">
      <button class="btn ghost" data-a="gPause">${G.paused ? icon('play') + ' Seguir' : icon('pause') + ' Pausa'}</button>
      <button class="btn" data-a="gStop">Terminar serie</button>
    </div>
  </div>`;
}

function restPanel(it) {
  const R = S.active.rest;
  const rem = Math.max(0, (R.endAt - Date.now()) / 1000);
  const k = curSetIdx(it);
  const nxt = k >= 0 ? it.sets[k] : null;
  const ex = EXERCISES[it.id];
  const enter = !R.seen; R.seen = true;
  return `<div class="rest-panel ${enter ? 'enter' : ''}">
    <div class="ring rest" style="--p:${1 - rem / R.total}"><div><b data-rest>${P.fmtClock(rem)}</b><span>Descansa</span></div></div>
    <div class="rest-info">
      <p class="muted small">Siguiente</p>
      <p class="big-line">${nxt ? `Serie ${it.sets.filter((x, j) => !x.warmup && j <= k).length}${nxt.kg != null && !ex.bodyweight ? ' · ' + P.fmtKg(nxt.kg) + ' ' + P.kgUnit(ex) : ''}` : 'Siguiente ejercicio'}</p>
      <div class="row3">
        <button class="btn ghost sm" data-a="restAdd" data-d="-15">−15</button>
        <button class="btn primary sm" data-a="restSkip">Listo</button>
        <button class="btn ghost sm" data-a="restAdd" data-d="15">+15</button>
      </div>
    </div>
  </div>`;
}

function projection() {
  const A = S.active;
  const elapsed = (Date.now() - Date.parse(A.startedAt)) / 1000;
  const remaining = A.items.filter(i => i.status === 'todo').reduce((a, it) => {
    const left = { ...it, sets: it.sets.filter(s => !s.done) };
    return a + (left.sets.length ? P.estimateItem(left) : 0);
  }, 0);
  const total = elapsed + remaining;
  return { elapsed, remaining, total, over: total - P.MAX_MIN * 60 };
}

// ───────── acciones de sesión ─────────
function startSession(tplKey, pain, type = 'fuerza', adj = null) {
  unlockAudio();
  const d = P.todayISO();
  const phase = C.programPhase(S.sessions, S.profile.startDate, d);
  let mode = type === 'core' ? 'normal' : pain >= 5 ? 'proteccion' : pain >= 3 ? 'suave' : 'normal';
  if (type === 'movilidad' && mode === 'suave') mode = 'normal'; // la sesión de movilidad ya es suave
  const useAdj = type === 'fuerza' && mode !== 'proteccion' && adj && adj.key !== 'normal' ? adj : null;
  const plan = P.buildSession(tplKey, { phase, settings: S.settings, mode, adj: useAdj });
  const id = uid();
  const sType = mode === 'proteccion' || type === 'movilidad' ? 'movilidad' : type;
  const hold = !!(phase.hold || mode !== 'normal' || useAdj?.hold);
  const adjInfo = useAdj ? { key: useAdj.key, tag: useAdj.tag, load: useAdj.load, maxSets: useAdj.maxSets } : null;
  S.active = { sessionId: id, type: sType, template: plan.template, mode, phase: { ...phase, hold }, adj: adjInfo, items: plan.items, idx: 0, startedAt: new Date().toISOString(), painBefore: pain, rest: null, guided: null, results: {} };
  S.sessions[id] = { id, date: d, type: sType, template: plan.template, phase: phase.key, mode, status: 'active', painBefore: pain, startedAt: S.active.startedAt, summary: { adj: adjInfo } };
  enqueue('session', id);
  save();
  ui.inSession = true; ui.sheet = null; ui.another = false;
  acquireWake();
  say(mode === 'proteccion' ? 'Hoy cuidamos la espalda' : 'Vamos allá');
  render();
  scrollTo(0, 0);
}

function logSet(it, k) {
  const s = it.sets[k];
  const ex = EXERCISES[it.id];
  s.done = true; s.doneAt = new Date().toISOString();
  const id = s.logId || (s.logId = uid());
  S.sets[id] = {
    id, sessionId: S.active.sessionId, exId: it.id, setNo: k + 1, warmup: !!s.warmup,
    kg: ex.bodyweight || ex.kind === 'time' || ex.kind === 'hold' || ex.kind === 'holdreps' ? null : s.kg,
    reps: ex.kind === 'reps' || ex.kind === 'holdreps' ? s.reps : null,
    secs: ex.kind === 'time' ? (s.secs ?? ex.minutes * 60) : (ex.kind === 'hold' || ex.kind === 'holdreps' || ex.kind === 'carry') ? s.hold : null,
    targetReps: ex.kind === 'reps' ? (Array.isArray(ex.reps) ? ex.reps[1] : ex.reps) : ex.kind === 'holdreps' ? s.reps : null,
    targetSecs: ex.kind === 'time' ? ex.minutes * 60 : s.targetHold ?? s.hold ?? null,
    doneAt: s.doneAt,
  };
  enqueue('set', id);
}

function afterSet(it) {
  const A = S.active;
  const k = curSetIdx(it);
  if (k >= 0) {
    if (it.rest) { A.rest = { endAt: Date.now() + it.rest * 1000, total: it.rest }; }
    save(); render();
    return;
  }
  itemComplete(it);
}

function itemComplete(it) {
  const ex = EXERCISES[it.id];
  const needsFeel = (it.g === 'core' || it.g === 'fuerza') && ex.kind !== 'time';
  S.active.rest = null;
  if (needsFeel) { ui.sheet = { type: 'feel' }; save(); render(); return; }
  it.status = 'done';
  advance();
}

function advance() {
  const A = S.active;
  const n = A.items.length;
  for (let j = 1; j <= n; j++) {
    const k = (A.idx + j) % n;
    if (A.items[k].status === 'todo') { A.idx = k; A.techOpen = false; save(); render(); scrollTo({ top: 0, behavior: 'smooth' }); return; }
  }
  ui.sheet = { type: 'finish' }; save(); render();
}

function finishSession(painAfter, rpe, notes) {
  const A = S.active;
  const s = S.sessions[A.sessionId];
  const finishedAt = new Date().toISOString();
  let volume = 0;
  for (const it of A.items) for (const x of it.sets) if (x.done && !x.warmup && x.kg && EXERCISES[it.id].kind === 'reps') { const e = EXERCISES[it.id]; if (!e.assist) volume += x.kg * (x.reps || 0) * (e.perSide || e.perHand ? 2 : 1); }
  Object.assign(s, {
    status: 'done', finishedAt, painAfter, rpe, notes,
    durationMin: Math.round((Date.parse(finishedAt) - Date.parse(A.startedAt)) / 600) / 100,
    summary: {
      results: A.results, volume: Math.round(volume), adj: A.adj || null,
      items: A.items.map(i => ({ id: i.id, status: i.status, sets: i.sets.filter(x => x.done).length })),
    },
  });
  enqueue('session', s.id);
  S.active = null;
  save();
  releaseWake();
  ui.inSession = false; ui.sheet = null; ui.summary = s.id;
  beep(660, 0.12); setTimeout(() => beep(990, 0.25), 140);
  say('Sesión terminada. Buen trabajo');
  render(); scrollTo(0, 0);
}

function discardSession() {
  const A = S.active;
  for (const it of A.items) for (const x of it.sets) if (x.logId && S.sets[x.logId]) { delete S.sets[x.logId]; enqueue('set', x.logId, 'delete'); }
  delete S.sessions[A.sessionId]; enqueue('session', A.sessionId, 'delete');
  S.active = null; save(); releaseWake();
  ui.inSession = false; ui.sheet = null; render();
}

// temporizador guiado
function startGuided(i) {
  unlockAudio();
  const A = S.active, it = A.items[A.idx];
  const s = it.sets[i];
  const steps = P.guidedSteps(it.id, s);
  const sides = Math.max(1, steps.filter(x => x.label === 'Cambia de lado').length + 1);
  A.rest = null;
  A.guided = { item: A.idx, set: i, steps, i: 0, stepEnd: Date.now() + steps[0].secs * 1000, paused: false, work: 0, sides };
  beep(880, 0.12);
  say(steps[0].say || steps[0].label);
  save(); render();
  app.querySelector('.guided')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function guidedNext() {
  const G = S.active.guided;
  const cur = G.steps[G.i];
  if (cur.work) G.work += cur.secs;
  G.i++;
  if (G.i >= G.steps.length) return guidedDone(false);
  const st = G.steps[G.i];
  G.stepEnd = Date.now() + st.secs * 1000;
  if (st.work) { beep(880, 0.12); } else beep(520, 0.1);
  if (st.say) say(st.say);
  save(); render();
}
function guidedDone(early) {
  const A = S.active, G = A.guided, it = A.items[G.item], s = it.sets[G.set];
  const ex = EXERCISES[it.id];
  if (early) {
    const cur = G.steps[G.i];
    if (cur.work) G.work += G.paused ? cur.secs - G.pausedRem : cur.secs - Math.max(0, (G.stepEnd - Date.now()) / 1000);
    s.targetHold = s.hold;
    if (ex.kind === 'hold' || ex.kind === 'carry') s.hold = Math.round(G.work / G.sides);
    if (ex.kind === 'holdreps') s.reps = Math.max(1, Math.round(G.work / G.sides / s.hold));
    if (ex.kind === 'time') s.secs = Math.round(G.work);
  }
  A.guided = null;
  beep(990, 0.3);
  if (!early) say(curSetIdx(it) === G.set && it.sets.length - 1 > G.set ? 'Descansa' : 'Hecho');
  logSet(it, G.set);
  afterSet(it);
}

// ticker
let lastBeep = 0;
setInterval(() => {
  const A = S.active;
  if (!A || !ui.inSession || ui.summary) return;
  const now = Date.now();
  const clock = app.querySelector('[data-clock]');
  if (clock) clock.textContent = P.fmtClock((now - Date.parse(A.startedAt)) / 1000);
  if (A.rest) {
    const rem = (A.rest.endAt - now) / 1000;
    if (rem <= 0) { A.rest = null; beep(990, 0.35); say('Vamos'); save(); if (!ui.sheet) render(); return; }
    const c = Math.ceil(rem);
    if (rem <= 3.2 && c !== lastBeep) { lastBeep = c; beep(660, 0.08); }
    const el = app.querySelector('[data-rest]');
    if (el) { el.textContent = P.fmtClock(rem); el.closest('.ring').style.setProperty('--p', 1 - rem / A.rest.total); }
  }
  if (A.guided && !A.guided.paused) {
    const G = A.guided, st = G.steps[G.i];
    const rem = (G.stepEnd - now) / 1000;
    if (rem <= 0) { guidedNext(); return; }
    const c = Math.ceil(rem);
    if (st.work && rem <= 3.2 && c !== lastBeep && st.secs > 5) { lastBeep = c; beep(660, 0.06, 0.2); }
    const el = app.querySelector('[data-g-secs]');
    if (el) { el.textContent = c; el.closest('.ring').style.setProperty('--p', 1 - rem / st.secs); }
  }
}, 200);

// ───────── RESUMEN ─────────
function viewSummary() {
  const s = S.sessions[ui.summary];
  if (!s) { ui.summary = null; return shell(); }
  const res = Object.entries(s.summary?.results || {});
  const nx = nextPlanned();
  const items = s.summary?.items || [];
  return `<main class="page summary">
    <div class="confetti">${icon('check')}</div>
    <h1 class="center">¡Sesión completada!</h1>
    <p class="center muted">${P.TEMPLATES[s.template]?.name || cap(s.type)} · ${fmtDate(s.date)}</p>
    <div class="tiles">
      <div class="tile"><b>${Math.round(s.durationMin || 0)}'</b><span>duración</span></div>
      <div class="tile"><b>${items.filter(i => i.status === 'done').length}/${items.length}</b><span>ejercicios</span></div>
      <div class="tile"><b>${(s.summary?.volume || 0).toLocaleString('es-ES')}</b><span>kg movidos</span></div>
    </div>
    <div class="tiles two">
      <div class="tile"><b>${s.painBefore ?? '–'} → ${s.painAfter ?? '–'}</b><span>espalda (0-10)</span></div>
      <div class="tile"><b>${s.rpe ?? '–'}/10</b><span>esfuerzo</span></div>
    </div>
    ${res.length ? `<section class="card"><p class="eyebrow">${icon('up')} Ajustes para la próxima vez</p>${res.map(([id, r]) => `<div class="win ${r.dir || ''}"><b>${EXERCISES[id]?.name || id}</b><span>${esc(r.msg)}</span></div>`).join('')}</section>` : ''}
    ${s.painAfter != null && s.painBefore != null && s.painAfter - s.painBefore >= 2 ? `<section class="card note k-warning"><p class="eyebrow">${icon('warn')} Atención</p><p>Tu espalda ha empeorado durante la sesión. La próxima vez la app te propondrá una sesión suave. Si el dolor baja por la pierna o aparece hormigueo, consulta con tu médico.</p></section>` : ''}
    ${nx ? `<section class="card subtle"><p class="muted small">Próximo día de gimnasio · recomendación</p><p class="big-line">${cap(P.DAY_NAMES[nx.date.getDay()])} · ${plannedLabel(nx)}</p></section>` : ''}
    <button class="btn primary xl" data-a="closeSummary">Volver al inicio</button>
  </main>`;
}

// ───────── PROGRESO ─────────
function viewHistory() {
  const all = Object.values(S.sessions).filter(s => s.status === 'done').sort((a, b) => (b.startedAt || b.date).localeCompare(a.startedAt || a.date));
  const month = P.todayISO().slice(0, 7);
  const inMonth = all.filter(s => s.date.startsWith(month));
  const painPts = all.filter(s => s.painBefore != null).slice(0, 30).reverse().map(s => ({ x: s.date, y: s.painBefore }));
  const logged = new Set(Object.values(S.sets).map(x => x.exId));
  const strengthIds = Object.keys(EXERCISES).filter(id => EXERCISES[id].group === 'fuerza' && !EXERCISES[id].bodyweight && (!SLOT_OF[id] || SLOT_OF[id] === id || logged.has(id))).concat(['pallof', 'carry']);
  const exPts = exerciseSeries(ui.chartEx);
  const wkStreak = weekStreak();
  return `
  <header class="top"><div><h1>Tu progreso</h1></div>${syncPill()}</header>
  <div class="tiles">
    <div class="tile"><b>${inMonth.filter(s => s.type === 'fuerza').length}</b><span>fuerza este mes</span></div>
    <div class="tile"><b>${inMonth.filter(s => s.type === 'spinning').length}</b><span>spinning este mes</span></div>
    <div class="tile"><b>${wkStreak}</b><span>semanas cumpliendo</span></div>
  </div>
  <section class="card">
    <p class="eyebrow">Peso de trabajo por ejercicio</p>
    <div class="chips scroll">${strengthIds.map(id => `<button class="chip-btn ${ui.chartEx === id ? 'on' : ''}" data-a="chartEx" data-id="${id}">${EXERCISES[id].name.replace(/ en (máquina|polea)$/, '')}</button>`).join('')}</div>
    ${lineChart(exPts, { unit: 'kg', color: 'var(--c-fuerza)' })}
  </section>
  <section class="card">
    <p class="eyebrow">Espalda antes de entrenar (0-10)</p>
    ${lineChart(painPts, { unit: '', color: 'var(--c-warm)', yMin: 0, yMax: 10 })}
  </section>
  <section class="card">
    <p class="eyebrow">Para revisar con Claude</p>
    <p class="small muted">Copia un resumen de tus últimas 4 semanas y pégalo en una conversación con Claude para ajustar el plan. Si tienes la copia en la nube activada, Claude también puede leer tu histórico directamente desde la base de datos.</p>
    <button class="btn ghost" data-a="copyReport">${icon('copy')} Copiar resumen</button>
  </section>
  <h2 class="sec-title">Historial</h2>
  ${all.length ? `<div class="hist">${all.slice(0, 60).map(s => `<button class="hist-row t-${s.type}" data-a="sheet" data-s="session" data-id="${s.id}">
      <span class="dot"></span>
      <span class="h-main"><b>${s.type === 'spinning' ? 'Spinning' : P.TEMPLATES[s.template]?.name || cap(s.type)}</b><small>${fmtDate(s.date)}${s.durationMin ? ' · ' + Math.round(s.durationMin) + ' min' : ''}</small></span>
      <span class="h-pain">${s.painBefore ?? '–'}→${s.painAfter ?? '–'}</span>
    </button>`).join('')}</div>` : '<p class="empty">Aquí aparecerán tus sesiones.</p>'}
  `;
}

function exerciseSeries(id) {
  const ex = EXERCISES[id];
  const bySes = {};
  for (const x of Object.values(S.sets)) {
    if (x.exId !== id || x.warmup) continue;
    const ses = S.sessions[x.sessionId];
    if (!ses || ses.status !== 'done') continue;
    const v = ex.kind === 'reps' || ex.kind === 'carry' ? x.kg : x.secs;
    if (v == null) continue;
    bySes[ses.date] = Math.max(bySes[ses.date] ?? 0, v);
  }
  return Object.entries(bySes).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([x, y]) => ({ x, y }));
}

function weekStreak() {
  let n = 0;
  const m = P.mondayOf(new Date());
  for (let w = 1; w < 52; w++) {
    const start = new Date(m); start.setDate(m.getDate() - 7 * w);
    const days = [...Array(7)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return P.iso(d); });
    const c = Object.values(S.sessions).filter(s => s.status === 'done' && days.includes(s.date) && (s.type === 'fuerza' || s.type === 'movilidad')).length;
    if (c >= 2) n++; else break;
  }
  return n;
}

function lineChart(pts, { unit = '', color = 'var(--accent)', yMin, yMax } = {}) {
  if (pts.length < 2) return `<p class="empty">${pts.length === 1 ? `Primer registro: ${P.fmtKg(pts[0].y)}${unit ? ' ' + unit : ''}. Con una sesión más verás la gráfica.` : 'Aún no hay datos. Aparecerán al completar sesiones.'}</p>`;
  const W = 320, H = 150, pl = 30, pr = 12, pt = 12, pb = 24;
  const ys = pts.map(p => p.y);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (yMin != null) y0 = Math.min(y0, yMin);
  if (yMax != null) y1 = Math.max(y1, yMax);
  if (y1 === y0) { y1 += 1; y0 = Math.max(0, y0 - 1); }
  const X = i => pl + (W - pl - pr) * i / (pts.length - 1);
  const Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(pts.length - 1).toFixed(1)},${H - pb} L${pl},${H - pb} Z`;
  const ticks = [y0, (y0 + y1) / 2, y1];
  const last = pts.at(-1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="--lc:${color}">
    ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/><text x="${pl - 6}" y="${Y(t) + 3}" class="ax" text-anchor="end">${P.fmtKg(t)}</text>`).join('')}
    <path d="${area}" class="area"/><path d="${d}" class="line"/>
    ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="${i === pts.length - 1 ? 4.5 : 2.5}" class="pt"/>`).join('')}
    <text x="${pl}" y="${H - 6}" class="ax">${fmtDate(pts[0].x)}</text>
    <text x="${W - pr}" y="${H - 6}" class="ax" text-anchor="end">${fmtDate(last.x)}</text>
  </svg>
  <p class="chart-last">Último: <b>${P.fmtKg(last.y)} ${unit}</b>${pts.length > 1 ? ` · inicio ${P.fmtKg(pts[0].y)} ${unit}` : ''}</p>`;
}

function buildReport() {
  const since = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
  const ses = Object.values(S.sessions).filter(s => s.status === 'done' && s.date >= since).sort((a, b) => a.date.localeCompare(b.date));
  const p = S.profile;
  const phase = C.programPhase(S.sessions, p.startDate, P.todayISO());
  let t = `RESUMEN APP GYM (últimas 4 semanas)\nPerfil: ${p.birthYear ? new Date().getFullYear() - p.birthYear + ' años, ' : ''}${p.weightKg || '?'} kg, ${p.heightCm || '?'} cm. Programa: semana ${phase.week} (${phase.name}).\nCondición: ${p.backNotes || 'columna lumbar sensible'}\n\n`;
  for (const s of ses) {
    t += `${s.date} · ${s.type}${s.spinKind ? ' ' + s.spinKind : ''}${s.summary?.adj?.tag ? ' [' + s.summary.adj.tag + ']' : ''}${s.template && s.type !== 'spinning' ? ' ' + s.template : ''}${s.mode && s.mode !== 'normal' ? ' (' + s.mode + ')' : ''} · ${Math.round(s.durationMin || 0)} min · espalda ${s.painBefore ?? '-'}→${s.painAfter ?? '-'} · RPE ${s.rpe ?? '-'}${s.notes ? ' · nota: ' + s.notes : ''}\n`;
    const sets = Object.values(S.sets).filter(x => x.sessionId === s.id && !x.warmup);
    const byEx = {};
    for (const x of sets) (byEx[x.exId] = byEx[x.exId] || []).push(x);
    for (const [id, xs] of Object.entries(byEx)) {
      t += `   - ${EXERCISES[id]?.name || id}: ${xs.map(x => x.kg != null ? `${P.fmtKg(x.kg)}kg×${x.reps ?? x.secs + 's'}` : x.reps != null ? `${x.reps}${x.secs ? '×' + x.secs + 's' : ''}` : `${x.secs}s`).join(', ')}${s.summary?.results?.[id]?.msg ? ' → ' + s.summary.results[id].msg : ''}\n`;
    }
  }
  t += `\nAjustes actuales:\n`;
  for (const [id, st] of Object.entries(S.settings)) {
    const e = EXERCISES[id]; if (!e) continue;
    t += `- ${e.name}: ${st.kg != null ? P.fmtKg(st.kg) + ' ' + P.kgUnit(e) : ''}${st.swapTo ? ' · fijado: ' + st.swapTo : ''}${st.hold ? ' ' + st.hold + ' s' : ''}${e.levels ? ' nivel ' + ((st.level || 0) + 1) : ''}${st.backFlags ? ' · molestias: ' + st.backFlags : ''}${st.note ? ' · ajuste: ' + st.note : ''}\n`;
  }
  return t;
}

// ───────── EJERCICIOS ─────────
function viewLibrary() {
  const isAlt = e => SLOT_OF[e.id] && SLOT_OF[e.id] !== e.id;
  const sections = [
    ['core', GROUPS.core.name, e => e.group === 'core'],
    ['fuerza', GROUPS.fuerza.name, e => e.group === 'fuerza' && !isAlt(e)],
    ['fuerza', 'Alternativas de fuerza (rotan o sustituyen)', e => isAlt(e)],
    ['warm', GROUPS.warm.name, e => e.group === 'warm'],
    ['calma', GROUPS.calma.name, e => e.group === 'calma'],
  ];
  return `<header class="top"><div><h1>Ejercicios</h1><p class="muted small">${Object.values(EXERCISES).filter(e => e.group !== 'cardio').length} ejercicios. Toca uno para ver cómo se hace</p></div></header>
  ${sections.map(([g, title, fn]) => `<h2 class="sec-title" style="--c:${GROUPS[g].color}"><i></i>${title}</h2>
    <div class="lib">${Object.values(EXERCISES).filter(fn).map(e => {
      const st = P.getSetting(S.settings, e.id);
      return `<button class="lib-card" data-a="openEx" data-id="${e.id}" style="--c:${GROUPS[g].color}">
        <div class="thumb">${artSVG(e.art, 1)}</div>
        <b>${e.name}</b>
        <small>${st.kg != null && !e.bodyweight && (e.kind === 'reps' || e.kind === 'carry') ? P.fmtKg(st.kg) + ' ' + P.kgUnit(e) : e.levels ? 'Nivel ' + (st.level + 1) : e.muscles[0]}</small>
      </button>`;
    }).join('')}</div>`).join('')}`;
}

function swapBtn(id, action, note = '', extra = '') {
  const e = EXERCISES[id];
  return `<button class="swap ${extra}" data-a="${action}" data-id="${id}"><span class="thumb">${artSVG(e.art, 1)}</span><span class="sw-txt"><b>${e.name}</b><small>${e.machine}</small>${note ? `<em>${note}</em>` : ''}</span></button>`;
}

function altSection(id, slot) {
  const pinned = S.settings[slot]?.swapTo;
  return `<section class="card"><p class="eyebrow">Variantes de este movimiento</p>
    <p class="small muted">${pinned ? `Fijado: siempre <b>${EXERCISES[pinned].name}</b>.` : 'La app las rota sola: los accesorios cada 6 semanas y los ejercicios principales cada 12. Durante la sesión puedes cambiar a cualquiera si la máquina está ocupada.'}</p>
    <div class="swaps">${optionsFor(slot).map(o => swapBtn(o, 'openEx', [o === slot ? 'Base' : EXERCISES[o].swapOnly ? 'Solo como recambio' : 'Alternativa', pinned === o ? 'fijado' : ''].filter(Boolean).join(' · '), o === id ? 'cur' : '')).join('')}</div>
    ${pinned === id ? `<button class="btn ghost sm" data-a="unpin" data-id="${slot}">Volver a la rotación automática</button>` : EXERCISES[id].swapOnly ? '' : `<button class="btn ghost sm" data-a="pin" data-slot="${slot}" data-id="${id}">Usar siempre este</button>`}
  </section>`;
}

function viewExercise(id) {
  const ex = EXERCISES[id];
  const st = P.getSetting(S.settings, id);
  const pts = exerciseSeries(id);
  return `<main class="page exd" style="--gc:${GROUPS[ex.group].color}">
    <header class="r-top"><button class="icon-btn" data-a="closeEx" aria-label="Volver">${icon('back')}</button><span class="block-chip">${GROUPS[ex.group].name}</span><span></span></header>
    <div class="art-wrap" data-anim="${id}">${artSVG(ex.art, 0, 'big')}</div>
    <h1 class="ex-name">${ex.name}</h1>
    <p class="where">${icon('pin')} ${ex.machine}</p>
    <div class="chips">${ex.muscles.map(m => `<span class="chip">${m}</span>`).join('')}</div>
    <p class="why">${ex.why}</p>
    <section class="card">
      <p class="eyebrow">Tu objetivo actual</p>
      <p class="big-line">${ex.kind === 'reps' ? `${P.targetText(id, st)}${!ex.bodyweight && st.kg != null ? ' · ' + P.fmtKg(st.kg) + ' ' + P.kgUnit(ex) : ''}` : ex.kind === 'time' ? ex.minutes + ' min' : P.targetText(id, st) + (ex.kind === 'carry' ? ' · ' + P.fmtKg(st.kg) + ' kg' : '')}</p>
      ${ex.levels ? `<p class="small muted">Nivel ${st.level + 1} de ${ex.levels.length}: ${ex.levels[st.level].name}</p>` : ''}
      <button class="mynote ${st.note ? '' : 'empty'}" data-a="sheet" data-s="note" data-id="${id}">${icon('gear')} ${st.note ? 'Mi ajuste: ' + esc(st.note) : 'Apunta tu ajuste de máquina'}</button>
      ${!ex.bodyweight && (ex.kind === 'reps' || ex.kind === 'carry') ? `<button class="btn ghost sm" data-a="sheet" data-s="kg" data-id="${id}">Cambiar peso de trabajo</button>` : ''}
    </section>
    <section class="card tech-body">
      <h4>Colócate</h4><ul>${ex.setup.map(x => `<li>${x}</li>`).join('')}</ul>
      <h4>Mientras lo haces</h4><ul class="ok">${ex.cues.map(x => `<li>${x}</li>`).join('')}</ul>
      <h4>Evita</h4><ul class="no">${ex.avoid.map(x => `<li>${x}</li>`).join('')}</ul>
    </section>
    ${ex.kind === 'reps' && !ex.bodyweight || ex.kind === 'carry' ? `<section class="card"><p class="eyebrow">Evolución</p>${lineChart(pts, { unit: P.kgUnit(ex), color: 'var(--c-fuerza)' })}</section>` : ''}
    ${SLOT_OF[id] ? altSection(id, SLOT_OF[id]) : ''}
  </main>`;
}

// ───────── PERFIL ─────────
function viewProfile() {
  const p = S.profile;
  const phase = C.programPhase(S.sessions, p.startDate, P.todayISO());
  const mets = Object.values(S.metrics).sort((a, b) => a.date.localeCompare(b.date));
  return `<header class="top"><div><h1>Perfil</h1></div>${syncPill()}</header>
  <section class="card">
    <p class="eyebrow">Tus datos</p>
    <div class="form">
      <label>Nombre<input data-f="name" value="${esc(p.name)}" autocomplete="given-name"></label>
      <div class="row2">
        <label>Año de nacimiento<input data-f="birthYear" inputmode="numeric" value="${esc(p.birthYear)}"></label>
        <label>Altura (cm)<input data-f="heightCm" inputmode="numeric" value="${esc(p.heightCm)}"></label>
      </div>
      <label>Zona a proteger / notas médicas<input data-f="backNotes" value="${esc(p.backNotes)}" placeholder="Ej.: protrusión lumbar"></label>
      <button class="btn" data-a="saveProfile">Guardar</button>
    </div>
  </section>
  <section class="card">
    <p class="eyebrow">Peso corporal</p>
    <div class="row2 end">
      <label>Hoy (kg)<input data-f="todayKg" inputmode="decimal" placeholder="${esc(p.weightKg)}"></label>
      <button class="btn" data-a="saveWeight">Registrar</button>
    </div>
    ${lineChart(mets.map(m => ({ x: m.date, y: m.kg })), { unit: 'kg', color: 'var(--c-core)' })}
  </section>
  ${weekPrefsCard()}
  <section class="card">
    <p class="eyebrow">Copia en la nube y conexión con Claude</p>
    ${cloudBlock()}
  </section>
  <section class="card">
    <p class="eyebrow">Programa</p>
    <p>Semana <b>${phase.week}</b> entrenada · ${phase.name}</p><p class="small muted">${phase.info}</p>
    <p class="small muted">Las semanas cuentan solo si haces fuerza. Una semana sin venir funciona como descarga, y un parón de 4 semanas reinicia la adaptación.</p>
    <p class="small muted">Inicio: ${fmtDate(p.startDate)}</p>
    <button class="btn ghost sm" data-a="sheet" data-s="restart">Reiniciar el programa desde hoy</button>
  </section>
  <section class="card">
    <p class="eyebrow">Durante la sesión</p>
    <label class="toggle"><input type="checkbox" data-a="pref" data-k="voice" ${S.prefs.voice ? 'checked' : ''}><span>Voz que te guía (cambios de lado, descansos)</span></label>
    <label class="toggle"><input type="checkbox" data-a="pref" data-k="sound" ${S.prefs.sound ? 'checked' : ''}><span>Pitidos de temporizador</span></label>
  </section>
  <section class="card note k-warning">
    <p class="eyebrow">${icon('warn')} Señales para parar</p>
    <p>Para y consulta con tu médico si notas dolor que baja por la pierna, hormigueo, pérdida de fuerza o dolor que empeora durante la sesión. La app no sustituye a tu médico ni a tu fisioterapeuta.</p>
  </section>
  <button class="btn ghost sm" data-a="export">Exportar mis datos (JSON)</button>
  <p class="muted small center ver">App Gym · v1.1</p>`;
}

function weekPrefsCard() {
  const t = C.targetsOf(S.prefs), gd = C.gymDaysOf(S.prefs);
  const pick = (k, arr) => `<div class="seg-pick">${arr.map(n => `<button class="${t[k] === n ? 'on' : ''}" data-a="target" data-k="${k}" data-v="${n}">${n}</button>`).join('')}</div>`;
  return `<section class="card">
    <p class="eyebrow">Tu semana</p>
    <p class="small muted">Cada mañana eliges qué haces; con esto la app reparte lo que falta.</p>
    <div class="pick-row"><span>Fuerza por semana</span>${pick('fuerza', [2, 3, 4])}</div>
    <div class="pick-row"><span>Spinning por semana</span>${pick('spinning', [0, 1, 2, 3])}</div>
    <p class="small muted">Días que sueles poder ir</p>
    <div class="seg-pick days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="${gd.includes(d) ? 'on' : ''}" data-a="gymDay" data-v="${d}">${P.DAY_SHORT[d]}</button>`).join('')}</div>
    <p class="small muted">Lo recomendable: 3 de fuerza (2 como mínimo para mantener) y nunca dos días seguidos de fuerza.</p>
  </section>`;
}

function cloudBlock() {
  if (!hasCloud()) return '<p class="small muted">La copia en la nube no está disponible en este momento (sin conexión al cargar). Tus datos se guardan en el móvil.</p>';
  if (!user) {
    return `<p class="small muted">Crea una cuenta (o entra) para guardar todo en la base de datos, no perder nada si cambias de móvil y que Claude pueda analizar tu histórico y dejarte notas aquí.</p>
    <div class="form">
      <label>Email<input data-f="email" type="email" autocomplete="email" inputmode="email"></label>
      <label>Contraseña<input data-f="pw" type="password" autocomplete="current-password"></label>
      <div class="row2"><button class="btn primary" data-a="login">Entrar</button><button class="btn" data-a="signup">Crear cuenta</button></div>
      <button class="link" data-a="forgot">¿Olvidaste la contraseña?</button>
    </div>`;
  }
  return `<p>Conectado como <b>${esc(user.email)}</b></p>
    <p class="small muted">${{ ok: 'Todo guardado.', syncing: 'Sincronizando…', pending: `${S.queue.length} cambios pendientes de subir.`, offline: 'Sin conexión: se subirá solo al recuperarla.', error: 'Error: ' + esc(cloud.error || '') }[cloud.status] || ''}${S.lastSync ? ' Última sincronización: ' + new Date(S.lastSync).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : ''}</p>
    <div class="row2"><button class="btn" data-a="syncNow">Sincronizar ahora</button><button class="btn ghost" data-a="logout">Cerrar sesión</button></div>`;
}

// ───────── ONBOARDING / RECUPERACIÓN ─────────
function viewOnboarding() {
  return `<main class="page onboard">
    <div class="art-wrap" data-anim="bird_dog">${artSVG(EXERCISES.bird_dog.art, 0, 'big')}</div>
    <h1>Tu plan de fuerza,<br><span class="accent">pensado para tu espalda</span></h1>
    <p class="muted">Sesiones de máximo 45 minutos. La app te dice qué toca, en qué máquina, con qué peso y cuánto descansar. Y va subiendo la carga según cómo te va.</p>
    <ol class="how">
      <li><b>Cada mañana eliges</b> fuerza o spinning. Te digo qué conviene según lo que llevas de semana.</li>
      <li><b>La sesión se adapta</b> a los días que llevas sin venir, a si ayer hiciste fuerza y a cómo está tu espalda.</li>
      <li><b>Objetivo semanal:</b> 3 de fuerza y 2 de spinning, 45 minutos como máximo.</li>
    </ol>
    <section class="card">
      <div class="form">
        <label>¿Cómo te llamas?<input data-f="name" autocomplete="given-name"></label>
        <div class="row2">
          <label>Año de nacimiento<input data-f="birthYear" inputmode="numeric"></label>
          <label>Altura (cm)<input data-f="heightCm" inputmode="numeric"></label>
        </div>
        <div class="row2">
          <label>Peso (kg)<input data-f="weightKg" inputmode="decimal"></label>
          <label>Zona a proteger<input data-f="backNotes" placeholder="Ej.: zona lumbar"></label>
        </div>
        <button class="btn primary xl" data-a="onboard">Empezar</button>
      </div>
    </section>
    ${hasCloud() ? `<button class="link center" data-a="sheet" data-s="login">Ya tengo cuenta: recuperar mis datos</button>` : ''}
  </main>`;
}
function viewRecovery() {
  return `<main class="page"><h1>Nueva contraseña</h1><section class="card"><div class="form">
    <label>Contraseña nueva<input data-f="newpw" type="password" autocomplete="new-password"></label>
    <button class="btn primary" data-a="setPw">Guardar</button></div></section></main>`;
}

// ───────── HOJAS (bottom sheets) ─────────
function viewSheet() {
  const s = typeof ui.sheet === 'string' ? { type: ui.sheet } : ui.sheet;
  let body = '';
  const T = S.profile ? todayInfo() : null;
  switch (s.type) {
    case 'pain':
      body = `<h2>¿Cómo está tu espalda ahora?</h2><p class="muted">0 = nada · 10 = dolor máximo. Con esto adapto la sesión.</p>
      <div class="painpad">${[...Array(11)].map((_, i) => `<button class="pain p${i}" data-a="painGo" data-v="${i}">${i}</button>`).join('')}</div>
      <div class="legend3"><span>0-2 normal</span><span>3-4 sesión suave</span><span>5+ solo movilidad</span></div>
      <p class="small muted">Si notas dolor que baja por la pierna, hormigueo o pérdida de fuerza, hoy no entrenes y consulta a tu médico.</p>`;
      break;
    case 'feel': {
      const it = S.active.items[S.active.idx];
      body = `<h2>${EXERCISES[it.id].name}</h2>
      <label class="toggle back"><input type="checkbox" id="backFlag"><span>He notado molestia en la espalda</span></label>
      <p class="muted">¿Cómo ha ido?</p>
      <div class="feel">
        <button data-a="feel" data-v="facil" class="f-facil"><b>😌</b>Fácil<small>me sobraban reps</small></button>
        <button data-a="feel" data-v="bien" class="f-bien"><b>💪</b>Justo<small>exigente pero bien</small></button>
        <button data-a="feel" data-v="duro" class="f-duro"><b>😣</b>Duro<small>al límite / técnica peor</small></button>
      </div>`;
      break;
    }
    case 'finish':
      body = `<h2>Última pregunta</h2>
      <p class="muted">¿Cómo está tu espalda ahora? (0-10)</p>
      <div class="painpad sm">${[...Array(11)].map((_, i) => `<button class="pain p${i} ${s.pain === i ? 'on' : ''}" data-a="finPain" data-v="${i}">${i}</button>`).join('')}</div>
      <p class="muted">¿Cómo de dura ha sido la sesión? (1-10)</p>
      <div class="painpad sm rpe">${[...Array(10)].map((_, i) => `<button class="pain ${s.rpe === i + 1 ? 'on' : ''}" data-a="finRpe" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
      <label class="note-in">Notas (opcional)<textarea data-f="notes" rows="2" placeholder="Ej.: la máquina de remo estaba ocupada…">${esc(s.notes || '')}</textarea></label>
      <button class="btn primary xl" data-a="finish" ${s.pain == null || s.rpe == null ? 'disabled' : ''}>Guardar sesión</button>`;
      break;
    case 'exit':
      body = `<h2>¿Qué hacemos?</h2>
      <button class="btn xl" data-a="pauseSession">Salir y continuar luego</button>
      <button class="btn xl" data-a="endNow">Terminar ya (guardar lo hecho)</button>
      <button class="btn danger" data-a="discard">Descartar sesión</button>`;
      break;
    case 'map':
      body = `<h2>Sesión de hoy</h2><p class="muted small">Toca un ejercicio para ir a él.</p><ol class="map">${S.active.items.map((it, k) => `<li><button class="s-${it.status} ${k === S.active.idx ? 'cur' : ''}" data-a="jump" data-i="${k}" style="--c:${GROUPS[it.g].color}">
        <i></i><b>${EXERCISES[it.id].name}</b><small>${it.status === 'done' ? 'Hecho' : it.status === 'skipped' ? 'Saltado' : setsSummary(it)}</small></button></li>`).join('')}</ol>`;
      break;
    case 'note': {
      const st = P.getSetting(S.settings, s.id);
      body = `<h2>Tu ajuste de máquina</h2><p class="muted">${EXERCISES[s.id].name}. Apunta lo que te sirva para colocarte rápido la próxima vez.</p>
      <label class="note-in"><input data-f="mnote" value="${esc(st.note)}" placeholder="Ej.: asiento 4, respaldo 2, agarre neutro"></label>
      <button class="btn primary" data-a="saveNote" data-id="${s.id}">Guardar</button>`;
      break;
    }
    case 'kg': {
      const st = P.getSetting(S.settings, s.id);
      body = `<h2>Peso de trabajo</h2><p class="muted">${EXERCISES[s.id].name}</p>
      <label class="note-in"><input data-f="kgset" inputmode="decimal" value="${st.kg ?? ''}"></label>
      <button class="btn primary" data-a="saveKg" data-id="${s.id}">Guardar</button>`;
      break;
    }
    case 'swap': {
      const A = S.active, it = A.items[A.idx];
      const slot = it.slot || SLOT_OF[it.id] || it.id;
      const inSession = new Set(A.items.map(i => i.id));
      const opts = ALTERNATIVES[slot] ? optionsFor(slot).filter(id => !inSession.has(id)) : [];
      const later = A.items.some((x, k) => k > A.idx && x.status === 'todo');
      body = `<h2>${EXERCISES[it.id].name}</h2>
      ${later ? `<button class="btn xl" data-a="busy">${icon('clock')} Está ocupada: lo hago después</button>` : '<p class="muted small">Es el último ejercicio: si la máquina está ocupada, cámbialo por otro.</p>'}
      ${opts.length ? `<p class="eyebrow sw-title">O cámbialo por</p>
      <div class="swaps">${opts.map(id => swapBtn(id, 'swapTo', id === slot ? 'El de base' : EXERCISES[id].swapOnly ? 'Con tu peso, sin máquina' : '')).join('')}</div>
      <label class="toggle"><input type="checkbox" id="pinSwap"><span>Usar siempre el que elija (no rotar)</span></label>`
      : '<p class="muted small">Este ejercicio no tiene alternativas: forma parte de tu base de core y progresa por niveles.</p>'}`;
      break;
    }
    case 'spin':
      body = `<h2>Spinning hecho 🚴</h2>
      <p class="muted">¿Cómo ha sido?</p>
      <div class="seg-pick">${[['suave', 'Suave (zona 2)'], ['intenso', 'Intenso / intervalos']].map(([k, l]) => `<button class="${s.kind === k ? 'on' : ''}" data-a="spinKind" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="muted">¿Cómo está tu espalda? (0-10)</p>
      <div class="painpad sm">${[...Array(11)].map((_, i) => `<button class="pain p${i} ${s.pain === i ? 'on' : ''}" data-a="spinPain" data-v="${i}">${i}</button>`).join('')}</div>
      <p class="muted">Esfuerzo (1-10)</p>
      <div class="painpad sm rpe">${[...Array(10)].map((_, i) => `<button class="pain ${s.rpe === i + 1 ? 'on' : ''}" data-a="spinRpe" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
      <label class="note-in">Minutos<input data-f="spinMin" inputmode="numeric" value="${s.min || 45}"></label>
      <button class="btn primary xl" data-a="saveSpin" ${s.pain == null || s.rpe == null ? 'disabled' : ''}>Guardar</button>`;
      break;
    case 'session': {
      const ses = S.sessions[s.id];
      const sets = Object.values(S.sets).filter(x => x.sessionId === s.id).sort((a, b) => (a.doneAt || '').localeCompare(b.doneAt || ''));
      const byEx = {};
      for (const x of sets) (byEx[x.exId] = byEx[x.exId] || []).push(x);
      body = `<h2>${ses.type === 'spinning' ? 'Spinning' : P.TEMPLATES[ses.template]?.name || cap(ses.type)}</h2>
      <p class="muted">${fmtDate(ses.date)} · ${Math.round(ses.durationMin || 0)} min · espalda ${ses.painBefore ?? '–'}→${ses.painAfter ?? '–'} · esfuerzo ${ses.rpe ?? '–'}</p>
      ${ses.notes ? `<p>“${esc(ses.notes)}”</p>` : ''}
      <div class="detail">${Object.entries(byEx).map(([id, xs]) => `<div><b>${EXERCISES[id]?.name || id}</b><span>${xs.map(x => x.warmup ? `<i>aprox ${P.fmtKg(x.kg)}</i>` : x.kg != null ? `${P.fmtKg(x.kg)}×${x.reps ?? x.secs + 's'}` : x.reps != null ? `${x.reps}${x.secs ? '×' + x.secs + 's' : ''}` : `${x.secs}s`).join(' · ')}</span></div>`).join('') || '<p class="muted">Sin series registradas.</p>'}</div>
      <button class="btn danger sm" data-a="delSession" data-id="${s.id}">Borrar esta sesión</button>`;
      break;
    }
    case 'restart':
      body = `<h2>¿Reiniciar el programa?</h2><p class="muted">Vuelves a la semana 1 (adaptación). Tu historial y tus pesos se mantienen.</p>
      <button class="btn primary" data-a="restart">Sí, empezar desde hoy</button>`;
      break;
    case 'login':
      body = `<h2>Entrar</h2>${cloudBlock()}`;
      break;
  }
  return `<div class="sheet-bg" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${body}</div>`;
}

// ───────── manejadores ─────────
const val = f => app.querySelector(`[data-f="${f}"]`)?.value?.trim() ?? '';
const num = f => { const v = parseFloat(val(f).replace(',', '.')); return Number.isFinite(v) ? v : null; };

function updateSetting(id, patch) {
  S.settings[id] = { ...P.getSetting(S.settings, id), ...patch, updatedAt: new Date().toISOString(), updatedBy: 'app' };
  enqueue('setting', id);
}

const actions = {
  tab: d => { ui.tab = d.t; render(); scrollTo(0, 0); },
  goProfile: () => { ui.tab = 'perfil'; render(); },
  sheet: d => { ui.sheet = { type: d.s, id: d.id }; render(); },
  closeSheet: () => {
    if (ui.sheet?.type === 'feel' || ui.sheet?.type === 'finish') return; // obligatorio
    ui.sheet = null; render();
  },
  resume: () => { ui.inSession = true; unlockAudio(); acquireWake(); render(); },
  painGo: d => {
    const v = +d.v;
    const T = todayInfo();
    if (T.choice === 'movilidad') startSession('M', v, 'movilidad');
    else startSession(T.tpl, v, 'fuerza', T.plan.adj);
  },
  choose: d => {
    const k = P.todayISO();
    if (d.v) S.dayType[k] = d.v; else delete S.dayType[k];
    save(); render(); scrollTo(0, 0);
  },
  another: () => { ui.another = true; delete S.dayType[P.todayISO()]; save(); render(); },
  spinSheet: () => { ui.sheet = { type: 'spin', kind: todayInfo().plan.spin.kind }; render(); },
  spinKind: d => { ui.sheet.kind = d.v; ui.sheet.min = val('spinMin'); render(); },
  target: d => { S.prefs.targets = { ...C.targetsOf(S.prefs), [d.k]: +d.v }; save(); enqueue('profile', 'me'); render(); },
  gymDay: d => {
    const v = +d.v, cur = C.gymDaysOf(S.prefs);
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
    if (!next.length) { toast('Deja al menos un día'); return; }
    S.prefs.gymDays = next; save(); enqueue('profile', 'me'); render();
  },
  startCore: () => { unlockAudio(); startSession('X', null, 'core'); },
  toggleSet: d => {
    const A = S.active, it = A.items[A.idx], i = +d.i, s = it.sets[i];
    unlockAudio();
    if (s.done) { // deshacer
      s.done = false;
      if (s.logId) { delete S.sets[s.logId]; enqueue('set', s.logId, 'delete'); s.logId = null; }
      A.rest = null; save(); render(); return;
    }
    // marcar también las anteriores pendientes
    for (let j = 0; j < i; j++) if (!it.sets[j].done) logSet(it, j);
    logSet(it, i);
    beep(760, 0.08);
    afterSet(it);
  },
  step: d => {
    const A = S.active, it = A.items[A.idx], i = +d.i, s = it.sets[i], ex = EXERCISES[it.id];
    const dir = +d.d;
    if (d.f === 'kg') {
      const inc = ex.incKg || 2.5;
      const nv = Math.max(0, +((s.kg ?? 0) + dir * inc).toFixed(2));
      // propaga a las series siguientes no hechas (no a la aproximación)
      it.sets.forEach((x, j) => { if (j >= i && !x.done && !!x.warmup === !!s.warmup) x.kg = nv; });
    } else {
      s.reps = Math.max(0, (s.reps ?? 0) + dir);
    }
    save(); render();
  },
  startGuided: d => startGuided(+d.i),
  gPause: () => {
    const G = S.active.guided;
    if (G.paused) { G.stepEnd = Date.now() + G.pausedRem * 1000; G.paused = false; }
    else { G.pausedRem = Math.max(0, (G.stepEnd - Date.now()) / 1000); G.paused = true; }
    save(); render();
  },
  gStop: () => guidedDone(true),
  restAdd: d => { const R = S.active.rest; R.endAt += +d.d * 1000; R.total = Math.max(5, R.total + +d.d); save(); render(); },
  restSkip: () => { S.active.rest = null; save(); render(); },
  feel: d => {
    const A = S.active, it = A.items[A.idx];
    const back = document.getElementById('backFlag')?.checked;
    const st = P.getSetting(S.settings, it.id);
    const r = P.progress(it.id, st, it.sets, d.v, back, A.phase);
    S.settings[it.id] = { ...r.st, updatedAt: new Date().toISOString(), updatedBy: 'app' };
    enqueue('setting', it.id);
    A.results[it.id] = { msg: r.msg, dir: r.dir || null, feel: d.v, back: !!back };
    it.status = 'done';
    ui.sheet = null;
    save();
    if (r.msg) { ui.toast = { msg: r.msg, kind: r.dir || '', id: Date.now() }; const id = ui.toast.id; setTimeout(() => { if (ui.toast?.id === id) { ui.toast = null; render(); } }, 2600); }
    advance();
  },
  swapTo: d => {
    const A = S.active, it = A.items[A.idx];
    const pin = document.getElementById('pinSwap')?.checked;
    const slot = it.slot || SLOT_OF[it.id] || it.id;
    const work = it.sets.filter(x => !x.warmup);
    const doneWork = work.filter(x => x.done).length;
    const nw = P.buildItem(d.id, { slot, g: it.g, phase: A.phase, settings: S.settings, mode: A.mode, adj: A.adj, nSets: Math.max(1, work.length - doneWork), first: it.sets.some(x => x.warmup && !x.done) });
    if (it.sets.some(x => x.done)) { it.status = 'done'; A.items.splice(A.idx + 1, 0, nw); A.idx += 1; } // lo hecho se queda guardado
    else A.items[A.idx] = nw;
    if (pin) updateSetting(slot, { swapTo: d.id });
    A.rest = null; A.guided = null; ui.sheet = null; save();
    toast(pin ? `Cambiado y fijado: ${EXERCISES[d.id].name}` : `Cambiado: ${EXERCISES[d.id].name}`);
    render(); scrollTo(0, 0);
  },
  pin: d => { updateSetting(d.slot, { swapTo: d.id }); save(); toast('Fijado: la app usará siempre este'); render(); },
  unpin: d => { updateSetting(d.id, { swapTo: null }); save(); toast('Vuelve a la rotación automática'); render(); },
  busy: () => {
    ui.sheet = null;
    const A = S.active;
    const cur = A.items[A.idx];
    const nextTodo = A.items.findIndex((x, k) => k > A.idx && x.status === 'todo');
    if (nextTodo < 0) { toast('Es el último: espera un poco o sáltalo'); return; }
    A.items.splice(A.idx, 1);
    A.items.splice(nextTodo, 0, cur); // queda justo después del siguiente
    A.rest = null; A.guided = null;
    save(); toast('Lo hacemos en cuanto se libere');
  },
  skipEx: () => { const A = S.active; A.items[A.idx].status = 'skipped'; A.rest = null; A.guided = null; advance(); },
  jump: d => { const A = S.active; const k = +d.i; if (A.items[k].status !== 'todo') A.items[k].status = 'todo'; A.idx = k; A.rest = null; A.guided = null; ui.sheet = null; save(); render(); scrollTo(0, 0); },
  express: () => {
    const A = S.active;
    const p = projection();
    const budget = P.MAX_MIN * 60 - p.elapsed - 30;
    const todo = A.items.filter(i => i.status === 'todo').map(it => ({ ...it, sets: it.sets.filter(s => !s.done), ref: it }));
    P.fitToTime(todo, budget);
    for (const t of todo) { const keep = new Set(t.sets); t.ref.sets = t.ref.sets.filter(s => s.done || keep.has(s)); }
    A.expressDone = true; save(); toast('Ajustado: quitamos series de los últimos ejercicios');
  },
  techToggle: (d, el, e) => { e.preventDefault(); S.active.techOpen = !S.active.techOpen; save(); render(); },
  pauseSession: () => { ui.inSession = false; ui.sheet = null; releaseWake(); render(); },
  endNow: () => { ui.sheet = { type: 'finish' }; render(); },
  discard: () => { if (confirm('¿Seguro? Se borrará esta sesión.')) discardSession(); },
  finPain: d => { ui.sheet.pain = +d.v; ui.sheet.notes = val('notes'); render(); },
  finRpe: d => { ui.sheet.rpe = +d.v; ui.sheet.notes = val('notes'); render(); },
  finish: () => { const s = ui.sheet; finishSession(s.pain, s.rpe, val('notes')); },
  closeSummary: () => { ui.summary = null; ui.another = false; ui.tab = 'hoy'; render(); scrollTo(0, 0); },
  saveNote: d => { updateSetting(d.id, { note: val('mnote') }); ui.sheet = null; save(); toast('Ajuste guardado'); },
  saveKg: d => { const v = num('kgset'); if (v == null) return; updateSetting(d.id, { kg: v }); ui.sheet = null; save(); toast('Peso actualizado'); },
  spinPain: d => { ui.sheet.pain = +d.v; ui.sheet.min = val('spinMin'); render(); },
  spinRpe: d => { ui.sheet.rpe = +d.v; ui.sheet.min = val('spinMin'); render(); },
  saveSpin: () => {
    const s = ui.sheet, id = uid(), now = new Date();
    const min = num('spinMin') || 45;
    S.sessions[id] = { id, date: P.todayISO(), type: 'spinning', spinKind: s.kind || 'suave', status: 'done', painBefore: s.pain, painAfter: s.pain, rpe: s.rpe, startedAt: new Date(now - min * 6e4).toISOString(), finishedAt: now.toISOString(), durationMin: min, summary: { spinKind: s.kind || 'suave' } };
    enqueue('session', id); save(); ui.sheet = null; ui.another = false; toast('Spinning guardado 🚴'); render();
  },
  chartEx: d => { ui.chartEx = d.id; render(); },
  copyReport: async () => {
    const t = buildReport();
    try { await navigator.clipboard.writeText(t); toast('Resumen copiado. Pégalo en Claude.'); }
    catch (e) { prompt('Copia este texto:', t); }
  },
  openEx: d => { ui.ex = d.id; render(); scrollTo(0, 0); },
  closeEx: () => { ui.ex = null; render(); },
  delSession: d => {
    if (!confirm('¿Borrar esta sesión del historial?')) return;
    for (const x of Object.values(S.sets)) if (x.sessionId === d.id) { delete S.sets[x.id]; }
    delete S.sessions[d.id]; enqueue('session', d.id, 'delete'); // las series se borran en cascada
    S.queue = S.queue.filter(q => !(q.kind === 'set' && !S.sets[q.key] && q.op !== 'delete'));
    save(); ui.sheet = null; render();
  },
  readNote: d => { const n = S.notes.find(x => x.id === d.id); if (n) { n.readAt = new Date().toISOString(); enqueue('note', n.id); save(); render(); } },
  onboard: () => {
    const name = val('name');
    if (!name) { toast('Pon tu nombre'); return; }
    S.profile = { name, birthYear: num('birthYear'), heightCm: num('heightCm'), weightKg: num('weightKg'), backNotes: val('backNotes'), startDate: P.todayISO() };
    if (S.profile.weightKg) { const id = uid(); S.metrics[id] = { id, date: P.todayISO(), kg: S.profile.weightKg }; enqueue('metric', id); }
    enqueue('profile', 'me'); save(); render();
  },
  saveProfile: () => {
    Object.assign(S.profile, { name: val('name') || S.profile.name, birthYear: num('birthYear'), heightCm: num('heightCm'), backNotes: val('backNotes') });
    enqueue('profile', 'me'); save(); toast('Guardado');
  },
  saveWeight: () => {
    const kg = num('todayKg'); if (!kg) return;
    const d = P.todayISO();
    let m = Object.values(S.metrics).find(x => x.date === d);
    if (!m) { m = { id: uid(), date: d }; S.metrics[m.id] = m; }
    m.kg = kg; S.profile.weightKg = kg;
    enqueue('metric', m.id); enqueue('profile', 'me'); save(); toast('Peso registrado'); render();
  },
  pref: (d, el) => { S.prefs[d.k] = el.checked; save(); enqueue('profile', 'me'); },
  restart: () => { S.profile.startDate = P.todayISO(); enqueue('profile', 'me'); save(); ui.sheet = null; toast('Programa reiniciado: semana 1'); },
  export: () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `app-gym-${P.todayISO()}.json`; a.click();
  },
  login: async () => { await authCall(() => signIn(val('email'), val('pw')), 'Conectado'); },
  signup: async () => {
    const pw = val('pw');
    if (pw.length < 8) { toast('La contraseña debe tener al menos 8 caracteres'); return; }
    await authCall(async () => { const r = await signUp(val('email'), pw); if (r === 'confirm') { toast('Te he enviado un email: confírmalo y vuelve a entrar'); return true; } }, 'Cuenta creada');
  },
  forgot: async () => { const e = val('email'); if (!e) { toast('Escribe tu email arriba'); return; } await authCall(() => resetPassword(e), 'Te he enviado un email para cambiarla'); },
  logout: async () => { await signOut(); render(); },
  syncNow: async () => { await sync(); toast(cloud.status === 'ok' ? 'Todo guardado en la nube' : cloud.status === 'offline' ? 'Sin conexión' : 'Sincronización: ' + cloud.status); },
  setPw: async () => { const pw = val('newpw'); if (pw.length < 8) { toast('Mínimo 8 caracteres'); return; } await authCall(() => updatePassword(pw), 'Contraseña cambiada'); },
};

async function authCall(fn, okMsg) {
  if (ui.busy) return;
  ui.busy = true;
  try { const skip = await fn(); if (!skip) { ui.sheet = null; toast(okMsg); } }
  catch (e) { toast(traducir(e.message || String(e)), 'down'); }
  finally { ui.busy = false; }
}
function traducir(m) {
  if (/Invalid login/i.test(m)) return 'Email o contraseña incorrectos';
  if (/already registered/i.test(m)) return 'Ese email ya tiene cuenta: usa Entrar';
  if (/Email not confirmed/i.test(m)) return 'Confirma primero el email que te enviamos';
  if (/rate limit/i.test(m)) return 'Demasiados intentos, espera un minuto';
  return m;
}

app.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.dataset.a !== 'pref') return;
  const fn = actions[el.dataset.a];
  if (fn) fn(el.dataset, el, e);
});

// ───────── arranque ─────────
onCloud(() => { if (!ui.sheet || ui.sheet.type === 'login') render(); });
initCloud();
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin SW */ });
}
