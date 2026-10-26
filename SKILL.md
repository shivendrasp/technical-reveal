---
name: technical-drawing-reveal
description: Turn any image into a CAD / blueprint-style animated intro — lines draft in, dimensions measure and count up, then a soft brush mask reveals the real image. Use when asked for a technical-drawing, blueprint, CAD or drafting-style reveal of an image.
---

# Technical drawing reveal

Engine lives in `src/engine/` (framework-free, canvas 2D). The React app in `src/App.jsx` wires it to DialKit controls.

## Run it
```bash
cd ~/Desktop/technical-drawing
npm install        # once
npm run dev        # opens the playground
```
Drop any image on the page (or use the Image control in the Source panel). Space = play/pause, R = replay.
Export: Playback → Export → "Record video (1 cycle)" (mp4/webm) or "Save PNG frame".

## How the effect is built (pipeline)
1. `analyze.js` – Canny-lite edges (blur → Sobel → NMS → hysteresis) traced into polylines, simplified (RDP).
   Also extracts circle fits (for R/Ø callouts), corners (angle callouts), and row/column edge peaks (construction lines).
2. `build.js` – maps everything to canvas space and schedules it on a 0..1 timeline:
   grid → construction/centre lines → contours (longest first) → hatching → dimensions/radii/angles/markers → title block → brush reveal.
   Stroke styles (flat/pen/sketch/pencil/brush) are baked into passes here.
3. `index.js` – playback loop, finished strokes are cached to offscreen layers, brush strokes paint a
   low-res mask that is blurred and used with `destination-in` to reveal the image; lines fade to `keepLines`.

## Embed elsewhere
```js
import { TechnicalReveal } from './engine/index.js';
const fx = new TechnicalReveal(canvas);
fx.setConfig(cfg);          // same shape App.jsx builds (source, playback, palette, detail, drafting, stroke, timing, reveal)
await fx.setImage(url);     // same-origin or data URL (pixels must be readable)
fx.replay(); fx.record(); fx.exportPNG();
```

## Tuning tips
- Too few lines → raise Line detection › sensitivity, lower minLength/blur. Too noisy → the opposite, or lower maxLines.
- Photos: try Stroke › pencil + Drafting › hatching on. Product renders: flat/pen + blueprint.
- Timing values are fractions of Duration; keep start < end for each phase.
- The canvas is transparent: image + `bleed` margin, so it drops onto any page. Palette › plate fills the image area with the palette bg (blueprint/dark looks).
- Add a palette by adding an entry to `src/engine/palettes.js`.
