/**
 * The two looks of Hush the Wumpus, each designed on its own rather than one inverted into the
 * other. **Scrap Paper** (light) is a field notebook: squared paper, fountain-pen ink, pencil
 * notes and watercolour sketches. **Lantern Dark** (dark) is the cave itself: black rock, a
 * warm lantern pool, chalk marks on the wall. Every colour the canvases use is defined here.
 */

export type LookName = 'paper' | 'lantern';

/** The caver's kit: an orange caving suit, a helmet with a headlamp, harness, rope and pack. */
export interface CaverColours {
  suit: string;
  suitShade: string;
  helmet: string;
  helmetShade: string;
  strap: string;
  metal: string;
  rope: string;
  pad: string;
  boot: string;
  sole: string;
  pack: string;
  packShade: string;
  glove: string;
  hair: string;
}

export interface Look {
  name: LookName;
  dark: boolean;
  /** The page or the rock behind everything. */
  ground: string;
  groundDeep: string;
  /** Map lines: ink on paper, chalk on rock. */
  line: string;
  lineSoft: string;
  /** Room numbers and labels on the map. */
  label: string;
  /** Notebook marks: pencil on paper, coloured chalk on rock. */
  pencil: string;
  marks: { safe: string; pit: string; bats: string; wumpus: string };
  /** The squared paper's grid and its margin rule (paper only). */
  grid: string;
  margin: string;
  /** The room view. */
  rock: string;
  rockDark: string;
  rockLight: string;
  strata: readonly string[];
  cavity: string;
  cavityShade: string;
  tunnel: string;
  outline: string;
  wash: { ochre: string; sienna: string; slate: string; moss: string };
  /** The lantern's light and the explorer's own colours. */
  lantern: string;
  lanternGlow: string;
  caver: CaverColours;
  skin: string;
  /** Senses. */
  stink: string;
  stinkGlow: string;
  dust: string;
  bat: string;
  /** The current room and the dart. */
  here: string;
  dart: string;
  dartGlow: string;
  /** The wumpus. */
  fur: string;
  furDark: string;
  furLight: string;
  belly: string;
  eye: string;
  nose: string;
  /** Things that end an expedition, shown on the revealed map. */
  danger: string;
  sign: string;
  signInk: string;
}

export const SCRAP_PAPER: Look = {
  name: 'paper',
  dark: false,
  ground: '#f3ead6',
  groundDeep: '#e6d9bd',
  line: '#22304f',
  lineSoft: 'rgba(34, 48, 79, 0.42)',
  label: '#1c2742',
  pencil: '#4f4c47',
  marks: { safe: '#2f6b3a', pit: '#7a3f1d', bats: '#5a3d7a', wumpus: '#55702a' },
  grid: 'rgba(84, 129, 168, 0.20)',
  margin: 'rgba(205, 92, 92, 0.42)',
  rock: '#c9b79a',
  rockDark: '#8d7a62',
  rockLight: '#e3d6bd',
  strata: ['#dcc39a', '#cfa577', '#c4b49c', '#b7b2a6', '#d6b68c'],
  cavity: '#f6efe0',
  cavityShade: '#e8dcc3',
  tunnel: '#5d5a63',
  outline: '#2a2a33',
  wash: { ochre: '#dca85e', sienna: '#b9703f', slate: '#7d8ea1', moss: '#8ea05a' },
  lantern: '#f3b54a',
  lanternGlow: 'rgba(246, 196, 92, 0.38)',
  caver: {
    suit: '#d66f2e',
    suitShade: '#a9502a',
    helmet: '#f2d35c',
    helmetShade: '#c9a83c',
    strap: '#2c3a52',
    metal: '#a9b0b8',
    rope: '#d9c08a',
    pad: '#4d4d55',
    boot: '#5b4332',
    sole: '#2a221c',
    pack: '#6f7d46',
    packShade: '#535f33',
    glove: '#7a5636',
    hair: '#4a3324',
  },
  skin: '#e9b98f',
  stink: 'rgba(122, 164, 58, 0.55)',
  stinkGlow: 'rgba(150, 190, 80, 0.25)',
  dust: 'rgba(110, 96, 80, 0.55)',
  bat: '#3b3542',
  here: '#c4553b',
  dart: '#3a5f8a',
  dartGlow: 'rgba(120, 150, 220, 0.35)',
  fur: '#8c9a55',
  furDark: '#56622d',
  furLight: '#b7c27c',
  belly: '#d9cf9b',
  eye: '#2a2a33',
  nose: '#9a6a52',
  danger: '#a63d2b',
  sign: '#c8955a',
  signInk: '#2b2118',
};

export const LANTERN_DARK: Look = {
  name: 'lantern',
  dark: true,
  ground: '#0f0d0b',
  groundDeep: '#070605',
  line: 'rgba(236, 229, 214, 0.86)',
  lineSoft: 'rgba(236, 229, 214, 0.34)',
  label: '#efe7d6',
  pencil: '#d8cfbf',
  marks: { safe: '#9fdc8c', pit: '#ffb36b', bats: '#d6a6ff', wumpus: '#c6ec6e' },
  grid: 'rgba(0, 0, 0, 0)',
  margin: 'rgba(0, 0, 0, 0)',
  rock: '#3a3129',
  rockDark: '#1b1612',
  rockLight: '#6b5a48',
  strata: ['#40352b', '#362c24', '#4a3d31', '#2f2720'],
  cavity: '#5a4734',
  cavityShade: '#2a2119',
  tunnel: '#050404',
  outline: '#120e0b',
  wash: { ochre: '#c88a3e', sienna: '#9a5a2e', slate: '#4f5b66', moss: '#5f7038' },
  lantern: '#ffc25e',
  lanternGlow: 'rgba(255, 176, 72, 0.55)',
  caver: {
    suit: '#c9622b',
    suitShade: '#8c4320',
    helmet: '#e6c552',
    helmetShade: '#a88c33',
    strap: '#1d2737',
    metal: '#c7ccd2',
    rope: '#cdb27a',
    pad: '#3a3a40',
    boot: '#4a3628',
    sole: '#1d1713',
    pack: '#5d6a3a',
    packShade: '#424c28',
    glove: '#6b4a2e',
    hair: '#3b291c',
  },
  skin: '#e3ad84',
  stink: 'rgba(160, 230, 90, 0.55)',
  stinkGlow: 'rgba(150, 240, 90, 0.22)',
  dust: 'rgba(255, 226, 180, 0.6)',
  bat: '#000000',
  here: '#ffb547',
  dart: '#d9d2ff',
  dartGlow: 'rgba(170, 160, 255, 0.55)',
  fur: '#6f7c45',
  furDark: '#38401f',
  furLight: '#a8b670',
  belly: '#b9ad7c',
  eye: '#120e0b',
  nose: '#7d5544',
  danger: '#ff8a65',
  sign: '#9a6a3c',
  signInk: '#1a120b',
};

export function lookFor(dark: boolean): Look {
  return dark ? LANTERN_DARK : SCRAP_PAPER;
}
