/**
 * Sprint's two looks. Day Stadium: a bright terracotta track, white lines, a crowd in soft
 * colour under a summer sky. Night Stadium: floodlights, lane lines that glow, a lit scoreboard
 * and camera flashes in the stands. Designed separately; night is not day darkened.
 */

export interface SprintPalette {
  readonly sky: readonly string[];
  readonly sun: string;
  readonly cloud: string;
  readonly star: string;
  readonly roof: string;
  readonly roofShade: string;
  readonly truss: string;
  readonly standBack: string;
  readonly standStep: string;
  readonly crowd: readonly string[];
  readonly crowdSkin: readonly string[];
  readonly wall: string;
  readonly wallStripe: string;
  readonly track: readonly [string, string];
  readonly lane: string;
  readonly laneGlow: string | null;
  readonly grass: readonly [string, string];
  readonly boardHousing: string;
  readonly boardBezel: string;
  readonly boardFace: string;
  readonly boardDot: string;
  readonly boardLamp: readonly string[];
  readonly light: string;
  readonly beam: string;
  readonly haze: string;
  readonly shadow: string;
  readonly skin: string;
  readonly skinShade: string;
  readonly hair: string;
  readonly singlet: string;
  readonly singletShade: string;
  readonly shorts: string;
  readonly shortsShade: string;
  readonly shoe: string;
  readonly shoeStripe: string;
  readonly band: string;
  readonly rim: string | null;
  readonly hurdle: string;
  readonly hurdleBar: string;
  readonly tape: string;
  readonly confetti: readonly string[];
  readonly dust: string;
  readonly ghost: string;
}

export const DAY: SprintPalette = {
  sky: ['#3f9be6', '#86c4f2', '#d4ecfb'],
  sun: 'rgba(255, 246, 214, 0.9)',
  cloud: 'rgba(255, 255, 255, 0.82)',
  star: 'rgba(0,0,0,0)',
  roof: '#f3f5f7',
  roofShade: '#c9d1da',
  truss: '#8c99a8',
  standBack: '#d9d3ca',
  standStep: '#c7beb2',
  crowd: [
    '#ef8f6f',
    '#f6c86b',
    '#7cc6b6',
    '#8fb3e3',
    '#c8a6dd',
    '#f2a7b8',
    '#9ccf87',
    '#f0b27f',
    '#ffffff',
  ],
  crowdSkin: ['#f1c7a6', '#d9a07c', '#a8714f', '#7a4b33', '#5c3726'],
  wall: '#1f4e8c',
  wallStripe: '#ffffff',
  track: ['#c95a3f', '#d8684a'],
  lane: 'rgba(255, 255, 255, 0.92)',
  laneGlow: null,
  grass: ['#5aa857', '#4c9a4b'],
  boardHousing: '#262c35',
  boardBezel: '#4b5563',
  boardFace: '#0d1116',
  boardDot: 'rgba(255, 210, 120, 0.07)',
  boardLamp: ['#ff6b3d', '#ffd166', '#5cc8ff'],
  light: '#fffdf2',
  beam: 'rgba(255,255,255,0)',
  haze: 'rgba(255,255,255,0)',
  shadow: 'rgba(60, 20, 10, 0.28)',
  skin: '#94603f',
  skinShade: '#704429',
  hair: '#1d1714',
  singlet: '#ff6b3d',
  singletShade: '#d94e24',
  shorts: '#1b2c50',
  shortsShade: '#132039',
  shoe: '#fbfbfb',
  shoeStripe: '#1f8fff',
  band: '#ffffff',
  rim: null,
  hurdle: '#f4f4f4',
  hurdleBar: '#1b2c50',
  tape: '#ffffff',
  confetti: ['#ff6b3d', '#ffd166', '#1f8fff', '#2fbf71', '#ffffff', '#c86bff'],
  dust: 'rgba(240, 190, 160, 0.55)',
  ghost: '#ffffff',
};

export const NIGHT: SprintPalette = {
  sky: ['#030814', '#081630', '#15284a'],
  sun: 'rgba(0,0,0,0)',
  cloud: 'rgba(0,0,0,0)',
  star: 'rgba(220, 232, 255, 0.75)',
  roof: '#1b2434',
  roofShade: '#111824',
  truss: '#2c3a52',
  standBack: '#121a29',
  standStep: '#0d1420',
  crowd: [
    '#ff8a6b',
    '#ffd27a',
    '#6fe0c8',
    '#7fb2ff',
    '#d39bff',
    '#ff9ec0',
    '#a8f08e',
    '#ffc08a',
    '#e9f0ff',
  ],
  crowdSkin: ['#c99a7c', '#a8785a', '#7d5340', '#5a3a2b', '#43291f'],
  wall: '#0b1424',
  wallStripe: '#47d1ff',
  track: ['#6e2a20', '#8a3628'],
  lane: 'rgba(255, 241, 222, 0.95)',
  laneGlow: 'rgba(255, 214, 170, 0.55)',
  grass: ['#1d4a2a', '#183f24'],
  boardHousing: '#0a0d12',
  boardBezel: '#2a3444',
  boardFace: '#04060a',
  boardDot: 'rgba(255, 200, 90, 0.09)',
  boardLamp: ['#ff6b3d', '#ffd166', '#47d1ff'],
  light: '#f4f8ff',
  beam: 'rgba(190, 212, 255, 0.16)',
  haze: 'rgba(140, 170, 230, 0.22)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  skin: '#8a573a',
  skinShade: '#5e3824',
  hair: '#120d0b',
  singlet: '#ff7a45',
  singletShade: '#d25426',
  shorts: '#16233f',
  shortsShade: '#0e172b',
  shoe: '#f5f7ff',
  shoeStripe: '#47d1ff',
  band: '#ffffff',
  rim: 'rgba(214, 232, 255, 0.85)',
  hurdle: '#e6ebf5',
  hurdleBar: '#ff7a45',
  tape: '#ffffff',
  confetti: ['#ff7a45', '#ffd166', '#47d1ff', '#5cf0a0', '#ffffff', '#d39bff'],
  dust: 'rgba(255, 210, 180, 0.35)',
  ghost: '#8fe3ff',
};
