import type { Arena } from '../engine/arena';

/**
 * Skyloom's own arenas, one or more for each idea the shifts teach. All are original designs;
 * gates sit on the border facing in, beacons and runways inside, airways run straight or at 45°.
 */

/** The tutorial and the first shift: one runway, three ways in, one beacon. */
export const FIRST_LIGHT: Arena = {
  id: 'first-light',
  name: 'First Light',
  width: 20,
  height: 14,
  tickSeconds: 6,
  spawnOneIn: 14,
  gates: [
    { x: 0, y: 4, heading: 2 },
    { x: 19, y: 10, heading: 6 },
    { x: 9, y: 0, heading: 4 },
  ],
  beacons: [{ x: 9, y: 4 }],
  runways: [{ x: 11, y: 10, heading: 6 }],
  airways: [
    { from: { x: 1, y: 4 }, to: { x: 8, y: 4 } },
    { from: { x: 9, y: 1 }, to: { x: 9, y: 3 } },
    { from: { x: 10, y: 5 }, to: { x: 14, y: 9 } },
    { from: { x: 12, y: 10 }, to: { x: 18, y: 10 } },
  ],
  scenery: { seed: 'first-light', coast: 'south', relief: 0.3 },
};

/** Two ways out on each side, one runway between them. */
export const TWO_GATES: Arena = {
  id: 'two-gates',
  name: 'Two Gates',
  width: 24,
  height: 16,
  tickSeconds: 5,
  spawnOneIn: 11,
  gates: [
    { x: 0, y: 3, heading: 2 },
    { x: 23, y: 3, heading: 6 },
    { x: 0, y: 12, heading: 2 },
    { x: 23, y: 12, heading: 6 },
  ],
  beacons: [{ x: 12, y: 3 }],
  runways: [{ x: 12, y: 8, heading: 4 }],
  airways: [
    { from: { x: 1, y: 3 }, to: { x: 11, y: 3 } },
    { from: { x: 13, y: 3 }, to: { x: 22, y: 3 } },
    { from: { x: 12, y: 4 }, to: { x: 12, y: 7 } },
    { from: { x: 1, y: 12 }, to: { x: 22, y: 12 } },
  ],
  scenery: { seed: 'two-gates', relief: 0.45 },
};

/** Three beacons in a row, the backbone every route leans on. */
export const BEACON_ROW: Arena = {
  id: 'beacon-row',
  name: 'Beacon Row',
  width: 26,
  height: 18,
  tickSeconds: 5,
  spawnOneIn: 10,
  gates: [
    { x: 0, y: 9, heading: 2 },
    { x: 25, y: 9, heading: 6 },
    { x: 13, y: 0, heading: 4 },
    { x: 13, y: 17, heading: 0 },
  ],
  beacons: [
    { x: 6, y: 9 },
    { x: 13, y: 9 },
    { x: 20, y: 9 },
  ],
  runways: [{ x: 13, y: 13, heading: 6 }],
  airways: [
    { from: { x: 1, y: 9 }, to: { x: 5, y: 9 } },
    { from: { x: 7, y: 9 }, to: { x: 12, y: 9 } },
    { from: { x: 14, y: 9 }, to: { x: 19, y: 9 } },
    { from: { x: 21, y: 9 }, to: { x: 24, y: 9 } },
    { from: { x: 13, y: 1 }, to: { x: 13, y: 8 } },
    { from: { x: 14, y: 13 }, to: { x: 18, y: 13 } },
    { from: { x: 20, y: 10 }, to: { x: 18, y: 12 } },
  ],
  scenery: { seed: 'beacon-row', coast: 'north', relief: 0.5 },
};

/** Two towns, two runways facing each other across a valley. */
export const TWO_TOWNS: Arena = {
  id: 'two-towns',
  name: 'Two Towns',
  width: 28,
  height: 18,
  tickSeconds: 5,
  spawnOneIn: 9,
  gates: [
    { x: 14, y: 0, heading: 4 },
    { x: 14, y: 17, heading: 0 },
    { x: 0, y: 3, heading: 3 },
    { x: 27, y: 14, heading: 7 },
  ],
  beacons: [
    { x: 14, y: 5 },
    { x: 14, y: 12 },
  ],
  runways: [
    { x: 8, y: 9, heading: 2 },
    { x: 20, y: 9, heading: 6 },
  ],
  airways: [
    { from: { x: 14, y: 1 }, to: { x: 14, y: 4 } },
    { from: { x: 14, y: 13 }, to: { x: 14, y: 16 } },
    { from: { x: 1, y: 4 }, to: { x: 4, y: 7 } },
    { from: { x: 26, y: 13 }, to: { x: 23, y: 10 } },
    { from: { x: 2, y: 9 }, to: { x: 7, y: 9 } },
    { from: { x: 21, y: 9 }, to: { x: 25, y: 9 } },
  ],
  scenery: { seed: 'two-towns', relief: 0.65 },
};

/** A coast at night: two runways, one facing the sea, one the hills. */
export const LANTERN_COAST: Arena = {
  id: 'lantern-coast',
  name: 'Lantern Coast',
  width: 30,
  height: 20,
  tickSeconds: 5,
  spawnOneIn: 8,
  gates: [
    { x: 0, y: 6, heading: 2 },
    { x: 0, y: 15, heading: 2 },
    { x: 29, y: 3, heading: 6 },
    { x: 29, y: 17, heading: 6 },
    { x: 15, y: 0, heading: 4 },
  ],
  beacons: [
    { x: 10, y: 6 },
    { x: 20, y: 12 },
  ],
  runways: [
    { x: 10, y: 12, heading: 0 },
    { x: 20, y: 6, heading: 4 },
  ],
  airways: [
    { from: { x: 1, y: 6 }, to: { x: 9, y: 6 } },
    { from: { x: 10, y: 13 }, to: { x: 10, y: 17 } },
    { from: { x: 20, y: 1 }, to: { x: 20, y: 5 } },
    { from: { x: 21, y: 12 }, to: { x: 28, y: 12 } },
    { from: { x: 11, y: 7 }, to: { x: 19, y: 15 } },
  ],
  scenery: { seed: 'lantern-coast', coast: 'east', relief: 0.6 },
};

/**
 * Windsock: two runways at right angles. The crosswind shift closes the first halfway through
 * and every arrival is sent to the second.
 */
export const WINDSOCK: Arena = {
  id: 'windsock',
  name: 'Windsock',
  width: 28,
  height: 20,
  tickSeconds: 5,
  spawnOneIn: 9,
  gates: [
    { x: 0, y: 10, heading: 2 },
    { x: 27, y: 10, heading: 6 },
    { x: 14, y: 0, heading: 4 },
    { x: 14, y: 19, heading: 0 },
    { x: 0, y: 0, heading: 3 },
    { x: 27, y: 19, heading: 7 },
  ],
  beacons: [
    { x: 7, y: 10 },
    { x: 21, y: 10 },
    { x: 17, y: 4 },
  ],
  runways: [
    { x: 13, y: 10, heading: 2 },
    { x: 17, y: 8, heading: 4 },
  ],
  airways: [
    { from: { x: 1, y: 10 }, to: { x: 6, y: 10 } },
    { from: { x: 8, y: 10 }, to: { x: 12, y: 10 } },
    { from: { x: 22, y: 10 }, to: { x: 26, y: 10 } },
    { from: { x: 17, y: 5 }, to: { x: 17, y: 7 } },
    { from: { x: 1, y: 1 }, to: { x: 6, y: 6 } },
    { from: { x: 26, y: 18 }, to: { x: 22, y: 14 } },
  ],
  scenery: { seed: 'windsock', relief: 0.4 },
};

/** A long reach of open country: wide enough to strain a short tank. */
export const LONG_REACH: Arena = {
  id: 'long-reach',
  name: 'Long Reach',
  width: 34,
  height: 22,
  tickSeconds: 4,
  spawnOneIn: 8,
  gates: [
    { x: 0, y: 4, heading: 2 },
    { x: 0, y: 17, heading: 2 },
    { x: 33, y: 4, heading: 6 },
    { x: 33, y: 17, heading: 6 },
    { x: 17, y: 0, heading: 4 },
    { x: 17, y: 21, heading: 0 },
  ],
  beacons: [
    { x: 9, y: 11 },
    { x: 25, y: 11 },
  ],
  runways: [{ x: 17, y: 11, heading: 6 }],
  airways: [
    { from: { x: 1, y: 4 }, to: { x: 8, y: 11 } },
    { from: { x: 1, y: 17 }, to: { x: 7, y: 11 } },
    { from: { x: 10, y: 11 }, to: { x: 16, y: 11 } },
    { from: { x: 18, y: 11 }, to: { x: 24, y: 11 } },
    { from: { x: 32, y: 4 }, to: { x: 26, y: 10 } },
    { from: { x: 32, y: 17 }, to: { x: 26, y: 11 } },
  ],
  scenery: { seed: 'long-reach', coast: 'west', relief: 0.35 },
};

/** The last shift's sky: three runways, four beacons, eight gates and three-second ticks. */
export const MIDNIGHT_TOWER: Arena = {
  id: 'midnight-tower',
  name: 'Midnight Tower',
  width: 30,
  height: 21,
  tickSeconds: 3,
  spawnOneIn: 7,
  gates: [
    { x: 0, y: 4, heading: 2 },
    { x: 0, y: 16, heading: 2 },
    { x: 29, y: 4, heading: 6 },
    { x: 29, y: 16, heading: 6 },
    { x: 8, y: 0, heading: 4 },
    { x: 22, y: 0, heading: 4 },
    { x: 8, y: 20, heading: 0 },
    { x: 22, y: 20, heading: 0 },
  ],
  beacons: [
    { x: 8, y: 4 },
    { x: 22, y: 4 },
    { x: 8, y: 16 },
    { x: 22, y: 16 },
  ],
  runways: [
    { x: 11, y: 8, heading: 6 },
    { x: 19, y: 13, heading: 2 },
    { x: 15, y: 17, heading: 0 },
  ],
  airways: [
    { from: { x: 9, y: 4 }, to: { x: 21, y: 4 } },
    { from: { x: 9, y: 16 }, to: { x: 21, y: 16 } },
    { from: { x: 8, y: 5 }, to: { x: 8, y: 15 } },
    { from: { x: 22, y: 5 }, to: { x: 22, y: 15 } },
    { from: { x: 12, y: 8 }, to: { x: 16, y: 8 } },
    { from: { x: 14, y: 13 }, to: { x: 18, y: 13 } },
  ],
  scenery: { seed: 'midnight-tower', coast: 'south', relief: 0.7 },
};
