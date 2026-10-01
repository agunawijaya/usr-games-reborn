import { CLASSIC_ARENAS } from '../arenas/classic';
import { HARBOUR_LIGHTS } from '../arenas/harbour-lights';
import {
  BEACON_ROW,
  FIRST_LIGHT,
  LANTERN_COAST,
  LONG_REACH,
  MIDNIGHT_TOWER,
  TWO_GATES,
  TWO_TOWNS,
  WINDSOCK,
} from '../arenas/ours';
import { TWIN_RIVERS } from '../arenas/twin-rivers';
import type { Arena } from '../engine/arena';
import {
  CLASSIC_RULES,
  closeRunway,
  reopenRunway,
  type SkyRules,
  type World,
} from '../engine/world';

/**
 * The campaign: twelve shifts, each teaching one idea, from a single runway at first light to
 * the tower at midnight. A shift is cleared by keeping the sky until its last tick with the
 * target met; two more stars reward a shift with no near-misses and one flown on little fuel.
 * Targets and the fuel star are set from the house controller's results (docs/NOTES.md).
 */

export interface ShiftDefinition {
  number: number;
  id: string;
  title: string;
  /** The idea the shift teaches, in one line for the shift map. */
  idea: string;
  arena: Arena;
  ticks: number;
  /** A new plane on a tick with a chance of one in this many (the shift's own traffic). */
  spawnOneIn: number;
  /** Planes safe needed to clear the shift (the first star). */
  target: number;
  /** Average share of a full tank still in the planes when they arrive (the third star). */
  fuelStar: number;
  night: boolean;
  /** Arrivals through a gate start with this share of a full tank. */
  arrivalFuel?: number;
  /** A change of wind: one runway closes and another opens at a tick. */
  windChange?: { closes: number; opens: number; atTick: number };
}

const OLD_RELIABLE = CLASSIC_ARENAS.find((a) => a.id === 'old-reliable')!;
const LITTLE_FIELD = CLASSIC_ARENAS.find((a) => a.id === 'little-field')!;

export const SHIFTS: readonly ShiftDefinition[] = [
  {
    number: 1,
    id: 'first-runway',
    title: 'First runway',
    idea: 'Bring planes down onto one runway, and send the rest on their way.',
    arena: FIRST_LIGHT,
    ticks: 60,
    spawnOneIn: 9,
    target: 3,
    fuelStar: 0.72,
    night: false,
  },
  {
    number: 2,
    id: 'two-exits',
    title: 'Two exits',
    idea: 'Leave by the right gate, and only at 9 000 ft.',
    arena: TWO_GATES,
    ticks: 60,
    spawnOneIn: 8,
    target: 3,
    fuelStar: 0.7,
    night: false,
  },
  {
    number: 3,
    id: 'beacons',
    title: 'Beacons',
    idea: 'Hang routes on beacons and keep the lines tidy.',
    arena: BEACON_ROW,
    ticks: 70,
    spawnOneIn: 8,
    target: 4,
    fuelStar: 0.72,
    night: false,
  },
  {
    number: 4,
    id: 'props-and-jets',
    title: 'Props and jets',
    idea: 'Props fly at half the speed of jets: plan for both.',
    arena: LITTLE_FIELD,
    ticks: 60,
    spawnOneIn: 9,
    target: 3,
    fuelStar: 0.67,
    night: false,
  },
  {
    number: 5,
    id: 'two-airports',
    title: 'Two airports',
    idea: 'Two runways face each other: send each plane to its own.',
    arena: TWO_TOWNS,
    ticks: 70,
    spawnOneIn: 7,
    target: 4,
    fuelStar: 0.74,
    night: false,
  },
  {
    number: 6,
    id: 'crossing-lines',
    title: 'Crossing lines',
    idea: 'Routes cross; heights keep them apart.',
    arena: TWIN_RIVERS,
    ticks: 80,
    spawnOneIn: 7,
    target: 5,
    fuelStar: 0.75,
    night: false,
  },
  {
    number: 7,
    id: 'night',
    title: 'Night',
    idea: 'The night post flies, and the coast is dark.',
    arena: LANTERN_COAST,
    ticks: 80,
    spawnOneIn: 7,
    target: 5,
    fuelStar: 0.72,
    night: true,
  },
  {
    number: 8,
    id: 'crosswind',
    title: 'Crosswind',
    idea: 'Halfway through, the wind turns and the other runway opens.',
    arena: WINDSOCK,
    ticks: 80,
    spawnOneIn: 7,
    target: 6,
    fuelStar: 0.72,
    night: false,
    windChange: { closes: 0, opens: 1, atTick: 40 },
  },
  {
    number: 9,
    id: 'rush-hour',
    title: 'Rush hour',
    idea: 'Traffic pours in from every side.',
    arena: HARBOUR_LIGHTS,
    ticks: 90,
    spawnOneIn: 5,
    target: 9,
    fuelStar: 0.71,
    night: false,
  },
  {
    number: 10,
    id: 'low-fuel',
    title: 'Low fuel',
    idea: 'Arrivals come in with little fuel: land them first.',
    arena: LONG_REACH,
    ticks: 90,
    spawnOneIn: 7,
    target: 6,
    fuelStar: 0.41,
    night: false,
    arrivalFuel: 0.6,
  },
  {
    number: 11,
    id: 'old-reliable',
    title: 'Old reliable',
    idea: 'The 1986 game’s own default sky, at its own speed.',
    arena: OLD_RELIABLE,
    ticks: 100,
    spawnOneIn: 10,
    target: 5,
    fuelStar: 0.72,
    night: false,
  },
  {
    number: 12,
    id: 'tower-at-midnight',
    title: 'Tower at midnight',
    idea: 'Three runways, eight gates, three-second ticks.',
    arena: MIDNIGHT_TOWER,
    ticks: 120,
    spawnOneIn: 6,
    target: 12,
    fuelStar: 0.73,
    night: true,
  },
];

export function shiftById(id: string): ShiftDefinition | undefined {
  return SHIFTS.find((shift) => shift.id === id);
}

/** The shift's arena with the shift's own rate of arrivals. */
export function shiftArena(shift: ShiftDefinition): Arena {
  return { ...shift.arena, spawnOneIn: shift.spawnOneIn };
}

export function shiftRules(shift: ShiftDefinition): SkyRules {
  return {
    ...CLASSIC_RULES,
    arrivalFuel: shift.arrivalFuel ?? 1,
    closedRunways: new Set(shift.windChange ? [shift.windChange.opens] : []),
  };
}

/** What changes in the sky before a tick: today only the wind. */
export function beforeShiftTick(world: World, shift: ShiftDefinition): 'wind-change' | null {
  const change = shift.windChange;
  if (!change || world.clock + 1 !== change.atTick) return null;
  reopenRunway(world, change.opens);
  closeRunway(world, change.closes);
  return 'wind-change';
}

export interface ShiftOutcome {
  /** The shift ran to its last tick. */
  completed: boolean;
  safe: number;
  nearMisses: number;
  /** Average share of a full tank left on arrival, over the planes that arrived. */
  fuelLeft: number;
}

export interface Stars {
  target: boolean;
  calm: boolean;
  fuel: boolean;
}

export function starsFor(shift: ShiftDefinition, outcome: ShiftOutcome): Stars {
  const target = outcome.completed && outcome.safe >= shift.target;
  return {
    target,
    calm: target && outcome.nearMisses === 0,
    fuel: target && outcome.fuelLeft >= shift.fuelStar,
  };
}

export function starCount(stars: Stars): number {
  return Number(stars.target) + Number(stars.calm) + Number(stars.fuel);
}
