import { type Cell, sameCell, step } from '../engine/geometry';
import { skyRandomness } from '../engine/randomness';
import { planRoute } from '../engine/route';
import { CLASSIC_RULES, createWorld, type Plane, tick, type World } from '../engine/world';
import type { Puzzle } from './puzzles';

/**
 * Finds the fewest clearances that bring every plane of a puzzle home, counting them the way the
 * game does: one for a route, one for a change of height, one for clearing a plane off the
 * ground. Each plane gets its clearances once, as soon as it can be given them, which is how a
 * player plans a puzzle while time stands still. The search goes up one clearance at a time, so
 * the first plan found is a cheapest one; that number is the puzzle's par.
 */

/** Waits before a plane on the ground is cleared, in ticks after it appears. */
const LAUNCH_WAITS = [0, 3, 6, 10] as const;
const LAUNCH_HEIGHTS = [3, 5, 7, 9] as const;
const OVERRIDE_HEIGHTS = [2, 3, 4, 5, 6, 8] as const;

/** A route straight to the destination, or by way of one beacon. */
type RouteChoice = { via: null } | { via: number };

export interface PlanePlan {
  route: RouteChoice | null;
  /** A height to fly at instead of the one it came in with: one more clearance. */
  altitude: number | null;
  /** For a plane on the ground: how long it waits, and the height it is cleared to. */
  launch: { wait: number; altitude: number } | null;
}

export interface Solution {
  clearances: number;
  plans: PlanePlan[];
}

function planCost(plan: PlanePlan): number {
  return (plan.route ? 1 : 0) + (plan.altitude === null ? 0 : 1) + (plan.launch ? 1 : 0);
}

function routeChoices(puzzle: Puzzle): RouteChoice[] {
  return [{ via: null }, ...puzzle.arena.beacons.map((_, via) => ({ via }))];
}

/**
 * Whether a plane would reach its own gate flying straight on from where it comes in. Only then is
 * leaving it without a route worth trying; any other plane needs one.
 */
function fliesHomeUnaided(puzzle: Puzzle, index: number): boolean {
  const { arena } = puzzle;
  const arrival = puzzle.arrivals[index]!;
  if (arrival.origin.kind !== 'gate' || arrival.destination.kind !== 'gate') return false;
  const from = arena.gates[arrival.origin.index]!;
  const home = arena.gates[arrival.destination.index]!;
  let cell: Cell = from;
  for (let moves = 0; moves < arena.width + arena.height; moves++) {
    cell = step(cell, from.heading);
    if (sameCell(cell, home)) return true;
    if (cell.x < 0 || cell.y < 0 || cell.x >= arena.width || cell.y >= arena.height) return false;
  }
  return false;
}

/** Every way to clear one plane within a budget, cheapest first. */
function optionsFor(puzzle: Puzzle, index: number, budget: number): PlanePlan[] {
  const fromGround = puzzle.arrivals[index]!.origin.kind === 'runway';
  const routes: (RouteChoice | null)[] = [
    ...(fliesHomeUnaided(puzzle, index) ? [null] : []),
    ...routeChoices(puzzle),
  ];
  const plans: PlanePlan[] = [];
  if (fromGround) {
    for (const wait of LAUNCH_WAITS)
      for (const altitude of LAUNCH_HEIGHTS)
        for (const route of routes)
          plans.push({ route, altitude: null, launch: { wait, altitude } });
  } else {
    for (const route of routes) {
      plans.push({ route, altitude: null, launch: null });
      for (const altitude of OVERRIDE_HEIGHTS) plans.push({ route, altitude, launch: null });
    }
  }
  return plans.filter((plan) => planCost(plan) <= budget).sort((a, b) => planCost(a) - planCost(b));
}

/** Routes depend only on where a plane is, its heading and the choice, so a search reuses them. */
const routeCache = new Map<string, Cell[] | null>();

function routeFor(world: World, plane: Plane, choice: RouteChoice): Cell[] | null {
  const key = `${world.arena.id}:${plane.x},${plane.y},${plane.heading}:${plane.destination.kind}${plane.destination.index}:${choice.via}`;
  if (!routeCache.has(key)) routeCache.set(key, searchRoute(world, plane, choice));
  const cells = routeCache.get(key)!;
  return cells ? cells.map((c) => ({ ...c })) : null;
}

function searchRoute(world: World, plane: Plane, choice: RouteChoice): Cell[] | null {
  const { arena } = world;
  const destination = plane.destination;
  const end =
    destination.kind === 'gate'
      ? arena.gates[destination.index]!
      : arena.runways[destination.index]!;
  const waypoints: Cell[] = choice.via === null ? [end] : [arena.beacons[choice.via]!, end];
  const planned = planRoute(arena, { cell: plane, heading: plane.heading }, waypoints, {
    arriveHeading:
      destination.kind === 'runway' ? arena.runways[destination.index]!.heading : undefined,
    endsAtGate: destination.kind === 'gate',
  });
  return planned ? planned.cells : null;
}

/** Flies the puzzle with one plan per arrival; true when every plane is home in time. */
export function flyPlans(puzzle: Puzzle, plans: readonly PlanePlan[]): boolean {
  return flyPlansFully(puzzle, plans).solved;
}

/** The same flight, with the sky as it ended: for explaining why a plan fails. */
export function flyPlansFully(
  puzzle: Puzzle,
  plans: readonly PlanePlan[],
): { solved: boolean; world: World } {
  const world = createWorld(puzzle.arena, skyRandomness(`puzzle:${puzzle.id}`), {
    ...CLASSIC_RULES,
    arrivals: puzzle.arrivals,
  });
  const arrivalOf = new Map<number, number>();
  const appearedAt = new Map<number, number>();
  const cleared = new Set<number>();
  const routed = new Set<number>();
  let spawned = 0;
  while (world.clock < puzzle.ticks && !world.loss) {
    for (const plane of world.ground) {
      const index = arrivalOf.get(plane.letter)!;
      const launch = plans[index]!.launch;
      if (!launch || cleared.has(plane.letter)) continue;
      if (world.clock - appearedAt.get(plane.letter)! < launch.wait) continue;
      plane.targetAltitude = launch.altitude;
      cleared.add(plane.letter);
    }
    for (const plane of world.air) {
      if (routed.has(plane.letter)) continue;
      routed.add(plane.letter);
      const plan = plans[arrivalOf.get(plane.letter)!]!;
      if (plan.altitude !== null) plane.targetAltitude = plan.altitude;
      if (!plan.route) continue;
      const cells = routeFor(world, plane, plan.route);
      if (!cells) return { solved: false, world };
      plane.route = cells;
    }
    for (const event of tick(world)) {
      if (event.kind !== 'spawned') continue;
      arrivalOf.set(event.letter, spawned);
      appearedAt.set(event.letter, world.clock);
      spawned += 1;
    }
    const allIn = spawned === puzzle.arrivals.length;
    if (allIn && world.air.length === 0 && world.ground.length === 0)
      return { solved: !world.loss, world };
  }
  return { solved: false, world };
}

export interface SolveOptions {
  /** The most clearances to try; the search stops there. */
  maxClearances: number;
  /** A cap on skies flown, so a test cannot run away. */
  maxFlights: number;
}

/** The cheapest plan within the limits, or null if none was found. */
export function solvePuzzle(puzzle: Puzzle, options: SolveOptions): Solution | null {
  let flights = 0;
  const count = puzzle.arrivals.length;
  for (let budget = 1; budget <= options.maxClearances; budget++) {
    const plans: PlanePlan[] = [];
    const search = (index: number, left: number): Solution | null => {
      if (index === count) {
        if (left !== 0) return null;
        flights += 1;
        return flyPlans(puzzle, plans) ? { clearances: budget, plans: [...plans] } : null;
      }
      for (const plan of optionsFor(puzzle, index, left)) {
        if (flights >= options.maxFlights) return null;
        plans.push(plan);
        const found = search(index + 1, left - planCost(plan));
        plans.pop();
        if (found) return found;
      }
      return null;
    };
    const found = search(0, budget);
    if (found) return found;
    if (flights >= options.maxFlights) return null;
  }
  return null;
}
