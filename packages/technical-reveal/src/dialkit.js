// Optional tuning panel: live DialKit controls for every option.
// Usage: const options = useRevealControls(ref, { src: '/car.png' }); <TechnicalReveal ref={ref} {...options} />
// Tune, press "Copy parameters" on a panel, paste the values into your options, then remove the panel.
'use client';
import { useEffect, useRef } from 'react';
import { useDialKit, useDialKitController } from 'dialkit';
import { withDefaults } from './options.js';
import { PALETTES, PALETTE_KEYS } from './engine/palettes.js';

// [min, max, step] for every numeric option
const R = {
  duration: [1, 40, 0.5], hold: [0, 10, 0.5], speed: [0.1, 3, 0.05], seed: [1, 999, 1], pixelRatio: [1, 3, 0.5],
  bleed: [0, 0.5, 0.01], gridOverflow: [0, 1, 0.01], edgeFade: [0, 1, 0.01],
  maxLines: [20, 4000, 10], sensitivity: [0.01, 0.8, 0.01], minLength: [2, 120, 1], blur: [0, 4, 0.1], simplify: [0.3, 4, 0.1], resolution: [240, 1600, 10],
  gridSize: [4, 60, 1], gridOpacity: [0, 1, 0.01], construction: [0, 60, 1],
  dimensions: [0, 24, 1], baselineDims: [0, 16, 1], radii: [0, 20, 1], angles: [0, 16, 1], markers: [0, 30, 1], realWidth: [10, 1000, 0.5], decimals: [0, 3, 1],
  textSize: [6, 28, 0.5], arrowSize: [0.4, 2.5, 0.05],
  hatchSpacing: [2, 24, 0.5], hatchThreshold: [0, 1, 0.01], hatchAngle: [0, 180, 1],
  lineWidth: [0.2, 8, 0.1], constructionWidth: [0.1, 4, 0.05], dimWidth: [0.2, 4, 0.05], opacity: [0.05, 1, 0.01], overshoot: [0, 30, 0.5], jitter: [0, 6, 0.1],
  gridEnd: [0, 1, 0.005], constructStart: [0, 1, 0.005], constructEnd: [0, 1, 0.005], drawStart: [0, 1, 0.005], drawEnd: [0, 1, 0.005],
  annotateStart: [0, 1, 0.005], annotateEnd: [0, 1, 0.005], revealStart: [0, 1, 0.005], revealEnd: [0, 1, 0.005],
  angle: [-90, 90, 1], brushSize: [0.04, 0.8, 0.01], dabs: [0, 40, 1], wobble: [0, 1.5, 0.01], softness: [0, 80, 1], bristles: [0, 1, 0.01], keepLines: [0, 1, 0.01],
};
// select options for string options
const S = {
  autoplay: ['true', 'inView', 'false'], reducedMotion: ['end', 'play'],
  preset: [...PALETTE_KEYS], colorMode: ['single', 'multi', 'image'],
  arrowStyle: ['open', 'arrow', 'tick', 'dot'], style: ['flat', 'pen', 'sketch', 'pencil', 'brush'],
  ease: ['easeInOut', 'easeOut', 'expoOut', 'smooth', 'linear'],
  mode: ['sweep', 'horizontal', 'vertical', 'radial', 'scribble'],
  imageMode: ['original', 'duotone', 'mono', 'inverted'],
  lineBlend: ['screen', 'source-over', 'multiply', 'overlay', 'difference', 'lighter'],
};

/** Turn a group of default values into a DialKit config (selects put the current value first = default). */
function toConfig(group, collapsed = false) {
  const out = collapsed ? { _collapsed: true } : {};
  for (const [k, v] of Object.entries(group)) {
    if (S[k]) out[k] = { type: 'select', options: [String(v), ...S[k].filter((o) => o !== String(v))] };
    else if (typeof v === 'number') out[k] = R[k] ? [v, ...R[k]] : v;
    else if (v && typeof v === 'object') out[k] = toConfig(v, true);
    else out[k] = v;
  }
  return out;
}

const unbool = (v) => (v === 'true' ? true : v === 'false' ? false : v);

/**
 * Registers DialKit panels for all options and returns live options for <TechnicalReveal>.
 * @param {React.RefObject} revealRef ref of the <TechnicalReveal> (for replay / record / export buttons)
 * @param {object} initial starting options (same shape as the component's options) + `images` for the picker
 */
export function useRevealControls(revealRef, initial = {}) {
  const { images, src, alt, ...rest } = initial;
  const d = useRef(withDefaults(rest)).current;
  const panel = (name) => ({ id: `technical-reveal-${name}`, defaultCollapsed: name !== 'playback' && name !== 'layout' });

  const imageOptions = images?.length ? images : src ? [{ value: src, label: 'Image' }] : [];
  const { pixelRatio, ...pb } = d.playback;
  const playback = useDialKit('Playback', {
    replay: { type: 'action', label: 'Replay' },
    playPause: { type: 'action', label: 'Play / Pause' },
    ...toConfig(pb),
    export: {
      record: { type: 'action', label: 'Record video (1 cycle)' },
      png: { type: 'action', label: 'Save PNG frame' },
      pixelRatio: [pixelRatio, ...R.pixelRatio],
    },
  }, {
    ...panel('playback'),
    onAction: (path) => {
      const r = revealRef?.current;
      if (!r) return;
      if (path === 'replay') r.replay();
      if (path === 'playPause') r.toggle();
      if (path === 'export.record') r.record();
      if (path === 'export.png') r.exportPNG();
    },
  });

  const layout = useDialKit('Layout', {
    ...(imageOptions.length ? { image: { type: 'image', options: src && images?.length ? [...images.filter((i) => i.value === src), ...images.filter((i) => i.value !== src)] : imageOptions } } : {}),
    ...toConfig(d.layout),
  }, panel('layout'));

  const colors = useDialKitController('Colors', toConfig(d.colors), panel('colors'));
  const detection = useDialKit('Detection', toConfig(d.detection), panel('detection'));
  const drafting = useDialKit('Drafting', toConfig(d.drafting), panel('drafting'));
  const stroke = useDialKit('Stroke', toConfig(d.stroke), panel('stroke'));
  const timing = useDialKit('Timing', toConfig(d.timing), panel('timing'));
  const reveal = useDialKit('Reveal', toConfig(d.reveal), panel('reveal'));

  // choosing a preset loads its colours into the colour controls
  const cv = colors.values;
  const lastPreset = useRef(cv.preset);
  useEffect(() => {
    if (cv.preset === lastPreset.current) return;
    lastPreset.current = cv.preset;
    const p = PALETTES[cv.preset];
    if (!p) return;
    const { m1, m2, m3, m4, ...base } = p;
    colors.setValues({ ...base, inks: { m1, m2, m3, m4 } });
  }, [cv.preset]);

  const { image, ...layoutValues } = layout;
  const { export: ex, ...pbValues } = playback;
  return {
    ...rest,
    src: image || src,
    alt,
    playback: { ...pbValues, autoplay: unbool(pbValues.autoplay), pixelRatio: ex.pixelRatio },
    layout: layoutValues,
    colors: cv,
    detection,
    drafting,
    stroke,
    timing,
    reveal,
  };
}
