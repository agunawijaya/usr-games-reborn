import type { BackStyle, DeckLook } from '@usr-games/kit/cards';

/**
 * The two tables. Porch is a wooden porch table in late-afternoon sun: honey planks, the long
 * slanted shadows of a railing and leaves moving in the light. Fireside is a dark walnut table
 * by a fire: one warm source to the left that breathes and flickers, embers drifting, the rest
 * of the room falling away into shadow. Each is designed on its own; neither is the other
 * inverted. Every colour the table, the board and the counting use is named here.
 */

export type LookId = 'porch' | 'fireside';

export interface Look {
  id: LookId;
  dark: boolean;
  deck: DeckLook;
  back: BackStyle;

  /** Table planks: base tones, the grain, and the seams between boards. */
  plank: readonly string[];
  grain: string;
  seam: string;
  /** The main light: where it comes from (0–1 across the screen), its colour and strength. */
  light: { x: number; y: number; colour: string; strength: number };
  /** Shadows on the table: the railing's stripes (Porch) or the room's dark (Fireside). */
  shade: string;
  shadeStrength: number;
  vignette: string;
  /** Specks in the light: dust in the sunbeam, or embers rising from the hearth. */
  mote: string;
  /** Card shadows fall away from the light. */
  castShadow: { dx: number; dy: number; alpha: number };

  board: {
    body: string;
    bodyDeep: string;
    edgeLight: string;
    inlay: string;
    inlayDeep: string;
    hole: string;
    holeRim: string;
    engraving: string;
    plate: string;
    plateDeep: string;
    plateInk: string;
  };
  pegs: {
    you: { metal: string; metalDeep: string; cap: string; capDeep: string };
    rival: { metal: string; metalDeep: string; cap: string; capDeep: string };
  };

  /** The counting colours: each kind of combination has its own light. */
  glow: { fifteen: string; pair: string; run: string; flush: string; nobs: string; core: string };
  gold: string;
  goldDeep: string;

  /** Text drawn on the table itself (the count, callouts), with a halo for legibility. */
  tableInk: string;
  tableHalo: string;
}

export const PORCH: Look = {
  id: 'porch',
  dark: false,
  deck: 'day',
  back: 'conservatory',
  plank: ['#c99c64', '#c49460', '#cfa46c', '#c2925b', '#cb9f68'],
  grain: 'rgba(122, 78, 38, 0.22)',
  seam: 'rgba(84, 52, 26, 0.55)',
  light: { x: 0.08, y: -0.1, colour: 'rgba(255, 226, 168, 0.55)', strength: 0.55 },
  shade: 'rgba(78, 46, 22, 1)',
  shadeStrength: 0.3,
  vignette: 'rgba(92, 54, 24, 0.32)',
  mote: 'rgba(255, 246, 222, 0.75)',
  castShadow: { dx: 10, dy: 14, alpha: 0.32 },
  board: {
    body: '#7a4a2a',
    bodyDeep: '#4e2d17',
    edgeLight: 'rgba(255, 220, 170, 0.55)',
    inlay: '#e7c792',
    inlayDeep: '#c79f63',
    hole: '#24130a',
    holeRim: 'rgba(255, 228, 186, 0.35)',
    engraving: '#f4e2bf',
    plate: '#d9b358',
    plateDeep: '#9c7a2a',
    plateInk: '#3a2410',
  },
  pegs: {
    you: { metal: '#e4bc58', metalDeep: '#8f6a1d', cap: '#c22c44', capDeep: '#7d1424' },
    rival: { metal: '#d4d9de', metalDeep: '#6f7880', cap: '#2a64a8', capDeep: '#163c6b' },
  },
  glow: {
    fifteen: '#f08c12',
    pair: '#d8336e',
    run: '#1f9a6a',
    flush: '#2f76d6',
    nobs: '#9a4fe0',
    core: '#fff6d6',
  },
  gold: '#f2c14e',
  goldDeep: '#a87612',
  tableInk: '#2e1a0c',
  tableHalo: 'rgba(255, 238, 205, 0.85)',
};

export const FIRESIDE: Look = {
  id: 'fireside',
  dark: true,
  deck: 'lamp',
  back: 'constellations',
  plank: ['#3d2617', '#3a2415', '#412919', '#372213', '#3f2818'],
  grain: 'rgba(14, 7, 3, 0.35)',
  seam: 'rgba(8, 4, 2, 0.75)',
  light: { x: -0.06, y: 0.55, colour: 'rgba(255, 150, 70, 0.55)', strength: 0.75 },
  shade: 'rgba(10, 5, 3, 1)',
  shadeStrength: 0.55,
  vignette: 'rgba(6, 3, 2, 0.75)',
  mote: 'rgba(255, 178, 92, 0.9)',
  castShadow: { dx: 16, dy: 8, alpha: 0.5 },
  board: {
    body: '#6a3d22',
    bodyDeep: '#3a1f10',
    edgeLight: 'rgba(255, 176, 102, 0.6)',
    inlay: '#d9a865',
    inlayDeep: '#a87540',
    hole: '#140904',
    holeRim: 'rgba(255, 190, 120, 0.32)',
    engraving: '#f6d6a2',
    plate: '#cf9e45',
    plateDeep: '#8a621f',
    plateInk: '#2a1708',
  },
  pegs: {
    you: { metal: '#f0c25c', metalDeep: '#8a5f17', cap: '#d63a4f', capDeep: '#7a1626' },
    rival: { metal: '#d8d2c8', metalDeep: '#6a645c', cap: '#4b86d0', capDeep: '#1f477f' },
  },
  glow: {
    fifteen: '#ffc240',
    pair: '#ff6f9c',
    run: '#5fe0aa',
    flush: '#8ab4ff',
    nobs: '#d39cff',
    core: '#fff7e2',
  },
  gold: '#ffcf5c',
  goldDeep: '#b8801a',
  tableInk: '#ffe9c6',
  tableHalo: 'rgba(24, 12, 6, 0.85)',
};

export function lookFor(dark: boolean): Look {
  return dark ? FIRESIDE : PORCH;
}
