import type { Nation } from '../engine';

/**
 * Figurehead's two looks, each designed on its own: Day (an Admiralty chart on the chart-room
 * table in daylight: paper, ink and a watercolour sea) and Night (the same table by lantern
 * light: dark sea, chalk lines, a warm glow). Canvas and SVG drawing read these; the CSS
 * mirrors them as custom properties.
 */

export type Look = 'day' | 'night';

export interface Palette {
  paper: string;
  /** The cards and sheets laid on the paper. */
  card: string;
  paper2: string;
  sea: string;
  sea2: string;
  seaLine: string;
  shoal: string;
  land: string;
  landInk: string;
  ink: string;
  ink2: string;
  grid: string;
  gridStrong: string;
  /** The ship's own colours: tarred hull, painted band, deck planks, sails. */
  hull: string;
  hullLight: string;
  deck: string;
  deckLine: string;
  sail: string;
  sailShade: string;
  sailLine: string;
  rigging: string;
  /** Masts and yards, and the light that catches the edge of the hull. */
  spar: string;
  rim: string;
  copper: string;
  patch: string;
  patchEnemy: string;
  newTimber: string;
  gilt: string;
  giltShade: string;
  /** Flags, one per nation, and the hull band each nation paints. */
  nation: Record<Nation, string>;
  nationBand: Record<Nation, string>;
  /** Overlays on the chart. */
  reach: string;
  reachLine: string;
  enemyReach: string;
  arcPort: string;
  arcStarboard: string;
  smoke: string;
  fire: string;
  splash: string;
  glow: string;
  good: string;
  warn: string;
  bad: string;
  sky: string;
  sky2: string;
}

export const PALETTES: Record<Look, Palette> = {
  day: {
    paper: '#efe5cd',
    card: '#f7f1e2',
    paper2: '#e2d3b1',
    sea: '#cfe0db',
    sea2: '#b4cecb',
    seaLine: 'rgba(38, 74, 88, 0.16)',
    shoal: 'rgba(38, 74, 88, 0.28)',
    land: '#e6d39e',
    landInk: '#6b5634',
    ink: '#1f2738',
    ink2: '#4e566a',
    grid: 'rgba(31, 39, 56, 0.055)',
    gridStrong: 'rgba(31, 39, 56, 0.14)',
    hull: '#2b231d',
    hullLight: '#4a3c31',
    deck: '#c39a66',
    deckLine: 'rgba(80, 56, 30, 0.45)',
    sail: '#f8f2e2',
    sailShade: '#dcd1b6',
    sailLine: 'rgba(120, 100, 70, 0.35)',
    rigging: 'rgba(40, 32, 26, 0.7)',
    spar: '#3a2b20',
    rim: 'rgba(255, 246, 225, 0.35)',
    copper: '#b56d37',
    patch: '#8a6b4a',
    patchEnemy: '#7a4636',
    newTimber: '#c9a46c',
    gilt: '#d8a63e',
    giltShade: '#8e6420',
    nation: { 0: '#24589a', 1: '#b23b25', 2: '#2f4d45' },
    nationBand: { 0: '#d7b45e', 1: '#a8452f', 2: '#8b8b7a' },
    reach: 'rgba(36, 88, 154, 0.16)',
    reachLine: 'rgba(36, 88, 154, 0.75)',
    enemyReach: 'rgba(178, 59, 37, 0.10)',
    arcPort: 'rgba(178, 59, 37, 0.16)',
    arcStarboard: 'rgba(36, 120, 74, 0.16)',
    smoke: 'rgba(236, 232, 222, 0.9)',
    fire: '#e2672a',
    splash: '#ffffff',
    glow: 'rgba(255, 238, 200, 0)',
    good: '#25704a',
    warn: '#9a6212',
    bad: '#a8261c',
    sky: '#f3ead6',
    sky2: '#d8e6ea',
  },
  night: {
    paper: '#0d1722',
    card: '#111d2a',
    paper2: '#081019',
    sea: '#13283a',
    sea2: '#0e1f2e',
    seaLine: 'rgba(150, 190, 215, 0.12)',
    shoal: 'rgba(150, 190, 215, 0.22)',
    land: '#1e2a2a',
    landInk: '#8ea397',
    ink: '#ece4cf',
    ink2: '#a9b3b8',
    grid: 'rgba(190, 210, 225, 0.07)',
    gridStrong: 'rgba(190, 210, 225, 0.18)',
    hull: '#10151c',
    hullLight: '#2a3340',
    deck: '#6c5a45',
    deckLine: 'rgba(20, 14, 8, 0.5)',
    sail: '#d9d5c6',
    sailShade: '#9fa3a3',
    sailLine: 'rgba(40, 50, 60, 0.35)',
    rigging: 'rgba(200, 210, 215, 0.45)',
    spar: '#7d8794',
    rim: 'rgba(190, 215, 240, 0.55)',
    copper: '#a8693b',
    patch: '#7d6550',
    patchEnemy: '#7a4a3c',
    newTimber: '#a98e66',
    gilt: '#e6b65a',
    giltShade: '#7a5a22',
    nation: { 0: '#6fa2e6', 1: '#ef8566', 2: '#79c3a3' },
    nationBand: { 0: '#c9a453', 1: '#b65a42', 2: '#7f8478' },
    reach: 'rgba(111, 162, 230, 0.16)',
    reachLine: 'rgba(140, 185, 245, 0.85)',
    enemyReach: 'rgba(239, 133, 102, 0.11)',
    arcPort: 'rgba(239, 133, 102, 0.09)',
    arcStarboard: 'rgba(121, 210, 160, 0.09)',
    smoke: 'rgba(170, 176, 182, 0.75)',
    fire: '#ff8a3c',
    splash: '#dfe9ef',
    glow: 'rgba(255, 196, 110, 0.20)',
    good: '#79d3a0',
    warn: '#f0c26a',
    bad: '#ff8f80',
    sky: '#0f1b2a',
    sky2: '#1b2c40',
  },
};

/** A stable number from a string, for decoration that never changes between visits. */
export function hashOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A tiny seeded stream for decoration (waves, paper grain, shot holes); never for rules. */
export function decorRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

export const NATION_NAMES: Record<Nation, string> = { 0: 'Alder', 1: 'Vesk', 2: 'Gullrock' };
