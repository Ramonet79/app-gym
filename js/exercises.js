// Catálogo de ejercicios. Todo pensado para columna lumbar sensible:
// espalda apoyada, sin flexión lumbar con carga, sin carga axial pesada.
import { ik } from './art.js';

const f = n => (+n).toFixed(1);
const R = (x, y, w, h, c = 'm', rx = 3) => `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="${rx}" class="${c}"/>`;
const L = (x1, y1, x2, y2, w = 5, c = 'mline') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${w}" class="${c}"/>`;
const C = (x, y, r, c = 'm') => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" class="${c}"/>`;
const PG = (pts, c = 'm') => `<polygon points="${pts}" class="${c}"/>`;
const cable = (x, y, w) => L(x, y, w[0], w[1], 1.6, 'cable');
const grip = w => C(w[0], w[1], 4.5, 'hi');
const lever = (x, y, w) => L(x, y, w[0], w[1], 5, 'mline') + grip(w);
const db = w => R(w[0] - 8, w[1] - 2, 16, 4, 'hi', 1.5) + R(w[0] - 11, w[1] - 6, 5, 12, 'hi', 1.5) + R(w[0] + 6, w[1] - 6, 5, 12, 'hi', 1.5);
const rope = w => L(w[0] - 4, w[1] - 3, w[0] + 4, w[1] + 3, 3, 'hiline');

const MAT = R(4, 147, 192, 4, 'mat', 2);
const SEAT = R(54, 111, 48, 7) + R(73, 118, 7, 29) + R(58, 145, 38, 5, 'm', 2);
const CHAIR = R(53, 58, 9, 58) + SEAT;
const SEATED = { face: 1, h: [72, 56], s: [70, 72], hp: [70, 108], k: [100, 108], a: [102, 140], f: [111, 141] };

const standing = (x, face = 1) => ({ face, h: [x + 2 * face, 35], s: [x, 50], hp: [x - 2 * face, 88], k: [x, 118], a: [x - 2 * face, 148], f: [x + 7 * face, 148], k2: [x - 4 * face, 118], a2: [x - 10 * face, 148], f2: [x - 2 * face, 148] });

// kind: reps | hold | holdreps | time | carry
export const EXERCISES = {
  // ───────── CALENTAMIENTO ─────────
  eliptica: {
    name: 'Elíptica suave', group: 'warm', kind: 'time', minutes: 4,
    machine: 'Elíptica (zona cardio)', muscles: ['Todo el cuerpo', 'Activación'],
    setup: ['Resistencia baja (nivel 3-5)', 'Tronco erguido, sin apoyarte en los brazos'],
    cues: ['Ritmo en el que puedas hablar', 'Empuja y tira de los brazos suave', 'Respira por la nariz'],
    avoid: ['Inclinarte hacia delante colgado de las asas'],
    why: 'Calienta sin impacto y con la columna vertical. A las 6:30 los discos están más hidratados: conviene calentar bien antes de cargar.',
    art: {
      dur: 1300,
      back: R(26, 140, 140, 7) + L(140, 140, 130, 40, 6) + R(124, 34, 14, 10, 'm', 3),
      A: { face: 1, h: [98, 31], s: [95, 46], hp: [90, 82], k: [104, 106], a: [100, 132], f: [110, 133], k2: [84, 112], a2: [74, 136], f2: [84, 137], e: [108, 62], w: [124, 50], e2: [104, 66], w2: [118, 60] },
      B: { k: [86, 110], a: [76, 136], f: [86, 137], k2: [102, 106], a2: [100, 132], f2: [110, 133], e: [104, 66], w: [118, 60], e2: [108, 62], w2: [124, 50] },
      dyn: p => R(p.a[0] - 8, p.a[1] + 2, 20, 4, 'hi', 1.5) + L(p.w[0], p.w[1], 136, 100, 3) + grip(p.w),
    },
  },
  gato_camello: {
    name: 'Gato-camello', group: 'warm', kind: 'reps', sets: 1, reps: [8, 8], rest: 0, bodyweight: true,
    machine: 'Esterilla (zona de estiramientos)', muscles: ['Movilidad columna'],
    setup: ['A cuatro patas: manos bajo hombros, rodillas bajo caderas'],
    cues: ['Movimiento lento y corto, sin forzar', 'Redondea suave y luego hunde suave', 'Es para "engrasar", no para estirar'],
    avoid: ['Llegar al final del recorrido con fuerza', 'Hacerlo rápido'],
    why: 'Movilidad suave de la columna sin carga (McGill). Reduce la rigidez de primera hora.',
    art: {
      vb: '0 82 200 76',
      dur: 3200, back: MAT,
      A: { face: 1, h: [126, 118], s: [112, 114], sp: [90, 92], hp: [68, 114], e: [112, 131], w: [112, 147], k: [70, 146], a: [40, 147] },
      B: { h: [128, 100], sp: [90, 126] },
    },
  },

  // ───────── CORE (estabilidad lumbar / multífido) ─────────
  bird_dog: {
    name: 'Bird-dog', group: 'core', kind: 'holdreps', sets: 2, reps: 5, hold: 8, perSide: true, rest: 30,
    sideLabels: ['Brazo derecho + pierna izquierda', 'Brazo izquierdo + pierna derecha'],
    levels: [{ name: 'Básico', reps: 5, hold: 8 }, { name: 'Medio', reps: 6, hold: 10 }, { name: 'Avanzado', reps: 8, hold: 10 }],
    machine: 'Esterilla', muscles: ['Multífido', 'Glúteo', 'Erectores'],
    setup: ['A cuatro patas, espalda neutra (ni hundida ni redonda)'],
    cues: ['Estira brazo y pierna contraria hasta la horizontal', 'Imagina un vaso de agua sobre tu zona lumbar', 'Aguanta, baja y repite sin apoyar del todo'],
    avoid: ['Levantar la pierna por encima de la cadera', 'Girar la pelvis', 'Arquear la lumbar'],
    why: 'Ejercicio clave para el multífido (el músculo profundo que estabiliza la zona lumbar). Lo activa sin comprimir el disco.',
    art: {
      vb: '0 82 200 76',
      back: MAT,
      A: { face: 1, h: [126, 104], s: [112, 113], hp: [68, 114], e: [112, 131], w: [112, 147], e2: [112, 131], w2: [112, 147], k: [70, 146], a: [40, 147], k2: [70, 146], a2: [40, 147] },
      B: { e: [134, 108], w: [158, 104], k: [42, 113], a: [14, 112] },
    },
  },
  plancha_lateral: {
    name: 'Plancha lateral', group: 'core', kind: 'hold', sets: 2, hold: 20, perSide: true, rest: 30, maxHold: 40,
    sideLabels: ['Apoyo sobre codo derecho', 'Apoyo sobre codo izquierdo'],
    levels: [{ name: 'Sobre rodillas', hold: 20 }, { name: 'Sobre pies', hold: 15 }, { name: 'Pies, con pierna arriba', hold: 15 }],
    machine: 'Esterilla', muscles: ['Cuadrado lumbar', 'Oblicuos', 'Glúteo medio'],
    setup: ['Codo justo debajo del hombro', 'Nivel 1: rodillas apoyadas y dobladas'],
    cues: ['Cadera arriba: cabeza, cadera y rodillas en línea', 'Mano libre en la cadera', 'Respira normal, no aguantes el aire'],
    avoid: ['Dejar caer la cadera', 'Echar la cadera hacia atrás'],
    why: 'Uno de los "3 grandes" de McGill. Estabiliza la columna lateralmente con mínima compresión del disco.',
    art: {
      vb: '0 82 200 76',
      back: MAT,
      A: { face: 1, h: [146, 100], s: [132, 112], hp: [92, 140], k: [62, 144], a: [32, 146], e: [132, 146], w: [152, 146], e2: [116, 124], w2: [98, 132] },
      B: { hp: [92, 126], k: [62, 138], e2: [114, 116], w2: [96, 124] },
    },
  },
  curl_up: {
    name: 'Curl-up de McGill', group: 'core', kind: 'holdreps', sets: 2, reps: 5, hold: 8, perSide: false, rest: 30,
    levels: [{ name: 'Básico', reps: 5, hold: 8 }, { name: 'Medio', reps: 6, hold: 10 }, { name: 'Codos levantados', reps: 6, hold: 10 }],
    machine: 'Esterilla', muscles: ['Recto abdominal', 'Core anterior'],
    setup: ['Boca arriba, una pierna doblada y otra estirada', 'Manos bajo la curva lumbar (no la aplastes)'],
    cues: ['Eleva SOLO cabeza y hombros unos centímetros', 'La barbilla no se mete: cuello quieto', 'A mitad de las repeticiones cambia la pierna doblada'],
    avoid: ['Hacer un abdominal clásico (crunch)', 'Despegar la zona lumbar', 'Tirar del cuello'],
    why: 'Trabaja el abdomen sin flexionar la lumbar: sustituye a los crunch, que no te convienen.',
    art: {
      vb: '0 82 200 76',
      back: MAT,
      A: { face: 1, h: [34, 138], s: [50, 141], hp: [100, 142], k: [132, 142], a: [164, 144], k2: [122, 116], a2: [140, 146], e: [70, 146], w: [88, 145] },
      B: { h: [37, 125], s: [53, 133], e: [70, 145] },
    },
  },
  dead_bug: {
    name: 'Dead bug', group: 'core', kind: 'reps', sets: 2, reps: [6, 8], perSide: true, rest: 30, bodyweight: true,
    machine: 'Esterilla', muscles: ['Transverso abdominal', 'Core anti-extensión'],
    setup: ['Boca arriba, brazos al techo, rodillas a 90º'],
    cues: ['Zona lumbar pegada suave al suelo todo el rato', 'Baja brazo y pierna contraria despacio (3 s)', 'Exhala al bajar'],
    avoid: ['Que se despegue la lumbar del suelo', 'Hacerlo rápido'],
    why: 'Enseña a mantener la columna quieta mientras se mueven brazos y piernas, justo lo que protege los discos lumbares.',
    art: {
      vb: '0 82 200 76',
      back: MAT,
      A: { face: 1, h: [40, 138], s: [54, 141], hp: [104, 142], e: [56, 119], w: [58, 98], e2: [56, 119], w2: [58, 98], k: [106, 114], a: [130, 114], k2: [106, 114], a2: [130, 114] },
      B: { e: [34, 135], w: [14, 131], k: [134, 136], a: [164, 140] },
    },
  },
  pallof: {
    name: 'Pallof press en polea', group: 'core', kind: 'reps', sets: 2, reps: [8, 10], perSide: true, rest: 30, startKg: 5, incKg: 2.5,
    sideLabels: ['Polea a tu derecha', 'Polea a tu izquierda'],
    machine: 'Polea (cruce de poleas) a la altura del pecho', muscles: ['Oblicuos', 'Core anti-rotación'],
    setup: ['Polea a la altura del pecho, agarre simple', 'Ponte de lado a la polea, a un paso largo', 'Pies a la anchura de cadera, rodillas algo flexionadas'],
    cues: ['Empuja el agarre al frente y aguanta 2 s', 'No dejes que la polea te gire', 'Vuelve al pecho despacio'],
    avoid: ['Girar el tronco hacia la polea', 'Arquear la espalda'],
    why: 'Anti-rotación: fortalece el core sin mover la columna. Muy seguro para discos lumbares.',
    art: {
      vb: '0 36 200 100',
      label: 'Vista desde arriba',
      back: R(8, 52, 16, 38) + C(28, 70, 4),
      A: { h: [100, 70], sl: [82, 70], sr: [118, 70], el: [88, 86], wl: [100, 90], er: [112, 86], wr: [100, 90] },
      B: { el: [93, 98], wl: [100, 118], er: [107, 98], wr: [100, 118] },
      dyn: p => cable(28, 70, p.wl) + grip(p.wl),
    },
  },
  puente: {
    name: 'Puente de glúteo', group: 'core', kind: 'reps', sets: 2, reps: [10, 15], rest: 30, bodyweight: true,
    machine: 'Esterilla', muscles: ['Glúteo mayor', 'Isquiotibiales'],
    setup: ['Boca arriba, rodillas dobladas, pies a la anchura de cadera'],
    cues: ['Aprieta glúteos y sube la cadera', 'Arriba: línea recta hombro-cadera-rodilla, 2 s', 'El esfuerzo en el glúteo, no en la lumbar'],
    avoid: ['Subir de más arqueando la espalda', 'Empujar con la lumbar'],
    why: 'El glúteo débil sobrecarga la zona lumbar. Fortalecerlo descarga los discos lumbares.',
    art: {
      vb: '0 82 200 76',
      back: MAT,
      A: { face: 1, h: [26, 140], s: [42, 142], hp: [84, 142], k: [108, 116], a: [118, 146], f: [127, 146], e: [62, 146], w: [82, 146] },
      B: { hp: [84, 124], k: [112, 112] },
    },
  },
  plancha_frontal: {
    name: 'Plancha frontal', group: 'core', kind: 'hold', sets: 2, hold: 20, rest: 30, maxHold: 40,
    levels: [{ name: 'Sobre rodillas', hold: 20 }, { name: 'Sobre pies', hold: 20 }, { name: 'Pies, con toque de hombro', hold: 20 }],
    machine: 'Esterilla', muscles: ['Core anterior', 'Hombros'],
    setup: ['Antebrazos en el suelo, codos bajo hombros', 'Nivel 1: con rodillas apoyadas'],
    cues: ['Aprieta glúteos y abdomen', 'Línea recta de cabeza a rodillas/pies', 'Mejor 20 s perfectos que 60 s mal'],
    avoid: ['Hundir la cadera (carga la lumbar)', 'Subir mucho el culo'],
    why: 'Resistencia del core en posición neutra.',
    art: {
      vb: '0 82 200 76',
      back: MAT,
      A: { face: 1, h: [134, 116], s: [120, 124], hp: [78, 128], k: [52, 136], a: [26, 146], e: [120, 146], w: [140, 146] },
      B: { hp: [78, 126] }, dur: 3000,
    },
  },
  carry: {
    name: 'Paseo con mancuerna a una mano', group: 'core', kind: 'carry', sets: 2, secs: 30, rest: 45, startKg: 12, incKg: 2,
    sideLabels: ['Mancuerna en mano derecha', 'Mancuerna en mano izquierda'],
    machine: 'Mancuernas + pasillo libre', muscles: ['Cuadrado lumbar', 'Oblicuos', 'Agarre'],
    setup: ['Coge la mancuerna doblando rodillas, espalda recta'],
    cues: ['Camina erguido, hombros nivelados', 'No te inclines hacia la mancuerna', 'Pasos cortos y controlados'],
    avoid: ['Coger la mancuerna del suelo con la espalda redonda', 'Ladearte'],
    why: 'Estabilidad lateral del tronco "en la vida real".',
    art: {
      dur: 1500,
      A: { face: 1, h: [94, 35], s: [92, 50], hp: [90, 88], k: [99, 117], a: [106, 147], f: [114, 147], k2: [85, 118], a2: [72, 145], f2: [80, 147], e: [92, 74], w: [92, 98], e2: [96, 72], w2: [102, 94] },
      B: { k: [85, 118], a: [72, 145], f: [80, 147], k2: [99, 117], a2: [106, 147], f2: [114, 147] },
      dyn: p => db([p.w[0], p.w[1] + 4]),
    },
  },

  // ───────── FUERZA: TREN SUPERIOR CON ESPALDA APOYADA ─────────
  press_pecho: {
    name: 'Press de pecho en máquina', group: 'fuerza', kind: 'reps', sets: 3, reps: [10, 12], rest: 75, startKg: 25, incKg: 2.5,
    machine: 'Máquina de press de pecho (sentado)', muscles: ['Pectoral', 'Tríceps', 'Hombro anterior'],
    setup: ['Asiento: asas a la altura de la mitad del pecho', 'Espalda y cabeza pegadas al respaldo', 'Pies planos en el suelo'],
    cues: ['Empuja exhalando, sin bloquear los codos', 'Vuelve en 2 segundos', 'Glúteos y lumbar siempre contra el respaldo'],
    avoid: ['Arquear la lumbar para mover más peso', 'Despegar la espalda del respaldo'],
    why: 'Empuje con la columna 100 % apoyada: carga casi nula en la zona lumbar.',
    art: {
      back: R(40, 18, 8, 130) + CHAIR,
      A: { ...SEATED, e: [58, 84], w: [86, 77] },
      B: { e: [92, 75], w: [118, 74] },
      dyn: p => lever(46, 26, p.w),
    },
  },
  remo_pecho: {
    name: 'Remo con apoyo en el pecho', group: 'fuerza', kind: 'reps', sets: 3, reps: [10, 12], rest: 75, startKg: 25, incKg: 2.5,
    machine: 'Máquina de remo sentado con almohadilla de pecho', muscles: ['Dorsal', 'Romboides', 'Trapecio medio', 'Bíceps'],
    setup: ['Altura de asiento: asas a la altura del pecho', 'Pecho apoyado en la almohadilla TODO el tiempo'],
    cues: ['Tira llevando los codos atrás y juntando escápulas', 'Pausa 1 s atrás', 'Vuelve estirando brazos sin despegar el pecho'],
    avoid: ['Separar el pecho del apoyo y tirar con la espalda', 'Encoger hombros'],
    why: 'El mejor remo para ti: la almohadilla sujeta el tronco y la lumbar no trabaja.',
    art: {
      back: R(140, 18, 8, 130) + SEAT + L(98, 79, 140, 79, 4) + R(90, 60, 9, 36, 'm', 4),
      A: { face: 1, h: [86, 56], s: [80, 72], hp: [70, 108], k: [100, 108], a: [102, 140], f: [111, 141], e: [102, 79], w: [124, 82] },
      B: { e: [58, 84], w: [86, 81] },
      dyn: p => lever(142, 28, p.w),
    },
  },
  press_hombro: {
    name: 'Press de hombro en máquina', group: 'fuerza', kind: 'reps', sets: 3, reps: [10, 12], rest: 75, startKg: 15, incKg: 2.5,
    machine: 'Máquina de press de hombros (sentado, con respaldo)', muscles: ['Deltoides', 'Tríceps'],
    setup: ['Asas a la altura de los hombros al empezar', 'Respaldo vertical, espalda pegada'],
    cues: ['Sube sin bloquear codos', 'Costillas abajo: no arquees al empujar', 'Peso moderado, técnica perfecta'],
    avoid: ['Arquear la lumbar al subir', 'Hacerlo de pie con barra (carga la columna)'],
    why: 'Hombro fuerte sin carga de compresión sobre la columna gracias al respaldo.',
    art: {
      back: CHAIR,
      A: { ...SEATED, e: [82, 90], w: [86, 68] },
      B: { e: [80, 47], w: [84, 24] },
      dyn: p => lever(44, 44, p.w),
    },
  },
  face_pull: {
    name: 'Face pull en polea', group: 'fuerza', kind: 'reps', sets: 3, reps: [12, 15], rest: 60, startKg: 10, incKg: 2.5,
    machine: 'Polea alta con cuerda', muscles: ['Deltoides posterior', 'Manguito rotador', 'Trapecio medio'],
    setup: ['Polea a la altura de la frente, con cuerda', 'Un pie adelantado, rodillas algo flexionadas'],
    cues: ['Tira de la cuerda hacia la cara separando las manos', 'Codos altos, abre el pecho', 'Abdomen firme, tronco quieto'],
    avoid: ['Echar el cuerpo atrás para tirar', 'Usar demasiado peso'],
    why: 'Postura: compensa horas sentado y hombros adelantados.',
    art: {
      back: R(14, 8, 14, 142) + C(34, 40, 4),
      A: { ...standing(106, -1), e: [84, 46], w: [62, 43] },
      B: { e: [122, 42], w: [99, 36] },
      dyn: p => cable(34, 40, p.w) + rope(p.w),
    },
  },
  jalon: {
    name: 'Jalón al pecho', group: 'fuerza', kind: 'reps', sets: 3, reps: [10, 12], rest: 75, startKg: 30, incKg: 2.5,
    machine: 'Polea alta de jalón (sentado, con sujeción de muslos)', muscles: ['Dorsal ancho', 'Bíceps', 'Romboides'],
    setup: ['Ajusta el rodillo para que sujete los muslos', 'Agarre algo más ancho que los hombros (o neutro)'],
    cues: ['Baja la barra a la parte alta del pecho', 'Piensa en llevar los codos a los bolsillos', 'Sube controlando, sin soltar de golpe'],
    avoid: ['Echarte muy atrás para tirar', 'Bajar la barra por detrás de la nuca'],
    why: 'Espalda alta y dorsal con la pelvis fija: protege la zona lumbar.',
    art: {
      back: R(132, 4, 9, 146) + L(80, 6, 140, 6, 5) + C(82, 8, 4) + SEAT,
      front: R(92, 95, 16, 8, 'm', 4),
      A: { face: 1, h: [74, 54], s: [72, 70], hp: [70, 108], k: [100, 107], a: [102, 140], f: [111, 141], e: [80, 46], w: [84, 22] },
      B: { e: [64, 92], w: [84, 66] },
      dyn: p => cable(82, 8, p.w) + L(p.w[0] - 7, p.w[1], p.w[0] + 7, p.w[1], 4, 'hiline'),
    },
  },
  press_inclinado: {
    name: 'Press inclinado en máquina', group: 'fuerza', kind: 'reps', sets: 3, reps: [10, 12], rest: 75, startKg: 20, incKg: 2.5,
    machine: 'Máquina de press inclinado (respaldo reclinado)', muscles: ['Pectoral superior', 'Hombro', 'Tríceps'],
    setup: ['Respaldo reclinado, espalda entera apoyada', 'Asas a la altura de la parte alta del pecho'],
    cues: ['Empuja hacia arriba y adelante', 'Escápulas juntas y apoyadas', 'Bajada controlada en 2 s'],
    avoid: ['Despegar la lumbar del respaldo'],
    why: 'Variante de empuje con apoyo completo de la espalda.',
    art: {
      back: L(62, 114, 42, 58, 9) + SEAT,
      A: { face: 1, h: [52, 58], s: [58, 74], hp: [70, 108], k: [100, 108], a: [102, 140], f: [111, 141], e: [50, 92], w: [78, 80] },
      B: { e: [80, 58], w: [102, 44] },
      dyn: p => lever(34, 132, p.w),
    },
  },
  remo_polea: {
    name: 'Remo en polea baja sentado', group: 'fuerza', kind: 'reps', sets: 3, reps: [10, 12], rest: 75, startKg: 25, incKg: 2.5,
    machine: 'Polea baja con banco y plataforma para pies (agarre en V)', muscles: ['Dorsal', 'Romboides', 'Bíceps'],
    setup: ['Rodillas ligeramente dobladas', 'Coge el agarre y siéntate erguido ANTES de tirar'],
    cues: ['Tronco quieto y vertical durante toda la serie', 'Lleva el agarre al ombligo, codos pegados', 'Vuelve sin dejarte llevar hacia delante'],
    avoid: ['Balancear el tronco adelante y atrás', 'Redondear la espalda al estirar los brazos'],
    why: 'Fortalece la espalda manteniendo la columna neutra. Si un día notas la lumbar, cámbialo por el remo con apoyo.',
    art: {
      back: R(38, 125, 58, 6) + R(56, 131, 6, 17) + R(104, 110, 6, 34, 'm', 2) + R(150, 62, 12, 88) + C(148, 104, 4),
      A: { face: 1, h: [64, 70], s: [62, 86], hp: [60, 121], k: [86, 104], a: [102, 124], f: [104, 115], e: [86, 93], w: [110, 98] },
      B: { e: [44, 100], w: [68, 96] },
      dyn: p => cable(148, 104, p.w) + grip(p.w),
    },
  },
  pec_deck: {
    name: 'Aperturas en máquina (contractor)', group: 'fuerza', kind: 'reps', sets: 2, reps: [12, 15], rest: 60, startKg: 20, incKg: 2.5,
    machine: 'Contractor de pecho / pec deck', muscles: ['Pectoral'],
    setup: ['Asiento: codos a la altura de los hombros', 'Espalda pegada al respaldo'],
    cues: ['Junta los brazos delante abrazando un árbol', 'Aprieta 1 s delante', 'Abre despacio sin pasar la línea del cuerpo'],
    avoid: ['Despegar la espalda', 'Abrir demasiado atrás'],
    why: 'Pectoral aislado, sin ninguna carga en la columna.',
    art: {
      vb: '0 36 200 100',
      label: 'Vista desde arriba',
      back: R(78, 96, 44, 10, 'm', 4),
      A: { h: [100, 92], sl: [82, 94], sr: [118, 94], el: [58, 96], wl: [56, 72], er: [142, 96], wr: [144, 72] },
      B: { el: [88, 68], wl: [97, 48], er: [112, 68], wr: [103, 48] },
      dyn: p => L(p.el[0], p.el[1], p.wl[0], p.wl[1], 9, 'hiline') + L(p.er[0], p.er[1], p.wr[0], p.wr[1], 9, 'hiline'),
    },
  },
  curl_maquina: {
    name: 'Curl de bíceps en máquina', group: 'fuerza', kind: 'reps', sets: 2, reps: [10, 12], rest: 60, startKg: 15, incKg: 2.5,
    machine: 'Máquina de curl de bíceps (banco Scott)', muscles: ['Bíceps', 'Braquial'],
    setup: ['Axilas apoyadas en el borde del pupitre', 'Asiento que permita el brazo bien apoyado'],
    cues: ['Sube sin despegar los codos', 'Baja en 2-3 s', 'Muñeca firme'],
    avoid: ['Balancear el cuerpo para subir'],
    why: 'Brazo apoyado y tronco quieto.',
    art: {
      back: SEAT + PG('84,82 120,100 116,108 80,90') + R(112, 104, 6, 44),
      A: { face: 1, h: [74, 56], s: [72, 72], hp: [66, 108], k: [96, 108], a: [98, 140], f: [107, 141], e: [98, 89], w: [120, 107] },
      B: { w: [93, 62] },
      dyn: p => grip(p.w),
    },
  },
  triceps_polea: {
    name: 'Extensión de tríceps en polea', group: 'fuerza', kind: 'reps', sets: 2, reps: [12, 15], rest: 60, startKg: 15, incKg: 2.5,
    machine: 'Polea alta con cuerda o barra', muscles: ['Tríceps'],
    setup: ['Pies a la anchura de cadera, rodillas algo flexionadas', 'Codos pegados a los costados'],
    cues: ['Solo se mueven los antebrazos', 'Estira abajo y aprieta 1 s', 'Abdomen firme'],
    avoid: ['Inclinarte encima de la polea', 'Mover los codos'],
    why: 'Tríceps de pie con carga ligera y tronco neutro.',
    art: {
      back: R(140, 4, 12, 146) + C(136, 12, 4),
      A: { ...standing(88, 1), e: [94, 78], w: [110, 64] },
      B: { w: [100, 103] },
      dyn: p => cable(136, 12, p.w) + rope(p.w),
    },
  },
  elev_laterales: {
    name: 'Elevaciones laterales sentado', group: 'fuerza', kind: 'reps', sets: 2, reps: [12, 15], rest: 60, startKg: 5, incKg: 1,
    machine: 'Banco con respaldo + mancuernas ligeras (o máquina de laterales)', muscles: ['Deltoides lateral'],
    setup: ['Sentado con la espalda apoyada en el respaldo', 'Mancuernas ligeras'],
    cues: ['Sube hasta la altura de los hombros', 'Codos ligeramente doblados', 'Baja despacio'],
    avoid: ['Balancear el tronco', 'Subir por encima de los hombros'],
    why: 'Hombro sin carga en la columna.',
    art: {
      label: 'Vista de frente',
      back: R(70, 111, 60, 8) + R(76, 119, 6, 29) + R(118, 119, 6, 29) + R(76, 60, 48, 52, 'm', 6),
      A: { h: [100, 38], n: [100, 52], pc: [100, 104], sl: [84, 56], sr: [116, 56], hl: [91, 108], hr: [109, 108], kl: [88, 120], al: [86, 148], kr: [112, 120], ar: [114, 148], el: [80, 80], wl: [80, 101], er: [120, 80], wr: [120, 101] },
      B: { el: [63, 58], wl: [46, 61], er: [137, 58], wr: [154, 61] },
      dyn: p => db(p.wl) + db(p.wr),
    },
  },

  // ───────── VUELTA A LA CALMA ─────────
  caminar: {
    name: 'Paseo + respiración', group: 'calma', kind: 'time', minutes: 2,
    machine: 'Pasillo o cinta a ritmo suave', muscles: ['Recuperación'],
    setup: ['Camina suave'],
    cues: ['Inspira 4 s por la nariz llevando aire a la tripa', 'Espira 6 s por la boca', 'Hombros sueltos'],
    avoid: ['Sentarte nada más terminar (mejor seguir moviéndote)'],
    why: 'Tu médico recomienda no estar mucho rato sentado o quieto: termina caminando.',
    art: {
      dur: 1400,
      A: { face: 1, h: [94, 35], s: [92, 50], hp: [90, 88], k: [99, 117], a: [106, 147], f: [114, 147], k2: [85, 118], a2: [72, 145], f2: [80, 147], e: [86, 72], w: [80, 92], e2: [98, 72], w2: [106, 90] },
      B: { k: [85, 118], a: [72, 145], f: [80, 147], k2: [99, 117], a2: [106, 147], f2: [114, 147], e: [98, 72], w: [106, 90], e2: [86, 72], w2: [80, 92] },
    },
  },

  // ───────── SPINNING ─────────
  spinning: {
    name: 'Spinning', group: 'cardio', kind: 'time', minutes: 45,
    machine: 'Sala de ciclo indoor', muscles: ['Cardio', 'Piernas'],
    setup: ['Manillar algo más alto que el sillín', 'Sillín: rodilla casi estirada abajo'],
    cues: ['Tronco largo, abdomen activo', 'Si molesta la lumbar: más tiempo sentado, menos de pie', 'Hidrátate'],
    avoid: ['Manillar muy bajo (flexiona la lumbar)', 'Saltos y sprints de pie si notas la espalda'],
    why: 'Mantienes el cardio. Con el manillar alto la columna va más neutra.',
    art: {
      at(t) {
        const ang = t * 2 * Math.PI, c = [100, 118], r = 13, hp = [78, 70];
        const a = [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang)];
        const a2 = [c[0] - r * Math.cos(ang), c[1] - r * Math.sin(ang)];
        return { face: 1, h: [110, 28], s: [102, 42], hp, e: [116, 54], w: [128, 58], a, k: ik(hp, a, 32, 32, 1), a2, k2: ik(hp, a2, 32, 32, 1) };
      },
      dur: 1100,
      back: C(136, 124, 20) + L(100, 118, 136, 124, 4) + L(100, 118, 80, 78, 5) + R(66, 72, 24, 5, 'm', 2) + L(136, 124, 130, 62, 5) + L(122, 60, 136, 57, 5) + L(84, 146, 150, 146, 6) + L(100, 118, 96, 146, 4) + L(136, 124, 140, 146, 4),
      dyn: p => L(p.a[0], p.a[1], p.a2[0], p.a2[1], 3) + L(p.a[0] - 5, p.a[1], p.a[0] + 5, p.a[1], 3, 'hiline') + C(100, 118, 3, 'hi'),
    },
  },
};

for (const [id, e] of Object.entries(EXERCISES)) e.id = id;

export const GROUPS = {
  warm: { name: 'Calentamiento', short: 'Calentar', color: 'var(--c-warm)' },
  core: { name: 'Core y zona lumbar', short: 'Core', color: 'var(--c-core)' },
  fuerza: { name: 'Fuerza tren superior', short: 'Fuerza', color: 'var(--c-fuerza)' },
  calma: { name: 'Vuelta a la calma', short: 'Calma', color: 'var(--c-calma)' },
  cardio: { name: 'Cardio', short: 'Cardio', color: 'var(--c-cardio)' },
};
