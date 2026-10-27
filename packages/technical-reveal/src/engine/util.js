export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** Deterministic PRNG so a seed always produces the same drawing. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EASES = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  backOut: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/** Local progress of an element whose window is [t0, t1] on the normalized timeline. */
export const prog = (u, t0, t1) => (t1 <= t0 ? (u >= t1 ? 1 : 0) : clamp((u - t0) / (t1 - t0)));

/** Parse any CSS colour (hex, rgb, oklch, p3...) to [r,g,b] 0-255 via a 1px canvas. */
const _cc = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d', { willReadFrequently: true }) : null;
const _cache = new Map();
export function toRGB(color) {
  if (_cache.has(color)) return _cache.get(color);
  _cc.clearRect(0, 0, 1, 1);
  _cc.fillStyle = '#000';
  _cc.fillStyle = color;
  _cc.fillRect(0, 0, 1, 1);
  const d = _cc.getImageData(0, 0, 1, 1).data;
  const rgb = [d[0], d[1], d[2]];
  _cache.set(color, rgb);
  return rgb;
}

/** Polyline helpers. pts = flat [x0,y0,x1,y1...]; cum = cumulative length per vertex. */
export function cumLengths(pts) {
  const n = pts.length / 2;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const dx = pts[i * 2] - pts[i * 2 - 2], dy = pts[i * 2 + 1] - pts[i * 2 - 1];
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
  }
  return cum;
}

/** Trace the first `frac` of a polyline into the current path. Returns the tip [x,y]. */
export function tracePartial(ctx, pts, cum, frac) {
  const n = cum.length;
  const total = cum[n - 1] * frac;
  ctx.moveTo(pts[0], pts[1]);
  let tx = pts[0], ty = pts[1];
  for (let i = 1; i < n; i++) {
    if (cum[i] <= total) {
      tx = pts[i * 2]; ty = pts[i * 2 + 1];
      ctx.lineTo(tx, ty);
    } else {
      const seg = cum[i] - cum[i - 1] || 1;
      const k = (total - cum[i - 1]) / seg;
      tx = lerp(pts[i * 2 - 2], pts[i * 2], k);
      ty = lerp(pts[i * 2 - 1], pts[i * 2 + 1], k);
      ctx.lineTo(tx, ty);
      break;
    }
  }
  return [tx, ty];
}

/** Point at fraction along polyline without drawing. */
export function pointAt(pts, cum, frac) {
  const n = cum.length;
  const total = cum[n - 1] * frac;
  for (let i = 1; i < n; i++) {
    if (cum[i] >= total) {
      const seg = cum[i] - cum[i - 1] || 1;
      const k = (total - cum[i - 1]) / seg;
      return [lerp(pts[i * 2 - 2], pts[i * 2], k), lerp(pts[i * 2 - 1], pts[i * 2 + 1], k)];
    }
  }
  return [pts[n * 2 - 2], pts[n * 2 - 1]];
}

/** Ramer–Douglas–Peucker on flat arrays. */
export function rdp(pts, eps) {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const e2 = eps * eps;
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-9;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * 2] - ax, py = pts[i * 2 + 1] - ay;
      const c = px * dy - py * dx;
      const d2 = (c * c) / L2;
      if (d2 > best) { best = d2; bi = i; }
    }
    if (best > e2) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** One Chaikin pass, keeps endpoints. */
export function chaikin(pts, closed) {
  const n = pts.length / 2;
  if (n < 3) return pts;
  const out = closed ? [] : [pts[0], pts[1]];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[j * 2], y1 = pts[j * 2 + 1];
    out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
  }
  if (closed) out.push(out[0], out[1]);
  else out.push(pts[n * 2 - 2], pts[n * 2 - 1]);
  return out;
}

export const fmtNum = (v, decimals) => {
  const s = v.toFixed(decimals);
  return decimals > 0 ? s.replace(/\.?0+$/, '') : s;
};
