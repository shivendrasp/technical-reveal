// TechnicalReveal — framework-free engine. Give it a canvas, an image URL and a config;
// it plays a CAD-style "drafting" intro that ends in a brush-masked reveal of the image.
import { analyzeImage } from './analyze.js';
import { buildScene } from './build.js';
import { drawPoly, drawNote, drawHead, drawHud } from './render.js';
import { EASES, prog, lerp, clamp, toRGB } from './util.js';

export { PALETTES, PALETTE_KEYS } from './palettes.js';

const MASK_SCALE = 0.25;
const mk = () => document.createElement('canvas');

export class TechnicalReveal {
  constructor(canvas, { onState } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layers = { grid: mk(), ink: mk(), image: mk(), reveal: mk(), mask: mk(), fade: mk() };
    this.cache = { grid: { idx: 0, u: -1 }, ink: { idx: 0, u: -1, done: 0 } };
    this.onState = onState || (() => {});
    this.time = 0;
    this.playing = true;
    this.cfg = null;
    this.img = null;
    this.an = null;
    this.scene = null;
    this.head = null;
    this.need = { analyze: false, build: false, image: false };
    this.keys = {};
    this.last = performance.now();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.stopRecording(true);
  }

  // ---------- public API ----------
  setConfig(cfg) {
    const prev = this.cfg;
    this.cfg = cfg;
    const k = {
      analyze: JSON.stringify(cfg.detail && { ...cfg.detail, maxLines: 0, smooth: 0 }),
      build: JSON.stringify([cfg.source, cfg.palette, cfg.detail, cfg.drafting, cfg.stroke, cfg.timing, cfg.reveal, cfg.playback.seed]),
      image: JSON.stringify([cfg.reveal.imageMode, cfg.palette.bg, cfg.palette.line, cfg.source]),
    };
    if (k.analyze !== this.keys.analyze) this.need.analyze = true;
    if (k.build !== this.keys.build) this.need.build = true;
    if (k.image !== this.keys.image) this.need.image = true;
    this.keys = k;
    if (prev && prev.playback.dpr !== cfg.playback.dpr) this.resize();
    this.dirty = true;
  }

  async setImage(url) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    try { await img.decode(); } catch (e) { this.onState({ error: `Could not load image` }); return; }
    this.img = img;
    this.onState({ aspect: img.naturalWidth / img.naturalHeight });
    this.need.analyze = this.need.build = this.need.image = true;
    if (this.cfg?.playback.autoplay !== false) this.replay();
  }

  play() { if (this.time >= this.total()) this.time = 0; this.playing = true; this.emit(); }
  pause() { this.playing = false; this.emit(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  replay() { this.time = 0; this.playing = true; this.head = null; this.emit(); }
  total() { const p = this.cfg?.playback; return p ? p.duration + p.hold : 1; }
  emit() { this.onState({ playing: this.playing, recording: !!this.rec }); }

  exportPNG() {
    this.canvas.toBlob((b) => download(b, `technical-drawing-${Date.now()}.png`), 'image/png');
  }

  record() {
    if (this.rec || !this.canvas.captureStream) return;
    const types = ['video/mp4;codecs=avc1.640033', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = types.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    if (!mimeType) { this.onState({ error: 'MediaRecorder not supported in this browser' }); return; }
    const stream = this.canvas.captureStream(60);
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 24_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      if (!rec._cancel) download(new Blob(chunks, { type: mimeType }), `technical-drawing-${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
      stream.getTracks().forEach((t) => t.stop());
    };
    this.rec = rec;
    this.replay();
    rec.start();
    this.emit();
  }

  stopRecording(cancel = false) {
    if (!this.rec) return;
    this.rec._cancel = cancel;
    this.rec.stop();
    this.rec = null;
    this.emit();
  }

  // ---------- internals ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.cfg?.playback.dpr ?? 2);
    const r = this.canvas.getBoundingClientRect();
    const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
    if (W === this.canvas.width && H === this.canvas.height && dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = W; this.canvas.height = H;
    for (const [k, c] of Object.entries(this.layers)) {
      if (k === 'mask') { c.width = Math.ceil(W * MASK_SCALE); c.height = Math.ceil(H * MASK_SCALE); }
      else { c.width = W; c.height = H; }
    }
    this.need.build = this.need.image = true;
  }

  prepare() {
    if (!this.img || !this.cfg) return false;
    if (this.need.analyze) {
      const t = performance.now();
      this.an = analyzeImage(this.img, this.cfg.detail);
      this.need.analyze = false;
      this.need.build = true;
      this.onState({ analyzed: { ms: Math.round(performance.now() - t), chains: this.an.chains.length, arcs: this.an.arcs.length } });
    }
    if (this.need.build) {
      const { width: W, height: H } = this.canvas;
      this.scene = buildScene(this.an, W, H, this.dpr, this.cfg);
      this.scene.contourTotal = this.scene.ink.filter((e) => e.contour).length;
      this.need.build = false;
      this.need.image = true;
      this.resetCaches();
      this.buildFade();
    }
    if (this.need.image) { this.prepareImage(); this.need.image = false; }
    return true;
  }

  /** Alpha mask that softly fades everything (lines, grid) out toward the canvas edges. */
  buildFade() {
    const f = this.layers.fade, c = f.getContext('2d');
    const { width: W, height: H } = f;
    const r = this.scene.imgRect, k = this.cfg.source.edgeFade;
    const wx = Math.max(1, r.x * k), wy = Math.max(1, r.y * k); // fade only inside the bleed margin
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-in';
    const edge = (x0, y0, x1, y1) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, '#000');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    };
    edge(0, 0, wx, 0); edge(W, 0, W - wx, 0); edge(0, 0, 0, wy); edge(0, H, 0, H - wy);
    c.globalCompositeOperation = 'source-over';
  }

  resetCaches() {
    for (const k of ['grid', 'ink']) {
      const L = this.layers[k];
      L.getContext('2d').clearRect(0, 0, L.width, L.height);
      this.cache[k] = { idx: 0, u: -1, done: 0 };
    }
  }

  prepareImage() {
    const { image } = this.layers, c = image.getContext('2d', { willReadFrequently: true });
    const r = this.scene.imgRect, mode = this.cfg.reveal.imageMode;
    c.clearRect(0, 0, image.width, image.height);
    c.imageSmoothingQuality = 'high';
    c.filter = mode === 'mono' ? 'grayscale(1) contrast(1.1)' : mode === 'inverted' ? 'invert(1) hue-rotate(180deg)' : 'none';
    c.drawImage(this.img, r.x, r.y, r.w, r.h);
    c.filter = 'none';
    if (mode === 'duotone') {
      const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
      const w = Math.min(image.width, Math.ceil(r.x + r.w)) - x0, h = Math.min(image.height, Math.ceil(r.y + r.h)) - y0;
      try {
        const d = c.getImageData(x0, y0, w, h);
        const [br, bg, bb] = toRGB(this.cfg.palette.bg), [lr, lg, lb] = toRGB(this.cfg.palette.line);
        const p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
          p[i] = br + (lr - br) * l; p[i + 1] = bg + (lg - bg) * l; p[i + 2] = bb + (lb - bb) * l;
        }
        c.putImageData(d, x0, y0);
      } catch (e) { /* tainted canvas: keep original */ }
    }
  }

  advanceCache(name, list, u) {
    const L = this.layers[name], lc = L.getContext('2d');
    const cache = this.cache[name];
    if (u < cache.u) { lc.clearRect(0, 0, L.width, L.height); cache.idx = 0; cache.done = 0; }
    lc.lineCap = 'round'; lc.lineJoin = 'round';
    while (cache.idx < list.length && list[cache.idx].t1 <= u) {
      const el = list[cache.idx++];
      drawPoly(lc, el, 1, 1);
      if (el.contour) cache.done++;
    }
    lc.globalAlpha = 1;
    cache.u = u;
  }

  /** Draws in-progress elements; returns the tip of the newest contour (plotter head target). */
  drawActive(ctx, list, start, u, alpha, ease) {
    let tip = null, newest = -1;
    for (let i = start; i < list.length; i++) {
      const el = list[i];
      if (el.t0 > u) continue;
      const t = drawPoly(ctx, el, ease(prog(u, el.t0, el.t1)), alpha);
      if (el.contour && el.t0 > newest && t) { newest = el.t0; tip = t; }
    }
    return tip;
  }

  tick = (now) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.prepare()) return;
    const P = this.cfg.playback;
    if (this.playing && !P.scrub) {
      this.time += dt * P.speed;
      if (this.time >= this.total()) {
        if (this.rec) { this.time = this.total(); this.stopRecording(); this.playing = false; }
        else if (P.loop) { this.time = 0; this.head = null; }
        else { this.time = this.total(); this.playing = false; this.emit(); }
      }
    }
    const u = P.scrub ? P.progress : clamp(this.time / P.duration);
    this.render(u);
  };

  render(u) {
    const { ctx, scene: sc, cfg } = this;
    const { W, H } = sc;
    const T = cfg.timing, R = cfg.reveal, D = cfg.drafting;
    const ease = EASES[T.ease] || EASES.easeInOut;
    const rv = sc.reveal;
    const fadeStart = rv.rs + (rv.re - rv.rs) * 0.45;
    const inkA = lerp(1, R.keepLines, EASES.smooth(prog(u, fadeStart, rv.re)));
    sc.knockA = 1 - EASES.smooth(prog(u, rv.rs, rv.rs + (rv.re - rv.rs) * 0.3));

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, W, H);
    if (cfg.palette.plate) {
      ctx.globalAlpha = inkA; // plate fades with the linework so only the image remains
      ctx.fillStyle = cfg.palette.bg;
      ctx.fillRect(sc.G.x, sc.G.y, sc.G.w, sc.G.h);
      ctx.globalAlpha = 1;
    }

    // grid
    this.advanceCache('grid', sc.grid, u);
    ctx.globalAlpha = inkA;
    if (inkA > 0.001) ctx.drawImage(this.layers.grid, 0, 0);
    this.drawActive(ctx, sc.grid, this.cache.grid.idx, u, inkA, EASES.easeOut);
    for (const n of sc.notes) if (n.kind === 'frame') drawNote(ctx, n, u, sc, cfg, 1);

    // image reveal
    if (u >= rv.rs) {
      ctx.globalAlpha = 1;
      if (u >= rv.re) ctx.drawImage(this.layers.image, 0, 0);
      else ctx.drawImage(this.renderReveal(u), 0, 0);
    }

    // ink (construction, contours, hatch)
    ctx.globalCompositeOperation = R.lineBlend;
    this.advanceCache('ink', sc.ink, u);
    if (inkA > 0.001) {
      ctx.globalAlpha = inkA;
      ctx.drawImage(this.layers.ink, 0, 0);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const tip = this.drawActive(ctx, sc.ink, this.cache.ink.idx, u, inkA, ease);

    // annotations
    ctx.globalCompositeOperation = 'source-over';
    if (inkA > 0.001) for (const n of sc.notes) if (n.kind !== 'frame') drawNote(ctx, n, u, sc, cfg, inkA);

    // plotter head
    if (D.plotter) {
      if (tip) {
        if (!this.head || this.head.a < 0.05 || this.cfg.playback.scrub) this.head = { x: tip[0], y: tip[1], a: this.head?.a ?? 0 };
        this.head.x = lerp(this.head.x, tip[0], 0.45);
        this.head.y = lerp(this.head.y, tip[1], 0.45);
        this.head.a = lerp(this.head.a, 1, 0.2);
      } else if (this.head) this.head.a = lerp(this.head.a, 0, 0.12);
      drawHead(ctx, this.head, sc, cfg, inkA);
    }
    if (D.hud) drawHud(ctx, sc, cfg, u, { done: this.cache.ink.done, total: sc.contourTotal }, inkA);
    if (cfg.source.edgeFade > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.layers.fade, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  renderReveal(u) {
    const { mask, reveal, image } = this.layers;
    const sc = this.scene, R = this.cfg.reveal, rv = sc.reveal;
    const m = mask.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, mask.width, mask.height);
    m.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0);
    m.lineCap = 'round'; m.lineJoin = 'round';
    m.strokeStyle = '#fff';
    const mainA = 1 - 0.55 * R.bristles;
    for (const st of sc.brush) {
      const p = prog(u, st.t0, st.t1);
      if (p <= 0) continue;
      const f = EASES.easeInOut(p);
      m.globalAlpha = mainA;
      m.lineWidth = st.size;
      m.beginPath(); tracePartial(m, st.pts, st.cum, f); m.stroke();
      for (const b of st.bristles) {
        m.globalAlpha = b.a;
        m.lineWidth = b.w;
        m.save();
        m.translate(st.nx * b.off, st.ny * b.off);
        m.beginPath(); tracePartial(m, st.pts, st.cum, Math.max(0, f - Math.abs(b.off) / (st.cum[st.cum.length - 1] || 1))); m.stroke();
        m.restore();
      }
    }
    const fill = prog(u, rv.fillStart, rv.re);
    if (fill > 0) {
      m.globalAlpha = EASES.smooth(fill);
      m.fillStyle = '#fff';
      m.fillRect(0, 0, sc.W, sc.H);
    }
    const rc = reveal.getContext('2d');
    rc.globalCompositeOperation = 'source-over';
    rc.globalAlpha = 1;
    rc.clearRect(0, 0, reveal.width, reveal.height);
    rc.drawImage(image, 0, 0);
    rc.globalCompositeOperation = 'destination-in';
    rc.imageSmoothingEnabled = true;
    rc.filter = R.softness > 0 ? `blur(${R.softness * sc.dpr}px)` : 'none';
    rc.drawImage(mask, 0, 0, sc.W, sc.H);
    rc.filter = 'none';
    rc.globalCompositeOperation = 'source-over';
    return reveal;
  }
}

function tracePartial(ctx, pts, cum, frac) {
  const n = cum.length, total = cum[n - 1] * frac;
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 1; i < n; i++) {
    if (cum[i] <= total) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    else {
      const k = (total - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      ctx.lineTo(lerp(pts[i * 2 - 2], pts[i * 2], k), lerp(pts[i * 2 - 1], pts[i * 2 + 1], k));
      break;
    }
  }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
