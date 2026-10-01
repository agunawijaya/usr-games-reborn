import { createRng, type Rng } from '@usr-games/kit';
import { createLayout } from './layout';
import { createRoom, type RoomSpec } from './room';
import { quickRoute, solve, type Solution } from './solver';
import type { Furniture, Point, TangleKind, VacuumKind } from './types';

/**
 * Rooms are made from a blueprint (size, furniture, what lives there) and a seed that places
 * everything. A candidate is kept only if the solver proves it can be cleared without a zoom
 * and its par falls in the blueprint's range. The house rooms were searched once and stored as
 * plain data; the daily room is searched the same way on the day.
 */

export interface Blueprint {
  readonly width: number;
  readonly height: number;
  readonly furniture?: readonly Furniture[];
  readonly vacuums: Partial<Record<VacuumKind, number>>;
  readonly clutter?: Partial<Record<Exclude<TangleKind, 'wreck'>, number>>;
  readonly dock?: { readonly every: number; readonly count: number };
  /** Inclusive range of acceptable pars. */
  readonly par: readonly [number, number];
  /** How close a vacuum may start to the cat (in steps). */
  readonly catSpace?: number;
  /**
   * The house's difficulty curve: the share of games a careless player (random safe steps)
   * should win here. Checked only by the room search script, never at run time.
   */
  readonly ease?: readonly [number, number];
}

export interface GeneratedRoom {
  readonly spec: RoomSpec;
  readonly solution: Solution;
}

const KIND_ORDER: readonly VacuumKind[] = ['basic', 'mop', 'slow', 'turbo', 'sweeper'];

function placer(blueprint: Blueprint, rng: Rng) {
  const layout = createLayout(blueprint.width, blueprint.height, blueprint.furniture ?? []);
  const taken = new Set<string>();
  const free = (p: Point) =>
    !layout.blocked[p.y * layout.width + p.x] && !taken.has(`${p.x},${p.y}`);
  return {
    take(accept: (p: Point) => boolean = () => true): Point | null {
      for (let attempt = 0; attempt < 400; attempt++) {
        const p = { x: rng.int(0, blueprint.width - 1), y: rng.int(0, blueprint.height - 1) };
        if (free(p) && accept(p)) {
          taken.add(`${p.x},${p.y}`);
          return p;
        }
      }
      return null;
    },
  };
}

const apart = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Places everything for one seed, or returns null if the room got too crowded. */
export function layoutFor(blueprint: Blueprint, seed: string): RoomSpec | null {
  const rng = createRng(seed);
  const place = placer(blueprint, rng);
  const clutter: { kind: Exclude<TangleKind, 'wreck'>; x: number; y: number }[] = [];
  for (const kind of ['sock', 'cable'] as const) {
    for (let i = 0; i < (blueprint.clutter?.[kind] ?? 0); i++) {
      // Clutter stays off the walls, where it would only ever be scenery.
      const p = place.take(
        (q) => q.x > 0 && q.y > 0 && q.x < blueprint.width - 1 && q.y < blueprint.height - 1,
      );
      if (!p) return null;
      clutter.push({ kind, ...p });
    }
  }
  let dock: RoomSpec['dock'];
  if (blueprint.dock) {
    // Docks stand against a wall, as real ones do.
    const p = place.take((q) => q.y === 0 || q.x === 0 || q.x === blueprint.width - 1);
    if (!p) return null;
    dock = { ...p, every: blueprint.dock.every, count: blueprint.dock.count };
  }
  const vacuums: { kind: VacuumKind; x: number; y: number }[] = [];
  for (const kind of KIND_ORDER) {
    for (let i = 0; i < (blueprint.vacuums[kind] ?? 0); i++) {
      const p = place.take();
      if (!p) return null;
      vacuums.push({ kind, ...p });
    }
  }
  const space = blueprint.catSpace ?? 3;
  const cat = place.take((q) => vacuums.every((v) => apart(v, q) >= space));
  if (!cat) return null;
  return {
    width: blueprint.width,
    height: blueprint.height,
    rules: 'house',
    cat,
    vacuums,
    clutter,
    furniture: blueprint.furniture ?? [],
    ...(dock ? { dock } : {}),
    seed,
  };
}

export interface SearchOptions {
  readonly maxCandidates?: number;
  readonly maxNodes?: number;
  /** Extra test a candidate must pass (for example: a rival must not find it trivial). */
  readonly accept?: (room: GeneratedRoom) => boolean;
}

/** Tries seeds `${seed}/0`, `${seed}/1`… until a room passes; deterministic for a seed. */
export function findRoom(
  blueprint: Blueprint,
  seed: string,
  options: SearchOptions = {},
): GeneratedRoom | null {
  const [minPar, maxPar] = blueprint.par;
  for (let i = 0; i < (options.maxCandidates ?? 400); i++) {
    const spec = layoutFor(blueprint, `${seed}/${i}`);
    if (!spec) continue;
    const room = createRoom(spec);
    // A cheap look first: most crowded candidates are lost within a few turns.
    if (!quickRoute(room, 24, maxPar + 4)) continue;
    const solution = solve(room, { maxNodes: options.maxNodes ?? 400_000, maxTurns: maxPar });
    if (!solution || solution.turns < minPar || solution.turns > maxPar) continue;
    const generated = { spec, solution };
    if (options.accept && !options.accept(generated)) continue;
    return generated;
  }
  return null;
}
