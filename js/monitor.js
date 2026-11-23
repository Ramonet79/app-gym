// Monitorización como la haría un entrenador: revisiones periódicas, métricas semanales,
// estancamientos y detección de cuándo el programa necesita una actualización (que hace Claude).
import { EXERCISES } from './exercises.js';
import { iso, parseISO, mondayOf, todayISO } from './program.js';

const DAY = 864e5;
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
const addDays = (d, n) => { const x = parseISO(d); x.setDate(x.getDate() + n); return iso(x); };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

// ───── grupos musculares (series efectivas: principal 1, secundario 0,5) ─────
export const MUSCLE_GROUPS = {
  pecho: { name: 'Pecho', range: [8, 14] },
  espalda: { name: 'Espalda', range: [10, 16] },
  hombro: { name: 'Hombro', range: [8, 14] },
  brazos: { name: 'Brazos', range: [6, 14] },
  core: { name: 'Core', range: [8, 16] },
};
const PUSH = { pecho: 1, brazos: 0.5 }, PULL = { espalda: 1, brazos: 0.5 };
const MAP = {
  press_pecho: PUSH, press_mancuernas: PUSH, flexiones_inclinadas: PUSH, press_inclinado: PUSH, press_inclinado_mancuernas: PUSH,
  pec_deck: { pecho: 1 }, cruce_poleas: { pecho: 1 },
  remo_pecho: PULL, remo_mancuerna: PULL, remo_invertido: PULL, remo_polea: PULL, remo_polea_unilateral: PULL,
  jalon: PULL, jalon_neutro: PULL, dominada_asistida: PULL,
  press_hombro: { hombro: 1, brazos: 0.5 }, press_hombro_mancuernas: { hombro: 1, brazos: 0.5 },
  face_pull: { hombro: 1, espalda: 0.5 }, pajaros_maquina: { hombro: 1, espalda: 0.5 }, y_inclinado: { hombro: 1, espalda: 0.5 },
  elev_laterales: { hombro: 1 }, laterales_maquina: { hombro: 1 }, laterales_polea: { hombro: 1 },
  curl_maquina: { brazos: 1 }, curl_mancuernas_inclinado: { brazos: 1 }, curl_polea: { brazos: 1 },
  triceps_polea: { brazos: 1 }, triceps_maquina: { brazos: 1 }, triceps_unilateral: { brazos: 1 },
};
const musclesOf = id => MAP[id] || (EXERCISES[id]?.group === 'core' ? { core: 1 } : {});

// 1RM estimado (Epley). En asistida no aplica.
export const e1rm = (kg, reps) => kg && reps ? kg * (1 + reps / 30) : null;

function doneSessions(S) { return Object.values(S.sessions).filter(s => s.status === 'done'); }
function workSets(S) {
  return Object.values(S.sets).filter(x => !x.warmup && S.sessions[x.sessionId]?.status === 'done')
    .map(x => ({ ...x, date: S.sessions[x.sessionId].date, ses: S.sessions[x.sessionId] }));
}

// ───── revisiones (check-ins) ─────
export const CHECKIN_Q = {
  back: { q: '¿Cómo ha ido la espalda esta semana?', opts: [['mejor', 'Mejor'], ['igual', 'Igual'], ['peor', 'Peor']] },
  legs: { q: '¿Dolor que baja por la pierna, hormigueo o pérdida de fuerza?', opts: [['no', 'No'], ['si', 'Sí']] },
  energy: { q: 'Energía y recuperación', opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], hint: '1 = agotado · 5 = a tope' },
  sleep: { q: 'Sueño medio por noche', opts: [['<6', '< 6 h'], ['6-7', '6-7 h'], ['7-8', '7-8 h'], ['>8', '> 8 h']] },
  soreness: { q: 'Agujetas o cansancio muscular', opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], hint: '1 = nada · 5 = mucho' },
  motivation: { q: 'Ganas de entrenar', opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
};
export const CHECKIN_MONTH_Q = {
  stronger: { q: '¿Te notas más fuerte que hace un mes?', opts: [['mucho', 'Mucho'], ['algo', 'Algo'], ['igual', 'Igual'], ['menos', 'Menos']] },
  load: { q: 'Las sesiones te resultan…', opts: [['cortas', 'Se me quedan cortas'], ['bien', 'Justas'], ['duras', 'Demasiado duras']] },
  days: { q: '¿Cuántos días de fuerza podrías hacer a la semana?', opts: [[2, '2'], [3, '3'], [4, '4']] },
  goal: { q: 'Prioridad para el próximo mes', opts: [['fuerza', 'Más fuerza'], ['musculo', 'Más músculo'], ['grasa', 'Perder grasa'], ['espalda', 'Espalda sin molestias'], ['postura', 'Postura']] },
};
export const requiredKeys = kind => [...Object.keys(CHECKIN_Q), ...(kind === 'month' ? Object.keys(CHECKIN_MONTH_Q) : [])];

export function checkinDue(S, today = todayISO()) {
  const ses = doneSessions(S);
  if (!ses.length) return null;
  const first = ses.map(s => s.date).sort()[0];
  if (daysBetween(first, today) < 6) return null;
  const list = Object.values(S.checkins || {}).sort((a, b) => a.date.localeCompare(b.date));
  const lastAny = list.at(-1), lastMonth = list.filter(c => c.kind === 'month').at(-1);
  if (lastAny && daysBetween(lastAny.date, today) < 7) return null;
  const monthDue = daysBetween(first, today) >= 25 && (!lastMonth || daysBetween(lastMonth.date, today) >= 28);
  return monthDue ? 'month' : 'week';
}
export function latestCheckin(S, today = todayISO(), maxDays = 8) {
  const c = Object.values(S.checkins || {}).filter(c => c.date <= today).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return c && daysBetween(c.date, today) <= maxDays ? c : null;
}

// Disponibilidad (0-100) a partir de la revisión
export function readiness(c) {
  if (!c) return null;
  const a = c.answers || {};
  const sleep = { '<6': 1, '6-7': 3, '7-8': 5, '>8': 5 }[a.sleep] ?? 3;
  const back = { mejor: 5, igual: 4, peor: 1 }[a.back] ?? 3;
  const parts = [a.energy ?? 3, sleep, 6 - (a.soreness ?? 3), a.motivation ?? 3, back];
  return Math.round((avg(parts) - 1) / 4 * 100);
}

// ───── métricas semanales ─────
export function weeklySets(S, endISO = todayISO(), days = 7) {
  const from = addDays(endISO, -(days - 1));
  const out = Object.fromEntries(Object.keys(MUSCLE_GROUPS).map(k => [k, 0]));
  for (const x of workSets(S)) {
    if (x.date < from || x.date > endISO) continue;
    for (const [m, w] of Object.entries(musclesOf(x.exId))) out[m] += w;
  }
  return out;
}

export function adherence(S, prefsTargets, weeks = 4, today = todayISO()) {
  const mon = iso(mondayOf(parseISO(today)));
  const res = [];
  for (let i = weeks; i >= 1; i--) { // semanas completas anteriores
    const start = addDays(mon, -7 * i), end = addDays(start, 6);
    const ses = doneSessions(S).filter(s => s.date >= start && s.date <= end);
    res.push({ start, fuerza: ses.filter(s => s.type === 'fuerza').length, spinning: ses.filter(s => s.type === 'spinning').length });
  }
  const t = prefsTargets;
  const pct = res.length ? Math.round(avg(res.map(w => Math.min(1, w.fuerza / t.fuerza))) * 100) : null;
  return { weeks: res, pct };
}

// Exposiciones por ejercicio: mejor serie de cada sesión
export function exposures(S, id) {
  const by = {};
  for (const x of workSets(S)) {
    if (x.exId !== id || x.kg == null || !x.reps) continue;
    const v = EXERCISES[id]?.assist ? -x.kg : e1rm(x.kg, x.reps);
    const cur = by[x.sessionId];
    if (!cur || v > cur.v) by[x.sessionId] = { v, kg: x.kg, reps: x.reps, date: x.date, ses: x.ses };
  }
  return Object.values(by).sort((a, b) => a.date.localeCompare(b.date));
}
const adjusted = ses => ses.mode !== 'normal' || ses.phase === 'deload' || !!ses.summary?.adj;

export function strengthTrends(S, today = todayISO()) {
  const out = [];
  for (const id of Object.keys(MAP)) {
    const ex = EXERCISES[id];
    if (!ex || ex.bodyweight) continue;
    const xs = exposures(S, id).filter(e => !adjusted(e.ses));
    if (xs.length < 2) continue;
    const last = xs.at(-1);
    if (daysBetween(last.date, today) > 21) continue;
    const ref = xs.find(e => daysBetween(e.date, last.date) <= 28) || xs[0];
    const change = ex.assist ? (ref.kg - last.kg) : (last.v - ref.v) / ref.v * 100;
    const recent = xs.slice(-4);
    const stalled = recent.length >= 4 && (ex.assist ? recent.at(-1).kg >= recent[0].kg : recent.at(-1).v <= recent[0].v * 1.01);
    out.push({ id, name: ex.name, last, ref, change, stalled, n: xs.length, assist: !!ex.assist });
  }
  return out.sort((a, b) => b.n - a.n);
}

export function backTrend(S, today = todayISO()) {
  const ses = doneSessions(S).filter(s => s.painAfter != null);
  const p = (a, b) => avg(ses.filter(s => daysBetween(s.date, today) >= a && daysBetween(s.date, today) < b).map(s => s.painAfter));
  const recent = p(0, 14), prev = p(14, 28);
  const flags = Object.values(S.sessions).filter(s => daysBetween(s.date, today) < 14)
    .reduce((n, s) => n + Object.values(s.summary?.results || {}).filter(r => r.back).length, 0);
  return { recent, prev, flags, worse: recent != null && prev != null && recent - prev >= 1 };
}

export function rpeTrend(S, today = todayISO()) {
  const ses = doneSessions(S).filter(s => s.rpe != null && s.type === 'fuerza');
  return avg(ses.filter(s => daysBetween(s.date, today) < 14).map(s => s.rpe));
}

// ───── ¿hay que actualizar el programa? ─────
// Cada aviso indica qué pedirle a Claude. Se pueden posponer 14 días.
export function programReview(S, { phase, targets, today = todayISO() }) {
  const out = [];
  const trends = strengthTrends(S, today);
  const stalled = trends.filter(t => t.stalled);
  const back = backTrend(S, today);
  const lastMonth = Object.values(S.checkins || {}).filter(c => c.kind === 'month').sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const adh = adherence(S, targets, 4, today);
  const legs = latestCheckin(S, today, 10)?.answers?.legs === 'si';

  if (legs) out.push({ id: 'legs', level: 'warn', title: 'Síntomas en la pierna', text: 'Has indicado dolor que baja por la pierna u hormigueo. Consulta con tu médico antes de seguir cargando, y cuéntamelo para adaptar el programa.' });
  if (back.worse || back.flags >= 3) out.push({ id: 'back', level: 'warn', title: 'La espalda protesta', text: `En las 2 últimas semanas ${back.flags >= 3 ? `has marcado molestia ${back.flags} veces` : 'el dolor al terminar ha subido'}. Hay que revisar qué ejercicios lo provocan y cambiarlos.` });
  if (stalled.length >= 3) out.push({ id: 'stall', level: 'info', title: 'Varios ejercicios estancados', text: `${stalled.slice(0, 4).map(t => t.name).join(', ')} no suben en 4 sesiones. Toca una fase nueva: cambiar rangos de repeticiones o periodización.` });
  if (phase.week >= 14) out.push({ id: 'phase2-w' + Math.floor(phase.week / 12), level: 'info', title: `Llevas ${phase.week} semanas entrenadas`, text: 'Tu base ya está hecha. Es el momento de diseñar la siguiente fase (más volumen o más intensidad) con nuevas progresiones.' });
  const core = ['bird_dog', 'plancha_lateral', 'curl_up'].filter(id => { const st = S.settings[id]; const ex = EXERCISES[id]; return st && ex.levels && st.level >= ex.levels.length - 1; });
  if (core.length >= 2) out.push({ id: 'core-max', level: 'info', title: 'Core al nivel máximo', text: 'Has llegado al último nivel en los ejercicios de McGill. Hay que añadir progresiones nuevas de core.' });
  if (lastMonth) {
    const a = lastMonth.answers || {};
    if (a.load === 'cortas' && adh.pct >= 80 && (back.recent ?? 0) <= 2) out.push({ id: 'more-' + lastMonth.date, level: 'info', title: 'Listo para más', text: 'Cumples el plan, la espalda va bien y las sesiones se te quedan cortas: podemos añadir volumen, una sesión o máquinas nuevas.' });
    if (a.load === 'duras') out.push({ id: 'less-' + lastMonth.date, level: 'info', title: 'Sesiones demasiado duras', text: 'Has indicado que las sesiones te resultan demasiado duras. Hay que reajustar el volumen.' });
    if (a.days && +a.days !== targets.fuerza) out.push({ id: 'days-' + lastMonth.date, level: 'info', title: `Puedes hacer ${a.days} días de fuerza`, text: `Tu plan está pensado para ${targets.fuerza}. Con ${a.days} conviene rediseñar el reparto de rutinas.` });
    if ((a.goal === 'musculo' || a.goal === 'grasa') && a.goal !== S.prefs.programGoal) out.push({ id: 'goal-' + a.goal, level: 'info', title: 'Objetivo nuevo', text: `Has elegido como prioridad: ${CHECKIN_MONTH_Q.goal.opts.find(o => o[0] === a.goal)?.[1]}. El programa se puede orientar más a eso.` });
  }
  const snooze = S.prefs.reviewSnooze || {};
  return out.filter(r => !(snooze[r.id] && snooze[r.id] > today));
}

// Texto para pegar a Claude cuando hay que actualizar
export function updateRequest(reviews) {
  return 'Claude, actualiza mi programa de App Gym. La app ha detectado:\n' + reviews.map(r => `- ${r.title}: ${r.text}`).join('\n') +
    '\n\nLee mi histórico en Supabase (tablas gym_) y ajusta fases, sesiones o máquinas.\n';
}
