import type { Rank } from '@usr-games/kit/cards';
import type { Point } from './painter';

/**
 * Thirteen pond species, one for each rank; a book of four becomes its rank's fish. All are
 * our own drawings of real kinds of fish, chosen so their silhouettes differ at a glance: tall,
 * tiny, spiny, barred, round, whiskered, long-billed, flowing. Some names echo their rank (the
 * angelfish for aces, three spines for threes, eight whiskers for eights, ten for the tench,
 * the jewelfish for jacks, the crowntail for queens, the koi for kings).
 *
 * Coordinates are the fish's straight frame: 100 units from tail tip (x −50) to snout (x 50),
 * y downwards, the spine at y 0. Fins list their outline; their first and last points sit on
 * the body. `markings` are painted inside the body outline only.
 */

export interface Fin {
  points: readonly Point[];
  /** Indices of points kept sharp: spine tips, the corners of a forked tail. */
  sharp?: readonly number[];
  /** Fill; translucent fins let the water show through. */
  colour: string;
  /** Over the body (pectoral and pelvic fins) or behind it. */
  front?: boolean;
  /** Draw fin rays; most fins have them. */
  rays?: boolean;
}

export type MarkKind =
  | { kind: 'band'; x: number; width: number; from: number; to: number; slant?: number }
  | { kind: 'stripe'; from: number; to: number; y: number; width: number; taper?: boolean }
  | { kind: 'spot'; x: number; y: number; r: number; ry?: number }
  | { kind: 'blob'; points: readonly Point[] }
  | { kind: 'wave'; x: number; y: number; length: number; width: number };

export interface Mark {
  colour: string;
  shape: MarkKind;
  /** 0–1, how much of the colour shows; defaults to 1. */
  alpha?: number;
}

export interface Detail {
  /** A stroke drawn over the fish: barbels, spines, the line of a long bill. */
  path: readonly Point[];
  width: number;
  colour: string;
  /** Close and fill instead of stroke (a spine with its little membrane). */
  fill?: boolean;
}

export interface Species {
  rank: Rank;
  id: string;
  name: string;
  /** Length relative to the others, for the bucket and the album. */
  size: number;
  /** [x, top, bottom] from the root of the tail to the snout. */
  profile: readonly (readonly [number, number, number])[];
  /** How far the snout rounds out beyond the last profile point. */
  nose: number;
  colours: {
    back: string;
    side: string;
    belly: string;
    outline: string;
    iris: string;
  };
  fins: readonly Fin[];
  marks: readonly Mark[];
  details: readonly Detail[];
  eye: { x: number; y: number; r: number };
  /** Where the gill cover's edge curves down, or null for none. */
  gill: number | null;
  /** Fine scale arcs, for the carp family. */
  scales?: string;
}

const clearFin = (alpha: number, rgb: string) => `rgba(${rgb}, ${alpha})`;

const ANGELFISH: Species = {
  rank: 1,
  id: 'angelfish',
  name: 'Angelfish',
  size: 0.9,
  profile: [
    [-18, 6, 6],
    [-10, 15, 14],
    [0, 23, 21],
    [8, 24, 22],
    [18, 17, 14],
    [26, 10, 7],
    [31, 5, 3],
  ],
  nose: 4,
  colours: {
    back: '#aab7bd',
    side: '#e9eff1',
    belly: '#f8f9f7',
    outline: '#5f6e75',
    iris: '#c0392b',
  },
  fins: [
    {
      points: [
        [14, -19],
        [2, -40],
        [-20, -60],
        [-34, -67],
        [-24, -44],
        [-16, -9],
      ],
      sharp: [3],
      colour: clearFin(0.82, '226, 233, 236'),
      rays: true,
    },
    {
      points: [
        [12, 16],
        [0, 38],
        [-20, 57],
        [-34, 63],
        [-24, 40],
        [-16, 8],
      ],
      sharp: [3],
      colour: clearFin(0.82, '226, 233, 236'),
      rays: true,
    },
    {
      points: [
        [-17, -6],
        [-30, -19],
        [-45, -23],
        [-40, 0],
        [-45, 23],
        [-30, 19],
        [-17, 6],
      ],
      sharp: [2, 4],
      colour: clearFin(0.7, '226, 233, 236'),
      rays: true,
    },
    {
      points: [
        [16, 17],
        [11, 38],
        [5, 60],
        [8, 38],
        [12, 18],
      ],
      sharp: [2],
      colour: clearFin(0.9, '214, 222, 226'),
      front: true,
    },
    {
      points: [
        [16, 2],
        [6, -2],
        [2, 4],
        [8, 8],
      ],
      colour: clearFin(0.45, '240, 245, 247'),
      front: true,
      rays: true,
    },
  ],
  marks: [
    {
      colour: '#1d2226',
      shape: { kind: 'band', x: 23, width: 4, from: -30, to: 30, slant: -0.12 },
    },
    {
      colour: '#1d2226',
      shape: { kind: 'band', x: 5, width: 6.5, from: -30, to: 30, slant: -0.1 },
    },
    {
      colour: '#1d2226',
      shape: { kind: 'band', x: -12, width: 5, from: -30, to: 30, slant: -0.08 },
    },
  ],
  details: [
    // The black bars run on into the long fins.
    {
      path: [
        [3, -26],
        [-8, -42],
        [-22, -58],
      ],
      width: 4.5,
      colour: '#1d2226',
    },
    {
      path: [
        [3, 23],
        [-8, 40],
        [-22, 55],
      ],
      width: 4.5,
      colour: '#1d2226',
    },
    {
      path: [
        [-14, -10],
        [-20, -30],
        [-28, -52],
      ],
      width: 3.5,
      colour: '#1d2226',
    },
    {
      path: [
        [-14, 9],
        [-20, 28],
        [-28, 48],
      ],
      width: 3.5,
      colour: '#1d2226',
    },
  ],
  eye: { x: 24, y: -3, r: 4.2 },
  gill: 17,
};

const MINNOW: Species = {
  rank: 2,
  id: 'minnow',
  name: 'Minnow',
  size: 0.62,
  profile: [
    [-24, 4, 4],
    [-12, 7, 6],
    [2, 10, 9],
    [16, 10, 8],
    [28, 7, 5],
    [36, 3, 2],
  ],
  nose: 3,
  colours: {
    back: '#5f7038',
    side: '#d6dac4',
    belly: '#f4f2e5',
    outline: '#45532b',
    iris: '#d7b54a',
  },
  fins: [
    {
      points: [
        [5, -9.5],
        [-1, -21],
        [-8, -20],
        [-10, -8],
      ],
      sharp: [1],
      colour: clearFin(0.85, '150, 160, 110'),
      rays: true,
    },
    {
      points: [
        [-23, -4],
        [-38, -15],
        [-45, -14],
        [-35, 0],
        [-45, 14],
        [-38, 15],
        [-23, 4],
      ],
      sharp: [2, 3, 4],
      colour: clearFin(0.85, '150, 160, 110'),
      rays: true,
    },
    {
      points: [
        [-6, 8],
        [-12, 17],
        [-17, 16],
        [-16, 6],
      ],
      colour: clearFin(0.8, '170, 175, 130'),
      rays: true,
    },
    {
      points: [
        [6, 9],
        [2, 16],
        [-3, 15],
        [0, 8],
      ],
      colour: clearFin(0.75, '190, 190, 150'),
      front: true,
      rays: true,
    },
    {
      points: [
        [21, 3],
        [12, 10],
        [10, 6],
      ],
      colour: clearFin(0.6, '200, 200, 170'),
      front: true,
    },
  ],
  marks: [
    {
      colour: '#2c3824',
      shape: { kind: 'stripe', from: -24, to: 36, y: 0.5, width: 3.4, taper: true },
    },
    {
      colour: '#d9c065',
      shape: { kind: 'stripe', from: -18, to: 30, y: -3.4, width: 1.3, taper: true },
    },
  ],
  details: [],
  eye: { x: 29, y: -2.5, r: 3.4 },
  gill: 24,
};

const STICKLEBACK: Species = {
  rank: 3,
  id: 'stickleback',
  name: 'Three-spined stickleback',
  size: 0.58,
  profile: [
    [-26, 2.5, 2.5],
    [-16, 4, 4],
    [-4, 9, 9],
    [8, 11, 10],
    [20, 10, 9],
    [30, 7, 5],
    [38, 3, 2],
  ],
  nose: 2.5,
  colours: {
    back: '#4b6234',
    side: '#a9bfb6',
    belly: '#f1eee1',
    outline: '#384a28',
    iris: '#3fa3d9',
  },
  fins: [
    {
      points: [
        [-8, -8],
        [-12, -15],
        [-22, -12],
        [-24, -3.5],
      ],
      colour: clearFin(0.75, '120, 140, 100'),
      rays: true,
    },
    {
      points: [
        [-8, 8],
        [-12, 14],
        [-22, 11],
        [-24, 3],
      ],
      colour: clearFin(0.75, '120, 140, 100'),
      rays: true,
    },
    {
      points: [
        [-25, -2.5],
        [-35, -10],
        [-43, -9],
        [-41, 0],
        [-43, 9],
        [-35, 10],
        [-25, 2.5],
      ],
      sharp: [2, 4],
      colour: clearFin(0.8, '120, 140, 100'),
      rays: true,
    },
    {
      points: [
        [19, 2],
        [10, 6],
        [8, 1],
        [12, -2],
      ],
      colour: clearFin(0.55, '200, 210, 190'),
      front: true,
      rays: true,
    },
  ],
  marks: [
    {
      colour: '#e04f38',
      shape: {
        kind: 'blob',
        points: [
          [36, 2],
          [30, 7],
          [18, 11],
          [6, 11],
          [10, 3],
          [22, 1],
        ],
      },
    },
    { colour: '#3c5a2c', alpha: 0.35, shape: { kind: 'band', x: 0, width: 1.2, from: -9, to: 4 } },
    { colour: '#3c5a2c', alpha: 0.35, shape: { kind: 'band', x: 6, width: 1.2, from: -10, to: 4 } },
    {
      colour: '#3c5a2c',
      alpha: 0.35,
      shape: { kind: 'band', x: 12, width: 1.2, from: -10, to: 4 },
    },
  ],
  details: [
    // The three spines that name it, each with a scrap of membrane.
    {
      path: [
        [21, -9.5],
        [16, -25],
        [23.5, -9.6],
      ],
      width: 0,
      colour: '#2f3d22',
      fill: true,
    },
    {
      path: [
        [12, -10.5],
        [8, -27],
        [14.5, -10.6],
      ],
      width: 0,
      colour: '#2f3d22',
      fill: true,
    },
    {
      path: [
        [-2, -8],
        [-5, -16],
        [0, -8.2],
      ],
      width: 0,
      colour: '#2f3d22',
      fill: true,
    },
    {
      path: [
        [9, 10],
        [2, 21],
        [11, 9.6],
      ],
      width: 0,
      colour: '#2f3d22',
      fill: true,
    },
  ],
  eye: { x: 30, y: -2, r: 3.6 },
  gill: 25,
};

const PERCH: Species = {
  rank: 4,
  id: 'perch',
  name: 'Perch',
  size: 0.85,
  profile: [
    [-24, 5, 5],
    [-12, 10, 8],
    [0, 15, 11],
    [10, 16, 12],
    [22, 12, 10],
    [32, 7, 5],
    [40, 3, 2],
  ],
  nose: 3,
  colours: {
    back: '#56722a',
    side: '#c4cc52',
    belly: '#f2ebd2',
    outline: '#3f511d',
    iris: '#d8b23a',
  },
  fins: [
    {
      points: [
        [17, -15.5],
        [13, -31],
        [7, -33],
        [0, -31],
        [-5, -26],
        [-7, -14],
      ],
      sharp: [1, 2, 3],
      colour: clearFin(0.85, '150, 165, 90'),
      rays: true,
    },
    {
      points: [
        [-8, -13],
        [-12, -25],
        [-20, -22],
        [-22, -7],
      ],
      colour: clearFin(0.82, '150, 165, 90'),
      rays: true,
    },
    {
      points: [
        [-23, -5],
        [-36, -18],
        [-45, -17],
        [-36, 0],
        [-45, 17],
        [-36, 18],
        [-23, 5],
      ],
      sharp: [2, 3, 4],
      colour: clearFin(0.85, '160, 160, 90'),
      rays: true,
    },
    {
      points: [
        [-8, 9],
        [-12, 20],
        [-19, 18],
        [-20, 6],
      ],
      colour: clearFin(0.9, '226, 103, 44'),
      rays: true,
    },
    {
      points: [
        [12, 11],
        [6, 23],
        [1, 21],
        [5, 10],
      ],
      colour: clearFin(0.92, '226, 103, 44'),
      front: true,
      rays: true,
    },
    {
      points: [
        [25, 2],
        [14, 9],
        [12, 3],
      ],
      colour: clearFin(0.6, '220, 200, 120'),
      front: true,
    },
  ],
  marks: [26, 16, 6, -4, -12, -19].map((x, i): Mark => ({
    colour: '#2f3c16',
    alpha: 0.82,
    shape: { kind: 'band', x, width: i < 3 ? 4.6 : 3.6, from: -18, to: 4 + (i % 2) * 2 },
  })),
  details: [
    // The dark blotch at the back of the spiny fin.
    {
      path: [
        [-1, -16],
        [-4, -25],
        [-6, -24],
        [-6, -15],
      ],
      width: 0,
      colour: '#1e2410',
      fill: true,
    },
  ],
  eye: { x: 30, y: -4, r: 3.8 },
  gill: 23,
};

const PUFFER: Species = {
  rank: 5,
  id: 'puffer',
  name: 'Pufferfish',
  size: 0.66,
  profile: [
    [-16, 5, 5],
    [-8, 14, 14],
    [2, 21, 21],
    [12, 20, 20],
    [22, 15, 14],
    [30, 8, 7],
    [34, 4, 3],
  ],
  nose: 3,
  colours: {
    back: '#8a9536',
    side: '#cbd168',
    belly: '#f7f3e2',
    outline: '#59661f',
    iris: '#2fa59a',
  },
  fins: [
    {
      points: [
        [-6, -16],
        [-12, -25],
        [-16, -20],
        [-13, -10],
      ],
      colour: clearFin(0.8, '190, 196, 110'),
      rays: true,
    },
    {
      points: [
        [-6, 16],
        [-12, 24],
        [-16, 19],
        [-13, 10],
      ],
      colour: clearFin(0.8, '190, 196, 110'),
      rays: true,
    },
    {
      points: [
        [-15, -5],
        [-27, -13],
        [-33, -4],
        [-33, 4],
        [-27, 13],
        [-15, 5],
      ],
      colour: clearFin(0.82, '190, 196, 110'),
      rays: true,
    },
    {
      points: [
        [15, 1],
        [7, -7],
        [3, 0],
        [7, 7],
      ],
      colour: clearFin(0.55, '230, 236, 190'),
      front: true,
      rays: true,
    },
  ],
  marks: [
    {
      colour: '#f8f4e3',
      shape: {
        kind: 'blob',
        points: [
          [32, 3],
          [24, 13],
          [8, 21],
          [-10, 16],
          [-12, 8],
          [6, 7],
          [22, 5],
        ],
      },
    },
    ...(
      [
        [-6, -10, 2.4],
        [2, -15, 2.8],
        [12, -14, 2.6],
        [20, -9, 2.2],
        [-2, -3, 2.2],
        [8, -6, 2.6],
        [16, -2, 2],
        [-10, 2, 1.8],
        [26, -6, 1.8],
        [4, 2, 1.8],
      ] as const
    ).map(([x, y, r]): Mark => ({ colour: '#3a4119', shape: { kind: 'spot', x, y, r } })),
  ],
  details: [
    {
      path: [
        [35.5, 2.4],
        [37.5, 3.2],
        [35.5, 4.4],
      ],
      width: 1.4,
      colour: '#59661f',
    },
  ],
  eye: { x: 20, y: -6, r: 5.8 },
  gill: null,
};

const PUMPKINSEED: Species = {
  rank: 6,
  id: 'pumpkinseed',
  name: 'Pumpkinseed sunfish',
  size: 0.78,
  profile: [
    [-20, 5, 5],
    [-12, 12, 11],
    [-2, 19, 17],
    [8, 20, 17],
    [18, 15, 13],
    [28, 8, 6],
    [35, 3, 2],
  ],
  nose: 3,
  colours: {
    back: '#4a6639',
    side: '#8ea257',
    belly: '#f2a93b',
    outline: '#36492a',
    iris: '#c33a2a',
  },
  fins: [
    {
      points: [
        [18, -14.5],
        [13, -26],
        [4, -30],
        [-8, -29],
        [-16, -23],
        [-19, -6],
      ],
      sharp: [1],
      colour: clearFin(0.85, '110, 135, 80'),
      rays: true,
    },
    {
      points: [
        [-2, 16],
        [-10, 26],
        [-17, 22],
        [-19, 6],
      ],
      colour: clearFin(0.85, '150, 140, 70'),
      rays: true,
    },
    {
      points: [
        [-19, -5],
        [-32, -16],
        [-41, -12],
        [-35, 0],
        [-41, 12],
        [-32, 16],
        [-19, 5],
      ],
      sharp: [3],
      colour: clearFin(0.82, '120, 140, 80'),
      rays: true,
    },
    {
      points: [
        [14, 13],
        [8, 26],
        [3, 23],
        [8, 12],
      ],
      sharp: [1],
      colour: clearFin(0.9, '70, 85, 50'),
      front: true,
      rays: true,
    },
    {
      points: [
        [21, 2],
        [8, 7],
        [8, 0],
      ],
      colour: clearFin(0.45, '220, 220, 170'),
      front: true,
    },
  ],
  marks: [
    ...(
      [
        [10, -10],
        [2, -5],
        [-6, -9],
        [-12, -2],
        [6, 4],
        [-2, 6],
        [14, -2],
        [-8, 8],
        [16, -12],
        [-14, -10],
      ] as const
    ).map(([x, y]): Mark => ({ colour: '#ea8c34', shape: { kind: 'spot', x, y, r: 1.9 } })),
    { colour: '#33b4c6', shape: { kind: 'wave', x: 22, y: -2, length: 12, width: 1.4 } },
    { colour: '#33b4c6', shape: { kind: 'wave', x: 22, y: 2, length: 12, width: 1.4 } },
    { colour: '#33b4c6', shape: { kind: 'wave', x: 21, y: 6, length: 10, width: 1.3 } },
    // The black ear flap with its red tip.
    { colour: '#161616', shape: { kind: 'spot', x: 17, y: -2.5, r: 3.4, ry: 2.6 } },
    { colour: '#e23b2f', shape: { kind: 'spot', x: 14.2, y: -2.5, r: 1.3, ry: 2.2 } },
  ],
  details: [],
  eye: { x: 28, y: -4, r: 3.6 },
  gill: null,
};

const TROUT: Species = {
  rank: 7,
  id: 'trout',
  name: 'Rainbow trout',
  size: 1,
  profile: [
    [-28, 4, 4],
    [-16, 8, 7],
    [0, 12, 11],
    [14, 12, 10],
    [28, 9, 7],
    [38, 5, 3],
    [44, 2, 1],
  ],
  nose: 3,
  colours: {
    back: '#4a6845',
    side: '#dfe4dc',
    belly: '#f7f5ef',
    outline: '#38502f',
    iris: '#c9a24a',
  },
  fins: [
    {
      points: [
        [6, -11.5],
        [1, -22],
        [-6, -21],
        [-8, -11],
      ],
      colour: clearFin(0.85, '120, 140, 110'),
      rays: true,
    },
    {
      points: [
        [-17, -7.5],
        [-21, -13],
        [-25, -6.5],
      ],
      colour: clearFin(0.85, '90, 110, 85'),
    },
    {
      points: [
        [-27, -4],
        [-40, -15],
        [-48, -14],
        [-44, 0],
        [-48, 14],
        [-40, 15],
        [-27, 4],
      ],
      sharp: [2, 4],
      colour: clearFin(0.85, '130, 145, 115'),
      rays: true,
    },
    {
      points: [
        [-12, 8],
        [-16, 16],
        [-21, 14],
        [-21, 5],
      ],
      colour: clearFin(0.85, '210, 180, 175'),
      rays: true,
    },
    {
      points: [
        [2, 11],
        [-3, 19],
        [-7, 16],
        [-4, 10],
      ],
      colour: clearFin(0.8, '220, 190, 185'),
      front: true,
      rays: true,
    },
    {
      points: [
        [29, 3],
        [18, 10],
        [16, 5],
      ],
      colour: clearFin(0.6, '230, 210, 200'),
      front: true,
    },
  ],
  marks: [
    {
      colour: '#e46d8e',
      alpha: 0.85,
      shape: { kind: 'stripe', from: -26, to: 34, y: 0.5, width: 6, taper: true },
    },
    ...(
      [
        [-20, -5],
        [-12, -7],
        [-4, -9],
        [4, -9],
        [12, -8],
        [20, -7],
        [28, -5],
        [-16, -2],
        [-8, -4],
        [0, -5],
        [8, -5],
        [16, -3],
        [-22, 1],
        [-14, 3],
      ] as const
    ).map(([x, y]): Mark => ({ colour: '#1f2420', shape: { kind: 'spot', x, y, r: 0.9 } })),
  ],
  details: [
    ...(
      [
        [-1, -16],
        [-5, -18],
        [-3, -13],
        [-36, -8],
        [-41, -4],
        [-38, 5],
        [-42, 9],
        [-33, -2],
      ] as const
    ).map(([x, y]): Detail => ({
      path: [
        [x, y],
        [x + 0.6, y + 0.4],
      ],
      width: 1.6,
      colour: '#1f2420',
    })),
  ],
  eye: { x: 37, y: -2, r: 3.4 },
  gill: 31,
};

const CATFISH: Species = {
  rank: 8,
  id: 'catfish',
  name: 'Catfish',
  size: 1,
  profile: [
    [-28, 4, 4],
    [-16, 7, 6],
    [-2, 9, 8],
    [12, 11, 9],
    [24, 10, 9],
    [34, 8, 8],
    [40, 6, 6],
  ],
  nose: 5,
  colours: {
    back: '#45473b',
    side: '#88856c',
    belly: '#e1dac1',
    outline: '#303228',
    iris: '#d8c25a',
  },
  fins: [
    {
      points: [
        [16, -10],
        [11, -23],
        [6, -20],
        [4, -9],
      ],
      sharp: [1],
      colour: clearFin(0.9, '80, 80, 64'),
      rays: true,
    },
    {
      points: [
        [-14, -6.5],
        [-18, -11],
        [-24, -5],
      ],
      colour: clearFin(0.9, '70, 72, 58'),
    },
    {
      points: [
        [-4, 8],
        [-8, 14],
        [-22, 11],
        [-24, 4.5],
      ],
      colour: clearFin(0.85, '90, 88, 70'),
      rays: true,
    },
    {
      points: [
        [-27, -4],
        [-38, -12],
        [-47, -9],
        [-42, 0],
        [-47, 9],
        [-38, 12],
        [-27, 4],
      ],
      sharp: [3],
      colour: clearFin(0.88, '80, 80, 64'),
      rays: true,
    },
    {
      points: [
        [4, 8],
        [0, 14],
        [-4, 12],
        [-1, 7],
      ],
      colour: clearFin(0.85, '100, 98, 80'),
      front: true,
    },
    {
      points: [
        [27, 6],
        [14, 14],
        [12, 10],
      ],
      sharp: [1],
      colour: clearFin(0.9, '100, 98, 80'),
      front: true,
      rays: true,
    },
  ],
  marks: (
    [
      [-18, -3, 2.6],
      [-8, -5, 3.2],
      [2, -6, 2.4],
      [12, -7, 3],
      [22, -6, 2.6],
      [30, -4, 2],
      [-12, 1, 2],
      [6, 0, 2.2],
      [18, 0, 1.8],
      [-22, 0, 1.6],
    ] as const
  ).map(([x, y, r]): Mark => ({
    colour: '#353629',
    alpha: 0.75,
    shape: { kind: 'spot', x, y, r },
  })),
  details: [
    // Eight whiskers: the long pair from the upper jaw trailing back along the flank, a short
    // pair above the nostrils, and four under the chin.
    {
      path: [
        [43, 1],
        [40, 5],
        [32, 8],
        [20, 11],
        [10, 15],
      ],
      width: 1.4,
      colour: '#2a2b22',
    },
    {
      path: [
        [41, 2],
        [37, 11],
        [29, 17],
        [20, 21],
      ],
      width: 1.2,
      colour: '#2a2b22',
    },
    {
      path: [
        [41, -4],
        [41, -9],
        [38, -12],
      ],
      width: 1,
      colour: '#2a2b22',
    },
    {
      path: [
        [39, 7],
        [36, 13],
        [31, 16],
      ],
      width: 1,
      colour: '#2a2b22',
    },
    {
      path: [
        [37, 8],
        [33, 13],
        [28, 14],
      ],
      width: 1,
      colour: '#2a2b22',
    },
  ],
  eye: { x: 36, y: -4, r: 2.6 },
  gill: 30,
};

const PIKE: Species = {
  rank: 9,
  id: 'pike',
  name: 'Pike',
  size: 1.15,
  profile: [
    [-32, 4, 4],
    [-20, 7, 6],
    [-4, 9, 8],
    [12, 9, 8],
    [26, 8, 7],
    [34, 6, 5],
    [42, 3.5, 2.5],
    [48, 2, 1.6],
  ],
  nose: 2,
  colours: {
    back: '#3d5829',
    side: '#90ab59',
    belly: '#eff0c9',
    outline: '#2c401e',
    iris: '#e2c04a',
  },
  fins: [
    {
      points: [
        [-14, -8],
        [-18, -19],
        [-27, -16],
        [-29, -5.5],
      ],
      colour: clearFin(0.9, '200, 120, 60'),
      rays: true,
    },
    {
      points: [
        [-14, 7],
        [-18, 17],
        [-27, 14],
        [-29, 4.5],
      ],
      colour: clearFin(0.9, '200, 120, 60'),
      rays: true,
    },
    {
      points: [
        [-31, -4],
        [-42, -14],
        [-50, -13],
        [-44, 0],
        [-50, 13],
        [-42, 14],
        [-31, 4],
      ],
      sharp: [2, 3, 4],
      colour: clearFin(0.9, '190, 120, 60'),
      rays: true,
    },
    {
      points: [
        [-2, 8],
        [-7, 15],
        [-11, 13],
        [-8, 7],
      ],
      colour: clearFin(0.9, '210, 130, 70'),
      front: true,
      rays: true,
    },
    {
      points: [
        [27, 3],
        [17, 9],
        [15, 5],
      ],
      colour: clearFin(0.75, '210, 150, 90'),
      front: true,
    },
  ],
  marks: (
    [
      [-24, -3],
      [-16, -5],
      [-8, -6],
      [0, -6],
      [8, -6],
      [16, -5],
      [24, -4],
      [-20, 1],
      [-12, 0],
      [-4, 0],
      [4, 0],
      [12, 0],
      [20, 0],
      [28, 0],
      [-16, 4.5],
      [-8, 5],
      [0, 5],
      [8, 5],
      [16, 4],
    ] as const
  ).map(([x, y]): Mark => ({
    colour: '#e6ecac',
    alpha: 0.9,
    shape: { kind: 'spot', x, y, r: 1.9, ry: 1.1 },
  })),
  details: [
    {
      path: [
        [49, 0.8],
        [40, 1.2],
        [33, 0.6],
      ],
      width: 0.9,
      colour: '#2c401e',
    },
    ...(
      [
        [-20, -13],
        [-24, -10],
        [-21, 11],
        [-25, 9],
        [-40, -8],
        [-44, -5],
        [-40, 8],
        [-45, 6],
      ] as const
    ).map(([x, y]): Detail => ({
      path: [
        [x, y],
        [x + 0.5, y + 0.4],
      ],
      width: 1.8,
      colour: '#5b2a12',
    })),
  ],
  eye: { x: 36, y: -3, r: 3.2 },
  gill: 27,
};

const TENCH: Species = {
  rank: 10,
  id: 'tench',
  name: 'Tench',
  size: 0.9,
  profile: [
    [-24, 7, 7],
    [-12, 11, 10],
    [0, 14, 12],
    [12, 14, 12],
    [24, 11, 9],
    [32, 7, 5],
    [38, 4, 3],
  ],
  nose: 3,
  colours: {
    back: '#38441a',
    side: '#8a8e36',
    belly: '#dcc76c',
    outline: '#2a3313',
    iris: '#e04e22',
  },
  fins: [
    {
      points: [
        [4, -13],
        [0, -25],
        [-8, -25],
        [-10, -12],
      ],
      colour: clearFin(0.95, '52, 60, 26'),
      rays: true,
    },
    {
      points: [
        [-6, 11],
        [-10, 21],
        [-17, 20],
        [-18, 8],
      ],
      colour: clearFin(0.95, '52, 60, 26'),
      rays: true,
    },
    {
      points: [
        [-23, -7],
        [-34, -17],
        [-45, -15],
        [-46, 0],
        [-45, 15],
        [-34, 17],
        [-23, 7],
      ],
      colour: clearFin(0.95, '52, 60, 26'),
      rays: true,
    },
    {
      points: [
        [6, 12],
        [0, 23],
        [-4, 20],
        [0, 11],
      ],
      colour: clearFin(0.95, '58, 66, 30'),
      front: true,
      rays: true,
    },
    {
      points: [
        [26, 3],
        [16, 11],
        [14, 5],
      ],
      colour: clearFin(0.9, '70, 76, 36'),
      front: true,
    },
  ],
  marks: [
    {
      colour: '#e9d27a',
      alpha: 0.55,
      shape: {
        kind: 'blob',
        points: [
          [30, 3],
          [20, 9],
          [0, 11],
          [-16, 8],
          [-8, 2],
          [12, 2],
        ],
      },
    },
  ],
  details: [
    {
      path: [
        [40, 2.6],
        [41, 6],
        [39, 8],
      ],
      width: 1,
      colour: '#2a3313',
    },
  ],
  eye: { x: 31, y: -3, r: 3.2 },
  gill: 25,
};

const JEWELFISH: Species = {
  rank: 11,
  id: 'jewelfish',
  name: 'Jewelfish',
  size: 0.78,
  profile: [
    [-22, 6, 6],
    [-12, 11, 10],
    [0, 15, 13],
    [12, 15, 13],
    [22, 12, 10],
    [31, 7, 5],
    [37, 3, 2],
  ],
  nose: 3,
  colours: {
    back: '#951b27',
    side: '#d6303a',
    belly: '#ee6a52',
    outline: '#6b1420',
    iris: '#f2c94c',
  },
  fins: [
    {
      points: [
        [24, -11],
        [17, -22],
        [2, -26],
        [-12, -23],
        [-20, -17],
        [-21, -6],
      ],
      sharp: [1],
      colour: clearFin(0.92, '196, 40, 58'),
      rays: true,
    },
    {
      points: [
        [-2, 13],
        [-8, 23],
        [-17, 20],
        [-20, 6],
      ],
      colour: clearFin(0.92, '196, 40, 58'),
      rays: true,
    },
    {
      points: [
        [-21, -6],
        [-32, -15],
        [-41, -8],
        [-42, 0],
        [-41, 8],
        [-32, 15],
        [-21, 6],
      ],
      colour: clearFin(0.9, '196, 40, 58'),
      rays: true,
    },
    {
      points: [
        [12, 12],
        [6, 25],
        [2, 21],
        [6, 11],
      ],
      sharp: [1],
      colour: clearFin(0.95, '200, 44, 60'),
      front: true,
      rays: true,
    },
    {
      points: [
        [24, 2],
        [14, 7],
        [13, 2],
      ],
      colour: clearFin(0.5, '240, 160, 150'),
      front: true,
    },
  ],
  marks: [
    { colour: '#2a0e12', shape: { kind: 'spot', x: 2, y: -1, r: 3.6 } },
    ...(
      [
        [-16, -4],
        [-10, -8],
        [-4, -10],
        [4, -10],
        [10, -8],
        [16, -6],
        [-14, 1],
        [-8, -2],
        [8, -3],
        [14, 0],
        [-10, 5],
        [-2, 5],
        [6, 4],
        [12, 6],
        [-4, 9],
        [4, 9],
        [20, -3],
        [22, 3],
      ] as const
    ).map(([x, y]): Mark => ({ colour: '#74e8f0', shape: { kind: 'spot', x, y, r: 1.05 } })),
  ],
  details: (
    [
      [12, -20],
      [4, -22],
      [-4, -21],
      [-12, -19],
      [-30, -9],
      [-36, -3],
      [-36, 4],
      [-30, 9],
      [-10, 18],
      [-14, 15],
    ] as const
  ).map(([x, y]): Detail => ({
    path: [
      [x, y],
      [x + 0.5, y + 0.4],
    ],
    width: 1.8,
    colour: '#74e8f0',
  })),
  eye: { x: 29, y: -3, r: 3.4 },
  gill: 23,
};

/** The crowntail's tail: a fan whose rays reach past the membrane like the points of a crown. */
function crownFan(): Point[] {
  const points: Point[] = [[-13, -5]];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI * (0.62 + (0.76 * i) / steps);
    const radius = i % 2 === 0 ? 40 : 31;
    points.push([-13 + Math.cos(angle) * radius, Math.sin(angle) * radius * -0.95]);
  }
  points.push([-13, 5]);
  return points;
}

const CROWNTAIL: Species = {
  rank: 12,
  id: 'crowntail',
  name: 'Crowntail',
  size: 0.74,
  profile: [
    [-14, 5, 5],
    [-6, 8, 8],
    [4, 9, 8],
    [14, 8, 7],
    [22, 5, 4],
    [27, 3, 2],
  ],
  nose: 2,
  colours: {
    back: '#28268a',
    side: '#4a3fb8',
    belly: '#7666d4',
    outline: '#211d68',
    iris: '#e6e1ff',
  },
  fins: [
    {
      points: [
        [6, -8],
        [0, -22],
        [-12, -34],
        [-27, -39],
        [-22, -22],
        [-14, -6],
      ],
      sharp: [3],
      colour: 'rgba(110, 70, 200, 0.9)',
      rays: true,
    },
    {
      points: [
        [10, 7],
        [2, 22],
        [-10, 37],
        [-27, 45],
        [-22, 26],
        [-14, 6],
      ],
      sharp: [3],
      colour: 'rgba(150, 60, 170, 0.9)',
      rays: true,
    },
    {
      points: crownFan(),
      sharp: Array.from({ length: 8 }, (_, i) => 1 + i * 2),
      colour: 'rgba(180, 50, 130, 0.88)',
      rays: true,
    },
    {
      points: [
        [10, 8],
        [7, 26],
        [4, 31],
        [6, 24],
        [8, 8],
      ],
      sharp: [2],
      colour: 'rgba(200, 60, 120, 0.95)',
      front: true,
    },
    {
      points: [
        [16, 2],
        [9, 6],
        [8, 1],
      ],
      colour: 'rgba(220, 210, 255, 0.45)',
      front: true,
    },
  ],
  marks: [],
  details: [],
  eye: { x: 22, y: -2, r: 2.8 },
  gill: 16,
};

const KOI: Species = {
  rank: 13,
  id: 'koi',
  name: 'Koi',
  size: 1.1,
  profile: [
    [-28, 6, 6],
    [-16, 10, 9],
    [-2, 14, 12],
    [12, 14, 12],
    [26, 11, 9],
    [36, 7, 5],
    [42, 4, 3],
  ],
  nose: 3.5,
  colours: {
    back: '#ece5d6',
    side: '#f8f4ec',
    belly: '#fcfaf5',
    outline: '#9a8e78',
    iris: '#262222',
  },
  fins: [
    {
      points: [
        [16, -13],
        [10, -22],
        [-8, -21],
        [-18, -14],
        [-20, -8],
      ],
      colour: 'rgba(246, 236, 222, 0.88)',
      rays: true,
    },
    {
      points: [
        [-27, -6],
        [-40, -18],
        [-50, -15],
        [-43, 0],
        [-50, 15],
        [-40, 18],
        [-27, 6],
      ],
      sharp: [3],
      colour: 'rgba(242, 163, 110, 0.85)',
      rays: true,
    },
    {
      points: [
        [-12, 10],
        [-16, 18],
        [-22, 15],
        [-22, 7],
      ],
      colour: 'rgba(246, 236, 222, 0.85)',
      rays: true,
    },
    {
      points: [
        [4, 12],
        [-2, 22],
        [-6, 18],
        [-2, 11],
      ],
      colour: 'rgba(250, 242, 232, 0.9)',
      front: true,
      rays: true,
    },
    {
      points: [
        [28, 5],
        [16, 16],
        [11, 13],
        [18, 6],
      ],
      colour: 'rgba(252, 246, 238, 0.92)',
      front: true,
      rays: true,
    },
  ],
  marks: [
    {
      colour: '#e44a24',
      shape: {
        kind: 'blob',
        points: [
          [42, -3],
          [36, -8],
          [26, -11],
          [22, -4],
          [30, 0],
          [38, 1],
        ],
      },
    },
    {
      colour: '#e44a24',
      shape: {
        kind: 'blob',
        points: [
          [18, -14],
          [6, -15],
          [-4, -12],
          [-2, -2],
          [10, 2],
          [18, -4],
        ],
      },
    },
    {
      colour: '#e44a24',
      shape: {
        kind: 'blob',
        points: [
          [-10, -11],
          [-20, -9],
          [-26, -4],
          [-20, 1],
          [-12, -2],
        ],
      },
    },
    { colour: '#1f1d1c', shape: { kind: 'spot', x: 4, y: 4, r: 2.4, ry: 1.8 } },
    { colour: '#1f1d1c', shape: { kind: 'spot', x: -14, y: -8, r: 1.8, ry: 1.4 } },
    { colour: '#1f1d1c', shape: { kind: 'spot', x: 22, y: -10, r: 1.5 } },
  ],
  details: [
    {
      path: [
        [44.5, 1.5],
        [45, 5],
        [42.5, 7.5],
      ],
      width: 1,
      colour: '#b07a5a',
    },
    {
      path: [
        [43, 2.5],
        [41.5, 6],
        [39, 7.5],
      ],
      width: 0.9,
      colour: '#b07a5a',
    },
  ],
  eye: { x: 34, y: -3, r: 3 },
  gill: 28,
  scales: 'rgba(150, 130, 105, 0.32)',
};

export const SPECIES: readonly Species[] = [
  ANGELFISH,
  MINNOW,
  STICKLEBACK,
  PERCH,
  PUFFER,
  PUMPKINSEED,
  TROUT,
  CATFISH,
  PIKE,
  TENCH,
  JEWELFISH,
  CROWNTAIL,
  KOI,
];

export function speciesFor(rank: Rank): Species {
  return SPECIES[rank - 1]!;
}
