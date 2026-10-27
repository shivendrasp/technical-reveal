// Vanilla entry: createTechnicalReveal(container | canvas, options) → controller.
import { RevealEngine } from './engine/index.js';
import { resolveOptions, deepMerge } from './options.js';

/**
 * Mount a technical-drawing reveal.
 * @param {HTMLElement|HTMLCanvasElement} target a container (a canvas is created inside, sized to the image) or a canvas you size yourself
 * @param {import('../types').TechnicalRevealOptions} options
 */
export function createTechnicalReveal(target, options = {}) {
  if (typeof window === 'undefined') throw new Error('technical-reveal: createTechnicalReveal() must run in the browser');
  if (!target) throw new Error('technical-reveal: missing target element');

  const owned = !(target instanceof HTMLCanvasElement);
  const canvas = owned ? document.createElement('canvas') : target;
  if (owned) {
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    target.appendChild(canvas);
  }

  let opts = { ...options };
  let src = null;
  let played = false;
  const reduced = () => opts.playback?.reducedMotion !== 'play' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const applyA11y = () => {
    canvas.setAttribute('role', 'img');
    if (opts.alt != null) canvas.setAttribute('aria-label', opts.alt);
  };

  const engine = new RevealEngine(canvas, {
    onState: (s) => {
      if (s.aspect) {
        if (owned || opts.autoSize) canvas.style.aspectRatio = String(s.aspect);
        opts.onAspect?.(s.aspect);
      }
      if (s.analyzed) {
        opts.onReady?.(s.analyzed);
        if (reduced()) { engine.seek(1); engine.pause(); }
      }
      if (s.complete) opts.onComplete?.();
      if (s.error) {
        const err = s.error instanceof Error ? s.error : new Error(String(s.error));
        if (opts.onError) opts.onError(err);
        else console.error(err);
      }
    },
  });

  // play-in-view + skip rendering while offscreen
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(([e]) => {
        engine.visible = e.isIntersecting;
        if (e.isIntersecting) {
          engine.dirty = true;
          if (opts.playback?.autoplay === 'inView' && !played && !reduced()) { played = true; engine.replay(); }
        }
      }, { threshold: opts.inViewThreshold ?? 0.3 })
    : null;
  io?.observe(canvas);

  const sync = () => {
    applyA11y();
    engine.setConfig(resolveOptions(opts));
    if (opts.src && opts.src !== src) {
      src = opts.src;
      played = false;
      engine.setImage(src);
    }
  };
  sync();

  return {
    canvas,
    engine,
    /** Replace all options (missing keys fall back to defaults). */
    setOptions(next) { opts = { ...next }; sync(); },
    /** Deep-merge a partial update into the current options. */
    update(partial) { opts = deepMerge(opts, partial); sync(); },
    setSource(url) { opts = { ...opts, src: url }; sync(); },
    play: () => engine.play(),
    pause: () => engine.pause(),
    toggle: () => engine.toggle(),
    replay: () => { played = true; engine.replay(); },
    seek: (progress) => engine.seek(progress),
    get progress() { return engine.progress; },
    get playing() { return engine.playing; },
    record: () => engine.record(),
    stopRecording: () => engine.stopRecording(),
    exportPNG: () => engine.exportPNG(),
    destroy() {
      io?.disconnect();
      engine.destroy();
      if (owned) canvas.remove();
    },
  };
}
