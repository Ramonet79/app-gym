// Entrenador: decide qué conviene hoy y cómo ajustar la sesión a partir del histórico real.
// Es una función pura del histórico: sin calendario fijo, se adapta a los días que realmente vas.
import { iso, parseISO, mondayOf, nextStrengthTemplate } from './program.js';

export const DEFAULT_TARGETS = { fuerza: 3, spinning: 2 };
export const DEFAULT_GYM_DAYS = [1, 2, 3, 4, 5]; // lunes a viernes

const DAY = 864e5;
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY); // b − a en días
const weekKey = d => iso(mondayOf(parseISO(d)));
const addDays = (d, n) => { const x = parseISO(d); x.setDate(x.getDate() + n); return iso(x); };

export const targetsOf = prefs => ({ ...DEFAULT_TARGETS, ...(prefs?.targets || {}) });
export const gymDaysOf = prefs => (Array.isArray(prefs?.gymDays) && prefs.gymDays.length ? prefs.gymDays : DEFAULT_GYM_DAYS);

function doneList(sessions) {
  return Object.values(sessions).filter(s => s.status === 'done' && s.date)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startedAt || '').localeCompare(b.startedAt || ''));
}
const isStrength = s => s.type === 'fuerza';

// ───── fase del programa según semanas REALMENTE entrenadas ─────
// · Adaptación: las 2 primeras semanas con fuerza.
// · Construcción: 3 series y doble progresión.
// · Descarga: tras 6 semanas seguidas de construcción. Una semana sin fuerza ya cuenta como descarga.
// · Un parón de 4 semanas o más reinicia la adaptación.
export function programPhase(sessions, startISO, today) {
  const str = doneList(sessions).filter(s => isStrength(s) && (!startISO || s.date >= startISO) && s.date <= today);
  let from = 0;
  for (let i = 1; i < str.length; i++) if (daysBetween(str[i - 1].date, str[i].date) >= 28) from = i;
  let recentStr = str.slice(from);
  if (recentStr.length && daysBetween(recentStr.at(-1).date, today) >= 28) recentStr = [];
  const weeks = [...new Set(recentStr.map(s => weekKey(s.date)))];
  const cur = weekKey(today);
  if (!weeks.includes(cur)) weeks.push(cur);
  const week = weeks.length;
  let streak = 1;
  for (let i = weeks.length - 1; i > 0; i--) { if (daysBetween(weeks[i - 1], weeks[i]) === 7) streak++; else break; }
  const buildStreak = Math.min(streak, week - 2);
  const block = Math.floor(Math.max(0, week - 3) / 6); // 0: semanas 1-8, 1: 9-14, 2: 15-20…
  if (week <= 2) return { week, block, key: 'adapt', name: 'Adaptación', sets: 2, load: 1, info: 'Pesos cómodos: te deben sobrar 3-4 repeticiones. Aprende la técnica y los ajustes de cada máquina.' };
  if (buildStreak > 0 && buildStreak % 6 === 0) return { week, block, key: 'deload', name: 'Descarga', sets: 2, load: 0.85, hold: true, info: 'Semana suave para asimilar: menos series y un 15 % menos de peso. No se sube peso.' };
  return { week, block, key: 'build', name: 'Construcción', sets: 3, load: 1, info: 'Doble progresión: cuando completas todas las series en el tope de repeticiones con buena técnica, la app sube el peso.' };
}

// ───── ajuste de la sesión de fuerza según el tiempo sin entrenar ─────
function strengthAdjust(lastStr, gapStr) {
  if (gapStr == null) return { key: 'first', load: 1, maxSets: null, hold: false, tag: null, note: 'Primera sesión: los pesos son de prueba. Ajústalos con + y − hasta que te sobren 3-4 repeticiones.' };
  if (gapStr === 0) return { key: 'same', load: 0.9, maxSets: 2, hold: true, tag: 'Segunda del día', note: 'Ya has hecho fuerza hoy: versión corta y sin subir pesos.' };
  if (gapStr === 1) return { key: 'consec', load: 0.9, maxSets: 2, hold: true, tag: 'Volumen reducido', note: 'Ayer hiciste fuerza y los mismos músculos necesitan unas 48 h. Hoy 2 series y −10 % de peso para no acumular fatiga en espalda y hombros.' };
  if (gapStr >= 28) return { key: 'restart', load: 0.75, maxSets: 2, hold: true, tag: 'Reinicio', note: `${gapStr} días sin fuerza: empezamos al 75 % de tus pesos y repetimos 2 semanas de adaptación. Es lo que evita lesiones al volver.` };
  if (gapStr >= 14) return { key: 'return2w', load: 0.8, maxSets: 2, hold: true, tag: 'Vuelta −20 %', note: `${gapStr} días sin fuerza: hoy al 80 % y 2 series. La próxima sesión subimos al 90 % y después a tus pesos normales.` };
  if (gapStr >= 8) return { key: 'return1w', load: 0.9, maxSets: null, hold: true, tag: 'Vuelta −10 %', note: `${gapStr} días sin fuerza: hoy un 10 % menos de peso para reengancharte. En la próxima sesión vuelves a tus pesos.` };
  const prev = lastStr?.summary?.adj?.key;
  if ((prev === 'return2w' || prev === 'restart') && gapStr <= 7) return { key: 'return2', load: 0.9, maxSets: null, hold: true, tag: 'Vuelta −10 %', note: 'Segunda sesión tras el parón: 90 % de tus pesos. La siguiente, ya normal.' };
  return { key: 'normal', load: 1, maxSets: null, hold: false, tag: null, note: null };
}

// ───── intensidad del spinning (modelo polarizado: 1 sesión intensa y el resto suaves) ─────
function spinPlan({ age, week, gapStr, gapAny, streakDays, strengthTomorrow, backWarn }) {
  const fcmax = Math.round(208 - 0.7 * (age || 47)); // Tanaka
  const z = p => Math.round(fcmax * p);
  const hardDone = week.some(s => s.type === 'spinning' && s.spinKind === 'intenso');
  let kind = 'suave', why;
  if (backWarn) why = 'La espalda viene cargada: rodaje suave, manillar alto y sin ponerte de pie.';
  else if (gapAny == null) why = 'Primeras sesiones: rodaje suave para coger la base.';
  else if (gapAny >= 7) why = 'Vuelves tras varios días: rodaje suave para reengancharte.';
  else if (gapStr === 1) why = 'Ayer hiciste fuerza: rodaje suave que además ayuda a recuperar.';
  else if (streakDays >= 3) why = `Llevas ${streakDays} días seguidos entrenando: hoy suave.`;
  else if (hardDone) why = 'Ya hiciste el spinning intenso de la semana: hoy suave.';
  else { kind = 'intenso'; why = strengthTomorrow ? 'Es tu spinning intenso de la semana. Sin pasarte: mañana toca fuerza.' : 'Es tu spinning intenso de la semana.'; }
  return kind === 'suave'
    ? { kind, why, fcmax, title: 'Rodaje en zona 2', zone: `${z(0.6)}-${z(0.7)} ppm`, rpe: 'Esfuerzo 4-5 de 10', tips: ['Debes poder hablar en frases completas', 'Cadencia cómoda, 80-90 rpm', 'Si la clase aprieta, baja resistencia y quédate en tu zona'] }
    : { kind, why, fcmax, title: 'Clase con intervalos', zone: `picos hasta ${z(0.85)} ppm`, rpe: 'Picos de 7-8 de 10', tips: ['Recupera del todo entre intervalos (bajo ' + z(0.7) + ' ppm)', 'Los sprints, sentado; de pie como mucho 1-2 min seguidos', 'Si la espalda avisa, siéntate y baja resistencia'] };
}

// ───── recomendación del día ─────
export function planToday({ sessions, profile, prefs, today }) {
  const targets = targetsOf(prefs), gymDays = gymDaysOf(prefs);
  const all = doneList(sessions);
  const past = all.filter(s => s.date < today);
  const todayDone = all.filter(s => s.date === today);
  const strAll = all.filter(s => isStrength(s) && s.date <= today);
  const lastStr = strAll.at(-1);
  const gapStr = lastStr ? daysBetween(lastStr.date, today) : null;
  const lastAny = past.at(-1);
  const gapAny = lastAny ? daysBetween(lastAny.date, today) : null;

  // días seguidos entrenando hasta ayer
  let streakDays = 0;
  for (let d = addDays(today, -1); past.some(s => s.date === d); d = addDays(d, -1)) streakDays++;

  const wk = weekKey(today);
  const week = all.filter(s => weekKey(s.date) === wk);
  const wF = week.filter(isStrength).length, wS = week.filter(s => s.type === 'spinning').length;
  const remF = Math.max(0, targets.fuerza - wF), remS = Math.max(0, targets.spinning - wS);

  // días de gimnasio que quedan esta semana, hoy incluido
  const sunday = addDays(wk, 6);
  let daysLeft = 0;
  for (let d = today; d <= sunday; d = addDays(d, 1)) if (d === today || gymDays.includes(parseISO(d).getDay())) daysLeft++;
  const maxFIfSkip = Math.ceil((daysLeft - 1) / 2); // fuerza posible sin repetir días seguidos si hoy no hago

  // señales de la espalda en las últimas 72 h
  const lastPain = lastAny && lastAny.painAfter != null && gapAny <= 2 ? lastAny : null;
  const painHigh = lastPain && lastPain.painAfter >= 5;
  const painUp = lastPain && lastPain.painAfter >= 3 && lastPain.painBefore != null && lastPain.painAfter - lastPain.painBefore >= 2;

  const phase = programPhase(sessions, profile?.startDate, today);
  const adj = strengthAdjust(lastStr, gapStr);
  const tpl = nextStrengthTemplate(sessions);
  const age = profile?.birthYear ? parseISO(today).getFullYear() - profile.birthYear : null;

  let rec, why = [];
  const fLine = `Llevas ${wF} de ${targets.fuerza} sesiones de fuerza esta semana.`;
  if (painHigh) {
    rec = 'movilidad';
    why.push(`Tu última sesión terminó con la espalda en ${lastPain.painAfter}/10. Hoy movilidad y core suave: el spinning te tendría sentado y flexionado 45 minutos.`);
  } else if (gapStr === 0) {
    rec = 'descanso';
    why.push('Ya has hecho fuerza hoy. Si te apetece algo más, que sea suave.');
  } else if (remF === 0 && remS === 0) {
    rec = 'descanso';
    why.push(`Semana cumplida: ${wF} de fuerza y ${wS} de spinning. Descansar también es entrenar: la fuerza se gana recuperando.`);
    why.push('Si vas igualmente, mejor movilidad y core o un spinning suave.');
  } else if (gapStr === 1) {
    rec = remS > 0 ? 'spinning' : 'movilidad';
    why.push('Ayer hiciste fuerza: los mismos músculos necesitan unas 48 h para recuperarse y ganar fuerza.');
    why.push(remS > 0 ? 'Hoy cardio y mañana vuelves a fuerza.' : 'Ya tienes el spinning de la semana hecho: hoy movilidad y core, o descanso.');
  } else if (remF > 0) {
    rec = 'fuerza';
    why.push(gapStr == null ? 'Aún no has hecho ninguna sesión de fuerza: empezamos.'
      : gapStr <= 7 ? `Hace ${gapStr} días de tu última sesión de fuerza: estás recuperado.`
      : `Llevas ${gapStr} días sin fuerza: toca volver, con el peso ajustado para reengancharte.`);
    why.push(fLine);
    if (remF > maxFIfSkip) why.push(daysLeft <= 1 ? 'Es tu último día de gimnasio de la semana.' : `Si hoy no la haces, no llegas a ${targets.fuerza} esta semana.`);
  } else if (remS > 0) {
    rec = 'spinning';
    why.push(`Ya has cumplido la fuerza de la semana (${wF}/${targets.fuerza}). Te falta spinning: ${wS} de ${targets.spinning}.`);
  }
  if (painUp && !painHigh) why.push(`Ojo: la última vez la espalda subió de ${lastPain.painBefore} a ${lastPain.painAfter}. Antes de empezar te pregunto cómo está.`);

  const spin = spinPlan({ age, week, gapStr, gapAny, streakDays, strengthTomorrow: rec === 'spinning' && remF > 0, backWarn: !!(painHigh || painUp) });

  return { today, rec, why, targets, gymDays, week: { fuerza: wF, spinning: wS, remF, remS, daysLeft }, gapStr, gapAny, streakDays, phase, adj, tpl, spin, todayDone, lastStr };
}

// ───── previsión del resto de la semana (si sigues las recomendaciones) ─────
export function projectWeek({ sessions, profile, prefs, today, todayChoice }) {
  const gymDays = gymDaysOf(prefs);
  const sim = { ...sessions };
  const out = {};
  let n = 0;
  const add = (date, type, template) => { const id = 'sim' + n++; sim[id] = { id, date, type, template, status: 'done', startedAt: date + 'T07:00:00' }; };
  const p0 = planToday({ sessions: sim, profile, prefs, today });
  const hasToday = Object.values(sessions).some(s => s.status === 'done' && s.date === today && s.type !== 'core');
  if (!hasToday) {
    const t = todayChoice || p0.rec;
    out[today] = t;
    if (t === 'fuerza' || t === 'spinning' || t === 'movilidad') add(today, t, t === 'fuerza' ? p0.tpl : null);
  }
  const sunday = addDays(weekKey(today), 6);
  for (let d = addDays(today, 1); d <= sunday; d = addDays(d, 1)) {
    if (!gymDays.includes(parseISO(d).getDay())) { out[d] = 'descanso'; continue; }
    const p = planToday({ sessions: sim, profile, prefs, today: d });
    const t = p.rec === 'movilidad' ? 'descanso' : p.rec;
    out[d] = t;
    if (t === 'fuerza' || t === 'spinning') add(d, t, t === 'fuerza' ? p.tpl : null);
  }
  return out;
}
