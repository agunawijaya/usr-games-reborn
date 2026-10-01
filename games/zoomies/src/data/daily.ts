import { createRng, weekdayIndex } from '@usr-games/kit';
import { type Blueprint, findRoom, type GeneratedRoom } from '../engine/generate';
import type { Furniture } from '../engine/types';
import type { RoomTheme } from './blueprints';

/**
 * Today's Mess: one room a day, the same for everyone. Each weekday has its own crowd, and the
 * day's seed picks the room's furniture and places everything; the solver then proves the par.
 */

interface DailyPlan {
  readonly theme: RoomTheme;
  readonly label: string;
  readonly vacuums: Blueprint['vacuums'];
  readonly clutter?: Blueprint['clutter'];
  readonly dock?: Blueprint['dock'];
}

/** Monday first, as the kit counts weekdays. */
const WEEK: readonly DailyPlan[] = [
  { theme: 'laundry', label: 'Sock Monday', vacuums: { basic: 6 }, clutter: { sock: 3 } },
  { theme: 'bathroom', label: 'Mop Tuesday', vacuums: { basic: 3, mop: 3 } },
  { theme: 'bedroom', label: 'Sleepy Wednesday', vacuums: { basic: 4, slow: 3 } },
  { theme: 'kids', label: 'Turbo Thursday', vacuums: { basic: 5, turbo: 1 }, clutter: { sock: 2 } },
  {
    theme: 'garage',
    label: 'Shop-vac Friday',
    vacuums: { basic: 5, sweeper: 2 },
    clutter: { cable: 2 },
  },
  {
    theme: 'conservatory',
    label: 'Dock Saturday',
    vacuums: { basic: 3 },
    dock: { every: 4, count: 3 },
  },
  {
    theme: 'living',
    label: 'Sunday mix',
    vacuums: { basic: 3, mop: 1, slow: 1, turbo: 1 },
    clutter: { sock: 1 },
  },
];

const FURNITURE_SETS: readonly (readonly Furniture[])[] = [
  [{ kind: 'sofa', x: 5, y: 8, w: 4, h: 1 }],
  [{ kind: 'table', x: 6, y: 3, w: 2, h: 2 }],
  [
    { kind: 'plant', x: 3, y: 2, w: 1, h: 1 },
    { kind: 'plant', x: 10, y: 6, w: 1, h: 1 },
  ],
  [{ kind: 'shelf', x: 0, y: 0, w: 4, h: 1 }],
  [
    { kind: 'armchair', x: 11, y: 0, w: 2, h: 2 },
    { kind: 'plant', x: 2, y: 7, w: 1, h: 1 },
  ],
];

export const DAILY_PAR: readonly [number, number] = [9, 16];

export interface DailyRoom extends GeneratedRoom {
  readonly theme: RoomTheme;
  readonly label: string;
}

export function dailyBlueprint(
  dateKey: string,
  seed: string,
): { plan: DailyPlan; blueprint: Blueprint } {
  const plan = WEEK[weekdayIndex(dateKey)]!;
  const rng = createRng(`${seed}/furniture`);
  return {
    plan,
    blueprint: {
      width: 14,
      height: 9,
      furniture: rng.pick(FURNITURE_SETS),
      vacuums: plan.vacuums,
      ...(plan.clutter ? { clutter: plan.clutter } : {}),
      ...(plan.dock ? { dock: plan.dock } : {}),
      par: DAILY_PAR,
    },
  };
}

/** Deterministic for a date and seed: every player gets the same room and the same par. */
export function dailyRoom(dateKey: string, seed: string): DailyRoom | null {
  const { plan, blueprint } = dailyBlueprint(dateKey, seed);
  const found = findRoom(blueprint, seed, { maxCandidates: 600, maxNodes: 300_000 });
  return found ? { ...found, theme: plan.theme, label: plan.label } : null;
}
