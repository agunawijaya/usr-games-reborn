// atc/fancy-web — Built-in playfields
// Ported from BSD atc /games/ directory (Ed James's original hand-crafted maps)
// Coordinates are 0-indexed. Directions per engine.js DIR constants.

import { DIR } from './engine.js';

/** DEFAULT — Ed James's reference training map. 30x21 with 7 exits + 3 airports. */
export const DEFAULT_FIELD = {
  name: 'Default',
  displayName: 'KJFK-Approach · Reference Sector',
  width: 30,
  height: 21,
  updateSecs: 5,
  newplaneMean: 5,

  exits: [
    { x: 12, y: 0,  dir: DIR.S,  label: '0' },   // top center
    { x: 29, y: 0,  dir: DIR.SW, label: '1' },   // top-right corner
    { x: 29, y: 7,  dir: DIR.W,  label: '2' },   // right side
    { x: 29, y: 17, dir: DIR.NW, label: '3' },   // bottom-right
    { x: 9,  y: 20, dir: DIR.N,  label: '4' },   // bottom
    { x: 0,  y: 13, dir: DIR.E,  label: '5' },   // left side
    { x: 0,  y: 0,  dir: DIR.SE, label: '6' },   // top-left corner
  ],

  beacons: [
    { x: 12, y: 7,  label: '0' },
    { x: 12, y: 17, label: '1' },
  ],

  airports: [
    { x: 20, y: 15, dir: DIR.W, label: '0' },  // main
    { x: 20, y: 18, dir: DIR.SE, label: '1' }, // regional
  ],

  lines: [
    // visual airways connecting features
    { x1: 12, y1: 0,  x2: 12, y2: 7 },
    { x1: 12, y1: 7,  x2: 29, y2: 7 },
    { x1: 12, y1: 7,  x2: 12, y2: 17 },
    { x1: 12, y1: 17, x2: 9,  y2: 20 },
    { x1: 12, y1: 17, x2: 20, y2: 15 },
    { x1: 0,  y1: 13, x2: 12, y2: 17 },
    { x1: 0,  y1: 0,  x2: 12, y2: 7 },
    { x1: 29, y1: 0,  x2: 12, y2: 7 },
    { x1: 29, y1: 17, x2: 20, y2: 15 },
    { x1: 20, y1: 15, x2: 20, y2: 18 },
  ],
};

/** EASY — A gentler 20x15 sector, 4 exits + 1 airport + 1 beacon. */
export const EASY_FIELD = {
  name: 'Easy',
  displayName: 'KTNG-Approach · Training Sector',
  width: 20,
  height: 15,
  updateSecs: 6,
  newplaneMean: 8,

  exits: [
    { x: 10, y: 0,  dir: DIR.S,  label: '0' },
    { x: 19, y: 7,  dir: DIR.W,  label: '1' },
    { x: 10, y: 14, dir: DIR.N,  label: '2' },
    { x: 0,  y: 7,  dir: DIR.E,  label: '3' },
  ],

  beacons: [
    { x: 10, y: 7,  label: '0' },
  ],

  airports: [
    { x: 5, y: 5, dir: DIR.SE, label: '0' },
  ],

  lines: [
    { x1: 10, y1: 0,  x2: 10, y2: 7 },
    { x1: 10, y1: 7,  x2: 19, y2: 7 },
    { x1: 10, y1: 7,  x2: 10, y2: 14 },
    { x1: 10, y1: 7,  x2: 0,  y2: 7 },
    { x1: 10, y1: 7,  x2: 5,  y2: 5 },
  ],
};

/** KILLER — Ed James's notoriously hard map. Faster ticks, more spawns. */
export const KILLER_FIELD = {
  name: 'Killer',
  displayName: 'KILLER · Advanced Sector',
  width: 30,
  height: 21,
  updateSecs: 3,
  newplaneMean: 3,

  exits: [
    { x: 12, y: 0,  dir: DIR.S,  label: '0' },
    { x: 29, y: 0,  dir: DIR.SW, label: '1' },
    { x: 29, y: 7,  dir: DIR.W,  label: '2' },
    { x: 29, y: 17, dir: DIR.NW, label: '3' },
    { x: 9,  y: 20, dir: DIR.N,  label: '4' },
    { x: 0,  y: 13, dir: DIR.E,  label: '5' },
    { x: 0,  y: 0,  dir: DIR.SE, label: '6' },
  ],

  beacons: [
    { x: 12, y: 7,  label: '0' },
    { x: 12, y: 17, label: '1' },
    { x: 20, y: 10, label: '2' },
  ],

  airports: [
    { x: 20, y: 15, dir: DIR.W,  label: '0' },
    { x: 20, y: 18, dir: DIR.SE, label: '1' },
    { x: 5,  y: 5,  dir: DIR.NE, label: '2' },
  ],

  lines: [
    { x1: 12, y1: 0,  x2: 12, y2: 7 },
    { x1: 12, y1: 7,  x2: 29, y2: 7 },
    { x1: 12, y1: 7,  x2: 20, y2: 10 },
    { x1: 20, y1: 10, x2: 20, y2: 15 },
    { x1: 12, y1: 17, x2: 20, y2: 15 },
    { x1: 20, y1: 15, x2: 20, y2: 18 },
    { x1: 12, y1: 17, x2: 9,  y2: 20 },
    { x1: 0,  y1: 13, x2: 12, y2: 17 },
    { x1: 0,  y1: 0,  x2: 5,  y2: 5 },
    { x1: 5,  y1: 5,  x2: 12, y2: 7 },
    { x1: 29, y1: 17, x2: 20, y2: 15 },
    { x1: 29, y1: 0,  x2: 12, y2: 7 },
  ],
};

export const PLAYFIELDS = {
  easy: EASY_FIELD,
  default: DEFAULT_FIELD,
  killer: KILLER_FIELD,
};
