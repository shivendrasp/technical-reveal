# technical-reveal

**Turn any image into a CAD / blueprint-style animated intro.**
Edges are traced from your image and drafted in like a technical drawing — construction lines, dimensions that measure and count up, compass arcs, a plotter crosshair — then a soft brush reveals the real image.

<!-- DEMO: record one with the playground (Playback › Export › Record video), then drag the file into this README on GitHub -->

[![npm](https://img.shields.io/npm/v/technical-reveal.svg)](https://www.npmjs.com/package/technical-reveal)
[![license](https://img.shields.io/npm/l/technical-reveal.svg)](./LICENSE)

- Works with any image — no paths, SVGs or manual tracing.
- Transparent canvas sized to the image, so it drops onto any page.
- React component, plain-JS API, and an optional live tuning panel ([DialKit](https://github.com/joshpuckett/dialkit)).
- Zero runtime dependencies, typed, plays in view, pauses offscreen, respects reduced motion.

## Install

```bash
npm i technical-reveal
```

## Use

```jsx
import { TechnicalReveal } from 'technical-reveal/react';

<TechnicalReveal src="/car.png" alt="Car" />
```

```js
import { createTechnicalReveal } from 'technical-reveal';

createTechnicalReveal(document.querySelector('#hero'), { src: '/car.png' });
```

Change the look with options — presets, stroke styles, brush reveal modes, timing and more:

```jsx
<TechnicalReveal
  src="/car.png"
  colors={{ preset: 'blueprint' }}
  stroke={{ style: 'sketch' }}
  playback={{ autoplay: 'inView', loop: false }}
/>
```

**Full documentation and every option:** [packages/technical-reveal/README.md](./packages/technical-reveal/README.md)

## Repo layout

| Path | |
| --- | --- |
| `packages/technical-reveal` | The npm package — engine, React component, DialKit panel, types |
| `playground` | Dev app: every option on a live panel (`/`) and a plain-JS example (`/vanilla.html`) |
| `SKILL.md` | Claude skill that uses the package |

## Develop

```bash
npm install
npm run dev     # playground with live controls
npm run pack    # preview what gets published
```

Release: bump `version` in `packages/technical-reveal/package.json`, then `cd packages/technical-reveal && npm publish`.

## License

MIT
