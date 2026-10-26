// Drawing routines for one frame. Everything is a pure function of (scene, u, cfg).
import { EASES, prog, clamp, lerp, TAU } from './util.js';

export function font(size, italic, weight = 500) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
}

/** Stroke the [f0, f1] fraction of a polyline. Returns the tip at f1. */
export function traceRange(ctx, pts, cum, f0, f1) {
  const n = cum.length, total = cum[n - 1];
  const s = total * f0, e = total * f1;
  let started = false, tx = pts[0], ty = pts[1];
  for (let i = 1; i < n; i++) {
    const a = cum[i - 1], b = cum[i];
    if (b < s) continue;
    const seg = b - a || 1;
    if (!started) {
      const k = Math.max(0, (s - a) / seg);
      ctx.moveTo(lerp(pts[i * 2 - 2], pts[i * 2], k), lerp(pts[i * 2 - 1], pts[i * 2 + 1], k));
      started = true;
    }
    if (b >= e) {
      const k = (e - a) / seg;
      tx = lerp(pts[i * 2 - 2], pts[i * 2], k); ty = lerp(pts[i * 2 - 1], pts[i * 2 + 1], k);
      ctx.lineTo(tx, ty);
      return [tx, ty];
    }
    tx = pts[i * 2]; ty = pts[i * 2 + 1];
    ctx.lineTo(tx, ty);
  }
  return [tx, ty];
}

export function drawPoly(ctx, el, frac, alphaMul) {
  if (frac <= 0) return null;
  ctx.strokeStyle = el.color;
  ctx.setLineDash(el.dash || []);
  let tip = null;
  for (const p of el.passes) {
    ctx.globalAlpha = el.alpha * p.alpha * alphaMul;
    if (p.taper) {
      ctx.lineWidth = el.w * p.wMul * 0.45;
      ctx.beginPath(); tip = traceRange(ctx, p.pts, p.cum, 0, frac); ctx.stroke();
      const a = 0.08, b = Math.min(frac, 0.92);
      if (b > a) { ctx.lineWidth = el.w * p.wMul; ctx.beginPath(); traceRange(ctx, p.pts, p.cum, a, b); ctx.stroke(); }
    } else {
      ctx.lineWidth = el.w * p.wMul;
      ctx.beginPath(); tip = traceRange(ctx, p.pts, p.cum, 0, frac); ctx.stroke();
    }
  }
  return tip;
}

// ---------- annotation primitives ----------
function arrowHead(ctx, x, y, ang, size, style) {
  const c = Math.cos(ang), s = Math.sin(ang);
  if (style === 'tick') {
    const k = size * 0.6;
    ctx.beginPath(); ctx.moveTo(x - k * 0.7, y + k * 0.7); ctx.lineTo(x + k * 0.7, y - k * 0.7); ctx.stroke();
    return;
  }
  if (style === 'dot') { ctx.beginPath(); ctx.arc(x, y, size * 0.22, 0, TAU); ctx.fill(); return; }
  const bx = x - c * size, by = y - s * size, w = size * 0.32;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(bx - s * w, by + c * w);
  if (style === 'open') { ctx.moveTo(x, y); ctx.lineTo(bx + s * w, by - c * w); ctx.stroke(); return; }
  ctx.lineTo(bx + s * w, by - c * w);
  ctx.closePath();
  ctx.fill();
}

function counted(n, p) {
  if (!n._parsed) {
    const m = String(n.label).match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
    n._parsed = m ? { pre: m[1], num: parseFloat(m[2]), dec: (m[2].split('.')[1] || '').length, suf: m[3] } : null;
  }
  const q = n._parsed;
  if (!q) return n.label;
  if (p >= 1) return n.label;
  return `${q.pre}${(q.num * EASES.easeOut(p)).toFixed(q.dec)}${q.suf}`;
}

function textBox(ctx, txt, x, y, bg, knock) {
  if (knock > 0.01) {
    const w = ctx.measureText(txt).width, h = parseFloat(ctx.font.match(/(\d+(?:\.\d+)?)px/)[1]);
    const prev = ctx.fillStyle, pa = ctx.globalAlpha;
    ctx.fillStyle = bg;
    ctx.globalAlpha = pa * knock;
    ctx.fillRect(x - w / 2 - h * 0.25, y - h * 0.62, w + h * 0.5, h * 1.24);
    ctx.fillStyle = prev;
    ctx.globalAlpha = pa;
  }
  ctx.fillText(txt, x, y);
}

const sub = (p, a, b) => clamp((p - a) / (b - a));

export function drawNote(ctx, n, u, scene, cfg, alpha) {
  const p = prog(u, n.t0, n.t1);
  if (p <= 0) return;
  const P = cfg.palette, D = cfg.drafting, S = cfg.stroke;
  const dpr = scene.dpr, ts = D.textSize * dpr;
  const E = EASES.easeInOut;
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.dim;
  ctx.fillStyle = P.dim;
  ctx.lineWidth = S.dimWidth * dpr;
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ah = 9 * dpr * D.arrowSize;

  switch (n.kind) {
    case 'dim': {
      const [ax, ay] = n.a, [bx, by] = n.b, at = n.at;
      const pe = E(sub(p, 0, 0.35)), pl = E(sub(p, 0.15, 0.7)), pt = sub(p, 0.3, 1);
      const off = 3 * dpr, over = 5 * dpr;
      ctx.beginPath();
      if (n.dir === 'h') {
        const sa = Math.sign(at - ay) || -1, sb = Math.sign(at - by) || -1;
        ctx.moveTo(ax, ay + sa * off); ctx.lineTo(ax, lerp(ay + sa * off, at + sa * over, pe));
        ctx.moveTo(bx, by + sb * off); ctx.lineTo(bx, lerp(by + sb * off, at + sb * over, pe));
        ctx.stroke();
        if (pl > 0) {
          const mx = (ax + bx) / 2, l = mx - (mx - ax) * pl, r = mx + (bx - mx) * pl;
          ctx.beginPath(); ctx.moveTo(l, at); ctx.lineTo(r, at); ctx.stroke();
          arrowHead(ctx, l, at, ax < bx ? Math.PI : 0, ah, D.arrowStyle);
          arrowHead(ctx, r, at, ax < bx ? 0 : Math.PI, ah, D.arrowStyle);
        }
        if (pt > 0) {
          ctx.fillStyle = P.text;
          ctx.font = font(ts, D.italic);
          ctx.globalAlpha = alpha * clamp(pt * 3);
          textBox(ctx, counted(n, pt), (ax + bx) / 2, at - ts * 0.75, P.bg, D.knockout ? scene.knockA : 0);
        }
      } else {
        const sa = Math.sign(at - ax) || -1, sb = Math.sign(at - bx) || -1;
        ctx.moveTo(ax + sa * off, ay); ctx.lineTo(lerp(ax + sa * off, at + sa * over, pe), ay);
        ctx.moveTo(bx + sb * off, by); ctx.lineTo(lerp(bx + sb * off, at + sb * over, pe), by);
        ctx.stroke();
        if (pl > 0) {
          const my = (ay + by) / 2, t = my - (my - ay) * pl, b = my + (by - my) * pl;
          ctx.beginPath(); ctx.moveTo(at, t); ctx.lineTo(at, b); ctx.stroke();
          arrowHead(ctx, at, t, ay < by ? -Math.PI / 2 : Math.PI / 2, ah, D.arrowStyle);
          arrowHead(ctx, at, b, ay < by ? Math.PI / 2 : -Math.PI / 2, ah, D.arrowStyle);
        }
        if (pt > 0) {
          ctx.save();
          ctx.translate(at - ts * 0.75, (ay + by) / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = P.text;
          ctx.font = font(ts, D.italic);
          ctx.globalAlpha = alpha * clamp(pt * 3);
          textBox(ctx, counted(n, pt), 0, 0, P.bg, D.knockout ? scene.knockA : 0);
          ctx.restore();
        }
      }
      break;
    }
    case 'radius': {
      const [cx, cy] = n.c, r = n.r;
      const pc = sub(p, 0, 0.15), ps = E(sub(p, 0.05, 0.6)), pl = E(sub(p, 0.5, 0.75)), pt = sub(p, 0.6, 1);
      // centre mark
      const cm = 6 * dpr * EASES.backOut(pc);
      ctx.beginPath(); ctx.moveTo(cx - cm, cy); ctx.lineTo(cx + cm, cy); ctx.moveTo(cx, cy - cm); ctx.lineTo(cx, cy + cm); ctx.stroke();
      // faint construction circle
      if (!n.full && ps > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath(); ctx.arc(cx, cy, r, n.a0, n.a0 + TAU * ps); ctx.stroke();
        ctx.restore();
      }
      // compass sweep along the real arc
      let sweep;
      if (n.full) sweep = TAU;
      else {
        let d = n.ccw ? n.a0 - n.a1 : n.a1 - n.a0;
        d = ((d % TAU) + TAU) % TAU || TAU;
        sweep = d;
      }
      const dir = n.ccw ? -1 : 1;
      const end = n.a0 + dir * sweep * ps;
      if (ps > 0) {
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = S.dimWidth * dpr * 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, r, n.a0, end, n.ccw); ctx.stroke();
        const armA = alpha * (1 - sub(p, 0.6, 0.75));
        if (armA > 0) {
          ctx.globalAlpha = armA;
          ctx.lineWidth = S.dimWidth * dpr;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(end) * r, cy + Math.sin(end) * r); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx + Math.cos(end) * r, cy + Math.sin(end) * r, 2.5 * dpr, 0, TAU); ctx.fillStyle = P.accent; ctx.fill();
          ctx.globalAlpha = alpha;
        }
        ctx.strokeStyle = P.dim; ctx.fillStyle = P.dim; ctx.lineWidth = S.dimWidth * dpr;
      }
      // leader
      if (pl > 0) {
        const sx = cx + Math.cos(n.la) * r, sy = cy + Math.sin(n.la) * r;
        const L1 = Math.max(26 * dpr, r * 0.35);
        const ex = sx + Math.cos(n.la) * L1, ey = sy + Math.sin(n.la) * L1;
        const sh = (Math.cos(n.la) >= 0 ? 1 : -1) * 46 * dpr;
        const l1 = clamp(pl * 1.6), l2 = clamp(pl * 1.6 - 0.6);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, ex, l1), lerp(sy, ey, l1));
        if (l2 > 0) ctx.lineTo(ex + sh * l2, ey);
        ctx.stroke();
        arrowHead(ctx, sx, sy, n.la + Math.PI, ah, D.arrowStyle === 'tick' ? 'arrow' : D.arrowStyle);
        if (pt > 0) {
          ctx.fillStyle = P.text;
          ctx.font = font(ts, D.italic);
          ctx.globalAlpha = alpha * clamp(pt * 3);
          ctx.textAlign = sh > 0 ? 'left' : 'right';
          ctx.fillText(counted(n, pt), ex + (sh > 0 ? 4 * dpr : -4 * dpr), ey - ts * 0.7);
        }
      }
      break;
    }
    case 'angle': {
      const [cx, cy] = n.c, r = n.r;
      let d = n.a2 - n.a1;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const ps = E(sub(p, 0, 0.6)), pt = sub(p, 0.4, 1);
      const cur = n.a1 + d * ps;
      ctx.beginPath(); ctx.arc(cx, cy, r, n.a1, cur, d < 0); ctx.stroke();
      const rayA = alpha * (1 - sub(p, 0.6, 0.8));
      if (rayA > 0) {
        ctx.globalAlpha = rayA;
        ctx.strokeStyle = P.accent;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(cur) * (r + 10 * dpr), cy + Math.sin(cur) * (r + 10 * dpr)); ctx.stroke();
        ctx.strokeStyle = P.dim; ctx.globalAlpha = alpha;
      }
      if (ps > 0.98) {
        arrowHead(ctx, cx + Math.cos(n.a1) * r, cy + Math.sin(n.a1) * r, n.a1 - Math.sign(d) * Math.PI / 2, ah * 0.7, D.arrowStyle);
        arrowHead(ctx, cx + Math.cos(n.a2) * r, cy + Math.sin(n.a2) * r, n.a2 + Math.sign(d) * Math.PI / 2, ah * 0.7, D.arrowStyle);
      }
      if (pt > 0) {
        const bis = n.a1 + d / 2, rr = r + ts * 1.1;
        ctx.fillStyle = P.text;
        ctx.font = font(ts * 0.9, D.italic);
        ctx.globalAlpha = alpha * clamp(pt * 3);
        textBox(ctx, counted(n, pt), cx + Math.cos(bis) * rr, cy + Math.sin(bis) * rr, P.bg, D.knockout ? scene.knockA : 0);
      }
      break;
    }
    case 'marker': {
      const [cx, cy] = n.c;
      const k = EASES.backOut(sub(p, 0, 0.5));
      ctx.strokeStyle = P.accent;
      ctx.beginPath(); ctx.arc(cx, cy, 6 * dpr * k, 0, TAU); ctx.stroke();
      const l = 11 * dpr * k;
      ctx.beginPath(); ctx.moveTo(cx - l, cy); ctx.lineTo(cx + l, cy); ctx.moveTo(cx, cy - l); ctx.lineTo(cx, cy + l); ctx.stroke();
      const pt = sub(p, 0.3, 1);
      if (pt > 0) {
        ctx.fillStyle = P.accent;
        ctx.font = font(ts * 0.75, D.italic, 600);
        ctx.textAlign = 'left';
        ctx.globalAlpha = alpha * pt;
        ctx.fillText(n.label, cx + 9 * dpr, cy - 10 * dpr);
      }
      break;
    }
    case 'frame': drawFrame(ctx, p, scene, cfg, alpha); break;
    case 'title': drawTitle(ctx, p, n, scene, cfg, alpha); break;
  }
}

function rectPath(ctx, x, y, w, h, f) {
  const per = 2 * (w + h);
  let L = per * f;
  ctx.moveTo(x, y);
  const seg = [[x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  let px = x, py = y;
  for (const [qx, qy] of seg) {
    const d = Math.hypot(qx - px, qy - py);
    if (L >= d) { ctx.lineTo(qx, qy); L -= d; px = qx; py = qy; }
    else { ctx.lineTo(px + ((qx - px) * L) / d, py + ((qy - py) * L) / d); break; }
  }
}

function drawFrame(ctx, p, scene, cfg, alpha) {
  const { W, H, dpr } = scene, P = cfg.palette, D = cfg.drafting;
  const m = 14 * dpr, m2 = m + 9 * dpr;
  const e = EASES.easeInOut(p);
  ctx.strokeStyle = P.dim;
  ctx.globalAlpha = alpha * 0.9;
  ctx.lineWidth = dpr;
  ctx.beginPath(); rectPath(ctx, m, m, W - 2 * m, H - 2 * m, e); ctx.stroke();
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); rectPath(ctx, m2, m2, W - 2 * m2, H - 2 * m2, clamp(e * 1.15 - 0.15)); ctx.stroke();
  const zt = clamp(p * 2 - 1);
  if (zt <= 0) return;
  ctx.lineWidth = dpr;
  ctx.globalAlpha = alpha * zt;
  ctx.fillStyle = P.text;
  ctx.font = font(8 * dpr, false, 500);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const nx = 8, ny = 6;
  for (let i = 1; i < nx; i++) {
    const x = m2 + ((W - 2 * m2) * i) / nx;
    ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, m2); ctx.moveTo(x, H - m); ctx.lineTo(x, H - m2); ctx.stroke();
  }
  for (let i = 0; i < nx; i++) {
    const x = m2 + ((W - 2 * m2) * (i + 0.5)) / nx;
    ctx.fillText(String(nx - i), x, (m + m2) / 2);
    ctx.fillText(String(nx - i), x, H - (m + m2) / 2);
  }
  for (let i = 1; i < ny; i++) {
    const y = m2 + ((H - 2 * m2) * i) / ny;
    ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(m2, y); ctx.moveTo(W - m, y); ctx.lineTo(W - m2, y); ctx.stroke();
  }
  for (let i = 0; i < ny; i++) {
    const y = m2 + ((H - 2 * m2) * (i + 0.5)) / ny;
    const L = String.fromCharCode(65 + (ny - 1 - i));
    ctx.fillText(L, (m + m2) / 2, y);
    ctx.fillText(L, W - (m + m2) / 2, y);
  }
}

function drawTitle(ctx, p, n, scene, cfg, alpha) {
  const { W, H, dpr } = scene, P = cfg.palette, D = cfg.drafting;
  const inset = (cfg.drafting.sheetFrame ? 23 : 12) * dpr;
  const w = Math.min(320 * dpr, W * 0.42), h = 76 * dpr;
  const x = W - inset - w, y = H - inset - h;
  const pb = EASES.easeInOut(sub(p, 0, 0.4)), pi = sub(p, 0.3, 0.6), pt = sub(p, 0.4, 1);
  ctx.globalAlpha = alpha * pb;
  ctx.fillStyle = P.bg;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = P.dim;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath(); rectPath(ctx, x, y, w, h, pb); ctx.stroke();
  const r1 = y + h * 0.48;
  const cols = [0, 0.34, 0.56, 0.76, 1].map((f) => x + w * f);
  ctx.lineWidth = dpr;
  if (pi > 0) {
    ctx.beginPath();
    ctx.moveTo(x, r1); ctx.lineTo(x + w * pi, r1);
    for (let i = 1; i < cols.length - 1; i++) { ctx.moveTo(cols[i], r1); ctx.lineTo(cols[i], r1 + (y + h - r1) * pi); }
    ctx.stroke();
  }
  if (pt <= 0) return;
  const type = (s) => s.slice(0, Math.ceil(s.length * clamp(pt * 1.4)));
  const date = new Date();
  const fields = [
    ['DWG NO.', `TD-${String(n.seed).padStart(4, '0')}`],
    ['SCALE', '1:1'],
    ['SHEET', '1/1'],
    ['DATE', `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(2)}`],
  ];
  ctx.fillStyle = P.text;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = font(15 * dpr, D.italic, 600);
  ctx.fillText(type(D.title || 'TECHNICAL DRAWING'), x + 10 * dpr, y + h * 0.33);
  fields.forEach(([k, v], i) => {
    ctx.font = font(7 * dpr, false, 500);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillText(type(k), cols[i] + 6 * dpr, r1 + 12 * dpr);
    ctx.font = font(11 * dpr, D.italic, 600);
    ctx.globalAlpha = alpha;
    ctx.fillText(type(v), cols[i] + 6 * dpr, y + h - 9 * dpr);
  });
}

/** Plotter head: follows the newest active line with crosshair + coordinate readout. */
export function drawHead(ctx, head, scene, cfg, alpha) {
  if (!head || head.a <= 0.01) return;
  const { W, H, dpr, B, mmPerPx } = scene, P = cfg.palette, D = cfg.drafting;
  const { x, y } = head;
  ctx.setLineDash([]);
  ctx.globalAlpha = alpha * head.a * 0.22;
  ctx.strokeStyle = P.accent;
  ctx.lineWidth = dpr;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  ctx.globalAlpha = alpha * head.a;
  const s = 7 * dpr;
  ctx.strokeRect(x - s, y - s, s * 2, s * 2);
  ctx.beginPath(); ctx.arc(x, y, 1.8 * dpr, 0, TAU); ctx.fillStyle = P.accent; ctx.fill();
  if (D.readout) {
    const rx = (x - B.x) * mmPerPx, ry = (B.y + B.h - y) * mmPerPx;
    ctx.font = font(10 * dpr, false, 500);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const tx = x + 12 * dpr, ty = y + 10 * dpr;
    const l1 = `X ${rx.toFixed(2)}`, l2 = `Y ${ry.toFixed(2)}`;
    const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 10 * dpr;
    ctx.globalAlpha = alpha * head.a * 0.85;
    ctx.fillStyle = P.bg;
    ctx.fillRect(tx - 5 * dpr, ty - 4 * dpr, w, 30 * dpr);
    ctx.globalAlpha = alpha * head.a;
    ctx.fillStyle = P.accent;
    ctx.fillText(l1, tx, ty);
    ctx.fillText(l2, tx, ty + 13 * dpr);
  }
}

export function drawHud(ctx, scene, cfg, u, info, alpha) {
  const { dpr, H } = scene, P = cfg.palette, T = cfg.timing;
  const phase = u < T.gridEnd ? 'GRID' : u < T.constructEnd ? 'CONSTRUCT' : u < T.drawEnd ? 'LINE' : u < T.annotateEnd ? 'DIMENSION' : u < T.revealEnd ? 'RENDER' : 'DONE';
  const inset = (cfg.drafting.sheetFrame ? 30 : 16) * dpr;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = P.text;
  ctx.font = font(10 * dpr, false, 500);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const blink = Math.floor(performance.now() / 450) % 2 ? '_' : ' ';
  ctx.fillText(`> ${phase}${blink}`, inset, H - inset - 14 * dpr);
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillText(`ENT ${String(info.done).padStart(4, '0')}/${String(info.total).padStart(4, '0')}   T ${(u * 100).toFixed(1).padStart(5, '0')}%`, inset, H - inset);
}
