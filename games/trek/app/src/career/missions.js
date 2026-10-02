// Deep Space Command — the Frontier Tour's ten sorties and the daily patrol's setup.
//
// The engine builds a galaxy from a named preset in galaxy.js's DIFFICULTY table, and galaxy.js
// must stay byte-identical to the baseline (tests/baseline-regression.test.js). So the tour adds
// its own presets to that table here, at load time, instead of changing the generator: a sortie
// is just another named preset plus a fixed seed. Seeds were chosen by scripts/tour-search.mjs so
// that the autopilot wins every sortie with time to spare (see docs/NOTES.md).

import { DIFFICULTY } from '../galaxy.js';

/**
 * @typedef {import('./orders.js').Commendation} Commendation
 * @typedef {{ id: string, number: number, name: string, briefing: string,
 *   setup: { klingons: number, starbases: number, stars: number, stardates: number },
 *   seed: number, commendations: Commendation[] }} Sortie
 */

/** @type {Sortie[]} */
export const SORTIES = [
  {
    id: 'shakedown',
    number: 1,
    name: 'Shakedown Cruise',
    briefing: 'A handful of raiders has slipped past the frontier pickets. Take her out, learn the controls, bring her back in one piece.',
    setup: { klingons: 4, starbases: 3, stars: 15, stardates: 30 },
    seed: 328,
    commendations: [{ kind: 'win' }, { kind: 'hull', atLeast: 75 }, { kind: 'orders', under: 30 }],
  },
  {
    id: 'picket',
    number: 2,
    name: 'Picket Duty',
    briefing: 'Six ships are probing the line. Starbases are standing by, but a picket that keeps running home is no picket at all.',
    setup: { klingons: 6, starbases: 3, stars: 20, stardates: 30 },
    seed: 235,
    commendations: [{ kind: 'win' }, { kind: 'noDock' }, { kind: 'spare', stardates: 10 }],
  },
  {
    id: 'torpedo-school',
    number: 3,
    name: 'Torpedo School',
    briefing: 'Gunnery wants to see the tubes earn their keep. Line up your shots: a torpedo stops any hull it meets.',
    setup: { klingons: 6, starbases: 2, stars: 20, stardates: 30 },
    seed: 235,
    commendations: [{ kind: 'win' }, { kind: 'torpedoKills', atLeast: 3 }, { kind: 'hull', atLeast: 60 }],
  },
  {
    id: 'long-haul',
    number: 4,
    name: 'The Long Haul',
    briefing: 'Nine raiders scattered across the whole chart and only two starbases to lean on. Map it as you go.',
    setup: { klingons: 9, starbases: 2, stars: 25, stardates: 34 },
    seed: 312,
    commendations: [{ kind: 'win' }, { kind: 'charted', atLeast: 30 }, { kind: 'noDock' }],
  },
  {
    id: 'no-harbour',
    number: 5,
    name: 'No Harbour',
    briefing: 'Every starbase in this sector has been pulled back. What you leave with is all you will have.',
    setup: { klingons: 7, starbases: 0, stars: 20, stardates: 30 },
    seed: 304,
    commendations: [{ kind: 'win' }, { kind: 'energy', atLeast: 3000 }, { kind: 'hull', atLeast: 50 }],
  },
  {
    id: 'phaser-drill',
    number: 6,
    name: 'Phaser Drill',
    briefing: 'The torpedo stores are being refitted. Ten ships, and the phaser banks will have to do the work.',
    setup: { klingons: 10, starbases: 3, stars: 25, stardates: 30 },
    seed: 336,
    commendations: [{ kind: 'win' }, { kind: 'torpedoes', atMost: 0 }, { kind: 'orders', under: 60 }],
  },
  {
    id: 'close-quarters',
    number: 7,
    name: 'Close Quarters',
    briefing: 'A crowded, star-thick sector. Twelve ships hiding in the clutter, and every shot passes close to a sun.',
    setup: { klingons: 12, starbases: 3, stars: 34, stardates: 30 },
    seed: 324,
    commendations: [{ kind: 'win' }, { kind: 'hull', atLeast: 50 }, { kind: 'spare', stardates: 6 }],
  },
  {
    id: 'race-the-clock',
    number: 8,
    name: 'Race the Clock',
    briefing: 'Twelve ships, and the convoy they are hunting arrives in twenty-four stardates. Plan every warp.',
    setup: { klingons: 12, starbases: 3, stars: 25, stardates: 24 },
    seed: 336,
    commendations: [{ kind: 'win' }, { kind: 'spare', stardates: 5 }, { kind: 'noDock' }],
  },
  {
    id: 'siege',
    number: 9,
    name: 'The Siege',
    briefing: 'Sixteen ships are massing on the border. Four starbases, and you will need all of them.',
    setup: { klingons: 16, starbases: 4, stars: 25, stardates: 34 },
    seed: 57,
    commendations: [{ kind: 'win' }, { kind: 'hull', atLeast: 40 }, { kind: 'orders', under: 90 }],
  },
  {
    id: 'deep-space',
    number: 10,
    name: 'Deep Space',
    briefing: 'The whole raiding fleet, twenty strong, far beyond the frontier. The last sortie of the tour.',
    setup: { klingons: 20, starbases: 3, stars: 30, stardates: 34 },
    seed: 711,
    commendations: [{ kind: 'win' }, { kind: 'hull', atLeast: 50 }, { kind: 'spare', stardates: 3 }],
  },
];

/** The daily patrol: between the novice and standard presets. */
export const PATROL_SETUP = { klingons: 12, starbases: 3, stars: 25, stardates: 30 };

export const TOUR_STARS = SORTIES.length * 3;

/** The preset name a sortie or the patrol registers in galaxy.js's table. */
export const sortiePreset = (sortie) => `tour-${sortie.id}`;
export const PATROL_PRESET = 'daily-patrol';

for (const sortie of SORTIES) {
  DIFFICULTY[sortiePreset(sortie)] = {
    ...sortie.setup,
    name: sortie.name,
    desc: `${sortie.setup.klingons} ships, ${sortie.setup.stardates} stardates`,
  };
}
DIFFICULTY[PATROL_PRESET] = {
  ...PATROL_SETUP,
  name: 'Daily Patrol',
  desc: `${PATROL_SETUP.klingons} ships, ${PATROL_SETUP.stardates} stardates`,
};

export function sortieById(id) {
  return SORTIES.find((sortie) => sortie.id === id) ?? null;
}
