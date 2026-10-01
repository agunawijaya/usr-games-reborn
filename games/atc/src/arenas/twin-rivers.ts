import type { Arena } from '../engine/arena';

/**
 * Twin Rivers — our own design. Two parallel west-facing runways three cells apart, fed from the
 * east by two approach beacons: the arena where landings can follow each other tick after tick.
 */
export const TWIN_RIVERS: Arena = {
  id: 'twin-rivers',
  name: 'Twin Rivers',
  width: 30,
  height: 21,
  tickSeconds: 4,
  spawnOneIn: 9,
  gates: [
    { x: 29, y: 4, heading: 5 },
    { x: 29, y: 15, heading: 7 },
    { x: 0, y: 5, heading: 2 },
    { x: 0, y: 14, heading: 2 },
    { x: 10, y: 0, heading: 4 },
    { x: 10, y: 20, heading: 0 },
    { x: 22, y: 0, heading: 4 },
    { x: 22, y: 20, heading: 0 },
  ],
  beacons: [
    { x: 25, y: 8 },
    { x: 25, y: 11 },
    { x: 10, y: 10 },
  ],
  runways: [
    { x: 18, y: 8, heading: 6 },
    { x: 18, y: 11, heading: 6 },
  ],
  airways: [
    { from: { x: 28, y: 5 }, to: { x: 26, y: 7 } },
    { from: { x: 28, y: 14 }, to: { x: 26, y: 12 } },
    { from: { x: 19, y: 8 }, to: { x: 24, y: 8 } },
    { from: { x: 19, y: 11 }, to: { x: 24, y: 11 } },
    { from: { x: 1, y: 5 }, to: { x: 5, y: 5 } },
    { from: { x: 5, y: 5 }, to: { x: 9, y: 9 } },
    { from: { x: 1, y: 14 }, to: { x: 5, y: 14 } },
    { from: { x: 5, y: 14 }, to: { x: 9, y: 10 } },
    { from: { x: 10, y: 1 }, to: { x: 10, y: 9 } },
    { from: { x: 10, y: 11 }, to: { x: 10, y: 19 } },
    { from: { x: 11, y: 10 }, to: { x: 17, y: 10 } },
  ],
  scenery: { seed: 'twin-rivers', coast: 'south', relief: 0.35 },
};
