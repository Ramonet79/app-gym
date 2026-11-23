// Programa: plantillas, calendario semanal, fases, construcción de sesión y progresión.
import { EXERCISES } from './exercises.js';

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

// ───── construcción de sesión ─────
// mode: normal | suave (dolor 3-4) | proteccion (≥5)
// adj: ajuste del entrenador según días sin entrenar { load, maxSets }. Los recortes no se multiplican: manda el más prudente.
export function buildSession(tplKey, { phase, settings, mode = 'normal', adj = null }) {
  const tpl = TEMPLATES[mode === 'proteccion' ? 'M' : tplKey];
  const items = [];
  for (const b of tpl.blocks) {
    for (let id of b.items) {
      let st = getSetting(settings, id);
      if (st.swapTo && EXERCISES[st.swapTo]) { id = st.swapTo; st = getSetting(settings, id); }
      if (st.disabled) continue;
      if (mode === 'suave' && st.backFlags >= 2) continue;
      const ex = EXERCISES[id];
      let nSets = ex.kind === 'time' ? 1 : ex.group === 'fuerza' ? Math.min(ex.sets ?? 3, phase.sets) : (ex.sets ?? 2);
      if (mode !== 'normal') nSets = Math.min(nSets, 2);
      if (adj?.maxSets && ex.group === 'fuerza') nSets = Math.min(nSets, adj.maxSets);
      let kg = st.kg;
      if (kg != null && ex.kind === 'reps') {
        const mul = Math.min(phase.load, mode === 'suave' ? 0.8 : 1, adj?.load ?? 1);
        kg = roundTo(kg * mul, ex.incKg || 2.5);
      }
      const rest = ex.kind === 'time' ? 0 : (ex.rest ?? 60);
      const sets = [];
      // serie de aproximación en el primer ejercicio de fuerza
      if (ex.group === 'fuerza' && !items.some(i => EXERCISES[i.id].group === 'fuerza') && kg) {
        sets.push({ warmup: true, kg: roundTo(kg * 0.5, ex.incKg || 2.5), reps: 10, done: false });
      }
      for (let i = 0; i < nSets; i++) {
        sets.push({ kg, reps: ex.kind === 'reps' ? (Array.isArray(ex.reps) ? ex.reps[1] : ex.reps) : st.reps, hold: st.hold, done: false });
      }
      items.push({ id, g: b.g, sets, rest: mode === 'normal' && phase.key === 'adapt' && rest > 60 ? 60 : rest, status: 'todo' });
    }
  }
  fitToTime(items);
  return { template: mode === 'proteccion' ? 'M' : tplKey, items };
}

export function estimateItem(it) {
  const ex = EXERCISES[it.id];
  const sets = it.sets.filter(s => !s.skipped);
  const n = sets.length;
  const side = ex.perSide ? 2 : 1;
  let work = 0;
  for (const s of sets) {
    if (ex.kind === 'time') work += (ex.minutes || 2) * 60;
    else if (ex.kind === 'hold') work += (s.hold || 20) * side + (side > 1 ? 5 : 0);
    else if (ex.kind === 'holdreps') work += (s.reps || 5) * ((s.hold || 8) + 2) * side + (side > 1 ? 5 : 0);
    else if (ex.kind === 'carry') work += (s.hold || 30) * 2 + 10;
    else work += (s.reps || 10) * 3.5 * side;
  }
  const rests = Math.max(0, n - 1) * (it.rest || 0);
  return work + rests + 35; // 35 s de transición/ajuste de máquina
}
export const estimateTotal = items => items.reduce((a, it) => a + estimateItem(it), 0);

// Si no cabe en 45', recorta series de fuerza (desde los accesorios del final), nunca por debajo de 2.
export function fitToTime(items, limitSec = (MAX_MIN - 1) * 60) {
  let guard = 0;
  while (estimateTotal(items) > limitSec && guard++ < 40) {
    const cand = [...items].reverse().find(it => (it.g === 'fuerza' || it.g === 'core') && it.status === 'todo' && it.sets.filter(s => !s.warmup && !s.skipped).length > 2 - (it.g === 'core' ? 1 : 0));
    if (!cand) break;
    const s = [...cand.sets].reverse().find(s => !s.warmup && !s.done && !s.skipped);
    if (!s) break;
    s.skipped = true; s.trimmed = true;
  }
  for (const it of items) it.sets = it.sets.filter(s => !s.trimmed);
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
  if (ex.kind === 'time') return `${ex.minutes} min`;
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
  if (ex.kind === 'time') return [{ label: ex.name, sub: 'Ritmo suave', secs: (ex.minutes || 2) * 60, work: true }];
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
