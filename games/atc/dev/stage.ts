import type { Arena, Place } from '../src/engine/arena';
import { type Cell, type Heading, STEPS } from '../src/engine/geometry';
import { planRoute } from '../src/engine/route';
import { CARRIERS, type FlightRole, SPECIAL_CARRIERS } from '../src/engine/traffic';
import { createWorld, type Plane, type TrackPoint, type World } from '../src/engine/world';

/**
 * Staging for documentation scenes: puts planes exactly where a scene needs them, with a wake
 * behind them and real routes from the route planner. Everything drawn afterwards comes from the
 * game's own engine, forecast and renderer.
 */

export interface StagedPlane {
  /** Upper case for a prop, lower case for a jet, as on the radar. */
  name: string;
  at: Cell;
  heading: Heading;
  altitude: number;
  target?: number;
  from: string;
  to: string;
  fuel: number;
  carrier?: number;
  role?: FlightRole;
  number: number;
  /** Waypoints for a committed route (beacon names like 'B2', place names or cells). */
  via?: readonly (string | Cell)[];
  /** How many past positions to leave behind it. */
  wake?: number;
  onGround?: boolean;
}

const quiet = { random: () => 1, rand: () => 1, flavour: () => 1 };

export function stagedWorld(arena: Arena, clock: number): World {
  const world = createWorld(arena, quiet);
  world.clock = clock;
  return world;
}

export function place(name: string): Place {
  const index = Number(name.slice(1));
  return name.startsWith('E') ? { kind: 'gate', index } : { kind: 'runway', index };
}

function cellOf(arena: Arena, ref: string | Cell): Cell {
  if (typeof ref !== 'string') return ref;
  const index = Number(ref.slice(1));
  if (ref.startsWith('B')) return arena.beacons[index]!;
  if (ref.startsWith('A')) return arena.runways[index]!;
  return arena.gates[index]!;
}

export function stage(world: World, spec: StagedPlane): Plane {
  const { arena } = world;
  const kind = spec.name === spec.name.toUpperCase() ? 'prop' : 'jet';
  const letter = spec.name.toLowerCase().charCodeAt(0) - 97;
  const role = spec.role ?? 'scheduled';
  const carrier = role === 'scheduled' ? CARRIERS[spec.carrier ?? 0]! : SPECIAL_CARRIERS[role];
  const destination = place(spec.to);
  const track = wakeBehind(spec, world.clock, kind === 'prop');
  const plane: Plane = {
    letter,
    kind,
    x: spec.at.x,
    y: spec.at.y,
    altitude: spec.altitude,
    targetAltitude: spec.target ?? spec.altitude,
    heading: spec.heading,
    targetHeading: spec.heading,
    hold: null,
    fuel: spec.fuel,
    origin: place(spec.from),
    destination,
    status: 'marked',
    waitForBeacon: null,
    onGround: spec.onGround ?? false,
    route: [],
    flight: { carrier, number: spec.number, role },
    track,
  };
  if (spec.via) {
    const waypoints = spec.via.map((ref) => cellOf(arena, ref));
    const last = spec.via[spec.via.length - 1];
    const toRunway = typeof last === 'string' && last.startsWith('A');
    const planned = planRoute(arena, { cell: spec.at, heading: spec.heading }, waypoints, {
      arriveHeading: toRunway ? arena.runways[Number(last.slice(1))]!.heading : undefined,
      endsAtGate: typeof last === 'string' && last.startsWith('E'),
    });
    if (!planned) throw new Error(`No route for ${spec.name}`);
    plane.route = planned.cells;
  }
  (plane.onGround ? world.ground : world.air).push(plane);
  return plane;
}

/** Positions behind the plane along its heading, one per move, oldest first. */
function wakeBehind(spec: StagedPlane, clock: number, prop: boolean): TrackPoint[] {
  const back = STEPS[spec.heading]!;
  const count = spec.onGround ? 0 : (spec.wake ?? 4);
  const climbing = Math.sign((spec.target ?? spec.altitude) - spec.altitude);
  const points: TrackPoint[] = [];
  for (let k = count; k >= 0; k--) {
    points.push({
      x: spec.at.x - back.x * k,
      y: spec.at.y - back.y * k,
      altitude: Math.max(1, Math.min(9, spec.altitude - climbing * k)),
      tick: clock - k * (prop ? 2 : 1),
    });
  }
  if (spec.onGround) points[0]!.altitude = 0;
  return points;
}
