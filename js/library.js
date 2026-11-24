// Biblioteca: tres secciones (esterilla, máquinas, peso libre), zonas del cuerpo,
// buscador por nombre de máquina Technogym o de ejercicio, y generador de rutinas.
import { EXERCISES, TECHNOGYM, AREAS, areasOf, zoneOf } from './exercises.js';

export const SECTIONS = [
  { z: 'suelo', name: 'Esterilla', sub: 'Peso corporal' },
  { z: 'maquinas', name: 'Máquinas', sub: 'Máquinas y poleas' },
  { z: 'libre', name: 'Peso libre', sub: 'Mancuernas y bancos' },
];

const listable = e => e.group !== 'cardio' && e.zone !== 'cardio';
export const inSection = z => Object.values(EXERCISES).filter(e => listable(e) && zoneOf(e.id) === z);
export const inArea = (z, a) => inSection(z).filter(e => a === 'all' || areasOf(e.id).includes(a));

// ───── máquinas (nombre de la placa Technogym) ─────
export const MACHINES = [
  { name: 'Chest Press', also: 'press de pecho sentado pectoral', ids: ['press_pecho', 'press_pecho_unilateral'] },
  { name: 'Incline Chest Press', also: 'press inclinado pecho superior', ids: ['press_inclinado'] },
  { name: 'Pectoral', also: 'contractor pec deck aperturas dual pectoral reverse fly mariposa butterfly', ids: ['pec_deck', 'pajaros_maquina'] },
  { name: 'Upper Back', also: 'rear delt reverse fly pajaros hombro posterior', ids: ['pajaros_maquina'] },
  { name: 'Low Row', also: 'remo sentado con apoyo row', ids: ['remo_pecho'] },
  { name: 'Lat Machine', also: 'jalon lat pulldown polea alta dorsal', ids: ['jalon', 'jalon_neutro', 'pullover_polea'] },
  { name: 'Vertical Traction', also: 'jalon agarre neutro paralelo traccion vertical', ids: ['jalon_neutro'] },
  { name: 'Kneeling Easy Chin Dip', also: 'dominadas asistidas chin dip fondos asistidos dominada', ids: ['dominada_asistida'] },
  { name: 'Shoulder Press', also: 'press de hombro press militar sentado', ids: ['press_hombro'] },
  { name: 'Delts Machine', also: 'lateral raise elevaciones laterales hombro deltoides', ids: ['laterales_maquina'] },
  { name: 'Arm Curl', also: 'curl biceps scott predicador', ids: ['curl_maquina'] },
  { name: 'Arm Extension', also: 'triceps extension fondos maquina', ids: ['triceps_maquina'] },
  { name: 'Low Pulley', also: 'polea baja remo en polea seated row', ids: ['remo_polea', 'remo_polea_unilateral'] },
  { name: 'Crossover', also: 'cruce de poleas poleas cable cross over dual adjustable pulley ftp polea', ids: ['cruce_poleas', 'cruce_poleas_bajo', 'pajaros_polea', 'face_pull', 'triceps_polea', 'triceps_unilateral', 'curl_polea', 'curl_martillo_polea', 'laterales_polea', 'rotacion_externa_polea', 'pallof', 'pallof_rodillas'] },
  { name: 'Multipower', also: 'smith maquina guiada barra guiada', ids: ['remo_invertido', 'flexiones_inclinadas'] },
  { name: 'Bancos y mancuernas', also: 'banco plano inclinado regulable mancuerna mancuernas peso libre dumbbell', ids: ['press_mancuernas', 'press_inclinado_mancuernas', 'aperturas_mancuernas', 'remo_mancuerna', 'remo_banco_inclinado', 'press_hombro_mancuernas', 'elev_laterales', 'y_inclinado', 'curl_mancuernas_inclinado', 'curl_martillo_sentado', 'triceps_tumbado', 'patada_triceps', 'encogimientos', 'press_suelo_mancuernas'], zone: 'libre' },
  { name: 'Esterilla', also: 'suelo colchoneta mat peso corporal funcional', ids: inSection('suelo').map(e => e.id), zone: 'suelo' },
  { name: 'Synchro / Vario', also: 'eliptica cardio', ids: ['eliptica'], cardio: true },
  { name: 'Recline / Bike / Run', also: 'bici reclinada bicicleta cinta correr caminar cardio', ids: ['cardio_z2', 'caminar'], cardio: true },
  { name: 'Group Cycle', also: 'spinning ciclo indoor bici', ids: ['spinning'], cardio: true },
];

// Máquinas que existen en el gimnasio pero que NO te convienen (o que están fuera de tu programa)
export const NOT_FOR_YOU = [
  { name: 'Abdominal Crunch', also: 'crunch abdominal maquina abdominales total abdominal', why: 'Flexiona la zona lumbar con carga: es justo el gesto que más presiona el disco L5-S1.', alt: ['pallof', 'curl_up', 'dead_bug'] },
  { name: 'Lower Back', also: 'lumbar extension lumbar hiperextensiones banco romano', why: 'Mueve la columna lumbar con carga. Tus lumbares se fortalecen mejor con la columna quieta.', alt: ['bird_dog', 'puente', 'patada_cuadrupedia'] },
  { name: 'Rotary Torso', also: 'rotary torso giro rotacion de tronco oblicuos maquina', why: 'Gira la columna con carga: mala combinación con una protrusión.', alt: ['pallof', 'plancha_lateral', 'plancha_alta_toques'] },
  { name: 'Leg Press', also: 'prensa de piernas leg press', why: 'Al bajar, la pelvis se redondea y la lumbar se despega del respaldo, cargando L5-S1. Además, tu programa es de cintura para arriba.', alt: ['puente', 'puente_una_pierna'] },
  { name: 'Sentadilla y peso muerto con barra', also: 'squat sentadilla peso muerto deadlift rack power rack barra olimpica buenos dias good morning', why: 'Cargan la columna en vertical y exigen mucha técnica de cadera. Con tu informe no compensa el riesgo.', alt: ['puente', 'carry'] },
  { name: 'Piernas (Leg Extension, Leg Curl, Abductor, Adductor, Glute)', neutral: true, also: 'leg extension leg curl cuadriceps isquios femoral abductor adductor aductor gemelos glute pierna piernas', why: 'No son malas para tu espalda, pero tu programa es de cintura para arriba. Si quieres añadir piernas, pídeselo a Claude y lo integra con cuidado.', alt: [] },
];

// ───── buscador ─────
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const stem = w => w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
const textOf = e => fold([e.name, e.machine, TECHNOGYM[e.id]?.name, TECHNOGYM[e.id]?.what, ...e.muscles, ...areasOf(e.id).map(a => AREAS[a].name + ' ' + AREAS[a].kw)].join(' '));
export function search(q) {
  const words = fold(q).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 2).map(stem);
  if (!words.length) return null;
  const hit = t => words.every(w => t.includes(w));
  const machines = MACHINES.filter(m => hit(fold(m.name + ' ' + m.also)));
  const warn = NOT_FOR_YOU.filter(m => hit(fold(m.name + ' ' + m.also)));
  const exs = Object.values(EXERCISES).filter(e => hit(textOf(e)));
  // si coincide la máquina exacta, primero sus ejercicios
  const firstIds = new Set(machines.flatMap(m => m.ids));
  exs.sort((a, b) => firstIds.has(b.id) - firstIds.has(a.id));
  return { machines: machines.filter(m => !m.cardio || machines.length === 1 || words.some(w => fold(m.name).includes(w))), warn, exs };
}

// ───── generador de rutinas ─────
// Empuje y tirón equilibrados, núcleo de core siempre, variedad entre días (semilla).
// Empuje = presses y flexiones (pecho u hombro). Tirón = remos, jalones y dominadas (dorsal como músculo principal).
const isPush = id => /^(press|flexiones)/i.test(EXERCISES[id].name);
const isPull = id => /dorsal/i.test(EXERCISES[id].muscles[0]) && !/pullover/i.test(EXERCISES[id].name);
export const balance = ids => ({ push: ids.filter(isPush).length, pull: ids.filter(isPull).length });
const usable = (id, settings) => EXERCISES[id] && !settings?.[id]?.disabled;
// Barajado con semilla: misma semilla = misma rutina; otra semilla = otra combinación
function shuffle(arr, seed) {
  let a = Math.imul(seed * 7919 + 13, 2654435761) >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// Elige n ejercicios variados de una lista (distinto músculo principal y tipo de esfuerzo)
export function pickVaried(pool, n, seed = 0, settings = {}) {
  const ids = shuffle(pool.map(e => e.id || e).filter(id => usable(id, settings) && !EXERCISES[id].swapOnly), seed);
  const out = [], seenM = new Set(), seenK = new Set();
  for (const pass of [0, 1, 2]) {
    for (const id of ids) {
      if (out.length >= n) break;
      if (out.includes(id)) continue;
      const ex = EXERCISES[id], m = ex.muscles[0], k = ex.kind + (ex.perSide ? 's' : '');
      if (pass === 0 && (seenM.has(m) || seenK.has(k))) continue;
      if (pass === 1 && seenM.has(m)) continue;
      out.push(id); seenM.add(m); seenK.add(k);
    }
  }
  return out;
}

const ANTAGONIST = { pecho: 'espalda', espalda: 'pecho', hombro: 'espalda', brazos: null, abdomen: 'lumbar', lumbar: 'abdomen', cuello: 'espalda', movilidad: null };
const BICEPS = id => /b[ií]ceps|braquial/i.test(EXERCISES[id].muscles[0]);

// Rutina completa alrededor de una máquina: la máquina, otro del mismo músculo, el antagonista, un accesorio y core.
export function machineRoutine(m, { settings = {}, seed = 0 } = {}) {
  if (m.zone) return areaRoutine(m.zone, 'all', { settings, seed }); // esterilla o bancos: rutina completa de esa zona
  const anchors = m.ids.filter(id => usable(id, settings) && !EXERCISES[id].swapOnly && listable(EXERCISES[id]));
  if (!anchors.length) return [];
  const anchor = anchors.length > 3 ? shuffle(anchors, seed)[0] : anchors[0]; // la máquina manda; en las poleas, varía
  const z = zoneOf(anchor), area = areasOf(anchor)[0];
  const out = [anchor];
  const pool = (a, filt = () => true) => Object.values(EXERCISES).filter(e => listable(e) && !out.includes(e.id) && areasOf(e.id).includes(a) && filt(e));
  // primero, de la misma zona del gimnasio: no vas y vuelves
  const take = (list, n = 1) => {
    const same = list.filter(e => zoneOf(e.id) === z && !out.includes(e.id));
    for (const id of pickVaried(same.length >= n ? same : list.filter(e => !out.includes(e.id)), n, seed, settings)) if (!out.includes(id)) out.push(id);
  };
  if (area === 'brazos') {
    take(pool('brazos', e => BICEPS(e.id) !== BICEPS(anchor)));
    take(pool('brazos', e => BICEPS(e.id) === BICEPS(anchor) && (m.ids.length < 2 || !m.ids.includes(e.id))));
    take(pool('espalda', e => isPull(e.id)));
  } else if (area === 'abdomen' || area === 'lumbar') {
    take(pool('abdomen'), 2); take(pool('lumbar'), 1);
  } else {
    take(pool(area, e => !m.ids.includes(e.id) || m.ids.length > 3)); // otro del mismo músculo
    const ant = ANTAGONIST[area];
    if (ant) take(pool(ant, e => ant === 'espalda' ? isPull(e.id) : isPush(e.id)));
    take(pool(area === 'hombro' ? 'brazos' : 'hombro', e => !isPush(e.id) || area === 'hombro'));
  }
  // core: siempre (anti-rotación en máquinas, McGill en la esterilla)
  if (!out.some(id => areasOf(id).includes('abdomen'))) take(Object.values(EXERCISES).filter(e => areasOf(e.id).includes('abdomen') && (zoneOf(e.id) === z || zoneOf(e.id) === 'suelo')));
  return out;
}

// Rutina de la sección y zona del cuerpo que estás viendo (p. ej. abdomen en esterilla)
export function areaRoutine(z, a, { settings = {}, seed = 0, n = null } = {}) {
  const list = inArea(z, a);
  if (a !== 'all') return pickVaried(list, n || Math.min(5, list.length), seed, settings);
  // "Todo" en una sección: cuerpo completo de esa zona del gimnasio
  const out = [];
  const plan = z === 'suelo' ? ['pecho', 'espalda', 'abdomen', 'abdomen', 'lumbar'] : ['pecho', 'espalda', 'hombro', 'brazos', 'abdomen'];
  for (const ar of plan) {
    const main = ar === 'pecho' ? isPush : ar === 'espalda' ? isPull : () => true; // en una rutina completa, ejercicios básicos
    const cands = list.filter(e => areasOf(e.id).includes(ar) && !out.includes(e.id));
    const got = pickVaried(cands.some(e => main(e.id)) ? cands.filter(e => main(e.id)) : cands, 1, seed, settings);
    out.push(...got);
  }
  return out;
}
