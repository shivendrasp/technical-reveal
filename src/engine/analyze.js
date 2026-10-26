// Image → drawing primitives: edge contours (Canny-lite + tracing), arcs (circle fits),
// corners, construction-line peaks and a luminance map for hatching.
import { rdp } from './util.js';

export function analyzeImage(source, o) {
  const iw = source.naturalWidth || source.width;
  const ih = source.naturalHeight || source.height;
  const k = Math.min(1, o.resolution / Math.max(iw, ih));
  const w = Math.max(16, Math.round(iw * k));
  const h = Math.max(16, Math.round(ih * k));

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(source, 0, 0, w, h);
  const data = cx.getImageData(0, 0, w, h).data;

  const N = w * h;
  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = data[i * 4 + 3] / 255;
    const l = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    gray[i] = l * a + (1 - a); // transparent → white so cut-outs keep their silhouette
  }

  const sm = gaussBlur(gray, w, h, o.blur);
  const lum = gaussBlur(gray, w, h, Math.max(1.5, o.blur * 2));

  // Sobel
  const mag = new Float32Array(N), gxA = new Float32Array(N), gyA = new Float32Array(N);
  let maxMag = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = sm[i - w - 1], t = sm[i - w], tr = sm[i - w + 1];
      const l = sm[i - 1], r = sm[i + 1];
      const bl = sm[i + w - 1], b = sm[i + w], br = sm[i + w + 1];
      const gx = tr + 2 * r + br - (tl + 2 * l + bl);
      const gy = bl + 2 * b + br - (tl + 2 * t + tr);
      gxA[i] = gx; gyA[i] = gy;
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m > maxMag) maxMag = m;
    }
  }

  // Non-maximum suppression
  const nms = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m === 0) continue;
      let a = (Math.atan2(gyA[i], gxA[i]) * 180) / Math.PI;
      if (a < 0) a += 180;
      let n1, n2;
      if (a < 22.5 || a >= 157.5) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
      else if (a < 67.5) { n1 = mag[i - w - 1]; n2 = mag[i + w + 1]; }
      else if (a < 112.5) { n1 = mag[i - w]; n2 = mag[i + w]; }
      else { n1 = mag[i - w + 1]; n2 = mag[i + w - 1]; }
      if (m >= n1 && m >= n2) nms[i] = m;
    }
  }

  // Thresholds from the gradient distribution (sensitivity = share of pixels that count as strong)
  const bins = 2048;
  const hist = new Uint32Array(bins);
  let cnt = 0;
  for (let i = 0; i < N; i++) if (nms[i] > 0) { hist[Math.min(bins - 1, ((nms[i] / maxMag) * bins) | 0)]++; cnt++; }
  let acc = 0, hiBin = bins - 1;
  const want = cnt * o.sensitivity;
  for (let b = bins - 1; b >= 0; b--) { acc += hist[b]; if (acc >= want) { hiBin = b; break; } }
  const high = Math.max((hiBin / bins) * maxMag, maxMag * 0.04);
  const low = high * 0.4;

  // Hysteresis
  const edges = new Uint8Array(N);
  const stack = [];
  for (let i = 0; i < N; i++) if (nms[i] >= high) { edges[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = i + dy * w + dx;
      if (j > 0 && j < N && !edges[j] && nms[j] >= low) { edges[j] = 1; stack.push(j); }
    }
  }

  // Trace edge pixels into chains
  const raw = traceChains(edges, w, h);
  const minLen = Math.max(3, o.minLength * (Math.max(w, h) / 600));
  const chains = [];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const pts of raw) {
    const n = pts.length / 2;
    if (n < minLen) continue;
    const simp = rdp(pts, o.simplify);
    let len = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < simp.length / 2; i++) {
      const x = simp[i * 2], y = simp[i * 2 + 1];
      if (i) len += Math.hypot(x - simp[i * 2 - 2], y - simp[i * 2 - 1]);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    // sample colour slightly to both sides of the edge so the line takes the object's hue
    const step = Math.max(1, (n / 24) | 0);
    let sc = 0;
    for (let i = 0; i < n; i += step) {
      const px = pts[i * 2] | 0, py = pts[i * 2 + 1] | 0;
      const j = (py * w + px) * 4;
      r += data[j]; g += data[j + 1]; b += data[j + 2]; sc++;
    }
    const closed = Math.hypot(pts[0] - pts[pts.length - 2], pts[1] - pts[pts.length - 1]) < 3;
    chains.push({ raw: pts, pts: simp, len, closed, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, color: [r / sc, g / sc, b / sc] });
    if (x0 < bx0) bx0 = x0; if (y0 < by0) by0 = y0; if (x1 > bx1) bx1 = x1; if (y1 > by1) by1 = y1;
  }
  chains.sort((a, b) => b.len - a.len);
  if (chains.length > 5000) chains.length = 5000;
  if (!chains.length) { bx0 = 0; by0 = 0; bx1 = w; by1 = h; }

  return {
    w, h, data, lum, chains,
    bbox: { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 },
    arcs: fitArcs(chains, w, h),
    corners: findCorners(chains, w, h),
    ...peaks(edges, gxA, gyA, w, h),
  };
}

function gaussBlur(src, w, h, sigma) {
  if (sigma < 0.05) return src.slice();
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const ker = new Float32Array(r * 2 + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { ker[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); s += ker[i + r]; }
  for (let i = 0; i < ker.length; i++) ker[i] /= s;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k; a += src[y * w + xx] * ker[k + r]; }
    tmp[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k; a += tmp[yy * w + x] * ker[k + r]; }
    out[y * w + x] = a;
  }
  return out;
}

const NB = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function traceChains(edges, w, h) {
  const seen = new Uint8Array(w * h);
  const chains = [];
  const walk = (start) => {
    const out = [];
    let cur = start, pdx = 0, pdy = 0;
    for (;;) {
      const cx = cur % w, cy = (cur / w) | 0;
      let next = -1, best = -9, bdx = 0, bdy = 0;
      for (const [dx, dy] of NB) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        if (!edges[j] || seen[j]) continue;
        const score = dx * pdx + dy * pdy - (dx && dy ? 0.1 : 0); // prefer going straight
        if (score > best) { best = score; next = j; bdx = dx; bdy = dy; }
      }
      if (next < 0) break;
      pdx = bdx; pdy = bdy;
      seen[next] = 1;
      out.push(next);
      cur = next;
    }
    return out;
  };
  for (let i = 0; i < w * h; i++) {
    if (!edges[i] || seen[i]) continue;
    seen[i] = 1;
    const fwd = walk(i);
    const back = walk(i);
    const idx = back.reverse().concat([i], fwd);
    const pts = new Array(idx.length * 2);
    for (let k = 0; k < idx.length; k++) { pts[k * 2] = idx[k] % w; pts[k * 2 + 1] = (idx[k] / w) | 0; }
    chains.push(pts);
  }
  return chains;
}

function circle3(ax, ay, bx, by, cx, cy) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { x: ux, y: uy, r: Math.hypot(ax - ux, ay - uy) };
}

function fitArcs(chains, w, h) {
  const maxR = Math.max(w, h) * 0.6;
  const arcs = [];
  for (const ch of chains.slice(0, 400)) {
    const p = ch.raw, n = p.length / 2;
    if (n < 18) continue;
    let found = null;
    for (const frac of [1, 0.7, 0.5, 0.35]) {
      const L = Math.max(14, (n * frac) | 0);
      for (let s = 0; s + L <= n && !found; s += Math.max(4, (L / 2) | 0)) {
        const a = s, b = s + ((L / 2) | 0), e = s + L - 1;
        const c = circle3(p[a * 2], p[a * 2 + 1], p[b * 2], p[b * 2 + 1], p[e * 2], p[e * 2 + 1]);
        if (!c || c.r < 5 || c.r > maxR) continue;
        let err = 0;
        for (let i = a; i <= e; i += 2) err += Math.abs(Math.hypot(p[i * 2] - c.x, p[i * 2 + 1] - c.y) - c.r);
        err /= Math.ceil((e - a + 1) / 2);
        if (err > Math.max(0.7, c.r * 0.025)) continue;
        const a0 = Math.atan2(p[a * 2 + 1] - c.y, p[a * 2] - c.x);
        const a1 = Math.atan2(p[e * 2 + 1] - c.y, p[e * 2] - c.x);
        const cross = (p[b * 2] - p[a * 2]) * (p[e * 2 + 1] - p[b * 2 + 1]) - (p[b * 2 + 1] - p[a * 2 + 1]) * (p[e * 2] - p[b * 2]);
        const span = Math.min(Math.PI * 2, L / c.r);
        if (span < 0.6) continue;
        found = { ...c, a0, a1, ccw: cross < 0, span, score: L * Math.min(span, 4) };
      }
      if (found) break;
    }
    if (!found) continue;
    if (arcs.some((q) => Math.hypot(q.x - found.x, q.y - found.y) < Math.max(4, q.r * 0.25) && Math.abs(q.r - found.r) < q.r * 0.3)) continue;
    arcs.push(found);
  }
  return arcs.sort((a, b) => b.score - a.score).slice(0, 60);
}

function findCorners(chains, w, h) {
  const minSeg = Math.max(w, h) * 0.02;
  const out = [];
  for (const ch of chains.slice(0, 300)) {
    const p = ch.pts, n = p.length / 2;
    for (let i = 1; i < n - 1; i++) {
      const x = p[i * 2], y = p[i * 2 + 1];
      const v1x = p[i * 2 - 2] - x, v1y = p[i * 2 - 1] - y;
      const v2x = p[i * 2 + 2] - x, v2y = p[i * 2 + 3] - y;
      const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      if (l1 < minSeg || l2 < minSeg) continue;
      const deg = (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)))) * 180) / Math.PI;
      if (deg < 25 || deg > 155) continue;
      out.push({ x, y, a1: Math.atan2(v1y, v1x), a2: Math.atan2(v2y, v2x), deg, strength: Math.min(l1, l2) });
    }
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 80);
}

function peaks(edges, gx, gy, w, h) {
  const rows = new Float32Array(h), cols = new Float32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!edges[i]) continue;
    if (Math.abs(gy[i]) > Math.abs(gx[i])) rows[y]++; else cols[x]++;
  }
  const pick = (arr, n, len) => {
    const sm = new Float32Array(len);
    for (let i = 0; i < len; i++) { let a = 0; for (let k = -2; k <= 2; k++) a += arr[Math.min(len - 1, Math.max(0, i + k))]; sm[i] = a; }
    const mean = sm.reduce((a, b) => a + b, 0) / len || 1;
    const idx = [...sm.keys()].sort((a, b) => sm[b] - sm[a]);
    const out = [];
    const gap = Math.max(4, len * 0.025);
    for (const i of idx) {
      if (sm[i] < mean * 1.6 || out.length >= n) break;
      if (out.some((q) => Math.abs(q.p - i) < gap)) continue;
      out.push({ p: i, s: sm[i] / sm[idx[0]] });
    }
    return out;
  };
  return { hPeaks: pick(rows, 30, h), vPeaks: pick(cols, 30, w) };
}
