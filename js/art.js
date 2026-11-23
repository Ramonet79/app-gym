// Motor de ilustraciones v2: figura con volumen (ropa, contorno), movimiento por ángulos articulares,
// apoyos fijos con cinemática inversa, músculo trabajado resaltado, trayectoria guía y rótulo de fase con tempo.
const f = n => (+n).toFixed(1);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 0.5 - Math.cos(Math.PI * t) / 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = v => Math.hypot(v[0], v[1]);
const norm = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const dist = (a, b) => len(sub(a, b));
const ang = v => Math.atan2(v[1], v[0]);
const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
const polar = (o, a, l) => [o[0] + Math.cos(a) * l, o[1] + Math.sin(a) * l];

// Cinemática inversa de dos segmentos
export function ik(A, B, l1, l2, bend = 1) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  let d = Math.hypot(dx, dy);
  d = Math.max(0.01, Math.min(d, l1 + l2 - 0.01));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  const mx = A[0] + ux * a, my = A[1] + uy * a;
  return [mx + uy * h * bend, my - ux * h * bend];
}
const bendOf = (r, m, e) => { const u = sub(e, r), v = sub(m, r); return (u[0] * v[1] - u[1] * v[0]) < 0 ? 1 : -1; };
const straightness = (r, m, e) => dist(r, e) / ((dist(r, m) + dist(m, e)) || 1);

// ───── interpolación anatómica ─────
const SINGLES_FIRST = [['hp', 's'], ['s', 'h'], ['n', 'h']];
const CHAINS = [['s', 'e', 'w'], ['s', 'e2', 'w2'], ['hp', 'k', 'a'], ['hp', 'k2', 'a2'], ['sl', 'el', 'wl'], ['sr', 'er', 'wr'], ['hl', 'kl', 'al'], ['hr', 'kr', 'ar']];
const SINGLES_LAST = [['a', 'f'], ['a2', 'f2']];

export function lerpPose(A, B, t) {
  const o = {};
  for (const k in A) {
    const a = A[k], b = B && B[k] !== undefined ? B[k] : a;
    o[k] = Array.isArray(a) ? [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] : a;
  }
  if (!B || t === 0 || t === 1) return t === 1 && B ? Object.assign(o, Object.fromEntries(Object.entries(B).filter(([, v]) => Array.isArray(v)))) : o;
  const Bf = k => (B[k] !== undefined ? B[k] : A[k]);
  const single = ([p, c]) => {
    if (!A[p] || !A[c]) return;
    const va = sub(A[c], A[p]), vb = sub(Bf(c), Bf(p));
    o[c] = polar(o[p], lerpAng(ang(va), ang(vb), t), lerp(len(va), len(vb), t));
  };
  SINGLES_FIRST.forEach(single);
  for (const [r, m, e] of CHAINS) {
    if (!A[r] || !A[m] || !A[e]) continue;
    const l1 = lerp(dist(A[r], A[m]), dist(Bf(r), Bf(m)), t), l2 = lerp(dist(A[m], A[e]), dist(Bf(m), Bf(e)), t);
    const fixed = dist(A[e], Bf(e)) < 0.6;
    const sA = straightness(A[r], A[m], A[e]), sB = straightness(Bf(r), Bf(m), Bf(e));
    const bA = bendOf(A[r], A[m], A[e]), bB = bendOf(Bf(r), Bf(m), Bf(e));
    const midFixed = dist(A[m], Bf(m)) < 0.6 && dist(A[r], Bf(r)) < 0.6;
    const bothStraight = sA > 0.95 && sB > 0.95;
    if (midFixed && !fixed) {
      // codo/rodilla apoyados (curl, tríceps): solo gira el segundo segmento
      o[m] = A[m];
      o[e] = polar(o[m], lerpAng(ang(sub(A[e], A[m])), ang(sub(Bf(e), Bf(m))), t), l2);
    } else if (fixed || (!bothStraight && (bA === bB || sA > 0.95 || sB > 0.95))) {
      // apoyo fijo, o el extremo viaja en línea recta (press, remos, jalones) con longitudes constantes
      const end = fixed ? A[e] : o[e];
      o[e] = end;
      o[m] = ik(o[r], end, l1, l2, sA <= sB ? bA : bB);
    } else {
      // giro articular (brazo o pierna que barre un arco)
      const a1 = lerpAng(ang(sub(A[m], A[r])), ang(sub(Bf(m), Bf(r))), t);
      const a2 = lerpAng(ang(sub(A[e], A[m])), ang(sub(Bf(e), Bf(m))), t);
      o[m] = polar(o[r], a1, l1);
      o[e] = polar(o[m], a2, l2);
    }
  }
  SINGLES_LAST.forEach(single);
  return o;
}

// ───── primitivas de cuerpo ─────
// Segmento cónico: polígono + dos círculos. Se dibuja dos veces (contorno y relleno) para un perfil limpio.
function cap(P, Q, r1, r2) {
  const d = sub(Q, P), n = norm([-d[1], d[0]]);
  const p1 = add(P, mul(n, r1)), p2 = add(Q, mul(n, r2)), p3 = sub(Q, mul(n, r2)), p4 = sub(P, mul(n, r1));
  return `<polygon points="${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])} ${f(p3[0])},${f(p3[1])} ${f(p4[0])},${f(p4[1])}"/><circle cx="${f(P[0])}" cy="${f(P[1])}" r="${r1}"/><circle cx="${f(Q[0])}" cy="${f(Q[1])}" r="${r2}"/>`;
}
const dot = (P, r) => `<circle cx="${f(P[0])}" cy="${f(P[1])}" r="${r}"/>`;
const poly = pts => `<polygon points="${pts.map(p => f(p[0]) + ',' + f(p[1])).join(' ')}"/>`;
// Una pieza = contorno oscuro + relleno con el color de la ropa/piel
const part = (shapes, cls) => shapes ? `<g class="ol">${shapes}</g><g class="${cls}">${shapes}</g>` : '';

function spinePts(p, N = 8) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    if (p.sp) { const q = (a, b, c) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c; pts.push([q(p.hp[0], p.sp[0], p.s[0]), q(p.hp[1], p.sp[1], p.s[1])]); }
    else pts.push([lerp(p.hp[0], p.s[0], u), lerp(p.hp[1], p.s[1], u)]);
  }
  return pts;
}
const TORSO_R = u => u < 0.35 ? lerp(8.6, 7.2, u / 0.35) : u < 0.78 ? lerp(7.2, 9.6, (u - 0.35) / 0.43) : lerp(9.6, 8.2, (u - 0.78) / 0.22);
function torsoSide(p) {
  const pts = spinePts(p), L = [], R = [];
  pts.forEach((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = sub(b, a), n = norm([-d[1], d[0]]), r = TORSO_R(i / (pts.length - 1));
    L.push(add(q, mul(n, r))); R.push(sub(q, mul(n, r)));
  });
  return poly([...L, ...R.reverse()]) + dot(p.hp, 8.6) + dot(p.s, 8);
}
// Normal hacia el pecho en vista lateral
function frontN(p, art) {
  const pts = spinePts(p, 4), d = norm(sub(pts[3], pts[1]));
  const n = [-d[1], d[0]];
  return art?.flip ? mul(n, -1) : n;
}
function head(p, art) {
  if (!p.h) return '';
  let s = part(dot(p.h, 9.6), 'skin');
  if (!p.s || !p.hp) return s;
  const up = norm(sub(p.h, p.s));
  let fw = frontN(p, art);
  if (p.face && Math.abs(up[1]) > 0.8) fw = [p.face, 0]; // de pie o sentado: mira hacia donde indica face
  const R = 9.6, at = v => add(p.h, mul(norm(v), R));
  const P1 = at(add(mul(fw, -1), mul(up, -0.25))), P2 = at(add(mul(fw, 0.55), up));
  const d = ang(sub(P2, p.h)) - ang(sub(P1, p.h)), dd = Math.atan2(Math.sin(d), Math.cos(d));
  const inner = add(p.h, add(mul(up, 2.5), mul(fw, -1.5)));
  s += `<path d="M${f(P1[0])},${f(P1[1])} A${R} ${R} 0 0 ${dd > 0 ? 1 : 0} ${f(P2[0])},${f(P2[1])} Q${f(inner[0])},${f(inner[1])} ${f(P1[0])},${f(P1[1])}Z" class="hair"/>`;
  const eye = add(p.h, add(mul(fw, 4.8), mul(up, 1.2)));
  s += `<circle cx="${f(eye[0])}" cy="${f(eye[1])}" r="1.4" class="eye"/>`;
  const n0 = add(p.h, add(mul(fw, 9.3), mul(up, 0.4))), n1 = add(n0, add(mul(fw, 2.2), mul(up, -2.4))), n2 = add(n1, mul(fw, -2.4));
  s += `<path d="M${f(n0[0])},${f(n0[1])} L${f(n1[0])},${f(n1[1])} L${f(n2[0])},${f(n2[1])}" class="nose"/>`;
  return s;
}

export function figure(p, art) {
  let s = '<g class="fig">';
  const has = k => !!p[k];
  // ── extremidades lejanas
  if (has('k2')) s += `<g class="far">${part(cap(p.hp, p.k2, 6, 4.8), 'shorts')}${part(cap(p.k2, p.a2, 4.6, 3.4) + (p.f2 ? cap(p.a2, p.f2, 3.2, 2.4) : ''), 'skin')}${p.f2 ? part(cap(p.a2, p.f2, 3.4, 2.6), 'shoe') : ''}</g>`;
  if (has('e2')) s += `<g class="far">${part(cap(p.s, p.e2, 4.4, 3.6), 'shirt')}${part(cap(p.e2, p.w2, 3.4, 2.8) + dot(p.w2, 3.2), 'skin')}</g>`;
  // ── vista frontal / cenital
  if (has('sl') && has('sr')) {
    const sl = p.sl, sr = p.sr;
    if (has('hl') && has('hr')) {
      s += part(cap(p.hl, p.kl, 6.4, 5) + cap(p.hr, p.kr, 6.4, 5), 'shorts');
      s += part(cap(p.kl, p.al, 4.8, 3.6) + cap(p.kr, p.ar, 4.8, 3.6), 'skin');
      s += part(cap(p.al, add(p.al, [-4, 1]), 3.4, 3) + cap(p.ar, add(p.ar, [4, 1]), 3.4, 3), 'shoe');
      s += part(poly([add(p.hl, [-6, 4]), add(p.hr, [6, 4]), add(p.hr, [5, -8]), add(p.hl, [-5, -8])]), 'shorts');
      const wl = add([lerp(sl[0], p.hl[0], 0.62), lerp(sl[1], p.hl[1], 0.62)], [2, 0]), wr = add([lerp(sr[0], p.hr[0], 0.62), lerp(sr[1], p.hr[1], 0.62)], [-2, 0]);
      s += part(poly([add(sl, [-3, -3]), add(sr, [3, -3]), add(sr, [4, 6]), wr, add(p.hr, [4, -6]), add(p.hl, [-4, -6]), wl, add(sl, [-4, 6])]), 'shirt');
    } else {
      // vista cenital: hombros como una pieza
      s += part(cap(sl, sr, 7, 7), 'shirt');
    }
    if (has('n') && has('h')) s += part(cap(p.n, p.h, 3.4, 3.4), 'skin');
    s += part(cap(sl, p.el, 4.6, 3.8) + cap(sr, p.er, 4.6, 3.8), 'shirt');
    s += part(cap(p.el, p.wl, 3.6, 2.9) + dot(p.wl, 3.4) + cap(p.er, p.wr, 3.6, 2.9) + dot(p.wr, 3.4), 'skin');
    s += muscles(p, art, 'front');
    if (has('h')) s += part(dot(p.h, 9.6), 'skin') + (has('n') ? `<path d="M${f(p.h[0] - 9.4)},${f(p.h[1] - 1)} A9.6 9.6 0 0 1 ${f(p.h[0] + 9.4)},${f(p.h[1] - 1)} Q${f(p.h[0])},${f(p.h[1] - 5)} ${f(p.h[0] - 9.4)},${f(p.h[1] - 1)}Z" class="hair"/>` : `<circle cx="${f(p.h[0])}" cy="${f(p.h[1])}" r="9.6" class="hair-top"/>`);
    return s + '</g>';
  }
  // ── vista lateral
  if (has('hp') && has('s')) s += part(torsoSide(p), 'shirt');
  if (has('k')) s += part(cap(p.hp, p.k, 6.6, 5), 'shorts');
  if (has('a')) s += part(cap(p.k, p.a, 4.9, 3.6), 'skin');
  if (has('f')) s += part(cap(p.a, p.f, 3.6, 2.6), 'shoe');
  if (has('s') && has('h')) s += part(cap(p.s, add(p.s, mul(sub(p.h, p.s), 0.55)), 3.6, 3.4), 'skin');
  s += head(p, art);
  if (has('e')) s += part(cap(p.s, p.e, 4.7, 3.9), 'shirt');
  if (has('w')) s += part(cap(p.e, p.w, 3.7, 3) + dot(p.w, 3.4), 'skin');
  s += muscles(p, art, 'side');
  return s + '</g>';
}

// ───── músculo que trabaja (se ilumina con el esfuerzo) ─────
const MUSCLE_RX = [
  [/pectoral|pecho/i, 'chest'], [/dorsal|romboides|trapecio|redondo/i, 'back'], [/deltoides|hombro|manguito/i, 'shoulder'],
  [/b[ií]ceps|braquial/i, 'biceps'], [/tr[ií]ceps/i, 'triceps'], [/gl[uú]teo/i, 'glute'],
  [/recto abdominal|transverso|core anterior|oblicuos|anti-/i, 'abs'], [/mult[ií]fido|erectores|cuadrado lumbar/i, 'lowback'], [/isquio/i, 'hams'],
];
function regionsOf(art) {
  const set = new Set();
  for (const m of art?.muscles || []) for (const [rx, r] of MUSCLE_RX) if (rx.test(m)) set.add(r);
  return set;
}
function muscles(p, art, view) {
  const R = regionsOf(art);
  if (!R.size) return '';
  let s = '';
  if (view === 'side' && p.hp && p.s) {
    const pts = spinePts(p), n = frontN(p, art), at = u => pts[Math.round(u * (pts.length - 1))];
    const band = (u1, u2, side, r) => cap(add(at(u1), mul(n, side * 4.2)), add(at(u2), mul(n, side * 4.2)), r, r);
    if (R.has('chest')) s += band(0.62, 0.9, 1, 4.6);
    if (R.has('abs')) s += band(0.12, 0.55, 1, 3.8);
    if (R.has('back')) s += band(0.5, 0.92, -1, 4.8);
    if (R.has('lowback')) s += band(0.08, 0.45, -1, 4.2);
    if (R.has('glute') && p.k) s += dot(add(p.hp, mul(n, -4)), 6.4);
    if (R.has('hams') && p.k) s += cap(p.hp, p.k, 4.4, 3.6);
    if (R.has('shoulder') && p.e) s += dot(add(p.s, mul(norm(sub(p.e, p.s)), 3)), 5.2);
    if ((R.has('biceps') || R.has('triceps')) && p.e) s += cap(add(p.s, mul(sub(p.e, p.s), 0.2)), p.e, 3.6, 3.1);
  } else if (view === 'front' && p.sl) {
    const mid = [(p.sl[0] + p.sr[0]) / 2, (p.sl[1] + p.sr[1]) / 2];
    const down = p.pc ? norm(sub(p.pc, mid)) : [0, 1];
    if (R.has('chest')) s += cap(add(add(mid, mul(down, 9)), [-7, 0]), add(add(mid, mul(down, 9)), [7, 0]), 5.5, 5.5);
    if (R.has('abs') && p.pc) s += cap(add(mid, mul(down, 22)), add(mid, mul(down, 40)), 5, 5);
    if (R.has('shoulder') || R.has('back')) s += dot(p.sl, 5.4) + dot(p.sr, 5.4);
    if ((R.has('biceps') || R.has('triceps')) && p.el) s += cap(p.sl, p.el, 3.6, 3.1) + cap(p.sr, p.er, 3.6, 3.1);
  }
  return s ? `<g class="mus" opacity="${(0.28 + 0.55 * EFFORT).toFixed(2)}">${s}</g>` : '';
}

// ───── guías de movimiento ─────
const EFFECTORS = ['w', 'wl', 'wr', 'h', 'hp', 'a', 'e', 'el'];
function guideFor(art) {
  if (art._guide !== undefined) return art._guide;
  let best = art.guide || null, bd = 9;
  if (art.B && !art.at && !best) {
    const P0 = poseAt(art, 0), P1 = poseAt(art, 1);
    for (const k of EFFECTORS) if (P0[k] && P1[k]) { const d = dist(P0[k], P1[k]); if (d > bd) { bd = d; best = k; } }
  }
  if (best) {
    const path = [];
    for (let i = 0; i <= 16; i++) path.push(poseAt(art, i / 16)[best]);
    art._guide = { k: best, path };
  } else art._guide = null;
  return art._guide;
}
function guideSVG(art, phase) {
  const g = guideFor(art);
  if (!g || !phase || phase === 'cyc') return '';
  const back = phase === 'down';
  const pts = back ? [...g.path].reverse() : g.path;
  const d = 'M' + pts.map(p => f(p[0]) + ',' + f(p[1])).join(' L');
  const e = pts.at(-1), pr = pts.at(-3) || pts[0];
  const v = norm(sub(e, pr)), n = [-v[1], v[0]];
  const h1 = add(sub(e, mul(v, 7)), mul(n, 4.2)), h2 = sub(sub(e, mul(v, 7)), mul(n, 4.2));
  return `<g class="guide ${back ? 'back' : ''}"><path d="${d}" class="g-path"/><polygon points="${f(e[0])},${f(e[1])} ${f(h1[0])},${f(h1[1])} ${f(h2[0])},${f(h2[1])}" class="g-head"/></g>`;
}
function ghostSVG(art, phase) {
  if (!art.B || art.at || !phase || phase === 'cyc') return '';
  const target = phase === 'down' || phase === 'top' ? 0 : 1;
  const p = poseAt(art, target);
  return `<g class="ghost">${figureLines(p)}</g>`;
}
// Silueta fina (para la posición objetivo)
function figureLines(p) {
  const L = (a, b) => p[a] && p[b] ? `<line x1="${f(p[a][0])}" y1="${f(p[a][1])}" x2="${f(p[b][0])}" y2="${f(p[b][1])}"/>` : '';
  let s = L('hp', 's') + L('s', 'e') + L('e', 'w') + L('hp', 'k') + L('k', 'a') + L('sl', 'el') + L('el', 'wl') + L('sr', 'er') + L('er', 'wr') + L('sl', 'sr') + L('hl', 'kl') + L('kl', 'al') + L('hr', 'kr') + L('kr', 'ar');
  if (p.h) s += `<circle cx="${f(p.h[0])}" cy="${f(p.h[1])}" r="9"/>`;
  return s;
}
function captionSVG(art, phase, vb) {
  if (!phase || phase === 'cyc' || !art.steps) return '';
  const [x, y, w, h] = vb.split(' ').map(Number);
  const txt = phase === 'up' ? art.steps[0] : phase === 'down' ? art.steps[1] : phase === 'top' ? (art.steps[2] || 'Pausa') : 'Posición inicial';
  const cls = phase === 'up' ? 'c-up' : phase === 'down' ? 'c-down' : 'c-hold';
  const num = phase === 'up' ? '1' : phase === 'down' ? '2' : '';
  return `<g class="cap ${cls}"><rect x="${x + 4}" y="${y + h - 17}" width="${Math.min(w - 8, 14 + txt.length * 4.6)}" height="13" rx="6.5"/>${num ? `<text x="${x + 10}" y="${y + h - 7.6}" class="cap-n">${num}</text>` : ''}<text x="${x + (num ? 17 : 10)}" y="${y + h - 7.6}">${txt}</text></g>`;
}

function poseAt(art, t) {
  return art.at ? art.at(t) : lerpPose(art.A, art.B || art.A, t);
}

let EFFORT = 1;
function inner(art, p, phase, effort, vb) {
  EFFORT = effort ?? 1;
  return (phase ? ghostSVG(art, phase) : '') + (art.dyn ? art.dyn(p) : '') + figure(p, art) +
    (art.front ? (typeof art.front === 'function' ? art.front(p) : art.front) : '') +
    (phase ? guideSVG(art, phase) + captionSVG(art, phase, vb) : '');
}

// cls 'big' = vista de ejercicio con guías (trayectoria, objetivo y fase)
export function artSVG(art, t = 0, cls = '') {
  if (!art) return '';
  const p = poseAt(art, t);
  const vb = art.vb || '0 0 200 160';
  const top = +vb.split(' ')[1];
  const guides = cls.includes('big') && !art.at && !isCyclic(art);
  return `<svg viewBox="${vb}" class="art ${cls}" aria-hidden="true">
    <rect x="-10" y="150.5" width="220" height="20" class="ground"/><line x1="0" y1="150.5" x2="200" y2="150.5" class="floor"/>
    ${art.back || ''}<g class="dyn">${inner(art, p, guides ? 'start' : null, t, vb)}</g>
    ${art.label ? `<text x="100" y="${top + 11}" class="art-label">${art.label}</text>` : ''}
  </svg>`;
}
const isCyclic = art => !!art.at || (art.dur && art.dur < 2000);

// Animación continua (una sola a la vez para ahorrar batería)
// Tempo: posición inicial → fase 1 (≈1 s) → pausa → fase 2 controlada (≈2 s).
const T0 = performance.now();
let current = null;
export function animate(svgEl, art, { slow = false, guides = true } = {}) {
  stopAnim();
  if (!svgEl || !art || (!art.B && !art.at)) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dyn = svgEl.querySelector('.dyn');
  const cyc = isCyclic(art);
  const dur = (art.dur || 3800) * (reduce ? 1.6 : 1) * (slow ? 2.2 : 1);
  const vb = art.vb || '0 0 200 160';
  const showG = guides && svgEl.classList.contains('big') && !cyc;
  let last = 0, raf;
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps
    last = now;
    const ph = ((now - T0) % dur) / dur;
    let t, phase;
    if (cyc) { t = art.at ? ph : ph < 0.5 ? ease(ph / 0.5) : 1 - ease((ph - 0.5) / 0.5); phase = 'cyc'; }
    else if (ph < 0.1) { t = 0; phase = 'start'; }
    else if (ph < 0.36) { t = ease((ph - 0.1) / 0.26); phase = 'up'; }
    else if (ph < 0.46) { t = 1; phase = 'top'; }
    else if (ph < 0.96) { t = 1 - ease((ph - 0.46) / 0.5); phase = 'down'; }
    else { t = 0; phase = 'start'; }
    dyn.innerHTML = inner(art, poseAt(art, t), showG ? phase : null, t, vb);
  };
  raf = requestAnimationFrame(frame);
  current = () => cancelAnimationFrame(raf);
}
export function stopAnim() { if (current) current(); current = null; }
