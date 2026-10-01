import { placeCell } from './arena';
import { type Cell, HEADING_KEYS, headingToward, sameCell } from './geometry';
import { planRoute } from './route';
import {
  CEILING,
  checkAfterMove,
  type Hold,
  isNearMiss,
  movePlane,
  movesOnTick,
  type Plane,
  planeName,
  SEPARATION,
  tooClose,
  type World,
} from './world';

/**
 * The house controller: a greedy planner with a lookahead. Every tick it gives each plane the
 * shortest legal route to where it is going and a height plan, flies every plan a few ticks ahead
 * by the game's own rules, and settles predicted trouble one change at a time: a new height, a
 * hold, or a departure kept on the ground, trying both planes of a pair and keeping whichever
 * change leaves the sky calmest. It plays the Hall's demo and is the yardstick for the balance
 * targets in docs/NOTES.md.
 */

export interface BotOptions {
  /** Ticks flown ahead when looking for trouble. */
  horizon?: number;
  /** The 1986 orders only hold to the right; Skyloom can hold either way. */
  leftHolds?: boolean;
}

export interface Intent {
  letter: number;
  route: Cell[];
  targetAltitude: number;
  hold: Hold | null;
  /** For a plane on the ground: clear it to climb now. */
  launch: boolean;
}

interface Point3 {
  x: number;
  y: number;
  altitude: number;
}

interface Flight {
  plane: Plane;
  intent: Intent;
  /** Where the plane is after each of the next ticks; null once it has arrived. */
  path: (Point3 | null)[];
  /** True when the plan breaks a rule on its own within the horizon. */
  broken: boolean;
  /** Cost of the change from the plan the plane would fly untouched. */
  effort: number;
  airborne: boolean;
}

const DEFAULT_HORIZON = 8;
const DEPARTURE = { toRunway: 4, toGate: 6 };

const COST = {
  broken: 10_000,
  conflict: 1_000,
  closeSoon: 200,
  closeLater: 20,
  hold: 6,
  perLevel: 1,
  waiting: 3,
} as const;

/** A route depends only on where a plane is, which way it faces, where it goes and its height. */
const routeCache = new Map<string, Cell[] | null>();
const ROUTE_CACHE_LIMIT = 20_000;

/** Routes are shared between plans and never changed in place; copy before flying one. */
function routeFor(world: World, plane: Plane): Cell[] | null {
  const key = `${world.arena.id}:${plane.x},${plane.y},${plane.heading}:${plane.destination.kind}${plane.destination.index}:${plane.altitude}`;
  const cached = routeCache.get(key);
  if (cached !== undefined) return cached;
  const route = searchRoute(world, plane);
  if (routeCache.size >= ROUTE_CACHE_LIMIT) routeCache.clear();
  routeCache.set(key, route);
  return route;
}

/**
 * The shortest route that leaves room for the height change still to come: a plane must glide
 * down one thousand feet a cell, or climb to 9 000 ft before its gate. When the direct route is
 * too short, the plane goes by way of a beacon.
 */
function searchRoute(world: World, plane: Plane): Cell[] | null {
  const { arena } = world;
  const target = placeCell(arena, plane.destination);
  const toRunway = plane.destination.kind === 'runway';
  const options = {
    arriveHeading: toRunway ? arena.runways[plane.destination.index]!.heading : undefined,
    endsAtGate: !toRunway,
  };
  const start = { cell: { x: plane.x, y: plane.y }, heading: plane.heading };
  const room = toRunway ? plane.altitude : CEILING - plane.altitude + 1;
  let best = planRoute(arena, start, [target], options)?.cells ?? null;
  if (best && best.length >= room) return best;
  for (const beacon of arena.beacons) {
    const via = planRoute(arena, start, [beacon, target], options)?.cells;
    if (!via) continue;
    const fits = via.length >= room;
    const bestFits = best !== null && best.length >= room;
    if (
      !best ||
      (fits && (!bestFits || via.length < best.length)) ||
      (!fits && !bestFits && via.length > best.length)
    ) {
      best = via;
    }
  }
  return best;
}

/**
 * A plane bound for a gate must get from its lowest planned height up to 9 000 ft in the moves
 * it has left; a plane bound for a runway must be able to glide down one thousand feet a cell.
 */
function feasible(plane: Plane, moves: number, target: number): boolean {
  if (plane.destination.kind === 'runway') return target <= Math.max(0, moves - 1);
  const lowest = Math.min(plane.altitude, target);
  return CEILING - lowest + (plane.altitude - lowest) <= moves;
}

/** The height a plane should aim for now: climb to leave in time, glide to land, else cruise. */
function heightPlan(plane: Plane, moves: number, cruise: number): number {
  if (plane.destination.kind === 'gate') {
    return CEILING - plane.altitude >= moves - 3 ? CEILING : cruise;
  }
  // Too high to land on this route: keep flying it and go round, never descend into the ground.
  if (plane.altitude > moves) return Math.max(1, cruise);
  return Math.min(cruise, Math.max(0, moves - 1));
}

function baseIntent(world: World, plane: Plane): Intent {
  const intent: Intent = {
    letter: plane.letter,
    route: [],
    targetAltitude: plane.targetAltitude,
    hold: null,
    launch: false,
  };
  if (plane.onGround) return intent;
  const route = routeFor(world, plane);
  if (!route) return { ...intent, targetAltitude: plane.altitude, hold: 'right' };
  const moves = route.length;
  const cruise = plane.targetAltitude > 0 ? plane.targetAltitude : plane.altitude;
  const lowOnFuel = plane.fuel <= moves + 4;
  if (plane.destination.kind === 'gate' && CEILING - plane.altitude > moves && !lowOnFuel) {
    // Too low to leave on this route: circle while climbing.
    return { ...intent, targetAltitude: CEILING, hold: 'right' };
  }
  if (plane.destination.kind === 'runway' && plane.altitude > moves && !lowOnFuel) {
    // Too high to glide in: circle while descending.
    return { ...intent, targetAltitude: Math.max(1, moves - 2), hold: 'right' };
  }
  return { ...intent, route, targetAltitude: heightPlan(plane, moves, cruise) };
}

/** Flies a copy of the plane under an intent, with the game's own movement rules. */
function flyAhead(
  world: World,
  plane: Plane,
  intent: Intent,
  horizon: number,
): Pick<Flight, 'path' | 'broken'> {
  const ghost: Plane = {
    ...plane,
    route: intent.route.map((c) => ({ ...c })),
    targetAltitude: intent.targetAltitude,
    hold: intent.hold,
    onGround: plane.onGround && !intent.launch,
    track: [],
  };
  const scratch: World = { ...world, air: [], ground: [], closePairs: new Set(), loss: null };
  const path: (Point3 | null)[] = [];
  let gone = false;
  let broken = false;
  for (let k = 1; k <= horizon; k++) {
    scratch.clock = world.clock + k;
    if (!gone && !broken && !ghost.onGround && movesOnTick(ghost, scratch.clock)) {
      if (ghost.route.length > 0) {
        ghost.targetAltitude = heightPlan(ghost, ghost.route.length, ghost.targetAltitude);
      }
      const trouble = movePlane(scratch, ghost, []) ?? checkAfterMove(scratch, ghost);
      if (trouble === 'arrived') gone = true;
      else if (trouble) broken = true;
    }
    path.push(gone ? null : { x: ghost.x, y: ghost.y, altitude: ghost.altitude });
  }
  return { path, broken };
}

function flight(
  world: World,
  plane: Plane,
  intent: Intent,
  horizon: number,
  effort: number,
): Flight {
  return {
    plane,
    intent,
    ...flyAhead(world, plane, intent, horizon),
    effort,
    airborne: !plane.onGround || intent.launch,
  };
}

/** Trouble between two plans: the rules ignore planes still waiting on the ground. */
function pairCost(a: Flight, b: Flight): number {
  if (!a.airborne || !b.airborne) return 0;
  let cost = 0;
  for (let k = 0; k < a.path.length; k++) {
    const p = a.path[k];
    const q = b.path[k];
    if (!p || !q) continue;
    if (tooClose(p, q, SEPARATION)) cost += COST.conflict;
    else if (p.altitude > 0 && q.altitude > 0 && isNearMiss(p, q)) {
      cost += k < 3 ? COST.closeSoon : COST.closeLater;
    }
  }
  return cost;
}

function ownCost(f: Flight): number {
  return (f.broken ? COST.broken : 0) + f.effort + (f.airborne ? 0 : COST.waiting);
}

function costAgainst(f: Flight, others: readonly Flight[]): number {
  let cost = ownCost(f);
  for (const other of others) if (other.plane !== f.plane) cost += pairCost(f, other);
  return cost;
}

/** Other plans to try for one plane, each with how much it disturbs the plane's own plan. */
function alternatives(
  world: World,
  base: Flight,
  options: BotOptions,
): { intent: Intent; effort: number }[] {
  const { plane, intent } = base;
  if (plane.onGround) {
    if (base.intent.launch)
      return [{ intent: { ...intent, launch: false, targetAltitude: 0 }, effort: 0 }];
    const route = routeFor(world, plane);
    if (!route) return [];
    const target = plane.destination.kind === 'gate' ? DEPARTURE.toGate : DEPARTURE.toRunway;
    return [{ intent: { ...intent, route, targetAltitude: target, launch: true }, effort: 0 }];
  }
  const route = intent.route.length > 0 ? intent.route : (routeFor(world, plane) ?? []);
  const moves = route.length;
  const choices: { intent: Intent; effort: number }[] = [];
  for (const delta of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const target = intent.targetAltitude + delta;
    if (target < 1 || target > CEILING) continue;
    if (moves > 0 && !feasible(plane, moves, target)) continue;
    choices.push({
      intent: { ...intent, route, hold: null, targetAltitude: target },
      effort: Math.abs(delta) * COST.perLevel,
    });
  }
  if (plane.fuel > moves + 8) {
    const sides: Hold[] = options.leftHolds === false ? ['right'] : ['right', 'left'];
    for (const side of sides) {
      for (const delta of [0, 2, -2]) {
        const target = Math.min(CEILING, Math.max(1, plane.altitude + delta));
        choices.push({
          intent: { ...intent, route: [], hold: side, targetAltitude: target },
          effort: COST.hold + Math.abs(delta) * COST.perLevel,
        });
      }
    }
  }
  return choices;
}

/** Decides what every plane should do this tick. */
export function planSky(world: World, options: BotOptions = {}): Intent[] {
  const horizon = options.horizon ?? DEFAULT_HORIZON;
  const flights = [...world.air, ...world.ground].map((plane) =>
    flight(world, plane, baseIntent(world, plane), horizon, 0),
  );

  // Departures leave only into a clear sky.
  for (const [i, waiting] of flights.entries()) {
    if (waiting.airborne) continue;
    for (const option of alternatives(world, waiting, options)) {
      const trial = flight(world, waiting.plane, option.intent, horizon, option.effort);
      if (costAgainst(trial, flights) < costAgainst(waiting, flights)) flights[i] = trial;
    }
  }

  // Settle trouble: always the change that lowers the total the most.
  const stuck = new Set<number>();
  for (let round = 0; round < 40; round++) {
    let worst: { index: number; cost: number } | null = null;
    for (const [index, f] of flights.entries()) {
      if (stuck.has(f.plane.letter)) continue;
      const cost = costAgainst(f, flights) - f.effort - (f.airborne ? 0 : COST.waiting);
      if (cost >= COST.closeLater && (!worst || cost > worst.cost)) worst = { index, cost };
    }
    if (!worst) break;
    const troubled = flights[worst.index]!;
    const partners = flights
      .map((f, index) => ({ f, index }))
      .filter(({ f }) => f !== troubled && pairCost(troubled, f) > 0)
      .map(({ index }) => index);
    let best: { index: number; flight: Flight; gain: number } | null = null;
    for (const index of [worst.index, ...partners]) {
      const current = flights[index]!;
      const before = costAgainst(current, flights);
      for (const option of alternatives(world, current, options)) {
        const trial = flight(world, current.plane, option.intent, horizon, option.effort);
        const gain = before - costAgainst(trial, flights);
        if (gain > 0 && (!best || gain > best.gain)) best = { index, flight: trial, gain };
      }
    }
    if (!best) {
      stuck.add(troubled.plane.letter);
      continue;
    }
    flights[best.index] = best.flight;
  }
  return flights.map((f) => f.intent);
}

/** Skyloom's own controls: routes, heights and holds set directly on the planes. */
export function applyIntents(world: World, intents: readonly Intent[]): void {
  for (const intent of intents) {
    const plane = [...world.air, ...world.ground].find((p) => p.letter === intent.letter);
    if (!plane) continue;
    if (plane.onGround) {
      if (intent.launch) {
        plane.targetAltitude = intent.targetAltitude;
        plane.route = intent.route.map((c) => ({ ...c }));
      }
      continue;
    }
    plane.route = intent.route.map((c) => ({ ...c }));
    plane.hold = intent.hold;
    plane.targetAltitude = intent.targetAltitude;
    plane.waitForBeacon = null;
  }
}

/**
 * The same decisions typed as the 1986 game's orders (absolute headings, altitudes and the
 * right-hand circle), for golden runs against the original program.
 */
export function intentsAsOrders(world: World, intents: readonly Intent[]): string[] {
  const orders: string[] = [];
  for (const intent of intents) {
    const plane = [...world.air, ...world.ground].find((p) => p.letter === intent.letter);
    if (!plane) continue;
    const name = planeName(plane);
    if (plane.onGround) {
      if (intent.launch) orders.push(`${name}a${intent.targetAltitude}`);
      continue;
    }
    if (intent.targetAltitude !== plane.targetAltitude)
      orders.push(`${name}a${intent.targetAltitude}`);
    if (intent.hold) {
      if (plane.hold !== 'right') orders.push(`${name}c`);
      continue;
    }
    const next = intent.route[0];
    if (!next || sameCell(next, plane)) continue;
    const heading = headingToward(next.x - plane.x, next.y - plane.y);
    if (heading !== plane.targetHeading || plane.hold)
      orders.push(`${name}t${HEADING_KEYS[heading]}`);
  }
  return orders;
}
