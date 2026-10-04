/**
 * The rule tables of sail, and the ship designs Figurehead builds its fleets from.
 *
 * Derived from the BSD sail game (Dave Riggle, with Ed Wang and Craig Leres), sail/globals.c:
 * the wind-effect, rigging, hull, ammunition, hit-chance, crew-quality and melee tables are
 * the original's numbers, and every design below except the merchantman is one row of its
 * ship table, cited by row. Copyright (c) 1983, 1993 The Regents of the University of
 * California; the notice is kept in LICENSES/BSD-3-Clause-UCB.txt.
 */

export interface ShipSpec {
  /** Squares a turn under battle sails, and under full sails. */
  bs: number;
  fs: number;
  /** Turns allowed in one helm order. */
  ta: number;
  guns: number;
  /** 1 three-decker, 2 two-decker, 3 frigate, 4 corvette, 5 sloop, 6 brig. */
  cls: number;
  hull: number;
  /** Crew quality: 1 unruly, 2 green, 3 steady, 4 crack, 5 elite. */
  qual: number;
  crew1: number;
  crew2: number;
  crew3: number;
  gunL: number;
  gunR: number;
  carL: number;
  carR: number;
  rig1: number;
  rig2: number;
  rig3: number;
  /** -1 on two- and three-deckers, which the original drew with three masts only. */
  rig4: number;
  /** What she is worth to whoever takes her. */
  pts: number;
}

/** Hand-made rows of numbers, so the tables read like the C they came from. */
function spec(...v: number[]): ShipSpec {
  const [bs, fs, ta, guns, cls, hull, qual, crew1, crew2, crew3, gunL, gunR, carL, carR] = v;
  const [rig1, rig2, rig3, rig4, pts] = v.slice(14);
  return {
    bs: bs!,
    fs: fs!,
    ta: ta!,
    guns: guns!,
    cls: cls!,
    hull: hull!,
    qual: qual!,
    crew1: crew1!,
    crew2: crew2!,
    crew3: crew3!,
    gunL: gunL!,
    gunR: gunR!,
    carL: carL!,
    carR: carR!,
    rig1: rig1!,
    rig2: rig2!,
    rig3: rig3!,
    rig4: rig4!,
    pts: pts!,
  };
}

export type DesignId =
  | 'frigate'
  | 'heavy-frigate'
  | 'light-frigate'
  | 'corvette'
  | 'heavy-corvette'
  | 'sloop'
  | 'cutter'
  | 'brig'
  | 'fifty'
  | 'seventy-four'
  | 'merchantman';

export interface Design {
  id: DesignId;
  /** What a sailor would call her: "frigate", "brig", "two-decker". */
  kind: string;
  spec: ShipSpec;
}

export const DESIGNS: Record<DesignId, Design> = {
  // Row 21: a 40-gun frigate. The player's ship, before her crew and refits change her.
  frigate: {
    id: 'frigate',
    kind: 'frigate',
    spec: spec(4, 6, 3, 40, 3, 15, 3, 8, 6, 6, 6, 6, 4, 4, 5, 5, 5, 5, 15),
  },
  // Row 65: a heavy 44 with long guns.
  'heavy-frigate': {
    id: 'heavy-frigate',
    kind: 'heavy frigate',
    spec: spec(4, 6, 3, 44, 3, 15, 4, 8, 8, 6, 10, 10, 2, 2, 6, 6, 6, 6, 20),
  },
  // Row 18: a small 32.
  'light-frigate': {
    id: 'light-frigate',
    kind: 'frigate',
    spec: spec(4, 6, 3, 32, 3, 8, 3, 4, 2, 2, 4, 4, 2, 2, 5, 5, 5, 5, 9),
  },
  // Row 22: a 36-gun corvette.
  corvette: {
    id: 'corvette',
    kind: 'corvette',
    spec: spec(4, 7, 3, 36, 4, 11, 3, 6, 6, 4, 4, 4, 2, 2, 5, 5, 5, 5, 11),
  },
  // Row 35: a heavily armed corvette.
  'heavy-corvette': {
    id: 'heavy-corvette',
    kind: 'corvette',
    spec: spec(4, 7, 3, 38, 4, 14, 4, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 19),
  },
  // Row 42: a fast sloop that carries only carronades.
  sloop: {
    id: 'sloop',
    kind: 'sloop',
    spec: spec(4, 7, 3, 20, 5, 6, 5, 4, 2, 2, 0, 0, 6, 6, 4, 4, 4, 4, 12),
  },
  // Row 0: a sloop with long guns.
  cutter: {
    id: 'cutter',
    kind: 'sloop',
    spec: spec(4, 7, 3, 19, 5, 5, 4, 2, 2, 2, 2, 2, 0, 0, 4, 4, 4, 4, 7),
  },
  // Row 59: a small brig.
  brig: {
    id: 'brig',
    kind: 'brig',
    spec: spec(4, 7, 3, 11, 6, 3, 4, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 5),
  },
  // Row 13: a 50-gun two-decker.
  fifty: {
    id: 'fifty',
    kind: 'two-decker',
    spec: spec(3, 5, 2, 50, 2, 14, 3, 6, 6, 4, 8, 8, 0, 0, 6, 6, 6, -1, 14),
  },
  // Row 5: a 74, the ship of the line.
  'seventy-four': {
    id: 'seventy-four',
    kind: 'ship of the line',
    spec: spec(3, 5, 2, 74, 2, 20, 4, 8, 8, 8, 16, 16, 2, 2, 7, 7, 7, -1, 26),
  },
  // Our own design: a deep-laden merchant ship that sails slowly and fights little.
  merchantman: {
    id: 'merchantman',
    kind: 'merchantman',
    spec: spec(3, 5, 2, 12, 4, 8, 2, 2, 2, 2, 2, 2, 0, 0, 4, 4, 4, 4, 6),
  },
};

/**
 * Wind effects, [windspeed 0..6][class - 1] = [A, B, C, D]: the allowance lost on the quarter,
 * before the wind, on the beam and close-hauled. Row 0 (no wind) is never read.
 */
export const WIND_EFFECTS: readonly (readonly (readonly number[])[])[] = [
  [
    [9, 9, 9, 9],
    [9, 9, 9, 9],
    [9, 9, 9, 9],
    [9, 9, 9, 9],
    [9, 9, 9, 9],
    [9, 9, 9, 9],
  ],
  [
    [3, 2, 2, 0],
    [3, 2, 1, 0],
    [3, 2, 1, 0],
    [3, 2, 1, 0],
    [2, 1, 0, 0],
    [2, 1, 0, 0],
  ],
  [
    [1, 1, 1, 0],
    [1, 1, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 0, 0],
    [1, 1, 0, 0],
    [2, 2, 1, 0],
    [2, 2, 1, 0],
  ],
  [
    [1, 0, 0, 0],
    [1, 1, 0, 0],
    [1, 1, 1, 0],
    [1, 1, 1, 0],
    [3, 2, 2, 0],
    [3, 2, 2, 0],
  ],
  [
    [2, 1, 1, 0],
    [3, 2, 1, 0],
    [3, 2, 1, 0],
    [3, 2, 1, 0],
    [3, 3, 2, 0],
    [3, 3, 2, 0],
  ],
];

/** Damage from a broadside aimed at the rigging: [hits 0..10][d6 - 1] = [hull, guns, crew, rig]. */
export const RIG_TABLE: readonly (readonly (readonly number[])[])[] = [
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
  ],
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
    [1, 0, 0, 1],
    [0, 1, 1, 1],
  ],
  [
    [0, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 1],
    [0, 1, 0, 1],
    [0, 1, 0, 1],
    [1, 0, 1, 2],
  ],
  [
    [0, 0, 0, 0],
    [0, 0, 1, 1],
    [0, 1, 0, 1],
    [0, 0, 0, 2],
    [0, 1, 0, 2],
    [1, 0, 1, 2],
  ],
  [
    [0, 1, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 2],
    [0, 1, 0, 2],
    [0, 0, 1, 3],
    [1, 0, 1, 4],
  ],
  [
    [0, 0, 1, 1],
    [0, 1, 0, 2],
    [1, 0, 0, 3],
    [0, 1, 1, 3],
    [1, 0, 0, 4],
    [1, 1, 1, 4],
  ],
  [
    [0, 0, 1, 2],
    [0, 1, 1, 2],
    [1, 1, 0, 3],
    [0, 1, 0, 4],
    [1, 0, 0, 4],
    [1, 0, 1, 5],
  ],
  [
    [0, 0, 1, 2],
    [0, 1, 0, 3],
    [1, 1, 0, 3],
    [1, 0, 2, 4],
    [0, 2, 1, 5],
    [2, 1, 0, 5],
  ],
  [
    [0, 2, 1, 3],
    [1, 0, 0, 3],
    [2, 1, 0, 4],
    [0, 1, 1, 4],
    [0, 1, 0, 5],
    [1, 0, 2, 6],
  ],
  [
    [1, 1, 0, 4],
    [1, 0, 1, 4],
    [2, 0, 0, 5],
    [0, 2, 1, 5],
    [0, 1, 2, 6],
    [0, 2, 0, 7],
  ],
  [
    [1, 0, 1, 5],
    [0, 2, 0, 6],
    [1, 2, 0, 6],
    [1, 1, 1, 6],
    [2, 0, 2, 6],
    [1, 1, 2, 7],
  ],
];

/** Damage from a broadside aimed at the hull, laid out like RIG_TABLE. */
export const HULL_TABLE: readonly (readonly (readonly number[])[])[] = [
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 1, 0, 0],
  ],
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [1, 1, 0, 0],
    [1, 0, 1, 0],
    [1, 0, 1, 1],
  ],
  [
    [0, 1, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 0, 0],
    [1, 0, 1, 0],
    [1, 0, 1, 1],
    [2, 1, 0, 0],
  ],
  [
    [0, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [2, 0, 0, 1],
    [2, 0, 1, 0],
    [2, 2, 0, 0],
  ],
  [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [2, 1, 0, 1],
    [2, 2, 1, 0],
    [3, 0, 1, 0],
    [3, 1, 0, 0],
  ],
  [
    [1, 1, 1, 0],
    [2, 0, 2, 1],
    [2, 1, 1, 0],
    [2, 2, 0, 0],
    [3, 1, 0, 1],
    [3, 1, 1, 0],
  ],
  [
    [1, 2, 2, 0],
    [2, 0, 2, 1],
    [2, 1, 0, 1],
    [2, 2, 0, 0],
    [3, 1, 1, 0],
    [4, 2, 1, 0],
  ],
  [
    [2, 1, 1, 0],
    [2, 0, 1, 1],
    [3, 2, 2, 0],
    [3, 2, 0, 0],
    [4, 2, 1, 0],
    [4, 2, 1, 1],
  ],
  [
    [2, 1, 2, 0],
    [3, 1, 1, 1],
    [3, 2, 2, 0],
    [4, 2, 1, 0],
    [4, 1, 0, 2],
    [4, 2, 2, 0],
  ],
  [
    [2, 3, 1, 0],
    [3, 2, 2, 0],
    [3, 2, 2, 1],
    [4, 2, 2, 0],
    [4, 1, 0, 3],
    [5, 1, 2, 0],
  ],
  [
    [2, 2, 4, 0],
    [3, 3, 1, 1],
    [4, 2, 1, 1],
    [5, 1, 0, 2],
    [5, 1, 2, 1],
    [6, 2, 2, 0],
  ],
];

/** To-hit modifiers by shot, [broadside size row][load - 1]: grape, chain, round, double. */
export const AMMO: readonly (readonly number[])[] = [
  [-1, 1, 0, 1],
  [-1, 1, 0, 1],
  [-1, 1, 0, 1],
  [-2, 1, 0, 2],
  [-2, 2, 0, 2],
  [-2, 2, 0, 2],
  [-3, 2, 0, 2],
  [-3, 2, 0, 3],
  [-3, 2, 0, 3],
];

/** Hits by [broadside size row][range - 1], for an ordinary broadside. */
export const HIT_BY_RANGE: readonly (readonly number[])[] = [
  [1, 0, -1, -2, -3, -3, -4, -4, -4, -4],
  [1, 1, 0, -1, -2, -2, -3, -3, -3, -3],
  [2, 1, 0, -1, -2, -2, -3, -3, -3, -3],
  [2, 2, 1, 0, -1, -1, -2, -2, -2, -2],
  [3, 2, 1, 0, -1, -1, -2, -2, -2, -2],
  [3, 3, 2, 1, 0, 0, -1, -1, -1, -1],
  [4, 3, 2, 1, 0, 0, -1, -1, -1, -1],
  [4, 4, 3, 2, 1, 1, 0, 0, 0, 0],
  [5, 4, 3, 2, 1, 1, 0, 0, 0, 0],
];

/** The same for a raking broadside, fired down the enemy's length. */
export const HIT_BY_RANGE_RAKING: readonly (readonly number[])[] = [
  [2, 1, 0, -1, -2, -2, -3, -3, -3, -3],
  [2, 2, 1, 0, -1, -1, -2, -2, -2, -2],
  [3, 2, 1, 0, -1, -1, -2, -2, -2, -2],
  [4, 3, 2, 1, 0, 0, -1, -1, -1, -1],
  [5, 4, 3, 2, 1, 1, 0, 0, 0, 0],
  [6, 5, 4, 3, 2, 2, 1, 1, 1, 1],
  [7, 6, 5, 4, 3, 3, 2, 2, 2, 2],
  [8, 7, 6, 5, 4, 4, 3, 3, 3, 3],
  [9, 8, 7, 6, 5, 5, 4, 4, 4, 4],
];

/** Crew-quality modifiers, [broadside size row][quality - 1]. */
export const QUALITY: readonly (readonly number[])[] = [
  [-1, 0, 0, 1, 1],
  [-1, 0, 0, 1, 1],
  [-1, 0, 0, 1, 2],
  [-1, 0, 0, 1, 2],
  [-1, 0, 0, 2, 2],
  [-1, -1, 0, 2, 2],
  [-2, -1, 0, 2, 2],
  [-2, -1, 0, 2, 2],
  [-2, -1, 0, 2, 3],
];

/** Hands put out of action in one round of a boarding fight, [strength row][roll band]. */
export const MELEE: readonly (readonly number[])[] = [
  [1, 0, 0],
  [1, 1, 0],
  [2, 1, 0],
  [2, 1, 1],
  [2, 2, 1],
  [3, 2, 1],
  [3, 2, 2],
  [4, 3, 2],
  [4, 4, 2],
];
