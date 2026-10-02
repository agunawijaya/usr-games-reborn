/** The garden by day (the Hall's light appearance) or by moonlight (dark). */
export type Look = 'sun' | 'moon';

export interface GardenPalette {
  /** The upper terrace and walls around the sunken chamber. */
  readonly terrace: string;
  readonly terraceDeep: string;
  readonly wallFace: string;
  readonly wallShade: string;
  readonly wallLight: string;
  /** Flagstones: a range to vary between, the mortar in the joints, and moss. */
  readonly stone: readonly [string, string, string];
  readonly stoneLight: string;
  readonly stoneShade: string;
  readonly mortar: string;
  readonly moss: readonly [string, string];
  readonly hedge: readonly [string, string, string];
  readonly hedgeLight: string;
  readonly water: readonly [string, string];
  readonly waterLight: string;
  readonly lily: readonly [string, string];
  readonly blossom: string;
  readonly shadow: string;
  /** Bronze for the vault door; the inside of the vault. */
  readonly bronze: readonly [string, string, string];
  readonly vault: string;
  readonly vaultGlow: string;
  /** The strike preview. */
  readonly strike: string;
  readonly strikeInk: string;
  readonly peek: string;
  /** Light pooling on the scene: sunlight or lantern light. */
  readonly light: string;
  readonly vignette: string;
}

export const PALETTES: Readonly<Record<Look, GardenPalette>> = {
  sun: {
    terrace: '#d9c6a0',
    terraceDeep: '#c3ab7f',
    wallFace: '#c9b089',
    wallShade: '#9c825c',
    wallLight: '#efe2c4',
    stone: ['#dcc9a2', '#cdb68c', '#e6d6b2'],
    stoneLight: 'rgba(255, 248, 226, 0.6)',
    stoneShade: 'rgba(96, 70, 34, 0.38)',
    mortar: '#a48e63',
    moss: ['#7f9a3e', '#5f7d2c'],
    hedge: ['#3d7a2f', '#2a5d22', '#62a345'],
    hedgeLight: '#b4dc72',
    water: ['#5fb7b0', '#2f8a8f'],
    waterLight: 'rgba(255, 255, 240, 0.75)',
    lily: ['#5e9d3c', '#3f7a2b'],
    blossom: '#f39ab0',
    shadow: 'rgba(72, 52, 26, 0.32)',
    bronze: ['#4e5561', '#30353e', '#8b95a3'],
    vault: '#2b1d10',
    vaultGlow: 'rgba(255, 214, 120, 0.85)',
    strike: 'rgba(214, 64, 44, 1)',
    strikeInk: '#7a1a0e',
    peek: '#c27a10',
    light: 'rgba(255, 238, 190, 0.35)',
    vignette: 'rgba(98, 70, 34, 0.32)',
  },
  moon: {
    terrace: '#1f2c45',
    terraceDeep: '#162036',
    wallFace: '#2a3a58',
    wallShade: '#141d31',
    wallLight: '#4a6087',
    stone: ['#34435f', '#2d3a53', '#3d4e6e'],
    stoneLight: 'rgba(190, 210, 255, 0.3)',
    stoneShade: 'rgba(4, 8, 20, 0.5)',
    mortar: '#1d2638',
    moss: ['#2b5650', '#1f433f'],
    hedge: ['#1c463c', '#12322b', '#2c6a58'],
    hedgeLight: '#6cc0a4',
    water: ['#1b3f66', '#0f2846'],
    waterLight: 'rgba(214, 232, 255, 0.85)',
    lily: ['#2f6a55', '#21503f'],
    blossom: '#e8b6ff',
    shadow: 'rgba(4, 8, 20, 0.5)',
    bronze: ['#3c4558', '#232a38', '#7d8aa3'],
    vault: '#090d18',
    vaultGlow: 'rgba(255, 200, 110, 0.9)',
    strike: 'rgba(255, 92, 140, 1)',
    strikeInk: '#ffd0de',
    peek: '#ffd36e',
    light: 'rgba(255, 196, 110, 0.32)',
    vignette: 'rgba(2, 4, 14, 0.55)',
  },
};

/** The snake's colours by day and by moonlight. */
export interface SnakePalette {
  readonly body: readonly [string, string];
  readonly belly: string;
  readonly pattern: string;
  readonly patternEdge: string;
  readonly frill: readonly [string, string];
  readonly eyeWhite: string;
  readonly iris: string;
  readonly pupil: string;
  readonly eyeGlow: string;
  readonly tongue: string;
  readonly outline: string;
}

export const SNAKE_COLOURS: Readonly<Record<Look, SnakePalette>> = {
  sun: {
    body: ['#2fa35e', '#1d7341'],
    belly: '#f3e6a6',
    pattern: '#f2c14e',
    patternEdge: '#a8761a',
    frill: ['#f6c945', '#e0862a'],
    eyeWhite: '#fffbea',
    iris: '#e0a51c',
    pupil: '#1d1406',
    eyeGlow: 'rgba(255, 220, 90, 0)',
    tongue: '#d8344b',
    outline: '#134a2a',
  },
  moon: {
    body: ['#2c8a83', '#185852'],
    belly: '#cfe8e0',
    pattern: '#bfe4ff',
    patternEdge: '#5d8db0',
    frill: ['#ffe08a', '#ff9f5a'],
    eyeWhite: '#fff6d8',
    iris: '#ffbf3a',
    pupil: '#140c02',
    eyeGlow: 'rgba(255, 196, 70, 0.75)',
    tongue: '#ff5a7a',
    outline: '#0a2d2a',
  },
};
