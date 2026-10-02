// The Sea Service: ten actions of one captain's career, each a historical scenario fought from a
// chosen ship with a fixed seed and three commendations. Seeds were chosen with
// scripts/counsel-sweep.mjs so that the first lieutenant's counsel wins every action, and
// thresholds so that it also earns at least one more star; 22 of the 30 are proven reachable by
// the counsel alone (docs/NOTES.md). The briefings are ours; the ship names are history's.

/**
 * @typedef {import('./commendations.js').Commendation} Commendation
 * @typedef {{ id: string, number: number, title: string, scenarioId: number, ship: number,
 *   year: number, briefing: string, seed: number, commendations: Commendation[] }} Action
 */

/** @type {Action[]} */
export const ACTIONS = [
  {
    id: 'first-command', number: 1, title: 'First Command', scenarioId: 7, ship: 0, year: 1799,
    briefing: 'Your first frigate, a fresh Caribbean blow and a French frigate off Nevis. Close her, and bring your new crew through it.',
    seed: 68,
    commendations: [{ kind: 'win' }, { kind: 'turns', within: 12 }, { kind: 'rakes', atLeast: 1 }],
  },
  {
    id: 'long-guns', number: 2, title: 'The Long Guns', scenarioId: 11, ship: 0, year: 1812,
    briefing: 'A heavy frigate against a lighter one in the open Atlantic. You have the weight of metal and the men: use both.',
    seed: 75,
    commendations: [{ kind: 'win' }, { kind: 'boarded' }, { kind: 'turns', within: 6 }],
  },
  {
    id: 'in-a-gale', number: 3, title: 'In a Gale', scenarioId: 10, ship: 0, year: 1812,
    briefing: 'A gale is blowing south-east of Halifax and the seas are heavy. Your flush-decked frigate can still fight every gun.',
    seed: 107,
    commendations: [{ kind: 'win' }, { kind: 'crew', atLeast: 75 }, { kind: 'rakes', atLeast: 1 }],
  },
  {
    id: 'one-against-two', number: 4, title: 'One Against Two', scenarioId: 16, ship: 0, year: 1815,
    briefing: 'Two sloops off Madeira, and the moon rising. Take one, then turn on the other before she slips away.',
    seed: 52,
    commendations: [{ kind: 'win' }, { kind: 'prizes', atLeast: 2 }, { kind: 'hull', atLeast: 60 }],
  },
  {
    id: 'a-drilled-crew', number: 5, title: 'A Drilled Crew', scenarioId: 13, ship: 1, year: 1813,
    briefing: 'Seven years of gunnery drill come down to one afternoon off Boston light. Rake her, and finish it quickly.',
    seed: 53,
    commendations: [{ kind: 'win' }, { kind: 'rakes', atLeast: 2 }, { kind: 'hull', atLeast: 70 }],
  },
  {
    id: 'off-the-gironde', number: 6, title: 'Off the Gironde', scenarioId: 6, ship: 0, year: 1798,
    briefing: 'A corvette half your size dares to close you in December weather. Keep your spars standing and teach her better.',
    seed: 35,
    commendations: [{ kind: 'win' }, { kind: 'masts' }, { kind: 'boarded' }],
  },
  {
    id: 'first-frigate-action', number: 7, title: 'The First Frigate Action', scenarioId: 4, ship: 0, year: 1793,
    briefing: 'The war is weeks old, and a French frigate of equal force waits off Start Point. Lay her aboard if she lets you.',
    seed: 27,
    commendations: [{ kind: 'win' }, { kind: 'boarded' }, { kind: 'hull', atLeast: 70 }],
  },
  {
    id: 'a-night-action', number: 8, title: 'A Night Action', scenarioId: 8, ship: 0, year: 1800,
    briefing: 'A heavier French frigate off Guadeloupe, and only the flashes of the guns to see her by. Fight her through the night.',
    seed: 46,
    commendations: [{ kind: 'win' }, { kind: 'hull', atLeast: 70 }, { kind: 'turns', within: 12 }],
  },
  {
    id: 'yardarm-to-yardarm', number: 9, title: 'Yardarm to Yardarm', scenarioId: 5, ship: 0, year: 1798,
    briefing: 'Two ships of the line of equal force, side by side in the fading light. Neither will give way; make sure yours stands.',
    seed: 47,
    commendations: [{ kind: 'win' }, { kind: 'masts' }, { kind: 'hull', atLeast: 50 }],
  },
  {
    id: 'against-two-frigates', number: 10, title: 'Against Two Frigates', scenarioId: 17, ship: 2, year: 1797,
    briefing: 'Your seventy-four on a lee shore, two frigates snapping at you and the seas rising. The last action of your service.',
    seed: 89,
    commendations: [{ kind: 'win' }, { kind: 'prizes', atLeast: 2 }, { kind: 'hull', atLeast: 70 }],
  },
];

export const SERVICE_STARS = ACTIONS.length * 3;

export function actionById(id) {
  return ACTIONS.find((action) => action.id === id) ?? null;
}

export function actionAfter(action) {
  return ACTIONS.find((next) => next.number === action.number + 1) ?? null;
}
