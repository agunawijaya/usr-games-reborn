/**
 * Noodle Nine's two appearances, each designed on its own: Garden Bed, a sunny cross-section of
 * a vegetable bed, and Glow Soil, the same bed at night with everything alive in it glowing.
 * Every colour the canvas draws comes from here; the screens around it take theirs from the CSS
 * custom properties of the same names in `src/ui/noodle.css`.
 */

export type LookId = 'bed' | 'glow';

export interface NoodlePaint {
  body: string;
  belly: string;
  outline: string;
  highlight: string;
  ring: string;
  saddle: string;
  cheek: string;
  eye: string;
  pupil: string;
  mouth: string;
  /** A soft halo around the body, for the glowing look; null in daylight. */
  halo: string | null;
  shadow: string | null;
}

export interface Look {
  id: LookId;
  dark: boolean;
  skyTop: string;
  skyBottom: string;
  grass: string;
  grassDark: string;
  grassTip: string;
  /** Soil strata from the surface down. */
  soil: readonly [string, string, string];
  speckLight: string;
  speckDark: string;
  bed: string;
  bedEdge: string;
  bedRim: string;
  grid: string;
  pebble: string;
  pebbleShade: string;
  rootColour: string;
  rootShade: string;
  rock: string;
  rockLight: string;
  rockShade: string;
  mud: string;
  mudShine: string;
  tunnel: string;
  tunnelRim: string;
  flow: string;
  /** Number-fruit colours for the digits 1 to 9. */
  fruit: readonly string[];
  fruitInk: string;
  fruitOutline: string;
  leaf: string;
  noodle: NoodlePaint;
  ink: string;
  popInk: string;
  popOutline: string;
  /** The glowing look's extras. */
  firefly: string | null;
  fungus: readonly string[];
  star: string | null;
}

/** 1 a blueberry … 9 a plum: a ramp that runs cool to warm and ends in a deep violet. */
const FRUIT = [
  '#5b9bf2',
  '#33bfb2',
  '#58c25a',
  '#b5d33a',
  '#f4c430',
  '#f59a2f',
  '#f26b4f',
  '#e8455f',
  '#a35ce6',
];

export const GARDEN_BED: Look = {
  id: 'bed',
  dark: false,
  skyTop: '#9fd8f2',
  skyBottom: '#fdf0d2',
  grass: '#6cb84a',
  grassDark: '#4c9434',
  grassTip: '#a6dc68',
  soil: ['#9a6640', '#875632', '#6f4427'],
  speckLight: 'rgba(214, 160, 110, 0.55)',
  speckDark: 'rgba(70, 38, 18, 0.5)',
  bed: '#a8714a',
  bedEdge: '#5a3519',
  bedRim: 'rgba(255, 222, 180, 0.55)',
  grid: 'rgba(72, 38, 16, 0.16)',
  pebble: '#c9b8a2',
  pebbleShade: '#8d7a63',
  rootColour: '#e2c08f',
  rootShade: '#a8845a',
  rock: '#a7a49b',
  rockLight: '#d9d6cc',
  rockShade: '#66635b',
  mud: '#734a2c',
  mudShine: 'rgba(255, 236, 210, 0.55)',
  tunnel: '#2b170b',
  tunnelRim: '#d9a86a',
  flow: 'rgba(255, 238, 205, 0.75)',
  fruit: FRUIT,
  fruitInk: '#2a1608',
  fruitOutline: '#4a2a14',
  leaf: '#4f9a34',
  noodle: {
    body: '#f590a6',
    belly: '#f8b3c0',
    outline: '#93394f',
    highlight: '#ffe1e8',
    ring: 'rgba(160, 58, 86, 0.5)',
    saddle: '#f7a081',
    cheek: '#ff6f8f',
    eye: '#ffffff',
    pupil: '#2a1218',
    mouth: '#7a2238',
    halo: null,
    shadow: 'rgba(60, 26, 10, 0.32)',
  },
  ink: '#2a1a10',
  popInk: '#fff8ec',
  popOutline: '#5a2a14',
  firefly: null,
  fungus: [],
  star: null,
};

export const GLOW_SOIL: Look = {
  id: 'glow',
  dark: true,
  skyTop: '#070a24',
  skyBottom: '#1b1440',
  grass: '#12301f',
  grassDark: '#0b2015',
  grassTip: '#4fe0a0',
  soil: ['#21162a', '#1a1121', '#130c18'],
  speckLight: 'rgba(150, 110, 200, 0.22)',
  speckDark: 'rgba(0, 0, 0, 0.45)',
  bed: '#241830',
  bedEdge: '#0a060d',
  bedRim: 'rgba(170, 120, 255, 0.35)',
  grid: 'rgba(190, 150, 255, 0.10)',
  pebble: '#3a2f48',
  pebbleShade: '#1b1424',
  rootColour: '#4a3a5c',
  rootShade: '#2a2036',
  rock: '#3b3448',
  rockLight: '#6b6082',
  rockShade: '#17121f',
  mud: '#0d0914',
  mudShine: 'rgba(140, 255, 220, 0.35)',
  tunnel: '#05030a',
  tunnelRim: '#7ef9d3',
  flow: 'rgba(126, 249, 211, 0.6)',
  fruit: [
    '#6aa8ff',
    '#3fe0cf',
    '#6ff07a',
    '#d4f04f',
    '#ffd84a',
    '#ffab40',
    '#ff7a5c',
    '#ff5d7a',
    '#c07aff',
  ],
  fruitInk: '#14081c',
  fruitOutline: '#0a0410',
  leaf: '#3fd893',
  noodle: {
    body: '#ff8cc0',
    belly: '#ffb8d8',
    outline: '#5c1640',
    highlight: '#fff0f8',
    ring: 'rgba(120, 20, 80, 0.45)',
    saddle: '#ffb08a',
    cheek: '#ff4f9a',
    eye: '#ffffff',
    pupil: '#1a0614',
    mouth: '#5c1032',
    halo: 'rgba(255, 110, 190, 0.6)',
    shadow: null,
  },
  ink: '#f3e9ff',
  popInk: '#fffaff',
  popOutline: '#3a0d36',
  firefly: '#f6f58a',
  fungus: ['#7ef9d3', '#b38bff', '#6fd6ff'],
  star: 'rgba(255, 255, 255, 0.8)',
};

export function lookFor(dark: boolean): Look {
  return dark ? GLOW_SOIL : GARDEN_BED;
}

export const FONT_DISPLAY = '"Fraunces Variable", "Fraunces", Georgia, serif';
export const FONT_UI = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
export const FONT_DATA = '"IBM Plex Mono", ui-monospace, monospace';
