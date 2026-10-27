// Public options: defaults, merging and resolution into the engine's internal config.
// The option groups mirror the DialKit panels 1:1, so "Copy parameters" output can be pasted straight in.
import { PALETTES } from './engine/palettes.js';

export const DEFAULTS = {
  playback: {
    duration: 10, // seconds the drawing takes (0 → 1 progress)
    hold: 2.5, // seconds to hold the finished frame before looping / ending
    speed: 0.8,
    loop: true,
    autoplay: true, // true | 'inView' | false
    seed: 7, // changes the random choices (ordering, which features get dimensioned…)
    pixelRatio: 2, // max device pixel ratio used for the canvas
    reducedMotion: 'end', // 'end' = show the finished frame when the user prefers reduced motion; 'play' = ignore
  },
  layout: {
    bleed: 0.14, // margin around the image (fraction of image size) that lines may overflow into
    gridOverflow: 0.6, // how far grid / plate extend into the bleed (0–1)
    edgeFade: 0.9, // soft fade of everything toward the canvas edge (0–1)
  },
  colors: {
    preset: 'ink', // ink | graphite | drafting | blueline | blueprint | retro | amber | phosphor
    colorMode: 'multi', // single | multi | image
    // plate, bg, grid, line, accent, dim, text, inks.m1–m4 default to the preset's values
  },
  detection: {
    maxLines: 1370,
    sensitivity: 0.3,
    minLength: 39,
    blur: 1.1,
    simplify: 1.1,
    resolution: 830,
    smooth: true,
  },
  drafting: {
    sheet: { grid: true, gridSize: 10, gridOpacity: 0.33, sheetFrame: false, titleBlock: false, title: 'TECHNICAL DRAWING' },
    construction: { construction: 24, centerLines: true },
    measure: { dimensions: 3, baselineDims: 5, radii: 10, angles: 3, markers: 7, realWidth: 269, decimals: 3 },
    type: { textSize: 13, italic: true, knockout: true, arrowStyle: 'open', arrowSize: 1 },
    hatching: { hatch: false, hatchSpacing: 8.5, hatchThreshold: 0.32, hatchAngle: 34, crossHatch: true },
    live: { plotter: true, readout: true, hud: false },
  },
  stroke: {
    style: 'flat', // flat | pen | sketch | pencil | brush
    lineWidth: 1.7,
    constructionWidth: 0.9,
    dimWidth: 2.15,
    opacity: 1,
    overshoot: 10.5,
    jitter: 0,
    dashedConstruction: true,
  },
  timing: {
    // phase windows as fractions of `duration`
    ease: 'easeInOut', // easeInOut | easeOut | expoOut | smooth | linear
    gridEnd: 0.1,
    constructStart: 0.03,
    constructEnd: 0.3,
    drawStart: 0.1,
    drawEnd: 0.62,
    annotateStart: 0.3,
    annotateEnd: 0.8,
    revealStart: 0.52,
    revealEnd: 0.75,
  },
  reveal: {
    mode: 'sweep', // sweep | horizontal | vertical | radial | scribble
    angle: -45,
    brushSize: 0.18,
    dabs: 9,
    wobble: 0.59,
    softness: 10,
    bristles: 0.3,
    keepLines: 1, // 0 = linework fades away, 1 = stays on top of the image
    imageMode: 'original', // original | duotone | mono | inverted
    lineBlend: 'screen', // any canvas composite op: source-over | screen | multiply | overlay | difference | lighter
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** {"sheet.grid": true} → {sheet: {grid: true}} (DialKit's "Copy parameters" uses dotted keys). */
export function expandDotted(obj) {
  if (!isObj(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const val = isObj(v) && !('type' in v) ? expandDotted(v) : v;
    if (!k.includes('.')) { out[k] = isObj(val) && isObj(out[k]) ? deepMerge(out[k], val) : val; continue; }
    const parts = k.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) cur = isObj(cur[parts[i]]) ? cur[parts[i]] : (cur[parts[i]] = {});
    cur[parts[parts.length - 1]] = val;
  }
  return out;
}

export function deepMerge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** Public options (partial) → complete public options with defaults applied and colours filled from the preset. */
export function withDefaults(options = {}) {
  const o = deepMerge(DEFAULTS, expandDotted(stripRuntime(options)));
  // accept pasted DialKit output as-is: export.pixelRatio folder, stringified autoplay select
  const { export: ex, ...pb } = o.playback;
  o.playback = { ...pb, pixelRatio: ex?.pixelRatio ?? pb.pixelRatio };
  if (o.playback.autoplay === 'true') o.playback.autoplay = true;
  if (o.playback.autoplay === 'false') o.playback.autoplay = false;
  const preset = PALETTES[o.colors.preset] || PALETTES.ink;
  const { m1, m2, m3, m4, ...base } = preset;
  o.colors = deepMerge({ ...base, inks: { m1, m2, m3, m4 } }, o.colors);
  return o;
}

const RUNTIME_KEYS = ['src', 'alt', 'progress', 'onReady', 'onComplete', 'onError', 'onAspect', 'className', 'style'];
function stripRuntime(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (!RUNTIME_KEYS.includes(k) && typeof v !== 'function') out[k] = v;
  return out;
}

/** Public options → the engine's internal config shape. */
export function resolveOptions(options = {}) {
  const o = withDefaults(options);
  const { inks, preset, ...colors } = o.colors;
  const progress = typeof options.progress === 'number' ? options.progress : null;
  return {
    source: { ...o.layout },
    playback: {
      ...o.playback,
      dpr: o.playback.pixelRatio,
      scrub: progress !== null,
      progress: progress ?? 0,
    },
    palette: { ...colors, ...inks, preset },
    detail: { ...o.detection },
    drafting: Object.assign({}, ...Object.values(o.drafting)),
    stroke: { ...o.stroke },
    timing: { ...o.timing },
    reveal: { ...o.reveal },
  };
}
