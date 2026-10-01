import { CLASSIC_ARENAS } from '../arenas/classic';
import { BEACON_ROW, FIRST_LIGHT, TWO_GATES, TWO_TOWNS, WINDSOCK } from '../arenas/ours';
import { TWIN_RIVERS } from '../arenas/twin-rivers';
import type { Arena } from '../engine/arena';
import type { ScriptedArrival } from '../engine/world';
import type { PlanePlan } from './puzzle-solver';

/**
 * Clearance puzzles: a handful of planes arrive at set moments and must all be brought home.
 * Time stands still while you plan, and again whenever a new plane comes in; every route, height
 * change or clearance to take off counts as one clearance, and each puzzle has a par, like a round
 * of golf. Par is the fewest clearances the puzzle solver could find (scripts/puzzle-pars.ts), and
 * `solution` is the plan that proves it.
 */

export interface Puzzle {
  id: string;
  title: string;
  brief: string;
  arena: Arena;
  arrivals: readonly ScriptedArrival[];
  /** The puzzle is lost if any plane is still flying after this many ticks. */
  ticks: number;
  par: number;
  /** One plan per arrival, in order, that brings everyone home in exactly `par` clearances. */
  solution: readonly PlanePlan[];
}

const gate = (index: number) => ({ kind: 'gate', index }) as const;
const runway = (index: number) => ({ kind: 'runway', index }) as const;
const OLD_RELIABLE = CLASSIC_ARENAS.find((a) => a.id === 'old-reliable')!;
const SALTIRE = CLASSIC_ARENAS.find((a) => a.id === 'saltire')!;

/** A route straight to the plane's destination, or by way of a beacon. */
const direct = { via: null } as const;
const via = (beacon: number) => ({ via: beacon });
const clear = (
  route: PlanePlan['route'],
  extra: { altitude?: number; launch?: PlanePlan['launch'] } = {},
): PlanePlan => ({ route, altitude: extra.altitude ?? null, launch: extra.launch ?? null });

export const PUZZLES: readonly Puzzle[] = [
  {
    id: 'head-on',
    title: 'Head on',
    brief: 'Two jets on the same airway, nose to nose. Part them.',
    arena: FIRST_LIGHT,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: gate(1) },
      { tick: 1, kind: 'jet', origin: gate(1), destination: gate(0) },
    ],
    ticks: 40,
    par: 2,
    solution: [clear(direct), clear(direct)],
  },
  {
    id: 'one-runway-two-planes',
    title: 'One runway, two planes',
    brief: 'A prop and a jet both want the runway. Land them both.',
    arena: FIRST_LIGHT,
    arrivals: [
      { tick: 1, kind: 'prop', origin: gate(2), destination: runway(0) },
      { tick: 1, kind: 'jet', origin: gate(1), destination: runway(0) },
    ],
    ticks: 45,
    par: 2,
    solution: [clear(direct), clear(direct)],
  },
  {
    id: 'crossroads',
    title: 'Crossroads',
    brief: 'Four planes, four gates, one beacon in the middle.',
    arena: BEACON_ROW,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: gate(1) },
      { tick: 1, kind: 'jet', origin: gate(1), destination: gate(0) },
      { tick: 2, kind: 'jet', origin: gate(2), destination: gate(3) },
      { tick: 2, kind: 'prop', origin: gate(3), destination: gate(2) },
    ],
    ticks: 60,
    par: 5,
    solution: [clear(direct), clear(direct, { altitude: 2 }), clear(direct), clear(via(0))],
  },
  {
    id: 'both-ends',
    title: 'Both ends',
    brief: 'Arrivals for both runways, coming in over each other.',
    arena: TWO_TOWNS,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: runway(0) },
      { tick: 1, kind: 'jet', origin: gate(1), destination: runway(1) },
      { tick: 3, kind: 'prop', origin: gate(2), destination: runway(1) },
    ],
    ticks: 60,
    par: 3,
    solution: [clear(direct), clear(direct), clear(direct)],
  },
  {
    id: 'pearls',
    title: 'Pearls',
    brief: 'Four arrivals, two runways. Land all four; a string of landings is the flourish.',
    arena: TWIN_RIVERS,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: runway(0) },
      { tick: 1, kind: 'jet', origin: gate(1), destination: runway(1) },
      { tick: 4, kind: 'jet', origin: gate(0), destination: runway(0) },
      { tick: 4, kind: 'jet', origin: gate(1), destination: runway(1) },
    ],
    ticks: 60,
    par: 4,
    solution: [clear(direct), clear(direct), clear(direct), clear(direct)],
  },
  {
    id: 'departures',
    title: 'Departures',
    brief: 'Three planes wait on the ground. Get them up and out.',
    arena: TWO_GATES,
    arrivals: [
      { tick: 1, kind: 'jet', origin: runway(0), destination: gate(0) },
      { tick: 1, kind: 'prop', origin: runway(0), destination: gate(3) },
      { tick: 1, kind: 'jet', origin: runway(0), destination: gate(1) },
    ],
    ticks: 50,
    par: 6,
    solution: [
      clear(direct, { launch: { wait: 0, altitude: 3 } }),
      clear(direct, { launch: { wait: 3, altitude: 3 } }),
      clear(direct, { launch: { wait: 10, altitude: 3 } }),
    ],
  },
  {
    id: 'saltire',
    title: 'Saltire',
    brief: 'Four corners, two diagonals, nowhere to land. Thread them through.',
    arena: SALTIRE,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: gate(4) },
      { tick: 1, kind: 'jet', origin: gate(3), destination: gate(7) },
      { tick: 2, kind: 'jet', origin: gate(4), destination: gate(0) },
      { tick: 2, kind: 'jet', origin: gate(7), destination: gate(3) },
    ],
    ticks: 60,
    par: 6,
    solution: [
      clear(direct),
      clear(via(0)),
      clear(direct, { altitude: 2 }),
      clear(direct, { altitude: 4 }),
    ],
  },
  {
    id: 'change-of-wind',
    title: 'Change of wind',
    brief: 'Two arrivals and a departure on two crossing runways.',
    arena: WINDSOCK,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: runway(1) },
      { tick: 1, kind: 'prop', origin: gate(2), destination: runway(0) },
      { tick: 2, kind: 'jet', origin: runway(1), destination: gate(1) },
    ],
    ticks: 60,
    par: 4,
    solution: [clear(direct), clear(direct), clear(direct, { launch: { wait: 0, altitude: 3 } })],
  },
  {
    id: 'old-reliable',
    title: 'Old reliable',
    brief: 'The 1986 default sky, five planes at once.',
    arena: OLD_RELIABLE,
    arrivals: [
      { tick: 1, kind: 'jet', origin: gate(0), destination: runway(0) },
      { tick: 1, kind: 'jet', origin: gate(6), destination: gate(3) },
      { tick: 1, kind: 'prop', origin: gate(4), destination: gate(1) },
      { tick: 2, kind: 'jet', origin: gate(2), destination: runway(1) },
      { tick: 2, kind: 'jet', origin: runway(0), destination: gate(5) },
    ],
    ticks: 80,
    par: 6,
    solution: [
      clear(direct),
      clear(direct),
      clear(via(0)),
      clear(direct),
      clear(direct, { launch: { wait: 0, altitude: 3 } }),
    ],
  },
];

export function puzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
