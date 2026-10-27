# technical-reveal

Turn any image into a CAD / blueprint-style animated intro. Edges are traced from the image and drafted in like a technical drawing — construction lines, dimensions that measure and count up, compass arcs, a plotter crosshair — then a soft brush mask reveals the real image.

<!-- DEMO: record one with the playground (Playback › Export › Record video), then drag the file here on GitHub -->

[![npm](https://img.shields.io/npm/v/technical-reveal.svg)](https://www.npmjs.com/package/technical-reveal)
[![license](https://img.shields.io/npm/l/technical-reveal.svg)](./LICENSE)

- Works with any image: no manual paths or SVGs.
- Transparent canvas sized to the image, so it drops onto any page.
- React component, plain-JS API, and an optional live tuning panel (DialKit).
- Zero runtime dependencies, ESM, fully typed. Plays in view, pauses offscreen, respects reduced motion.

## Install

```bash
npm i technical-reveal
```

## React

```jsx
import { TechnicalReveal } from 'technical-reveal/react';

<TechnicalReveal src="/car.png" alt="Car" />
```

Width follows CSS (100% of its container by default); height follows the image's aspect ratio.

Customise with options — only set what you want to change:

```jsx
<TechnicalReveal
  src="/car.png"
  colors={{ preset: 'blueprint' }}
  stroke={{ style: 'sketch' }}
  reveal={{ mode: 'radial', keepLines: 0 }}
  playback={{ autoplay: 'inView', loop: false }}
  onComplete={() => console.log('done')}
/>
```

Control it with a ref:

```jsx
const ref = useRef(null);
<TechnicalReveal ref={ref} src="/car.png" />;
ref.current.replay(); // play, pause, toggle, seek(0.5), record(), exportPNG()
```

Next.js: the component is a client component (`'use client'` is included).

## Plain JavaScript

```js
import { createTechnicalReveal } from 'technical-reveal';

const reveal = createTechnicalReveal(document.querySelector('#hero'), {
  src: '/car.png',
  colors: { preset: 'ink' },
});

reveal.update({ colors: { preset: 'retro' } }); // deep-merge options
reveal.replay();
reveal.destroy();
```

Pass a container and a canvas is created inside it (sized to the image), or pass your own `<canvas>`.

## Scroll-driven

Set `progress` (0–1) to drive the animation yourself — the internal clock stops:

```jsx
<TechnicalReveal src="/car.png" progress={scrollProgress} />
```

## Tune visually, then paste

Every option has a live control. Add the panel while designing:

```jsx
import { DialRoot } from 'dialkit';
import 'dialkit/styles.css';
import { TechnicalReveal } from 'technical-reveal/react';
import { useRevealControls } from 'technical-reveal/dialkit';

function Hero() {
  const ref = useRef(null);
  const options = useRevealControls(ref, { src: '/car.png' });
  return (
    <>
      <TechnicalReveal ref={ref} {...options} />
      <DialRoot />
    </>
  );
}
```

Hit **Copy parameters** on a panel and paste the values into the matching option group (`playback`, `layout`, `colors`, `detection`, `drafting`, `stroke`, `timing`, `reveal`). DialKit's dotted keys (`"sheet.grid": true`) are accepted as-is. Then remove the panel — `dialkit` is an optional peer dependency and is never loaded unless you import `technical-reveal/dialkit`.

## Options

All optional. Defaults shown.

| Group | Option | Default | |
| --- | --- | --- | --- |
| — | `src` | | Image URL. Same-origin, CORS-enabled, or a data URL (pixels must be readable). |
| — | `alt` | | Accessible label for the canvas. |
| — | `progress` | | 0–1. Drive the animation yourself. |
| `playback` | `duration` | `10` | Seconds from blank to revealed. |
| | `hold` | `2.5` | Seconds to hold the final frame. |
| | `speed` | `0.8` | Speed multiplier. |
| | `loop` | `true` | |
| | `autoplay` | `true` | `true`, `'inView'` or `false`. |
| | `seed` | `7` | Changes ordering and which features get dimensioned. |
| | `pixelRatio` | `2` | Max device pixel ratio. |
| | `reducedMotion` | `'end'` | With reduced motion: `'end'` shows the final frame, `'play'` animates anyway. |
| `layout` | `bleed` | `0.14` | Margin around the image for lines to overflow into. |
| | `gridOverflow` | `0.6` | How far the grid / plate extend into the margin. |
| | `edgeFade` | `0.9` | Soft fade toward the canvas edge. |
| `colors` | `preset` | `'ink'` | `ink` `graphite` `drafting` `blueline` `blueprint` `retro` `amber` `phosphor` |
| | `colorMode` | `'multi'` | `single`, `multi` (inks by image hue) or `image` (sampled colours). |
| | `plate` | from preset | Fill the image area with `bg` (dark looks). |
| | `bg` `grid` `line` `accent` `dim` `text` `inks.m1–m4` | from preset | Any CSS colour. |
| `detection` | `maxLines` | `1370` | |
| | `sensitivity` | `0.3` | Higher = more lines. |
| | `minLength` | `39` | Drop short edges. |
| | `blur` `simplify` `resolution` `smooth` | `1.1` `1.1` `830` `true` | |
| `drafting` | `sheet` | grid on, size 10 | `grid` `gridSize` `gridOpacity` `sheetFrame` `titleBlock` `title` |
| | `construction` | 24, centre lines | `construction` `centerLines` |
| | `measure` | | `dimensions` `baselineDims` `radii` `angles` `markers` `realWidth` `decimals` |
| | `type` | 13px italic, open arrows | `textSize` `italic` `knockout` `arrowStyle` `arrowSize` |
| | `hatching` | off | `hatch` `hatchSpacing` `hatchThreshold` `hatchAngle` `crossHatch` |
| | `live` | plotter + readout | `plotter` `readout` `hud` |
| `stroke` | `style` | `'flat'` | `flat` `pen` `sketch` `pencil` `brush` |
| | `lineWidth` `constructionWidth` `dimWidth` `opacity` `overshoot` `jitter` `dashedConstruction` | | |
| `timing` | `ease`, `gridEnd`, `constructStart/End`, `drawStart/End`, `annotateStart/End`, `revealStart/End` | | Phase windows as fractions of `duration`. |
| `reveal` | `mode` | `'sweep'` | `sweep` `horizontal` `vertical` `radial` `scribble` |
| | `angle` `brushSize` `dabs` `wobble` `softness` `bristles` | | Brush shape. |
| | `keepLines` | `1` | 0 = lines fade away, 1 = stay on the image. |
| | `imageMode` | `'original'` | `original` `duotone` `mono` `inverted` |
| | `lineBlend` | `'screen'` | Canvas composite op for the linework. |

Events: `onReady({ chains, arcs, ms })`, `onComplete()`, `onError(error)`, `onAspect(ratio)`.

Full types ship with the package.

## Export

`record()` captures one full cycle to mp4/webm (browser-dependent). `exportPNG()` saves the current frame with a transparent background.

## Notes

- Images are analysed once on load (typically 100–300 ms on the main thread), then the animation is cheap.
- Product shots and renders on plain backgrounds give the cleanest drawings. Busy photos: lower `detection.sensitivity` or raise `minLength`.
- Rendering pauses while offscreen.

## This repo

| Path | |
| --- | --- |
| `packages/technical-reveal` | The npm package — engine, React component, DialKit panel, types |
| `playground` | Dev app: every option on a live panel (`/`) and a plain-JS example (`/vanilla.html`) |
| `SKILL.md` | Claude skill that uses the package |

```bash
npm install
npm run dev     # playground with live controls
npm run pack    # preview what gets published
```

Release: bump `version` in `packages/technical-reveal/package.json`, then `cd packages/technical-reveal && npm publish`.

## License

MIT
