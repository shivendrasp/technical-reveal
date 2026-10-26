// bg: paper / plate colour (also text knock-outs) · grid: graph paper · line: main ink · accent: centre lines, compass, plotter head
// dim: dimensions/leaders · text: numbers & labels · m1..m4: extra inks for "multi" colour mode
// plate: fill the image area with bg (dark looks); off = transparent canvas that sits on any page
export const PALETTES = {
  ink: { plate: false, bg: '#ffffff', grid: '#e4e6ea', line: '#121212', accent: '#2f6bff', dim: '#5b6170', text: '#121212', m1: '#121212', m2: '#2f6bff', m3: '#ff5a1f', m4: '#7a7f8c' },
  graphite: { plate: false, bg: '#ffffff', grid: '#e2e2de', line: '#2b2b2e', accent: '#ff5a1f', dim: '#55555a', text: '#2b2b2e', m1: '#2b2b2e', m2: '#ff5a1f', m3: '#7a7a80', m4: '#1f6feb' },
  drafting: { plate: false, bg: '#ffffff', grid: '#e6e0d2', line: '#161616', accent: '#c8372d', dim: '#3a3a3a', text: '#161616', m1: '#161616', m2: '#c8372d', m3: '#2f5fb3', m4: '#5a5a5a' },
  blueline: { plate: false, bg: '#ffffff', grid: '#dfe3ff', line: '#2433f5', accent: '#1424c9', dim: '#3445ff', text: '#1424c9', m1: '#2433f5', m2: '#5160ff', m3: '#0d1a9e', m4: '#7a86ff' },
  blueprint: { plate: true, bg: '#1d4f9e', grid: '#4f7cc4', line: '#f2f6ff', accent: '#ffffff', dim: '#c7dbff', text: '#ffffff', m1: '#ffffff', m2: '#9fd0ff', m3: '#d9e6ff', m4: '#7fb2ff' },
  retro: { plate: true, bg: '#07070d', grid: '#152643', line: '#3fb8ff', accent: '#ff40c0', dim: '#4fb4ff', text: '#9bdcff', m1: '#ff3b5c', m2: '#ffd23f', m3: '#3dff8a', m4: '#ff40c0' },
  amber: { plate: true, bg: '#0e0a04', grid: '#2b1c07', line: '#ffb000', accent: '#ffe08a', dim: '#ff9500', text: '#ffc94d', m1: '#ffb000', m2: '#ff7a00', m3: '#ffe08a', m4: '#ff5a1f' },
  phosphor: { plate: true, bg: '#030b06', grid: '#0c2a17', line: '#39ff88', accent: '#b6ffd4', dim: '#2ad873', text: '#7dffb0', m1: '#39ff88', m2: '#b6ffd4', m3: '#18b85c', m4: '#e2ff6b' },
};

export const PALETTE_KEYS = Object.keys(PALETTES);
