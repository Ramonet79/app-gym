// Programa: plantillas, calendario semanal, fases, construcción de sesión y progresión.
import { EXERCISES, ALTERNATIVES, MAIN_LIFTS, optionsFor } from './exercises.js';

export const MAX_MIN = 45;

export const TEMPLATES = {
  A: {
    name: 'Fuerza A', subtitle: 'Pecho, remo y hombro',
    blocks: [
      { g: 'warm', items: ['eliptica', 'gato_camello'] },
      { g: 'core', items: ['bird_dog', 'plancha_lateral', 'curl_up'] },
      { g: 'fuerza', items: ['press_pecho', 'remo_pecho', 'press_hombro', 'face_pull'] },
      { g: 'calma', items: ['caminar'] },
    ],
  },
  B: {
    name: 'Fuerza B', subtitle: 'Dorsal, pecho inclinado y remo',
    blocks: [
      { g: 'warm', items: ['eliptica', 'gato_camello'] },
      { g: 'core', items: ['dead_bug', 'pallof', 'puente'] },
      { g: 'fuerza', items: ['jalon', 'press_inclinado', 'remo_polea', 'pec_deck'] },
      { g: 'calma', items: ['caminar'] },
    ],
  },
  C: {
    name: 'Fuerza C', subtitle: 'Remo, pecho, hombro y brazos',
    blocks: [
      { g: 'warm', items: ['eliptica', 'gato_camello'] },
      { g: 'core', items: ['plancha_frontal', 'bird_dog', 'carry'] },
      { g: 'fuerza', items: ['remo_pecho', 'press_pecho', 'elev_laterales', 'curl_maquina', 'triceps_polea'] },
      { g: 'calma', items: ['caminar'] },
    ],
  },
  M: { // modo protección (dolor ≥5): solo movilidad y core suave
    name: 'Movilidad y core suave', subtitle: 'Día de protección de la espalda',
    blocks: [
      { g: 'warm', items: ['eliptica', 'gato_camello'] },
      { g: 'core', items: ['bird_dog', 'curl_up', 'puente'] },
      { g: 'calma', items: ['caminar'] },
    ],
  },
  X: { // core exprés para días de spinning
    name: 'Core exprés', subtitle: '6 minutos después del spinning',
    blocks: [{ g: 'core', items: ['bird_dog', 'curl_up', 'plancha_lateral'] }],
  },
};

// getDay(): 0 domingo … 6 sábado
export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// ───── fechas ─────
export const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const todayISO = () => iso(new Date());
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
export function weekDates(d = new Date()) { const m = mondayOf(d); return [...Array(7)].map((_, i) => { const x = new Date(m); x.setDate(m.getDate() + i); return x; }); }

// La fase del programa y la recomendación diaria están en coach.js (dependen del histórico real).

export function nextStrengthTemplate(sessions) {
  const done = Object.values(sessions).filter(s => s.type === 'fuerza' && s.status === 'done' && 'ABC'.includes(s.template))
    .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));
  const last = done.at(-1)?.template;
  return last === 'A' ? 'B' : last === 'B' ? 'C' : 'A';
}

// ───── estado por ejercicio ─────
export function defaultSetting(ex) {
  const lv = ex.levels?.[0];
  return {
    kg: ex.startKg ?? null,
    reps: ex.kind === 'holdreps' ? (lv?.reps ?? ex.reps) : Array.isArray(ex.reps) ? ex.reps[1] : ex.reps ?? null,
    hold: ex.kind === 'hold' || ex.kind === 'holdreps' ? (lv?.hold ?? ex.hold) : ex.kind === 'carry' ? ex.secs : null,
    level: 0, backFlags: 0, hardStreak: 0, note: '', disabled: false, swapTo: null, calibrated: false,
  };
}
export function getSetting(settings, id) {
  return { ...defaultSetting(EXERCISES[id]), ...(settings[id] || {}) };
}

const roundTo = (v, step) => Math.round(v / step) * step;

// ───── variantes ─────
// block 0 = semanas 1-8 (máquinas base), luego cambia cada 6 semanas.
// Principales cambian cada 2 bloques; accesorios, cada bloque. Una variante fijada por el usuario (swapTo) manda.
export function variantFor(slot, block = 0, settings = {}, used = new Set()) {
  const pinned = settings[slot]?.swapTo;
  if (pinned && EXERCISES[pinned] && !used.has(pinned)) return pinned;
  const opts = optionsFor(slot).filter(id => !EXERCISES[id].swapOnly && !settings[id]?.disabled); // swapOnly: solo como recambio
  if (!opts.length) return slot;
  const step = MAIN_LIFTS.has(slot) ? Math.floor(block / 2) : block;
  for (let i = 0; i < opts.length; i++) {
    const id = opts[(step + i) % opts.length];
    if (!used.has(id)) return id;
  }
  return slot;
}
export const hasAlternatives = slot => !!ALTERNATIVES[slot];

// ───── construcción de sesión ─────
// mode: normal | suave (dolor 3-4) | proteccion (≥5)
// adj: ajuste del entrenador según días sin entrenar { load, maxSets }. Los recortes no se multiplican: manda el más prudente.
export function buildSession(tplKey, { phase, settings, mode = 'normal', adj = null, budgetMin = MAX_MIN }) {
  const tpl = TEMPLATES[mode === 'proteccion' ? 'M' : tplKey];
  const items = [];
  const used = new Set();
  for (const b of tpl.blocks) {
    for (const slot of b.items) {
      const id = ALTERNATIVES[slot] ? variantFor(slot, phase.block || 0, settings, used) : (settings[slot]?.swapTo && EXERCISES[settings[slot].swapTo] ? settings[slot].swapTo : slot);
      const st = getSetting(settings, id);
      if (st.disabled) continue;
      used.add(id);
      if (mode === 'suave' && st.backFlags >= 2) continue;
      const first = EXERCISES[id].group === 'fuerza' && !items.some(i => EXERCISES[i.id].group === 'fuerza');
      items.push(buildItem(id, { slot, g: b.g, phase, settings, mode, adj, first }));
    }
  }
  const lim = (budgetMin - 1) * 60, ctx = { phase, settings, mode, adj };
  if (budgetMin > MAX_MIN) adaptToTime(items, lim, ctx); // con más tiempo se amplía; con 45' o menos solo se recorta
  else if (remainingEstimate(items) > lim) fitToTime(items, lim);
  const out = items.filter(it => !it.trimmed);
  return { template: mode === 'proteccion' ? 'M' : tplKey, items: out };
}

// Un ejercicio con sus series. nSets fuerza el número de series de trabajo (al cambiar de ejercicio a mitad de sesión).
export function buildItem(id, { slot = id, g, phase, settings, mode = 'normal', adj = null, first = false, nSets: forced = null }) {
  const ex = EXERCISES[id];
  const st = getSetting(settings, id);
  let nSets = ex.kind === 'time' ? 1 : ex.group === 'fuerza' ? Math.min(ex.sets ?? 3, phase.sets) : (ex.sets ?? 2);
  if (mode !== 'normal') nSets = Math.min(nSets, 2);
  if (adj?.maxSets && ex.group === 'fuerza') nSets = Math.min(nSets, adj.maxSets);
  if (forced) nSets = forced;
  let kg = st.kg;
  if (kg != null && ex.kind === 'reps') {
    const mul = Math.min(phase.load, mode === 'suave' ? 0.8 : 1, adj?.load ?? 1);
    kg = roundTo(ex.assist ? kg / mul : kg * mul, ex.incKg || 2.5); // en asistida, más ayuda = más fácil
  }
  const rest = ex.kind === 'time' ? 0 : (ex.rest ?? 60);
  const sets = [];
  // serie de aproximación en el primer ejercicio de fuerza (en asistida: con más ayuda)
  if (first && kg) sets.push({ warmup: true, kg: roundTo(kg * (ex.assist ? 1.4 : 0.5), ex.incKg || 2.5), reps: 10, done: false });
  for (let i = 0; i < nSets; i++) {
    sets.push({ kg, reps: ex.kind === 'reps' ? (Array.isArray(ex.reps) ? ex.reps[1] : ex.reps) : st.reps, hold: st.hold, done: false });
  }
  return { id, slot, g: g || ex.group, sets, rest: mode === 'normal' && phase.key === 'adapt' && rest > 60 ? 60 : rest, status: 'todo' };
}

export function estimateItem(it) {
  const ex = EXERCISES[it.id];
  const sets = it.sets.filter(s => !s.skipped);
  const n = sets.length;
  const side = ex.perSide ? 2 : 1;
  let work = 0;
  for (const s of sets) {
    if (ex.kind === 'time') work += (s.mins || ex.minutes || 2) * 60;
    else if (ex.kind === 'hold') work += (s.hold || 20) * side + (side > 1 ? 5 : 0);
    else if (ex.kind === 'holdreps') work += (s.reps || 5) * ((s.hold || 8) + 2) * side + (side > 1 ? 5 : 0);
    else if (ex.kind === 'carry') work += (s.hold || 30) * 2 + 10;
    else work += (s.reps || 10) * 3.5 * side;
  }
  const rests = Math.max(0, n - 1) * (it.rest || 0);
  return work + rests + 35; // 35 s de transición/ajuste de máquina
}

// ───── ajuste al tiempo disponible ─────
// Trabaja sobre la lista completa de la sesión: solo toca lo pendiente (status 'todo' y series sin hacer).
// Sirve para preparar la sesión y para recalcular en vivo según el ritmo real.
const pendingSets = it => it.sets.filter(s => !s.done && !s.skipped);
export function remainingEstimate(items) {
  return items.filter(it => it.status === 'todo').reduce((a, it) => {
    const left = { ...it, sets: pendingSets(it) };
    return a + (left.sets.length ? estimateItem(left) : 0);
  }, 0);
}
export const estimateTotal = items => items.reduce((a, it) => a + estimateItem(it), 0);
const isMainSlot = it => MAIN_LIFTS.has(it.slot || it.id);
const workLeft = it => it.sets.filter(s => !s.warmup && !s.done && !s.skipped);
const workAll = it => it.sets.filter(s => !s.warmup && !s.skipped);

export function adaptToTime(items, limitSec, ctx, pace = 1) {
  const need = () => remainingEstimate(items) * pace;
  if (need() > limitSec) return fitToTime(items, limitSec, pace);
  return expandToTime(items, limitSec, ctx, pace);
}

// Recorta por prioridades: 1) lo añadido por tener tiempo extra, 2) series hasta el mínimo eficaz,
// 3) accesorios enteros (desde el final), 4) calentamiento y vuelta a la calma más cortos. Lo principal y el core McGill se mantienen.
export function fitToTime(items, limitSec, pace = 1) {
  const need = () => remainingEstimate(items) * pace;
  const log = { sets: 0, items: [] };
  const todo = () => items.filter(it => it.status === 'todo');
  const dropItem = it => { it.status = 'skipped'; it.trimmed = true; log.items.push(it.id); };
  const dropSet = it => { const s = [...it.sets].reverse().find(s => !s.warmup && !s.done && !s.skipped); if (!s) return false; s.skipped = true; s.trimmed = true; log.sets++; return true; };
  let g = 0;
  // 1) extras: cardio final más corto o fuera, luego ejercicios extra y series extra
  for (const it of [...todo()].reverse()) {
    if (need() <= limitSec) break;
    if (!it.extra) continue;
    const ex = EXERCISES[it.id];
    if (ex.kind === 'time' && !it.sets.some(s => s.done)) {
      const over = Math.ceil((need() - limitSec) / 60 / pace);
      const s0 = it.sets[0], m = (s0.mins || ex.minutes) - over;
      if (m >= 6) { s0.mins = m; continue; }
    }
    if (!it.sets.some(s => s.done)) dropItem(it);
  }
  while (need() > limitSec && g++ < 60) { const c = [...todo()].reverse().find(it => it.sets.some(s => s.added && !s.done && !s.skipped)); if (!c) break; const s = [...c.sets].reverse().find(s => s.added && !s.done && !s.skipped); s.skipped = true; s.trimmed = true; log.sets++; }
  // 2) series hasta el mínimo (fuerza 2, core 1); accesorios primero
  const order = () => [...todo()].reverse().sort((a, b) => isMainSlot(a) - isMainSlot(b));
  while (need() > limitSec && g++ < 120) {
    const c = order().find(it => (it.g === 'fuerza' || it.g === 'core') && workLeft(it).length && workAll(it).length > (it.g === 'core' ? 1 : 2));
    if (!c || !dropSet(c)) break;
  }
  // 3) accesorios enteros
  for (const it of [...todo()].reverse()) {
    if (need() <= limitSec) break;
    if (it.g === 'fuerza' && !isMainSlot(it) && !it.sets.some(s => s.done)) dropItem(it);
  }
  // 4) calentamiento y calma más cortos
  for (const it of todo()) {
    if (need() <= limitSec) break;
    const ex = EXERCISES[it.id];
    if (ex.kind === 'time' && (it.g === 'warm' || it.g === 'calma') && !it.sets[0].done) { const s0 = it.sets[0]; s0.mins = Math.max(it.g === 'warm' ? 2 : 1, (s0.mins || ex.minutes) - 2); }
  }
  // 5) principales a 2 series y core a 1 (último recurso)
  while (need() > limitSec && g++ < 160) {
    const c = [...todo()].reverse().find(it => (it.g === 'fuerza' || it.g === 'core') && workLeft(it).length && workAll(it).length > 1 && (it.g === 'core' || workAll(it).length > 2));
    if (!c || !dropSet(c)) break;
  }
  for (const it of items) it.sets = it.sets.filter(s => !s.trimmed || s.done);
  const changed = log.sets > 0 || log.items.length > 0;
  return { changed, dir: 'down', text: [log.sets ? `−${log.sets} ${log.sets > 1 ? 'series' : 'serie'}` : '', namesText(log.items, 'quito')].filter(Boolean).join(' y ') };
}

// Amplía con criterio cuando sobra tiempo: 1) una serie más en los principales (máx. 4),
// 2) accesorios que equilibran (hombro posterior, brazos, laterales, core), 3) cardio suave en zona 2 al final.
const namesText = (ids, verb) => !ids.length ? '' : ids.length <= 2 ? `${verb} ${ids.map(id => EXERCISES[id].name.toLowerCase()).join(' y ')}` : `${verb} ${ids.length} ejercicios`;
const EXTRA_POOL = ['face_pull', 'curl_maquina', 'triceps_polea', 'elev_laterales', 'pec_deck', 'pallof'];
export function expandToTime(items, limitSec, { phase, settings, mode = 'normal', adj = null }, pace = 1, maxAdds = Infinity) {
  const need = () => remainingEstimate(items) * pace;
  const log = { sets: 0, items: [], back: [] };
  let adds = 0;
  const fits = extra => adds < maxAdds && need() + extra * pace <= limitSec;
  // 0) recupera lo que se quitó antes por ir justo
  for (const it of items) {
    if (!(it.trimmed && it.status === 'skipped' && !it.sets.some(s => s.done))) continue;
    if (!fits(estimateItem(it))) continue;
    it.status = 'todo'; it.trimmed = false; adds++; log.back.push(it.id);
  }
  const strengthOk = mode === 'normal' && !adj?.hold && !phase.hold;
  const insertAt = () => { const k = items.findIndex(it => it.g === 'calma' && it.status === 'todo'); return k < 0 ? items.length : k; };
  if (strengthOk) {
    // 1) series extra en principales
    for (const it of items.filter(it => it.status === 'todo' && it.g === 'fuerza' && isMainSlot(it))) {
      const ex = EXERCISES[it.id];
      if (workAll(it).length >= (phase.key === 'adapt' ? 3 : 4)) continue;
      const proto = workAll(it).at(-1) || it.sets.at(-1);
      const cost = (Array.isArray(ex.reps) ? ex.reps[1] : ex.reps || 10) * 3.5 * (ex.perSide ? 2 : 1) + (it.rest || 60);
      if (!proto || !fits(cost + 60)) continue;
      it.sets.push({ ...proto, done: false, skipped: false, trimmed: false, added: true, warmup: false });
      log.sets++; adds++;
    }
    // 2) accesorios
    const used = new Set(items.map(it => it.id));
    let added = 0;
    for (const slot of EXTRA_POOL) {
      if (added >= 3) break;
      const ex0 = EXERCISES[slot];
      if (items.some(it => (it.slot || it.id) === slot)) continue;
      const id = ALTERNATIVES[slot] ? variantFor(slot, phase.block || 0, settings, used) : slot;
      if (used.has(id) || settings[id]?.disabled) continue;
      const it = buildItem(id, { slot, g: ex0.group === 'core' ? 'core' : 'fuerza', phase, settings, mode, adj, nSets: Math.min(phase.sets, 3) });
      if (!fits(estimateItem(it) + 90)) continue;
      it.extra = true; items.splice(insertAt(), 0, it); used.add(id); added++; adds++; log.items.push(id);
    }
  }
  // 3) cardio suave al final (también en días suaves)
  if (!items.some(it => it.id === 'cardio_z2' && it.status === 'todo')) {
    const spare = (limitSec - need()) / pace / 60;
    if (spare >= 8 && adds < maxAdds) {
      const mins = Math.min(30, Math.floor(spare - 1.5));
      const it = buildItem('cardio_z2', { g: 'cardio', phase, settings, mode });
      it.sets[0].mins = mins; it.extra = true;
      items.splice(insertAt(), 0, it); log.items.push('cardio_z2');
    }
  }
  const changed = log.sets > 0 || log.items.length > 0 || log.back.length > 0;
  return { changed, dir: 'up', text: [namesText(log.back, 'recupero'), log.sets ? `+${log.sets} ${log.sets > 1 ? 'series' : 'serie'} en los principales` : '', namesText(log.items, 'añado')].filter(Boolean).join(' y ') };
}

// ───── progresión ─────
// feel: facil | bien | duro · back: true si hubo molestia lumbar
export function progress(id, st, sets, feel, back, phase) {
  const ex = EXERCISES[id];
  const s = { ...st };
  const work = sets.filter(x => x.done && !x.warmup);
  const msg = [];
  if (!work.length) return { st: s, msg: '' };
  s.calibrated = true;
  if (ex.kind === 'reps' && !ex.bodyweight) {
    const used = work.at(-1).kg ?? s.kg;
    if (used != null && !phase.hold) s.kg = used;
  }
  if (back) {
    s.backFlags = (s.backFlags || 0) + 1;
    if (s.kg) { s.kg = roundTo(s.kg * 0.9, ex.incKg || 2.5); }
    msg.push(s.backFlags >= 2 ? 'Molestia repetida: este ejercicio queda en vigilancia y en días suaves se salta.' : 'Bajamos un 10 % por la molestia. Vigila la técnica.');
    s.hardStreak = 0;
    return { st: s, msg: msg.join(' '), dir: 'down' };
  }
  s.backFlags = Math.max(0, (s.backFlags || 0) - 1);
  if (phase.hold) return { st: s, msg: phase.key === 'deload' ? 'Semana de descarga: mantenemos tus pesos.' : 'Sesión ajustada: tus pesos de referencia se mantienen.' };

  if (ex.kind === 'reps') {
    const [lo, hi] = Array.isArray(ex.reps) ? ex.reps : [ex.reps, ex.reps];
    const allTop = work.every(x => (x.reps ?? 0) >= hi);
    const anyLow = work.some(x => (x.reps ?? 0) < lo);
    if (ex.bodyweight) {
      if (allTop && feel !== 'duro') msg.push('Muy bien. Próxima vez, más lento y controlado.');
      return { st: s, msg: msg.join(' ') };
    }
    if (ex.assist) { // el peso es ayuda: progresar = quitar kilos
      if (allTop && feel !== 'duro') { s.kg = Math.max(0, +(s.kg - ex.incKg).toFixed(2)); s.hardStreak = 0; return { st: s, msg: `Próxima vez: ${fmtKg(s.kg)} kg de ayuda 💪`, dir: 'up' }; }
      if (anyLow || feel === 'duro') {
        s.hardStreak = (s.hardStreak || 0) + 1;
        if (s.hardStreak >= 2 && anyLow) { s.kg = +(s.kg + ex.incKg).toFixed(2); s.hardStreak = 0; return { st: s, msg: `Subimos la ayuda a ${fmtKg(s.kg)} kg para hacerlo con técnica limpia.`, dir: 'down' }; }
        return { st: s, msg: `Mantenemos ${fmtKg(s.kg)} kg de ayuda.` };
      }
      s.hardStreak = 0;
      return { st: s, msg: `Mantén ${fmtKg(s.kg)} kg de ayuda y busca ${hi} reps en todas las series.` };
    }
    if (allTop && feel !== 'duro') {
      s.kg = +(s.kg + (ex.incKg || 2.5)).toFixed(2); s.hardStreak = 0;
      return { st: s, msg: `Próxima vez: ${fmtKg(s.kg)} kg 💪`, dir: 'up' };
    }
    if (anyLow || feel === 'duro') {
      s.hardStreak = (s.hardStreak || 0) + 1;
      if (s.hardStreak >= 2 && anyLow) { s.kg = Math.max(0, +(s.kg - (ex.incKg || 2.5)).toFixed(2)); s.hardStreak = 0; return { st: s, msg: `Bajamos a ${fmtKg(s.kg)} kg para hacerlo con técnica limpia.`, dir: 'down' }; }
      return { st: s, msg: `Mantenemos ${fmtKg(s.kg)} kg.` };
    }
    s.hardStreak = 0;
    return { st: s, msg: `Mantén ${fmtKg(s.kg)} kg y busca ${hi} reps en todas las series.` };
  }
  if (ex.kind === 'hold') {
    const ok = work.every(x => (x.hold ?? 0) >= (s.hold ?? 0));
    if (ok && feel === 'facil') {
      const max = ex.maxHold || 40;
      if (s.hold + 5 <= max) { s.hold += 5; return { st: s, msg: `Próxima vez: ${s.hold} s`, dir: 'up' }; }
      if (ex.levels && s.level < ex.levels.length - 1) { s.level++; s.hold = ex.levels[s.level].hold; return { st: s, msg: `¡Subes de nivel! ${ex.levels[s.level].name}`, dir: 'up' }; }
    }
    return { st: s, msg: `Mantenemos ${s.hold} s.` };
  }
  if (ex.kind === 'holdreps') {
    if (feel === 'facil' && ex.levels && s.level < ex.levels.length - 1) {
      s.level++; s.reps = ex.levels[s.level].reps; s.hold = ex.levels[s.level].hold;
      return { st: s, msg: `¡Subes de nivel! ${ex.levels[s.level].name}: ${s.reps} × ${s.hold} s`, dir: 'up' };
    }
    return { st: s, msg: 'Mantenemos. Calidad antes que cantidad.' };
  }
  if (ex.kind === 'carry') {
    if (feel === 'facil') { s.kg = +((s.kg || 0) + (ex.incKg || 2)).toFixed(1); return { st: s, msg: `Próxima vez: ${fmtKg(s.kg)} kg`, dir: 'up' }; }
    return { st: s, msg: `Mantenemos ${fmtKg(s.kg)} kg.` };
  }
  return { st: s, msg: '' };
}

export const fmtKg = v => v == null ? '–' : (Math.round(v * 10) / 10).toString().replace('.', ',');
export const fmtMin = sec => `${Math.round(sec / 60)} min`;
export function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; }

export function targetText(id, set) {
  const ex = EXERCISES[id];
  const side = ex.perSide ? ' por lado' : '';
  if (ex.kind === 'time') return `${set?.mins || ex.minutes} min`;
  if (ex.kind === 'hold') return `${set.hold} s${side}`;
  if (ex.kind === 'holdreps') return `${set.reps} × ${set.hold} s${side}`;
  if (ex.kind === 'carry') return `${set.hold} s por mano`;
  const r = Array.isArray(ex.reps) ? (ex.reps[0] === ex.reps[1] ? ex.reps[0] : `${ex.reps[0]}-${ex.reps[1]}`) : ex.reps;
  return `${r} reps${side}`;
}

// Secuencia guiada (temporizador con voz) para ejercicios de tiempo
export function guidedSteps(id, set) {
  const ex = EXERCISES[id];
  const sides = ex.perSide || ex.kind === 'carry' ? (ex.sideLabels || ['Lado derecho', 'Lado izquierdo']) : [null];
  const steps = [];
  if (ex.kind === 'time') return [{ label: ex.name, sub: ex.group === 'cardio' ? 'Zona 2: puedes hablar' : 'Ritmo suave', secs: (set?.mins || ex.minutes || 2) * 60, work: true }];
  sides.forEach((side, si) => {
    if (si > 0) steps.push({ label: 'Cambia de lado', sub: side, secs: 5, work: false, say: 'Cambia de lado' });
    if (ex.kind === 'hold' || ex.kind === 'carry') steps.push({ label: side || 'Aguanta', sub: ex.kind === 'carry' ? 'Camina erguido' : 'Aguanta', secs: set.hold, work: true, say: si === 0 ? 'Empezamos' : null });
    if (ex.kind === 'holdreps') {
      for (let r = 1; r <= set.reps; r++) {
        steps.push({ label: `Rep ${r} de ${set.reps}`, sub: side || 'Aguanta arriba', secs: set.hold, work: true, say: r === 1 ? (side || 'Empezamos') : String(r) });
        if (r < set.reps) steps.push({ label: 'Baja y respira', sub: side || '', secs: 2, work: false });
      }
    }
  });
  return steps;
}

// Unidad del peso según el ejercicio
export const kgUnit = ex => ex.assist ? 'kg ayuda' : ex.perHand ? 'kg c/u' : 'kg';
