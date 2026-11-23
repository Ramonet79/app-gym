// Motor de ilustraciones: figura articulada + máquina, animada entre dos posturas.
const f = n => (+n).toFixed(1);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 0.5 - Math.cos(Math.PI * t) / 2;

export function lerpPose(A, B, t) {
  const o = {};
  for (const k in A) {
    const a = A[k], b = B && B[k] !== undefined ? B[k] : a;
    o[k] = Array.isArray(a) ? [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] : a;
  }
  return o;
}

// Cinemática inversa de dos segmentos (cadera-rodilla-tobillo, etc.)
export function ik(A, B, l1, l2, bend = 1) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  let d = Math.hypot(dx, dy);
  d = Math.min(d, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  const mx = A[0] + ux * a, my = A[1] + uy * a;
  return [mx + uy * h * bend, my - ux * h * bend];
}

function seg(p, a, b, w, cls = 'limb') {
  const P = p[a], Q = p[b];
  if (!P || !Q) return '';
  return `<line x1="${f(P[0])}" y1="${f(P[1])}" x2="${f(Q[0])}" y2="${f(Q[1])}" stroke-width="${w}" class="${cls}"/>`;
}

export function figure(p) {
  let s = '<g class="fig">';
  // extremidades lejanas (atenuadas)
  s += seg(p, 'hp', 'k2', 10, 'limb far') + seg(p, 'k2', 'a2', 8, 'limb far') + seg(p, 'a2', 'f2', 5, 'limb far');
  s += seg(p, 's', 'e2', 7, 'limb far') + seg(p, 'e2', 'w2', 6, 'limb far');
  // vista frontal / cenital
  s += seg(p, 'n', 'pc', 20) + seg(p, 'n', 'h', 6) + seg(p, 'hl', 'hr', 13);
  s += seg(p, 'hl', 'kl', 11) + seg(p, 'kl', 'al', 9) + seg(p, 'hr', 'kr', 11) + seg(p, 'kr', 'ar', 9);
  s += seg(p, 'sl', 'sr', 14);
  s += seg(p, 'sl', 'el', 8) + seg(p, 'el', 'wl', 7) + seg(p, 'sr', 'er', 8) + seg(p, 'er', 'wr', 7);
  // vista lateral
  if (p.sp && p.hp && p.s) {
    s += `<path d="M${f(p.hp[0])},${f(p.hp[1])} Q${f(p.sp[0])},${f(p.sp[1])} ${f(p.s[0])},${f(p.s[1])}" stroke-width="14" class="limb" fill="none"/>`;
  } else s += seg(p, 'hp', 's', 14);
  s += seg(p, 's', 'h', 6);
  s += seg(p, 'hp', 'k', 11) + seg(p, 'k', 'a', 9) + seg(p, 'a', 'f', 5);
  s += seg(p, 's', 'e', 8) + seg(p, 'e', 'w', 7);
  if (p.h) {
    s += `<circle cx="${f(p.h[0])}" cy="${f(p.h[1])}" r="9.5" class="head"/>`;
    if (p.face) s += `<circle cx="${f(p.h[0] + 4 * p.face)}" cy="${f(p.h[1] - 1.5)}" r="1.6" class="eye"/>`;
  }
  return s + '</g>';
}

function poseAt(art, t) {
  return art.at ? art.at(t) : lerpPose(art.A, art.B || art.A, t);
}

function inner(art, p) {
  return (art.dyn ? art.dyn(p) : '') + figure(p) + (art.front ? (typeof art.front === 'function' ? art.front(p) : art.front) : '');
}

export function artSVG(art, t = 0, cls = '') {
  if (!art) return '';
  const p = poseAt(art, t);
  const vb = art.vb || '0 0 200 160';
  const top = +vb.split(' ')[1];
  return `<svg viewBox="${vb}" class="art ${cls}" aria-hidden="true">
    <line x1="0" y1="150.5" x2="200" y2="150.5" class="floor"/>
    ${art.back || ''}<g class="dyn">${inner(art, p)}</g>
    ${art.label ? `<text x="100" y="${top + 11}" class="art-label">${art.label}</text>` : ''}
  </svg>`;
}

// Animación continua (una sola a la vez para ahorrar batería)
const T0 = performance.now();
let current = null;
export function animate(svgEl, art) {
  stopAnim();
  if (!svgEl || !art || (!art.B && !art.at)) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dyn = svgEl.querySelector('.dyn');
  const dur = (art.dur || 2600) * (reduce ? 1.8 : 1);
  let last = 0, raf;
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps
    last = now;
    const ph = ((now - T0) % dur) / dur;
    let t;
    if (art.at) t = ph;
    else t = ph < 0.12 ? 0 : ph < 0.5 ? ease((ph - 0.12) / 0.38) : ph < 0.62 ? 1 : 1 - ease((ph - 0.62) / 0.38);
    dyn.innerHTML = inner(art, poseAt(art, t));
  };
  raf = requestAnimationFrame(frame);
  current = () => cancelAnimationFrame(raf);
}
export function stopAnim() { if (current) current(); current = null; }
