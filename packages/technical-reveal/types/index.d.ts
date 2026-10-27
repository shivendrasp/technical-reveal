export type PresetName = 'ink' | 'graphite' | 'drafting' | 'blueline' | 'blueprint' | 'retro' | 'amber' | 'phosphor';

export interface PlaybackOptions {
  /** Seconds the drawing takes, from blank to fully revealed. Default 10. */
  duration?: number;
  /** Seconds to hold the finished frame before looping / ending. Default 2.5. */
  hold?: number;
  /** Playback speed multiplier. Default 0.8. */
  speed?: number;
  /** Loop forever. Default true. */
  loop?: boolean;
  /** `true` plays when the image is ready, `'inView'` waits until the canvas scrolls into view, `false` waits for `play()`. Default true. */
  autoplay?: boolean | 'inView';
  /** Changes random choices (ordering, which features get dimensioned). Default 7. */
  seed?: number;
  /** Maximum device pixel ratio for the canvas. Default 2. */
  pixelRatio?: number;
  /** With `prefers-reduced-motion`: `'end'` shows the finished frame, `'play'` animates anyway. Default 'end'. */
  reducedMotion?: 'end' | 'play';
}

export interface LayoutOptions {
  /** Margin around the image (fraction of image size) that linework overflows into. Default 0.14. */
  bleed?: number;
  /** How far the grid / plate extend into the bleed, 0–1. Default 0.6. */
  gridOverflow?: number;
  /** Soft fade toward the canvas edge, 0–1. Default 0.9. */
  edgeFade?: number;
}

export interface ColorOptions {
  /** Base palette; any colour below overrides it. Default 'ink'. */
  preset?: PresetName;
  /** `single` = line colour, `multi` = inks picked by the image's hues, `image` = sampled image colours. Default 'multi'. */
  colorMode?: 'single' | 'multi' | 'image';
  /** Fill the image area with `bg` (for dark looks). Off = transparent canvas. */
  plate?: boolean;
  bg?: string;
  grid?: string;
  line?: string;
  accent?: string;
  dim?: string;
  text?: string;
  inks?: { m1?: string; m2?: string; m3?: string; m4?: string };
}

export interface DetectionOptions {
  maxLines?: number;
  /** Share of edge pixels treated as strong edges. Higher = more lines. */
  sensitivity?: number;
  minLength?: number;
  blur?: number;
  simplify?: number;
  /** Analysis resolution (longest side, px). */
  resolution?: number;
  smooth?: boolean;
}

export interface DraftingOptions {
  sheet?: { grid?: boolean; gridSize?: number; gridOpacity?: number; sheetFrame?: boolean; titleBlock?: boolean; title?: string };
  construction?: { construction?: number; centerLines?: boolean };
  measure?: { dimensions?: number; baselineDims?: number; radii?: number; angles?: number; markers?: number; realWidth?: number; decimals?: number };
  type?: { textSize?: number; italic?: boolean; knockout?: boolean; arrowStyle?: 'open' | 'arrow' | 'tick' | 'dot'; arrowSize?: number };
  hatching?: { hatch?: boolean; hatchSpacing?: number; hatchThreshold?: number; hatchAngle?: number; crossHatch?: boolean };
  live?: { plotter?: boolean; readout?: boolean; hud?: boolean };
}

export interface StrokeOptions {
  style?: 'flat' | 'pen' | 'sketch' | 'pencil' | 'brush';
  lineWidth?: number;
  constructionWidth?: number;
  dimWidth?: number;
  opacity?: number;
  overshoot?: number;
  jitter?: number;
  dashedConstruction?: boolean;
}

/** Phase windows as fractions (0–1) of `duration`. */
export interface TimingOptions {
  ease?: 'easeInOut' | 'easeOut' | 'expoOut' | 'smooth' | 'linear';
  gridEnd?: number;
  constructStart?: number;
  constructEnd?: number;
  drawStart?: number;
  drawEnd?: number;
  annotateStart?: number;
  annotateEnd?: number;
  revealStart?: number;
  revealEnd?: number;
}

export interface RevealOptions {
  mode?: 'sweep' | 'horizontal' | 'vertical' | 'radial' | 'scribble';
  angle?: number;
  brushSize?: number;
  dabs?: number;
  wobble?: number;
  softness?: number;
  bristles?: number;
  /** 0 = linework fades away, 1 = stays on top of the image. */
  keepLines?: number;
  imageMode?: 'original' | 'duotone' | 'mono' | 'inverted';
  /** Canvas composite operation for the linework. */
  lineBlend?: GlobalCompositeOperation;
}

export interface ReadyInfo {
  /** Number of traced contours. */
  chains: number;
  /** Number of fitted arcs. */
  arcs: number;
  /** Analysis time in ms. */
  ms: number;
}

export interface TechnicalRevealOptions {
  /** Image URL (same-origin, CORS-enabled, or a data URL). */
  src?: string;
  /** Accessible description of the image. */
  alt?: string;
  /** Drive the animation yourself (e.g. from scroll), 0–1. Disables the internal clock. */
  progress?: number;
  playback?: PlaybackOptions;
  layout?: LayoutOptions;
  colors?: ColorOptions;
  detection?: DetectionOptions;
  drafting?: DraftingOptions;
  stroke?: StrokeOptions;
  timing?: TimingOptions;
  reveal?: RevealOptions;
  /** Viewport share that counts as "in view" for `autoplay: 'inView'`. Default 0.3. */
  inViewThreshold?: number;
  /** Size a canvas you passed in to the image's aspect ratio. (Containers are always auto-sized.) */
  autoSize?: boolean;
  onReady?: (info: ReadyInfo) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onAspect?: (aspectRatio: number) => void;
}

export interface TechnicalRevealController {
  readonly canvas: HTMLCanvasElement;
  readonly progress: number;
  readonly playing: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  replay(): void;
  /** Jump to a point of the animation, 0–1. */
  seek(progress: number): void;
  /** Replace all options (missing keys fall back to defaults). */
  setOptions(options: TechnicalRevealOptions): void;
  /** Deep-merge a partial update into the current options. */
  update(options: TechnicalRevealOptions): void;
  setSource(src: string): void;
  /** Record one full cycle and download it (mp4 or webm, browser-dependent). */
  record(): void;
  stopRecording(): void;
  /** Download the current frame as a transparent PNG. */
  exportPNG(): void;
  destroy(): void;
}

/** Mount a reveal into a container (a canvas is created, sized to the image) or onto your own canvas. */
export function createTechnicalReveal(target: HTMLElement | HTMLCanvasElement, options?: TechnicalRevealOptions): TechnicalRevealController;

export declare const DEFAULTS: Required<Omit<TechnicalRevealOptions, 'src' | 'alt' | 'progress' | 'inViewThreshold' | 'autoSize' | 'onReady' | 'onComplete' | 'onError' | 'onAspect'>>;
export declare const PALETTES: Record<PresetName, Required<Omit<ColorOptions, 'preset' | 'colorMode' | 'inks'>> & { m1: string; m2: string; m3: string; m4: string }>;
export declare const PALETTE_KEYS: PresetName[];
/** Fill in defaults (and preset colours) for a partial options object. */
export function withDefaults(options?: TechnicalRevealOptions): Required<Omit<TechnicalRevealOptions, 'src' | 'alt' | 'progress' | 'inViewThreshold' | 'autoSize' | 'onReady' | 'onComplete' | 'onError' | 'onAspect'>>;
/** Low-level: resolve public options into the engine's internal config. */
export function resolveOptions(options?: TechnicalRevealOptions): Record<string, unknown>;
/** Low-level engine (prefer createTechnicalReveal). */
export class RevealEngine {
  constructor(canvas: HTMLCanvasElement, opts?: { onState?: (state: Record<string, unknown>) => void });
  setConfig(config: Record<string, unknown>): void;
  setImage(url: string): Promise<void>;
  play(): void;
  pause(): void;
  toggle(): void;
  replay(): void;
  seek(progress: number): void;
  record(): void;
  stopRecording(cancel?: boolean): void;
  exportPNG(): void;
  destroy(): void;
  readonly progress: number;
  playing: boolean;
  visible: boolean;
}
