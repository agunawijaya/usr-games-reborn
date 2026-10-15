import type { Family, Kind } from '../engine/cards';

/**
 * What every card is called and what it does, in Detour's own words. Card names on the faces,
 * the helper's one-line reasons and the screen reader all read from here.
 */

export interface CardCopy {
  name: string;
  /** A second line under the name: the scene on a distance card. */
  sub?: string;
  /** One sentence on what the card does. */
  does: string;
}

export const FAMILY_LABEL: Readonly<Record<Family, string>> = {
  distance: 'Miles',
  hazard: 'Hazard',
  remedy: 'Remedy',
  safety: 'Safety',
};

export const CARD_COPY: Readonly<Record<Kind, CardCopy>> = {
  m25: { name: '25 miles', sub: 'Side street', does: 'Adds 25 miles. Fine in a slow zone.' },
  m50: { name: '50 miles', sub: 'Country lane', does: 'Adds 50 miles. Fine in a slow zone.' },
  m75: {
    name: '75 miles',
    sub: 'Coast road',
    does: 'Adds 75 miles once you are free of any slow zone.',
  },
  m100: {
    name: '100 miles',
    sub: 'Highway',
    does: 'Adds 100 miles once you are free of any slow zone.',
  },
  m200: {
    name: '200 miles',
    sub: 'Open throttle',
    does: 'Adds 200 miles; two per hand at most, and none on a safe trip.',
  },
  noFuel: {
    name: 'Out of Fuel',
    does: 'Stops a rolling rival until they fill up and get a green light.',
  },
  flatTyre: {
    name: 'Flat Tyre',
    does: 'Stops a rolling rival until they fit a spare and get a green light.',
  },
  fenderBender: {
    name: 'Fender Bender',
    does: 'A harmless bump that stops a rolling rival until a mechanic and a green light.',
  },
  redLight: { name: 'Red Light', does: 'Stops a rolling rival until they get a green light.' },
  slowZone: {
    name: 'Slow Zone',
    does: 'Holds a rival to 25s and 50s until they reach an open road.',
  },
  fillUp: { name: 'Fill Up', does: 'Clears Out of Fuel. Then you need a green light.' },
  spareTyre: { name: 'Spare Tyre', does: 'Clears a Flat Tyre. Then you need a green light.' },
  mechanic: { name: 'Mechanic', does: 'Clears a Fender Bender. Then you need a green light.' },
  greenLight: {
    name: 'Green Light',
    does: 'Lets you roll: play it on a red light or after a fix.',
  },
  openRoad: { name: 'Open Road', does: 'Ends a slow zone on your car.' },
  longRangeTank: {
    name: 'Long-Range Tank',
    does: 'Your car never runs out of fuel this hand. Lay it the moment Out of Fuel hits you for a coup fourré.',
  },
  runFlats: {
    name: 'Run-Flat Tyres',
    does: 'No flat tyres for you this hand. Lay it the moment a Flat Tyre hits you for a coup fourré.',
  },
  roadSense: {
    name: 'Road Sense',
    does: 'No fender benders for you this hand. Lay it the moment one hits you for a coup fourré.',
  },
  greenWave: {
    name: 'Green Wave',
    does: 'Every light is green for you this hand: no red lights, no slow zones, no green light needed.',
  },
};

export function cardName(kind: Kind): string {
  return CARD_COPY[kind].name;
}
