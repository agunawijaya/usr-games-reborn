import type { Arena } from '../engine/arena';

/**
 * Harbour Lights — our own design. Two beacons over the hills feed a third above the harbour,
 * which lines planes up for the south-facing runway; a second runway takes arrivals from the sea.
 */
export const HARBOUR_LIGHTS: Arena = {
  id: 'harbour-lights',
  name: 'Harbour Lights',
  width: 30,
  height: 21,
  tickSeconds: 5,
  spawnOneIn: 8,
  gates: [
    { x: 0, y: 6, heading: 2 },
    { x: 8, y: 0, heading: 4 },
    { x: 20, y: 0, heading: 4 },
    { x: 29, y: 6, heading: 6 },
    { x: 29, y: 14, heading: 6 },
    { x: 29, y: 20, heading: 7 },
    { x: 6, y: 20, heading: 1 },
    { x: 0, y: 12, heading: 2 },
  ],
  beacons: [
    { x: 8, y: 6 },
    { x: 20, y: 6 },
    { x: 14, y: 12 },
  ],
  runways: [
    { x: 14, y: 16, heading: 4 },
    { x: 23, y: 14, heading: 6 },
  ],
  airways: [
    { from: { x: 1, y: 6 }, to: { x: 7, y: 6 } },
    { from: { x: 8, y: 1 }, to: { x: 8, y: 5 } },
    { from: { x: 9, y: 6 }, to: { x: 19, y: 6 } },
    { from: { x: 20, y: 1 }, to: { x: 20, y: 5 } },
    { from: { x: 21, y: 6 }, to: { x: 28, y: 6 } },
    { from: { x: 9, y: 7 }, to: { x: 13, y: 11 } },
    { from: { x: 19, y: 7 }, to: { x: 15, y: 11 } },
    { from: { x: 1, y: 12 }, to: { x: 13, y: 12 } },
    { from: { x: 14, y: 13 }, to: { x: 14, y: 15 } },
    { from: { x: 7, y: 19 }, to: { x: 13, y: 13 } },
    { from: { x: 24, y: 14 }, to: { x: 28, y: 14 } },
    { from: { x: 28, y: 19 }, to: { x: 24, y: 15 } },
  ],
  scenery: { seed: 'harbour-lights', coast: 'east', relief: 0.55 },
};
