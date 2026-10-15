import type { BackStyle, DeckLook } from '@usr-games/kit/cards';

/**
 * The two ponds. Morning Pond is the light appearance: a bright morning, dragonflies, lily
 * pads, reeds and sparkles on the water. Firefly Pond is the dark one: night, fireflies, the
 * moon's reflection breaking into ripples and koi glowing deep down. Each is painted with its
 * own colours; neither is the other turned down or up.
 */

export type LookId = 'morning' | 'firefly';

export interface Look {
  id: LookId;
  dark: boolean;
  deck: DeckLook;
  back: BackStyle;
  sky: { top: string; middle: string; horizon: string };
  /** The far tree line, from the back row to the front. */
  trees: readonly string[];
  /** Grass on the banks: light, mid and shade. */
  grass: { light: string; mid: string; shade: string };
  soil: string;
  stone: { light: string; mid: string; shade: string };
  water: { far: string; middle: string; near: string; deep: string; line: string; glint: string };
  /** How strongly the banks and rivals show in the water. */
  reflection: number;
  pad: { light: string; mid: string; shade: string; vein: string };
  lily: { petal: string; petalShade: string; heart: string };
  reed: { stem: string; stemShade: string; head: string };
  wood: { light: string; mid: string; shade: string; grain: string };
  /** The fishing line and its float. */
  line: string;
  float: { top: string; bottom: string; band: string };
  /** Water thrown up by a splash. */
  spray: string;
  /** A soft light over everything: morning haze or moonlight. */
  ambient: string;
  /** Dragonflies by day, fireflies by night. */
  flyer: { body: string; wing: string; glow: string };
  moon?: { disc: string; halo: string; path: string };
  koi?: { glow: string };
  /** Shadows cast on grass and water. */
  shadow: string;
  /** The golden fish's metal. */
  gold: { light: string; mid: string; deep: string; shine: string };
  ui: UiColours;
}

/** Colours for the panels drawn in HTML: name plates, the ask bar, the notebook, the bucket card. */
export interface UiColours {
  panel: string;
  /** The panel colour without its see-through, for text set on ink. */
  panelSolid: string;
  panelEdge: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentInk: string;
  /** The accent as text on a panel, where it must still read. */
  accentStrong: string;
  /** Paper of the notebook. */
  paper: string;
  paperLine: string;
  paperInk: string;
  /** The notebook's red margin rule and its binding holes. */
  margin: string;
  hole: string;
  /** Notebook cells: a rank you hold, a rank a rival is known to hold, a rank they lack. */
  mine: string;
  has: string;
  hasInk: string;
  none: string;
  good: string;
  focus: string;
  bubble: string;
  bubbleInk: string;
  /** The little number keys on the name plates. */
  key: string;
  keyInk: string;
  /** The rank buttons, printed like small cards. */
  card: string;
  cardInk: string;
  cardEdge: string;
}

export const MORNING: Look = {
  id: 'morning',
  dark: false,
  deck: 'day',
  back: 'conservatory',
  sky: { top: '#9fd0e6', middle: '#cfe7ec', horizon: '#fbefd6' },
  trees: ['#a9cdb9', '#86b79a', '#5f9a73', '#3f7a55'],
  grass: { light: '#a6d27a', mid: '#79b257', shade: '#4d8a42' },
  soil: '#8a6a45',
  stone: { light: '#d9d3c4', mid: '#b3ab98', shade: '#857d6c' },
  water: {
    far: '#8cc9cf',
    middle: '#5aa9b2',
    near: '#3a8a98',
    deep: '#256a7a',
    line: 'rgba(255, 255, 255, 0.55)',
    glint: '#ffffff',
  },
  reflection: 0.42,
  pad: { light: '#8fcf6c', mid: '#5aa64f', shade: '#3c7f3f', vein: 'rgba(30, 80, 35, 0.35)' },
  lily: { petal: '#fbd3e1', petalShade: '#ee9ab9', heart: '#f7cf4a' },
  reed: { stem: '#6e9b4b', stemShade: '#4c7537', head: '#7d5233' },
  wood: { light: '#c99a64', mid: '#a5743f', shade: '#6f4a26', grain: 'rgba(80, 45, 20, 0.35)' },
  line: 'rgba(40, 50, 60, 0.75)',
  float: { top: '#e5483b', bottom: '#fbf7ee', band: '#2b2b2b' },
  spray: '#ffffff',
  ambient: 'rgba(255, 244, 214, 0.10)',
  flyer: { body: '#1d8fc2', wing: 'rgba(220, 245, 255, 0.55)', glow: 'rgba(255,255,255,0)' },
  shadow: 'rgba(20, 60, 50, 0.22)',
  gold: { light: '#ffe7a0', mid: '#e6a93a', deep: '#9c6614', shine: '#fff8dc' },
  ui: {
    panel: 'rgba(253, 250, 241, 0.94)',
    panelSolid: '#fdfaf1',
    panelEdge: 'rgba(60, 96, 80, 0.30)',
    ink: '#1f3a33',
    inkSoft: '#46615a',
    accent: '#c4502f',
    accentInk: '#ffffff',
    accentStrong: '#a8401f',
    paper: '#fdf8ea',
    paperLine: 'rgba(70, 120, 160, 0.22)',
    paperInk: '#24322f',
    margin: 'rgba(214, 90, 90, 0.55)',
    hole: 'rgba(60, 80, 70, 0.28)',
    mine: 'rgba(255, 214, 110, 0.55)',
    has: '#1f6f5c',
    hasInk: '#ffffff',
    none: '#8a5a4a',
    good: '#1f7a4f',
    focus: '#1d5fb8',
    bubble: '#ffffff',
    bubbleInk: '#1f3a33',
    key: '#1f3a33',
    keyInk: '#fdfaf1',
    card: '#fffdf6',
    cardInk: '#1d1d2a',
    cardEdge: '#c9bfa6',
  },
};

export const FIREFLY: Look = {
  id: 'firefly',
  dark: true,
  deck: 'lamp',
  back: 'constellations',
  sky: { top: '#060d1f', middle: '#0f1f3d', horizon: '#253a5c' },
  trees: ['#152b40', '#10233a', '#0b1b2e', '#081523'],
  grass: { light: '#2b4a3c', mid: '#1d3a30', shade: '#112620' },
  soil: '#2a2a2a',
  stone: { light: '#5a6474', mid: '#3e4756', shade: '#262d39' },
  water: {
    far: '#1b3656',
    middle: '#112a45',
    near: '#0b2038',
    deep: '#061529',
    line: 'rgba(190, 215, 255, 0.28)',
    glint: '#fff3c4',
  },
  reflection: 0.5,
  pad: { light: '#3f7a5e', mid: '#285743', shade: '#173b2e', vein: 'rgba(0, 0, 0, 0.35)' },
  lily: { petal: '#e8d6f5', petalShade: '#b996d8', heart: '#ffe27a' },
  reed: { stem: '#2c4a38', stemShade: '#1b3226', head: '#3a2a22' },
  wood: { light: '#6b5a48', mid: '#4d4033', shade: '#2e261e', grain: 'rgba(0, 0, 0, 0.4)' },
  line: 'rgba(220, 230, 255, 0.55)',
  float: { top: '#ff6b4a', bottom: '#f3ead6', band: '#1b1b1b' },
  spray: '#dfeaff',
  ambient: 'rgba(120, 150, 255, 0.06)',
  flyer: { body: '#3b3320', wing: 'rgba(255, 240, 180, 0.25)', glow: 'rgba(255, 220, 90, 0.9)' },
  moon: { disc: '#f7f0d6', halo: 'rgba(247, 240, 214, 0.18)', path: '#f9e8a8' },
  koi: { glow: 'rgba(255, 150, 70, 0.55)' },
  shadow: 'rgba(0, 0, 10, 0.45)',
  gold: { light: '#ffe9a6', mid: '#eaa832', deep: '#94600f', shine: '#fff7d6' },
  ui: {
    panel: 'rgba(14, 26, 46, 0.92)',
    panelSolid: '#0e1a2e',
    panelEdge: 'rgba(160, 190, 240, 0.28)',
    ink: '#eef0e6',
    inkSoft: '#b9c3cf',
    accent: '#f2c14e',
    accentInk: '#1a1405',
    accentStrong: '#ffd36b',
    paper: '#16243a',
    paperLine: 'rgba(160, 190, 240, 0.16)',
    paperInk: '#e9e6d8',
    margin: 'rgba(240, 120, 130, 0.45)',
    hole: 'rgba(0, 0, 0, 0.45)',
    mine: 'rgba(242, 193, 78, 0.28)',
    has: '#5fd0b4',
    hasInk: '#08201b',
    none: '#f0a58c',
    good: '#6fdc9f',
    focus: '#ffd166',
    bubble: '#eef2fb',
    bubbleInk: '#12203a',
    key: '#f2c14e',
    keyInk: '#1a1405',
    card: '#f3e6cb',
    cardInk: '#191723',
    cardEdge: '#a8936c',
  },
};

export function lookFor(dark: boolean): Look {
  return dark ? FIREFLY : MORNING;
}
