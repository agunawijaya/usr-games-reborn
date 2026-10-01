import { automaticBanks, flarePath } from './combat';
import { driveSpeed } from './helm';
import { type CellContent, type Point, type WatchState, ZONE_SIZE } from './types';

/**
 * What the ship's computer can tell the captain before an order: courses, costs, where a
 * flare would go, what a volley would do. These are the original's `computer` requests, worked
 * out without touching the random stream, so a preview never changes the watch.
 */

export interface Course {
  /** Whole degrees clockwise from north, 0–360. */
  bearing: number;
  /** In zones; one cell is 0.1. */
  distance: number;
}

/** The original's course calculation, from the ship to a cell of any zone. */
export function courseTo(s: WatchState, zone: Point, cell: Point): Course {
  const dRow = s.ship.zone.row + s.ship.cell.row / ZONE_SIZE - (zone.row + cell.row / ZONE_SIZE);
  const dCol = zone.col + cell.col / ZONE_SIZE - (s.ship.zone.col + s.ship.cell.col / ZONE_SIZE);
  let angle = Math.atan2(dCol, dRow);
  if (angle < 0) angle += 2 * Math.PI;
  return { bearing: Math.trunc((angle * 180) / Math.PI + 0.5), distance: Math.hypot(dRow, dCol) };
}

export interface TravelCost {
  days: number;
  energy: number;
  /** Percent chance the drive strains (above factor 6). */
  strain: number;
  redline: boolean;
}

export function driveCost(
  s: WatchState,
  distance: number,
  factor = s.ship.drive,
  shieldUp = s.ship.shieldUp,
): TravelCost {
  const days = distance / driveSpeed(factor, s.params.driveTime);
  const energy = distance * factor ** 3 * (shieldUp ? 2 : 1);
  const strain = factor > 6 ? Math.min(100, 20 + 15 * (factor - 6)) : 0;
  return { days, energy, strain, redline: factor > 9 };
}

export function thrusterCost(distance: number): TravelCost {
  return { days: distance / 0.095, energy: 20 + 100 * distance, strain: 0, redline: false };
}

export interface PlottedCourse {
  cells: Point[];
  /** Where the ship would stop inside this zone, or its last cell before the edge. */
  stop: Point;
  leaves: boolean;
  blockedBy: CellContent | null;
}

/** The cells a course crosses inside the ship's zone, as `move` walks them. */
export function plotCourse(s: WatchState, course: Course): PlottedCourse {
  const angle = (course.bearing * Math.PI) / 180;
  let dRow = -Math.cos(angle);
  let dCol = Math.sin(angle);
  const bigger = Math.max(Math.abs(dRow), Math.abs(dCol));
  dRow /= bigger;
  dCol /= bigger;
  const steps = Math.trunc(ZONE_SIZE * course.distance * bigger + 0.5);
  let row = s.ship.cell.row + 0.5;
  let col = s.ship.cell.col + 0.5;
  const cells: Point[] = [];
  let stop = { ...s.ship.cell };
  for (let i = 0; i < steps; i++) {
    row += dRow;
    col += dCol;
    if (row < 0 || col < 0 || row >= ZONE_SIZE || col >= ZONE_SIZE) {
      return { cells, stop, leaves: true, blockedBy: null };
    }
    const at = { row: Math.trunc(row), col: Math.trunc(col) };
    const content = s.cells[at.row]![at.col]!;
    if (content !== 'empty') return { cells, stop, leaves: false, blockedBy: content };
    cells.push(at);
    stop = at;
  }
  return { cells, stop, leaves: false, blockedBy: null };
}

export interface FlarePreview {
  path: Point[];
  end: string;
  at: Point | null;
  /** The widest a flare strays from this bearing, in degrees, without a misfire. */
  scatter: number;
}

export function previewFlare(s: WatchState, bearing: number): FlarePreview {
  const flight = flarePath(s.ship.cell, Math.round(bearing), (at) => s.cells[at.row]![at.col]!);
  const widen =
    s.ship.condition === 'moored' ? 2 : s.ship.shieldUp ? 1 + s.ship.shield / s.params.shield : 1;
  return { path: flight.path, end: flight.end, at: flight.at, scatter: Math.round(12 * widen) };
}

export interface BeamTarget {
  at: Point;
  power: number;
  /** Damage at the formula's middle luck. */
  expected: number;
  stopped: boolean;
}

/**
 * The automatic volley played out at a fixed luck (0 the worst, 1 the best roll of the beam
 * formula): what each gleaner would take. Middle luck is what the sheet shows.
 */
export function previewBeams(
  s: WatchState,
  energy: number,
  luck = 0.5,
): { targets: BeamTarget[]; wasted: number } {
  const gleaners = s.gleaners.map((g) => ({ ...g }));
  const view = { gleaners, ship: s.ship };
  const { banks, overkill } = automaticBanks(view, Math.trunc(energy));
  const taken = new Map<string, number>();
  let wasted = overkill;
  const alive = [...gleaners];
  for (const source of banks) {
    let units = source.units;
    if (units <= 0) continue;
    let k = 0;
    const count = alive.length;
    for (let j = 0; j < count && units > 0; j++) {
      const g = alive[k];
      if (!g) break;
      const reach = (((3 + luck) * 3 * 10.596) / (g.dist * g.dist + 150)) * units;
      const hit = Math.trunc(Math.cos(0.3) * reach + 0.5);
      g.power -= hit;
      units -= hit;
      const key = `${g.row},${g.col}`;
      taken.set(key, (taken.get(key) ?? 0) + hit);
      if (g.power <= 0) {
        alive.splice(k, 1);
        continue;
      }
      k++;
    }
    wasted += Math.max(0, units);
  }
  const targets = s.gleaners.map((g) => {
    const expected = taken.get(`${g.row},${g.col}`) ?? 0;
    return {
      at: { row: g.row, col: g.col },
      power: g.power,
      expected,
      stopped: expected >= g.power,
    };
  });
  return { targets, wasted };
}

/**
 * The least power that stops every gleaner here (the nearest six) whatever the luck, found by
 * bisection over the automatic volley at several luck levels. Worst luck alone is not enough:
 * a lucky hit overkills the nearest gleaner and leaves less of the bank for the next one. The
 * original's bank shares also shrink as they go, so adding up each gleaner's need falls short.
 * Capped at the ship's energy.
 */
export function energyToStopAll(s: WatchState): number {
  const ceiling = Math.max(0, Math.trunc(s.ship.energy));
  const lucks = [0, 0.25, 0.5, 0.75, 1];
  const stopsAll = (energy: number) =>
    lucks.every((luck) =>
      previewBeams(s, energy, luck)
        .targets.slice(0, 6)
        .every((t) => t.stopped),
    );
  if (s.gleaners.length === 0 || !stopsAll(ceiling)) return ceiling;
  let low = 0;
  let high = ceiling;
  while (high - low > 5) {
    const middle = Math.floor((low + high) / 2);
    if (stopsAll(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/**
 * Energy that stops a gleaner even at the formula's worst luck. The original's own estimate
 * (`energyNeeded`) multiplies by the angle constant instead of its cosine and asks for about
 * four times too much; it still caps the automatic banks, but nobody should aim by it.
 */
export function sureStopEnergy(gleaner: { power: number; dist: number }): number {
  const worstReach = (3 * 3 * 10.596 * Math.cos(0.3)) / (gleaner.dist * gleaner.dist + 150);
  return Math.ceil(gleaner.power / worstReach) + 1;
}

/** A volley that should stop every gleaner here, nearest first, within the ship's energy. */
export function suggestedBeamEnergy(s: WatchState): number {
  return energyToStopAll(s);
}

export type CallKind = 'threatened' | 'dark' | 'siege';

export interface KnownCall {
  kind: CallKind;
  zone: Point;
  world: number | null;
  /** When a threatened world falls or a besieged harbour is lost; null for a dark world. */
  deadline: number | null;
}

/** The calls the crew has heard about and that are still live, soonest first. */
export function knownCalls(s: WatchState): KnownCall[] {
  const calls: KnownCall[] = [];
  for (const event of s.events) {
    if (event.hidden || event.ghost) continue;
    if (event.kind === 'world-falls') {
      calls.push({
        kind: 'threatened',
        zone: event.zone,
        world: event.world,
        deadline: event.date,
      });
    } else if (event.kind === 'swarm-grows') {
      calls.push({ kind: 'dark', zone: event.zone, world: event.world, deadline: null });
    } else if (event.kind === 'harbour-falls') {
      calls.push({ kind: 'siege', zone: event.zone, world: null, deadline: event.date });
    }
  }
  return calls.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
}

export function systemsDown(s: WatchState): { system: string; until: number }[] {
  return s.events
    .filter((event) => event.kind === 'repair' && event.system)
    .map((event) => ({ system: event.system!, until: event.date }))
    .sort((a, b) => a.until - b.until);
}

/** Landing cells nearest the middle of a zone come first: that is where a captain aims. */
const LANDING_ORDER: readonly Point[] = Array.from({ length: ZONE_SIZE * ZONE_SIZE }, (_, i) => ({
  row: Math.trunc(i / ZONE_SIZE),
  col: i % ZONE_SIZE,
})).sort(
  (a, b) =>
    Math.hypot(a.row - 4.5, a.col - 4.5) - Math.hypot(b.row - 4.5, b.col - 4.5) ||
    a.row - b.row ||
    a.col - b.col,
);

/**
 * A course to another zone whose line out of this one is clear, the way the computer would
 * pick a landing spot. Null when every line out is blocked.
 */
export function clearCourseTo(s: WatchState, zone: Point): Course | null {
  for (const cell of LANDING_ORDER) {
    const course = courseTo(s, zone, cell);
    if (course.distance <= 0 || course.distance > 15) continue;
    if (!plotCourse(s, course).blockedBy) return course;
  }
  return null;
}
