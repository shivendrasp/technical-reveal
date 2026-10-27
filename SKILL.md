---
name: technical-drawing-reveal
description: Add a CAD / blueprint-style animated intro to any image (lines draft in, dimensions measure, a brush reveals the image) using the technical-reveal npm package. Use when asked for a technical-drawing, blueprint, CAD or drafting-style image reveal.
---

# Technical drawing reveal

Use the `technical-reveal` package; don't re-implement the effect.

1. `npm i technical-reveal`
2. React: `import { TechnicalReveal } from 'technical-reveal/react'` → `<TechnicalReveal src="/img.png" alt="…" />`.
   Plain JS: `createTechnicalReveal(containerEl, { src })` from `technical-reveal`.
3. Pick a look with options, only overriding what's needed:
   - Light sites: `colors: { preset: 'ink' }` (default). Dark / blueprint: `preset: 'blueprint' | 'retro' | 'amber' | 'phosphor'` (these fill a plate).
   - Hero above the fold: default autoplay. Lower on the page: `playback: { autoplay: 'inView', loop: false }`.
   - Clean final image: `reveal: { keepLines: 0 }`. Lines kept over the image: `keepLines: 1`.
   - Scroll-driven: pass `progress` (0–1).
4. Images must be same-origin, CORS-enabled or data URLs (the effect reads pixels).
5. For visual tuning, add `useRevealControls(ref, { src })` from `technical-reveal/dialkit` + `<DialRoot />`, then paste the panel's copied values into the options and remove the panel.

Tuning: too few lines → raise `detection.sensitivity`, lower `minLength`; too noisy → the opposite.
Full option list: the package README (`node_modules/technical-reveal/README.md`).
