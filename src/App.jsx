import { useEffect, useRef, useState } from 'react';
import { DialRoot, useDialKit, useDialKitController } from 'dialkit';
import { TechnicalReveal, PALETTES, PALETTE_KEYS } from './engine/index.js';

const sel = (options) => ({ type: 'select', options });
const persist = (id) => ({ id, persist: false, defaultCollapsed: true });
const BP = PALETTES.ink;

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [state, setState] = useState({ playing: true });
  const [info, setInfo] = useState('');
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState(null);
  const [ar, setAr] = useState(1.5);

  // ---------------- controls ----------------
  const playback = useDialKit('Playback', {
    replay: { type: 'action', label: 'Replay' },
    playPause: { type: 'action', label: 'Play / Pause' },
    duration: [10, 2, 40, 0.5],
    hold: [2.5, 0, 10, 0.5],
    speed: [0.8, 0.1, 3, 0.05],
    loop: true,
    autoplay: true,
    scrub: false,
    progress: [0, 0, 1, 0.001],
    seed: [7, 1, 999, 1],
    export: {
      record: { type: 'action', label: 'Record video (1 cycle)' },
      png: { type: 'action', label: 'Save PNG frame' },
      dpr: [2, 1, 3, 0.5],
    },
  }, {
    id: 'td2-playback', persist: false,
    onAction: (path) => {
      const e = engineRef.current;
      if (!e) return;
      if (path === 'replay') e.replay();
      if (path === 'playPause') e.toggle();
      if (path === 'export.record') e.rec ? e.stopRecording() : e.record();
      if (path === 'export.png') e.exportPNG();
    },
  });

  const source = useDialKitController('Source', {
    image: { type: 'image', options: [{ value: '/helmet.png', label: 'Helmet' }, { value: '/demo.png', label: 'Demo render' }] },
    bleed: [0.14, 0, 0.5, 0.01],
    gridOverflow: [0.6, 0, 1, 0.01],
    edgeFade: [0.9, 0, 1, 0.01],
  }, { id: 'td3-source', persist: false });

  const palette = useDialKitController('Palette', {
    preset: sel([...PALETTE_KEYS, 'custom']),
    colorMode: sel(['single', 'multi', 'image']),
    plate: BP.plate,
    bg: BP.bg, grid: BP.grid, line: BP.line, accent: BP.accent, dim: BP.dim, text: BP.text,
    inks: { _collapsed: true, m1: BP.m1, m2: BP.m2, m3: BP.m3, m4: BP.m4 },
  }, { id: 'td2-palette', persist: false });

  const detail = useDialKit('Line detection', {
    maxLines: [1370, 20, 4000, 10],
    sensitivity: [0.3, 0.01, 0.8, 0.01],
    minLength: [39, 2, 120, 1],
    blur: [1.1, 0, 4, 0.1],
    simplify: [1.1, 0.3, 4, 0.1],
    resolution: [830, 240, 1600, 10],
    smooth: true,
  }, persist('td2-detail'));

  const drafting = useDialKit('Drafting', {
    sheet: { grid: true, gridSize: [10, 4, 60, 1], gridOpacity: [0.33, 0, 1, 0.01], sheetFrame: false, titleBlock: false, title: 'TECHNICAL DRAWING' },
    construction: { _collapsed: true, construction: [17, 0, 60, 1], centerLines: true },
    measure: {
      _collapsed: true,
      dimensions: [6, 0, 24, 1], baselineDims: [6, 0, 16, 1], radii: [4, 0, 20, 1], angles: [3, 0, 16, 1], markers: [6, 0, 30, 1],
      realWidth: [235.5, 10, 1000, 0.5], decimals: [2, 0, 3, 1],
    },
    type: { _collapsed: true, textSize: [13, 6, 28, 0.5], italic: true, knockout: true, arrowStyle: sel(['open', 'arrow', 'tick', 'dot']), arrowSize: [1, 0.4, 2.5, 0.05] },
    hatching: { _collapsed: true, hatch: false, hatchSpacing: [8.5, 2, 24, 0.5], hatchThreshold: [0.32, 0, 1, 0.01], hatchAngle: [34, 0, 180, 1], crossHatch: true },
    live: { _collapsed: true, plotter: true, readout: true, hud: false },
  }, persist('td2-drafting'));

  const stroke = useDialKit('Stroke', {
    style: sel(['flat', 'pen', 'sketch', 'pencil', 'brush']),
    lineWidth: [1.8, 0.2, 8, 0.1],
    constructionWidth: [0.65, 0.1, 4, 0.05],
    dimWidth: [1.55, 0.2, 4, 0.05],
    opacity: [1, 0.05, 1, 0.01],
    overshoot: [7, 0, 30, 0.5],
    jitter: [0, 0, 6, 0.1],
    dashedConstruction: false,
  }, persist('td2-stroke'));

  const timing = useDialKit('Timing', {
    ease: sel(['easeInOut', 'easeOut', 'expoOut', 'smooth', 'linear']),
    gridEnd: [0.1, 0, 1, 0.005],
    constructStart: [0.03, 0, 1, 0.005],
    constructEnd: [0.3, 0, 1, 0.005],
    drawStart: [0.1, 0, 1, 0.005],
    drawEnd: [0.62, 0, 1, 0.005],
    annotateStart: [0.3, 0, 1, 0.005],
    annotateEnd: [0.8, 0, 1, 0.005],
    revealStart: [0.52, 0, 1, 0.005],
    revealEnd: [0.94, 0, 1, 0.005],
  }, persist('td2-timing'));

  const reveal = useDialKit('Brush reveal', {
    mode: sel(['sweep', 'horizontal', 'vertical', 'radial', 'scribble']),
    angle: [-37, -90, 90, 1],
    brushSize: [0.19, 0.04, 0.8, 0.01],
    dabs: [12, 0, 40, 1],
    wobble: [0.59, 0, 1.5, 0.01],
    softness: [12, 0, 80, 1],
    bristles: [0.08, 0, 1, 0.01],
    keepLines: [1, 0, 1, 0.01],
    imageMode: sel(['original', 'duotone', 'mono', 'inverted']),
    lineBlend: sel(['screen', 'source-over', 'multiply', 'overlay', 'difference', 'lighter']),
  }, persist('td2-reveal'));

  // palette preset → load its colours into the colour controls (then they stay editable)
  const pv = palette.values;
  const lastPreset = useRef(pv.preset);
  useEffect(() => {
    if (pv.preset === lastPreset.current) return;
    lastPreset.current = pv.preset;
    const p = PALETTES[pv.preset];
    if (!p) return;
    palette.setValues({
      plate: p.plate,
      bg: p.bg, grid: p.grid, line: p.line, accent: p.accent, dim: p.dim, text: p.text,
      inks: { m1: p.m1, m2: p.m2, m3: p.m3, m4: p.m4 },
      colorMode: pv.preset === 'retro' ? 'multi' : pv.colorMode,
    });
  }, [pv.preset]);

  // ---------------- engine ----------------
  useEffect(() => {
    const e = new TechnicalReveal(canvasRef.current, {
      onState: (s) => {
        if (s.analyzed) setInfo(`${s.analyzed.chains} contours · ${s.analyzed.arcs} arcs · ${s.analyzed.ms}ms`);
        if (s.error) setInfo(s.error);
        if (s.aspect) setAr(s.aspect);
        if ('playing' in s) setState(s);
      },
    });
    engineRef.current = e;
    return () => e.destroy();
  }, []);

  const sv = source.values;
  const cfg = {
    source: { bleed: sv.bleed, gridOverflow: sv.gridOverflow, edgeFade: sv.edgeFade },
    playback: { ...playback, dpr: playback.export.dpr },
    palette: { ...pv, ...pv.inks },
    detail,
    drafting: Object.assign({}, ...Object.values(drafting)),
    stroke,
    timing,
    reveal,
  };
  const cfgKey = JSON.stringify(cfg);
  useEffect(() => { engineRef.current?.setConfig(cfg); }, [cfgKey]);

  const imageUrl = dropped || sv.image || '/helmet.png';
  useEffect(() => { engineRef.current?.setImage(imageUrl); }, [imageUrl]);
  useEffect(() => { setDropped(null); }, [sv.image]);

  // drag & drop any image onto the page
  useEffect(() => {
    const over = (ev) => { ev.preventDefault(); setDragging(true); };
    const leave = (ev) => { if (!ev.relatedTarget) setDragging(false); };
    const drop = (ev) => {
      ev.preventDefault();
      setDragging(false);
      const f = [...(ev.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!f) return;
      const r = new FileReader();
      r.onload = () => setDropped(r.result);
      r.readAsDataURL(f);
    };
    const key = (ev) => {
      if (ev.target.closest?.('input, textarea, [contenteditable]')) return;
      if (ev.code === 'Space') { ev.preventDefault(); engineRef.current?.toggle(); }
      if (ev.key === 'r' && !ev.metaKey && !ev.ctrlKey) engineRef.current?.replay();
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('keydown', key);
    };
  }, []);

  return (
    <>
      <div className="page">
        <canvas ref={canvasRef} className="stage" style={{ '--ar': ar }} />
      </div>
      <div className={`status ${info || state.recording ? 'show' : ''}`}>
        {state.recording ? <span className="rec">● REC </span> : null}
        {info}
        {!state.playing && !state.recording ? ' · paused (space)' : ''}
      </div>
      {dragging && <div className="drop">Drop an image to draft it</div>}
      <DialRoot position="top-right" theme="dark" productionEnabled />
    </>
  );
}
