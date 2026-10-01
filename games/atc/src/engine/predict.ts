import type { Cell } from './geometry';
import {
  checkAfterMove,
  insertByLetter,
  type LossReason,
  movePlane,
  movesOnTick,
  type Plane,
  SEPARATION,
  tooClose,
  type TrackPoint,
  type World,
} from './world';

/**
 * Looks a few ticks ahead without changing the sky: where each plane will be if nobody touches
 * it, which pairs will lose separation and which planes are about to break a rule on their own.
 * This is the information the original never gave; the rules used are the same ones `tick` uses.
 */

export const FORECAST_TICKS = 3;

export interface Conflict {
  a: number;
  b: number;
  /** Ticks from now until separation is lost (1 = on the next tick). */
  inTicks: number;
  /** Midpoint of the pair at that moment, in cells. */
  at: Cell;
}

export interface Hazard {
  letter: number;
  inTicks: number;
  reason: LossReason;
}

export interface Forecast {
  /** Next positions per plane letter, one per tick (a prop repeats its cell on ticks it waits). */
  paths: Map<number, TrackPoint[]>;
  conflicts: Conflict[];
  hazards: Hazard[];
}

const NEVER: World['random'] = { random: () => 1, rand: () => 1, flavour: () => 1 };

function ghostOf(plane: Plane): Plane {
  return { ...plane, route: plane.route.map((c) => ({ ...c })), track: [] };
}

export function forecast(world: World, ticks = FORECAST_TICKS): Forecast {
  const ghost: World = {
    ...world,
    closePairs: new Set(world.closePairs),
    air: world.air.map(ghostOf),
    ground: world.ground.map(ghostOf),
    loss: null,
    random: NEVER,
  };
  const paths = new Map<number, TrackPoint[]>();
  const conflicts: Conflict[] = [];
  const hazards: Hazard[] = [];
  const reported = new Set<string>();
  const sidelined = new Set<number>();

  for (let ahead = 1; ahead <= ticks; ahead++) {
    ghost.clock += 1;
    const cleared = ghost.ground.filter((p) => p.targetAltitude > 0);
    ghost.ground = ghost.ground.filter((p) => p.targetAltitude <= 0);
    for (const plane of cleared) insertByLetter(ghost.air, plane);

    const gone = new Set<Plane>();
    for (const plane of ghost.air) {
      if (sidelined.has(plane.letter)) continue;
      if (movesOnTick(plane, ghost.clock)) {
        const outcome = movePlane(ghost, plane, []) ?? checkAfterMove(ghost, plane);
        if (outcome === 'arrived') gone.add(plane);
        else if (outcome) {
          hazards.push({ letter: plane.letter, inTicks: ahead, reason: outcome.reason });
          sidelined.add(plane.letter);
        }
      }
      const path = paths.get(plane.letter) ?? [];
      path.push({ x: plane.x, y: plane.y, altitude: plane.altitude, tick: ghost.clock });
      paths.set(plane.letter, path);
    }
    ghost.air = ghost.air.filter((p) => !gone.has(p));

    const flying = ghost.air.filter((p) => !sidelined.has(p.letter));
    for (let i = 0; i < flying.length; i++) {
      for (let j = i + 1; j < flying.length; j++) {
        const a = flying[i]!;
        const b = flying[j]!;
        const key = a.letter < b.letter ? `${a.letter}:${b.letter}` : `${b.letter}:${a.letter}`;
        if (reported.has(key) || !tooClose(a, b, SEPARATION)) continue;
        reported.add(key);
        conflicts.push({
          a: a.letter,
          b: b.letter,
          inTicks: ahead,
          at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        });
      }
    }
  }
  return { paths, conflicts, hazards };
}
