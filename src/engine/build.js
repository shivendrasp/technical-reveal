// Analysis + config → timed scene (all geometry in canvas pixels, times on a 0..1 timeline).
import { mulberry32, cumLengths, chaikin, clamp, fmtNum, TAU } from './util.js';

export function buildScene(an, W, H, dpr, cfg) {
  const rnd = mulberry32(cfg.playback.seed * 9973 + 17);
  const P = cfg.palette, D = cfg.drafting, S = cfg.stroke, T = cfg.timing, R = cfg.reveal;

  // ---- fit image into canvas ----
  // canvas = image + bleed margin on every side (lines and dimensions overflow into it)
  const bl = cfg.source.bleed;
  const s = Math.min(W / (an.w * (1 + 2 * bl)), H / (an.h * (1 + 2 * bl)));
  let ox, oy;
  ox = (W - an.w * s) / 2;
  oy = (H - an.h * s) / 2;
  const imgRect = { x: ox, y: oy, w: an.w * s, h: an.h * s };
  const bleedPx = Math.max(0, Math.min(imgRect.x, imgRect.y));
  const gox = Math.max(0, imgRect.x) * cfg.source.gridOverflow, goy = Math.max(0, imgRect.y) * cfg.source.gridOverflow;
  const G = { x: imgRect.x - gox, y: imgRect.y - goy, w: imgRect.w + 2 * gox, h: imgRect.h + 2 * goy }; // grid / plate area
  const M = (x, y) => [ox + x * s, oy + y * s];
  const B = { x: ox + an.bbox.x * s, y: oy + an.bbox.y * s, w: an.bbox.w * s, h: an.bbox.h * s };
  const mmPerPx = D.realWidth / Math.max(1, B.w); // canvas px → "mm"
  const ts = D.textSize * dpr;
  const scene = { W, H, dpr, s, imgRect, B, mmPerPx, bleedPx, G, grid: [], ink: [], notes: [], brush: [], stats: {} };

  const span = (a, b) => Math.max(0.0001, b - a);

  // ---- grid (graph paper) ----
  if (D.grid) {
    const g = Math.max(4, D.gridSize * dpr);
    const gs = 0, ge = T.gridEnd;
    const add = (x1, y1, x2, y2, major, d) => {
      const t0 = gs + d * span(gs, ge) * 0.55;
      scene.grid.push(poly([x1, y1, x2, y2], {
        w: (major ? 1 : 0.6) * dpr, color: P.grid, alpha: (major ? 1 : 0.5) * D.gridOpacity, t0, t1: t0 + span(gs, ge) * 0.45,
      }));
    };
    const gx0 = G.x, gx1 = G.x + G.w, gy0 = G.y, gy1 = G.y + G.h;
    const kx0 = Math.ceil((gx0 - ox) / g), kx1 = Math.floor((gx1 - ox) / g);
    for (let k = kx0; k <= kx1; k++) {
      const x = Math.round(ox + k * g) + 0.5;
      const d = clamp(Math.abs(x - W / 2) / (G.w / 2));
      k % 2 ? add(x, gy1, x, gy0, k % 5 === 0, d) : add(x, gy0, x, gy1, k % 5 === 0, d);
    }
    const ky0 = Math.ceil((gy0 - oy) / g), ky1 = Math.floor((gy1 - oy) / g);
    for (let k = ky0; k <= ky1; k++) {
      const y = Math.round(oy + k * g) + 0.5;
      const d = clamp(Math.abs(y - H / 2) / (G.h / 2));
      k % 2 ? add(gx1, y, gx0, y, k % 5 === 0, d) : add(gx0, y, gx1, y, k % 5 === 0, d);
    }
  }
  if (D.sheetFrame) scene.notes.push({ kind: 'frame', t0: 0, t1: Math.max(0.02, T.gridEnd) });

  // ---- construction lines ----
  const cs = T.constructStart, ce = T.constructEnd;
  const cons = [];
  const nH = Math.round(D.construction / 2), nV = D.construction - nH;
  an.hPeaks.slice(0, nH).forEach((pk) => { const y = oy + pk.p * s; cons.push({ pts: [0, y, W, y], s: pk.s }); });
  an.vPeaks.slice(0, nV).forEach((pk) => { const x = ox + pk.p * s; cons.push({ pts: [x, 0, x, H], s: pk.s }); });
  cons.sort((a, b) => b.s - a.s);
  cons.forEach((c, i) => {
    const t0 = cs + (i / Math.max(1, cons.length)) * span(cs, ce) * 0.7 + rnd() * 0.01;
    let pts = c.pts;
    if (rnd() < 0.5) pts = [pts[2], pts[3], pts[0], pts[1]];
    scene.ink.push(poly(pts, {
      w: S.constructionWidth * dpr, color: P.line, alpha: 0.42 * S.opacity, t0, t1: t0 + span(cs, ce) * 0.3,
      dash: S.dashedConstruction ? [8 * dpr, 6 * dpr] : null,
    }));
  });

  // centre lines (dash-dot) through the subject + main circles
  if (D.centerLines && an.chains.length) {
    const ext = Math.min(W, H) * 0.06;
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    const dd = [22 * dpr, 5 * dpr, 4 * dpr, 5 * dpr];
    const t0 = cs + span(cs, ce) * 0.55;
    scene.ink.push(poly([cx, B.y - ext, cx, B.y + B.h + ext], { w: S.constructionWidth * dpr, color: P.accent, alpha: 0.8 * S.opacity, dash: dd, t0, t1: t0 + span(cs, ce) * 0.4 }));
    scene.ink.push(poly([B.x - ext, cy, B.x + B.w + ext, cy], { w: S.constructionWidth * dpr, color: P.accent, alpha: 0.8 * S.opacity, dash: dd, t0: t0 + 0.02, t1: t0 + 0.02 + span(cs, ce) * 0.4 }));
    an.arcs.slice(0, Math.min(6, D.radii + 2)).forEach((a, i) => {
      const [x, y] = M(a.x, a.y), r = a.r * s * 1.25 + 6 * dpr;
      if (r < 10 * dpr) return;
      const tt = cs + span(cs, ce) * (0.6 + 0.06 * i);
      scene.ink.push(poly([x - r, y, x + r, y], { w: S.constructionWidth * dpr, color: P.accent, alpha: 0.7 * S.opacity, dash: dd, t0: tt, t1: tt + 0.05 }));
      scene.ink.push(poly([x, y - r, x, y + r], { w: S.constructionWidth * dpr, color: P.accent, alpha: 0.7 * S.opacity, dash: dd, t0: tt + 0.01, t1: tt + 0.06 }));
    });
  }

  // ---- contours (the actual drawing) ----
  const ds = T.drawStart, de = T.drawEnd;
  const chains = an.chains.slice(0, D.maxLines);
  const diag = Math.hypot(W, H);
  const multi = [P.m1, P.m2, P.m3, P.m4, P.line];
  chains.forEach((ch, rank) => {
    let pts = [];
    for (let i = 0; i < ch.pts.length; i += 2) { const [x, y] = M(ch.pts[i], ch.pts[i + 1]); pts.push(x, y); }
    if (cfg.detail.smooth && pts.length > 4) pts = chaikin(chaikin(pts, ch.closed), ch.closed);
    const len = ch.len * s;
    const imp = clamp(len / (diag * 0.25));
    const order = Math.pow(rank / Math.max(1, chains.length), 0.75);
    const dur = span(ds, de) * (0.035 + 0.22 * Math.sqrt(imp));
    let t0 = ds + order * span(ds, de) * 0.9 + (rnd() - 0.5) * 0.02;
    t0 = clamp(t0, ds, de - dur);
    let color = P.line;
    if (P.colorMode === 'multi') color = multi[hueIndex(ch.color, multi.length, rnd)];
    else if (P.colorMode === 'image') color = `rgb(${ch.color.map((v) => v | 0).join(',')})`;
    const el = poly(pts, {
      w: S.lineWidth * dpr * (0.55 + 0.45 * imp), color, alpha: S.opacity, t0, t1: t0 + dur,
      closed: ch.closed, style: S.style, jitter: S.jitter * dpr, overshoot: S.overshoot * dpr, rnd,
    });
    el.contour = true;
    scene.ink.push(el);
  });
  scene.stats.entities = chains.length;

  // ---- hatching on dark areas ----
  if (D.hatch) {
    const hs = T.drawStart + span(ds, de) * 0.45, he = Math.min(1, T.drawEnd + 0.08);
    const segs = [];
    const passes = [[D.hatchAngle, D.hatchThreshold]];
    if (D.crossHatch) passes.push([D.hatchAngle + 90, D.hatchThreshold * 0.6]);
    const step = 2 * dpr, gap = Math.max(2, D.hatchSpacing * dpr);
    for (const [deg, thr] of passes) {
      const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const corners = [[0, 0], [imgRect.w, 0], [0, imgRect.h], [imgRect.w, imgRect.h]].map(([x, y]) => [x + imgRect.x, y + imgRect.y]);
      const pn = corners.map(([x, y]) => x * nx + y * ny), pd = corners.map(([x, y]) => x * dx + y * dy);
      const n0 = Math.min(...pn), n1 = Math.max(...pn), d0 = Math.min(...pd), d1 = Math.max(...pd);
      for (let o = n0 + gap / 2; o < n1; o += gap) {
        let run = null;
        for (let t = d0; t <= d1 + step; t += step) {
          const x = nx * o + dx * t, y = ny * o + dy * t;
          const ax = (x - ox) / s, ay = (y - oy) / s;
          const inside = ax >= 0 && ay >= 0 && ax < an.w && ay < an.h && x >= 0 && y >= 0 && x <= W && y <= H;
          const dark = inside && an.lum[(ay | 0) * an.w + (ax | 0)] < thr;
          if (dark && !run) run = [x, y];
          if (!dark && run) {
            if (Math.hypot(x - run[0], y - run[1]) > 4 * dpr) segs.push({ pts: [run[0], run[1], x - dx * step, y - dy * step], o: (o - n0) / (n1 - n0 || 1) });
            run = null;
          }
        }
      }
    }
    const lim = segs.slice(0, 9000);
    lim.forEach((sg) => {
      const t0 = hs + sg.o * span(hs, he) * 0.75;
      scene.ink.push(poly(sg.pts, { w: S.constructionWidth * dpr * 0.9, color: P.line, alpha: 0.45 * S.opacity, t0, t1: t0 + span(hs, he) * 0.25 }));
    });
    scene.stats.hatch = lim.length;
  }

  // ---- annotations ----
  const as = T.annotateStart, ae = T.annotateEnd;
  const gap = clamp(bleedPx * 0.42, 16 * dpr, 64 * dpr);
  const fmt = (px) => fmtNum(px * mmPerPx, D.decimals);
  const notes = [];
  const used = [];
  const free = (r) => !used.some((u) => r.x < u.x + u.w && r.x + r.w > u.x && r.y < u.y + u.h && r.y + r.h > u.y);
  const claim = (r) => used.push(r);
  const onCanvas = (v, max) => v > ts * 1.6 && v < max - ts * 1.6;

  if (an.chains.length && D.dimensions > 0 && onCanvas(B.y - gap, H)) {
    notes.push({ kind: 'dim', dir: 'h', a: [B.x, B.y], b: [B.x + B.w, B.y], at: B.y - gap, label: fmt(B.w), pri: 1 });
    claim({ x: B.x, y: B.y - gap - ts, w: B.w, h: ts * 2 });
  }
  if (an.chains.length && D.dimensions > 1 && onCanvas(B.x - gap, W)) {
    notes.push({ kind: 'dim', dir: 'v', a: [B.x, B.y], b: [B.x, B.y + B.h], at: B.x - gap, label: fmt(B.h), pri: 1 });
    claim({ x: B.x - gap - ts, y: B.y, w: ts * 2, h: B.h });
  }

  // baseline / ordinate stacks (bottom from vertical features, right from horizontal features)
  if (D.baselineDims > 0) {
    const nb = Math.ceil(D.baselineDims / 2), nr = D.baselineDims - nb;
    const xs = an.vPeaks.map((p) => ox + p.p * s).filter((x) => x > B.x + Math.max(B.w * 0.08, 40 * dpr) && x <= B.x + B.w + 1).sort((a, b) => a - b);
    pickSpread(xs, nb).forEach((x, k) => {
      const at = B.y + B.h + gap * (0.8 + k * 0.7);
      if (!onCanvas(at, H)) return;
      notes.push({ kind: 'dim', dir: 'h', a: [B.x, B.y + B.h], b: [x, B.y + B.h], at, label: fmt(x - B.x), pri: 2 });
    });
    const ys = an.hPeaks.map((p) => oy + p.p * s).filter((y) => y >= B.y - 1 && y < B.y + B.h - Math.max(B.h * 0.08, 40 * dpr)).sort((a, b) => b - a);
    pickSpread(ys, nr).forEach((y, k) => {
      const at = B.x + B.w + gap * (0.8 + k * 0.7);
      if (!onCanvas(at, W)) return;
      notes.push({ kind: 'dim', dir: 'v', a: [B.x + B.w, B.y + B.h], b: [B.x + B.w, y], at, label: fmt(B.y + B.h - y), pri: 2 });
    });
  }

  // feature dimensions on individual parts
  let fd = Math.max(0, D.dimensions - 2);
  for (const ch of an.chains.slice(0, 120)) {
    if (fd <= 0) break;
    const bx = ox + ch.bbox.x * s, by = oy + ch.bbox.y * s, bw = ch.bbox.w * s, bh = ch.bbox.h * s;
    if (bw < B.w * 0.1 && bh < B.h * 0.1) continue;
    if (bw > B.w * 0.9 && bh > B.h * 0.9) continue;
    const horiz = bw >= bh ? rnd() < 0.75 : rnd() < 0.25;
    if (horiz && bw > 30 * dpr) {
      const at = by - gap * 0.55;
      const r = { x: bx - 4, y: at - ts, w: bw + 8, h: ts * 1.8 };
      if (!free(r) || !onCanvas(at, H)) continue;
      claim(r);
      notes.push({ kind: 'dim', dir: 'h', a: [bx, by], b: [bx + bw, by], at, label: fmt(bw), pri: 3 });
      fd--;
    } else if (!horiz && bh > 30 * dpr) {
      const at = bx + bw + gap * 0.55;
      const r = { x: at - ts, y: by - 4, w: ts * 1.8, h: bh + 8 };
      if (!free(r) || !onCanvas(at, W)) continue;
      claim(r);
      notes.push({ kind: 'dim', dir: 'v', a: [bx + bw, by], b: [bx + bw, by + bh], at, label: fmt(bh), pri: 3 });
      fd--;
    }
  }

  // radius / diameter callouts with compass sweep
  const cxI = B.x + B.w / 2, cyI = B.y + B.h / 2;
  const centres = [];
  for (const a of an.arcs) {
    if (centres.length >= D.radii) break;
    const [x, y] = M(a.x, a.y), r = a.r * s;
    if (r < 8 * dpr || r > Math.min(B.w, B.h) * 0.6 || x < 0 || y < 0 || x > W || y > H) continue;
    if (centres.some((c) => Math.hypot(c[0] - x, c[1] - y) < 40 * dpr)) continue;
    centres.push([x, y]);
    const full = a.span > 5.2;
    let la = Math.atan2(y - cyI, x - cxI);
    if (!isFinite(la) || (Math.abs(x - cxI) < 2 && Math.abs(y - cyI) < 2)) la = -Math.PI * 0.75;
    la = Math.round((la - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4; // snap to diagonals
    const label = full ? `Ø${fmt(r * 2)}` : `R${fmt(r)}`;
    notes.push({ kind: 'radius', c: [x, y], r, a0: a.a0, a1: a.a1, ccw: a.ccw, full, la, label, pri: 3 });
  }

  // angle callouts
  let na = 0;
  for (const c of an.corners) {
    if (na >= D.angles) break;
    const [x, y] = M(c.x, c.y);
    if (centres.some((q) => Math.hypot(q[0] - x, q[1] - y) < 50 * dpr)) continue;
    centres.push([x, y]);
    const ra = clamp(c.strength * s * 0.4, 14 * dpr, 36 * dpr);
    notes.push({ kind: 'angle', c: [x, y], a1: c.a1, a2: c.a2, r: ra, label: `${fmtNum(c.deg, Math.min(1, D.decimals))}°`, pri: 3 });
    na++;
  }

  // reference markers
  const pts = [...an.arcs.map((a) => M(a.x, a.y)), ...an.corners.map((c) => M(c.x, c.y))];
  let nm = 0;
  for (const [x, y] of pts) {
    if (nm >= D.markers) break;
    if (x < 0 || y < 0 || x > W || y > H) continue;
    if (notes.some((n) => n.kind === 'marker' && Math.hypot(n.c[0] - x, n.c[1] - y) < 36 * dpr)) continue;
    notes.push({ kind: 'marker', c: [x, y], label: `${String.fromCharCode(65 + (nm % 26))}${1 + Math.floor(nm / 26)}`, pri: 4 });
    nm++;
  }

  // schedule: overall first, the rest shuffled so the sheet fills in organically
  const head = notes.filter((n) => n.pri === 1);
  const rest = notes.filter((n) => n.pri !== 1).sort(() => rnd() - 0.5);
  const ordered = [...head, ...rest];
  const nd = span(as, ae) * clamp(2.5 / Math.max(3, ordered.length), 0.08, 0.3);
  ordered.forEach((n, i) => {
    n.t0 = as + (i / Math.max(1, ordered.length - 1 || 1)) * Math.max(0, span(as, ae) - nd);
    n.t1 = n.t0 + nd;
    scene.notes.push(n);
  });
  if (D.titleBlock) scene.notes.push({ kind: 'title', t0: as + span(as, ae) * 0.55, t1: ae, seed: cfg.playback.seed });

  // ---- reveal brush strokes ----
  buildBrush(scene, cfg, rnd);

  scene.grid.sort((a, b) => a.t1 - b.t1);
  scene.ink.sort((a, b) => a.t1 - b.t1);
  return scene;
}

function pickSpread(arr, n) {
  if (n <= 0 || !arr.length) return [];
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i / Math.max(1, n - 1)) * (arr.length - 1))]);
  return [...new Set(out)];
}

function hueIndex([r, g, b], n, rnd) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 18) return Math.floor(rnd() * n);
  let h;
  if (mx === r) h = ((g - b) / (mx - mn)) % 6;
  else if (mx === g) h = (b - r) / (mx - mn) + 2;
  else h = (r - g) / (mx - mn) + 4;
  h = (h * 60 + 360) % 360;
  return Math.floor((h / 360) * n) % n;
}

/** Create a stroke element; style passes (sketch/pencil/brush) are baked here so rendering stays cheap. */
function poly(pts, o) {
  const el = { kind: 'poly', w: o.w, color: o.color, alpha: o.alpha, t0: o.t0, t1: o.t1, dash: o.dash || null, passes: [] };
  const style = o.style || 'flat';
  const rnd = o.rnd || Math.random;
  let base = pts;
  if (o.overshoot && !o.closed && pts.length >= 4) base = extend(pts, o.overshoot * (0.4 + rnd() * 0.8));
  const j = o.jitter || 0;
  const add = (p, alpha, wMul, taper = false) => el.passes.push({ pts: p, cum: cumLengths(p), alpha, wMul, taper });
  switch (style) {
    case 'pen':
      add(jitter(base, j * 0.3, rnd), 1, 1, true);
      break;
    case 'sketch':
      add(jitter(base, j * 0.4, rnd), 0.95, 1);
      add(jitter(o.overshoot && !o.closed ? extend(pts, o.overshoot * (0.3 + rnd())) : pts, j, rnd), 0.45, 0.7);
      break;
    case 'pencil':
      for (let k = 0; k < 3; k++) add(jitter(base, j, rnd), 0.34, 0.75 + rnd() * 0.4);
      break;
    case 'brush':
      add(jitter(base, j * 0.3, rnd), 0.85, 1.9, true);
      add(jitter(base, j, rnd), 0.5, 0.5);
      break;
    default:
      add(j ? jitter(base, j * 0.3, rnd) : base, 1, 1);
  }
  return el;
}

function extend(pts, d) {
  const n = pts.length / 2;
  const out = pts.slice();
  const ex = (ia, ib) => {
    const dx = pts[ia * 2] - pts[ib * 2], dy = pts[ia * 2 + 1] - pts[ib * 2 + 1];
    const l = Math.hypot(dx, dy) || 1;
    return [pts[ia * 2] + (dx / l) * d, pts[ia * 2 + 1] + (dy / l) * d];
  };
  const s0 = ex(0, 1), s1 = ex(n - 1, n - 2);
  out[0] = s0[0]; out[1] = s0[1];
  out[out.length - 2] = s1[0]; out[out.length - 1] = s1[1];
  return out;
}

function jitter(pts, amt, rnd) {
  if (!amt) return pts;
  const n = pts.length / 2;
  const out = new Array(pts.length);
  const f = 0.3 + rnd() * 0.5, ph = rnd() * TAU;
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : i, b = i < n - 1 ? i + 1 : i;
    let nx = -(pts[b * 2 + 1] - pts[a * 2 + 1]), ny = pts[b * 2] - pts[a * 2];
    const l = Math.hypot(nx, ny) || 1;
    const off = amt * (Math.sin(i * f + ph) * 0.7 + (rnd() - 0.5) * 0.6);
    out[i * 2] = pts[i * 2] + (nx / l) * off;
    out[i * 2 + 1] = pts[i * 2 + 1] + (ny / l) * off;
  }
  return out;
}

function buildBrush(scene, cfg, rnd) {
  const R = cfg.reveal, T = cfg.timing, { W, H } = scene;
  const r = scene.imgRect;
  const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(W, r.x + r.w), y1 = Math.min(H, r.y + r.h);
  const rw = x1 - x0, rh = y1 - y0;
  const size = Math.max(8, R.brushSize * Math.min(rw, rh));
  const rs = T.revealStart, re = Math.max(T.revealStart + 0.01, T.revealEnd);
  const sweepEnd = rs + (re - rs) * 0.82;
  const strokes = [];

  const wav = (u, ph, f) => Math.sin(u * Math.PI * f + ph) * R.wobble * size * 0.6;

  if (R.mode === 'radial') {
    const cx = x0 + rw / 2, cy = y0 + rh / 2, maxR = Math.hypot(rw, rh) / 2 + size / 2;
    const turns = maxR / (size * 0.6);
    const pts = [];
    const steps = Math.ceil(turns * 48);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, a = u * turns * TAU, rr = u * maxR;
      pts.push(cx + Math.cos(a) * rr + wav(u, 0, 9) * 0.3, cy + Math.sin(a) * rr);
    }
    strokes.push({ pts, order: 0 });
  } else if (R.mode !== 'scribble') {
    const deg = R.mode === 'horizontal' ? 0 : R.mode === 'vertical' ? 90 : R.angle;
    const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    const pn = corners.map(([x, y]) => x * nx + y * ny), pd = corners.map(([x, y]) => x * dx + y * dy);
    const n0 = Math.min(...pn) - size * 0.3, n1 = Math.max(...pn) + size * 0.3;
    const d0 = Math.min(...pd) - size, d1 = Math.max(...pd) + size;
    let k = 0;
    for (let o = n0; o <= n1; o += size * 0.62, k++) {
      const pts = [];
      const ph = rnd() * TAU, f = 1 + rnd() * 2;
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, t = k % 2 ? d1 - u * (d1 - d0) : d0 + u * (d1 - d0);
        const oo = o + wav(u, ph, f);
        pts.push(nx * oo + dx * t, ny * oo + dy * t);
      }
      strokes.push({ pts, order: k });
    }
  }
  // free dabs/scribbles (also the whole reveal in scribble mode)
  const dabs = R.mode === 'scribble' ? Math.max(6, R.dabs) : R.dabs;
  for (let i = 0; i < dabs; i++) {
    const pts = [];
    let px = x0 + rnd() * rw, py = y0 + rnd() * rh, ang = rnd() * TAU;
    const L = size * (2 + rnd() * 4);
    for (let k = 0; k <= 16; k++) {
      pts.push(px, py);
      ang += (rnd() - 0.5) * 0.9;
      px += Math.cos(ang) * (L / 16);
      py += Math.sin(ang) * (L / 16);
    }
    strokes.push({ pts, order: rnd() * 1e3, dab: true });
  }

  const sweeps = strokes.filter((s) => !s.dab).length;
  strokes.forEach((st, i) => {
    let t0, t1;
    if (st.dab) {
      t0 = rs + rnd() * (sweepEnd - rs) * 0.8;
      t1 = t0 + (sweepEnd - rs) * (0.12 + rnd() * 0.12);
    } else if (R.mode === 'radial') {
      t0 = rs; t1 = sweepEnd;
    } else {
      const f = st.order / Math.max(1, sweeps);
      t0 = rs + f * (sweepEnd - rs) * 0.72;
      t1 = t0 + (sweepEnd - rs) * 0.28;
    }
    // bristles: thinner parallel hairs that give a dry-brush edge
    const bristles = [];
    const nb = Math.round(R.bristles * 9);
    for (let b = 0; b < nb; b++) bristles.push({ off: (rnd() - 0.5) * size * 1.05, w: size * (0.06 + rnd() * 0.12), a: 0.25 + rnd() * 0.5 });
    const n = st.pts.length / 2;
    const dirx = st.pts[n * 2 - 2] - st.pts[0], diry = st.pts[n * 2 - 1] - st.pts[1];
    const dl = Math.hypot(dirx, diry) || 1;
    scene.brush.push({ pts: st.pts, cum: cumLengths(st.pts), size: st.dab ? size * (0.6 + rnd() * 0.5) : size, t0, t1, bristles, nx: -diry / dl, ny: dirx / dl });
  });
  scene.reveal = { rs, re, fillStart: rs + (re - rs) * 0.7 };
}
