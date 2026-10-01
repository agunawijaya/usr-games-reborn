/**
 * Lightkeeper's two looks, each designed on its own: the Chart (a navigator's paper chart in
 * daylight, ink and amber) and the Night Watch (deep blue, warm lamplight, cold teal drones).
 * Canvas drawing reads these; the CSS mirrors them as custom properties.
 */

export type Look = 'chart' | 'night';

export interface Palette {
  bg: string;
  bg2: string;
  grid: string;
  gridStrong: string;
  ink: string;
  ink2: string;
  /** The Lantern's light: the colour of everything the player owns. */
  lamp: string;
  lampSoft: string;
  lampGlow: string;
  gleaner: string;
  gleanerBody: string;
  gleanerGlow: string;
  star: string;
  starGlow: string;
  hole: string;
  holeRing: string;
  world: string;
  worldGlow: string;
  worldDark: string;
  threatened: string;
  lost: string;
  harbour: string;
  harbourBody: string;
  shot: string;
  beam: string;
  flare: string;
  nova: string;
  shield: string;
  danger: string;
  good: string;
  fog: string;
  collapsed: string;
  cursor: string;
}

export const PALETTES: Record<Look, Palette> = {
  night: {
    bg: '#060a17',
    bg2: '#0d1530',
    grid: 'rgba(140, 165, 255, 0.07)',
    gridStrong: 'rgba(150, 175, 255, 0.2)',
    ink: '#eef1ff',
    ink2: '#a9b3d6',
    lamp: '#ffc35a',
    lampSoft: '#ffe2a3',
    lampGlow: 'rgba(255, 190, 80, 0.42)',
    gleaner: '#43e3c4',
    gleanerBody: '#123a3f',
    gleanerGlow: 'rgba(67, 227, 196, 0.32)',
    star: '#eef3ff',
    starGlow: 'rgba(170, 200, 255, 0.5)',
    hole: '#000005',
    holeRing: '#8a76ff',
    world: '#ffcf6e',
    worldGlow: 'rgba(255, 196, 92, 0.5)',
    worldDark: '#262038',
    threatened: '#ff9a5c',
    lost: '#4b5068',
    harbour: '#9fc4ff',
    harbourBody: '#26324f',
    shot: '#5cf2d6',
    beam: '#ffd27a',
    flare: '#fff4cc',
    nova: '#fff1b8',
    shield: '#80b4ff',
    danger: '#ff7a6e',
    good: '#7ce3a1',
    fog: 'rgba(120, 140, 200, 0.05)',
    collapsed: '#2a1440',
    cursor: '#ffffff',
  },
  chart: {
    bg: '#f4ebd7',
    bg2: '#e9dcbf',
    grid: 'rgba(31, 42, 68, 0.09)',
    gridStrong: 'rgba(31, 42, 68, 0.26)',
    ink: '#1d2741',
    ink2: '#4b5677',
    lamp: '#b85f00',
    lampSoft: '#f2aa3c',
    lampGlow: 'rgba(242, 160, 50, 0.35)',
    gleaner: '#0d7a69',
    gleanerBody: '#cfeee5',
    gleanerGlow: 'rgba(13, 122, 105, 0.18)',
    star: '#1d2741',
    starGlow: 'rgba(29, 39, 65, 0.12)',
    hole: '#1d2741',
    holeRing: '#5a43c9',
    world: '#e39a1c',
    worldGlow: 'rgba(227, 154, 28, 0.3)',
    worldDark: '#3d4258',
    threatened: '#c2481a',
    lost: '#9a9481',
    harbour: '#2b57a8',
    harbourBody: '#dbe5f7',
    shot: '#0d7a69',
    beam: '#d98500',
    flare: '#9c4a00',
    nova: '#e7a01e',
    shield: '#2f64c9',
    danger: '#b3261e',
    good: '#1d7a45',
    fog: 'rgba(31, 42, 68, 0.05)',
    collapsed: '#4a3a66',
    cursor: '#1d2741',
  },
};

/** A stable number from a string, for procedural variety that never changes between visits. */
export function hashOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A tiny seeded stream for decoration (starfields, paper grain); never for rules. */
export function decorRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}
