import { type Cell, type Heading, STEPS } from './geometry';

/**
 * An arena is one stretch of sky: its size, its gates on the border, its beacons and runways, the
 * airway lines drawn on the chart, and how fast traffic comes.
 */

export interface Gate extends Cell {
  /** Planes enter heading this way and must leave through it at 9 000 ft. */
  heading: Heading;
}

export interface Runway extends Cell {
  /** The only heading a plane may land on, and the one it takes off on. */
  heading: Heading;
}

export interface Airway {
  from: Cell;
  to: Cell;
}

/** Decoration only: how the chart's land and water are generated. Never affects the rules. */
export interface Scenery {
  seed: string;
  /** Which edge the sea lies along, if any. */
  coast?: 'north' | 'south' | 'east' | 'west';
  /** 0 flat lowland … 1 rugged hills. */
  relief?: number;
}

export interface Arena {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Seconds between ticks at the classic speed. */
  tickSeconds: number;
  /** A new plane arrives on a tick with a chance of one in this many. */
  spawnOneIn: number;
  gates: readonly Gate[];
  beacons: readonly Cell[];
  runways: readonly Runway[];
  airways: readonly Airway[];
  scenery: Scenery;
}

/** Where a flight comes from or is going: a gate on the border or a runway. */
export type Place = { kind: 'gate'; index: number } | { kind: 'runway'; index: number };

export function placeCell(arena: Arena, place: Place): Cell {
  const list = place.kind === 'gate' ? arena.gates : arena.runways;
  const found = list[place.index];
  if (!found) throw new Error(`${arena.id} has no ${place.kind} ${place.index}`);
  return found;
}

/** The short name the chart prints: E3 for a gate, A1 for a runway, as the original numbered them. */
export function placeLabel(place: Place): string {
  return `${place.kind === 'gate' ? 'E' : 'A'}${place.index}`;
}

export function isOnBorder(arena: Arena, cell: Cell): boolean {
  return cell.x < 1 || cell.x >= arena.width - 1 || cell.y < 1 || cell.y >= arena.height - 1;
}

/**
 * Everything an arena must get right before planes can fly it, in plain words: gates on the
 * border facing in, beacons and runways inside with room to land, airways straight or at 45°.
 */
export function arenaProblems(arena: Arena): string[] {
  const problems: string[] = [];
  const inside = (c: Cell) =>
    c.x >= 1 && c.x < arena.width - 1 && c.y >= 1 && c.y < arena.height - 1;
  arena.gates.forEach((gate, i) => {
    if (!isOnBorder(arena, gate)) problems.push(`gate E${i} is not on the border`);
    const step = STEPS[gate.heading]!;
    if (!inside({ x: gate.x + step.x, y: gate.y + step.y }))
      problems.push(`gate E${i} does not face inwards`);
  });
  arena.beacons.forEach((beacon, i) => {
    if (!inside(beacon)) problems.push(`beacon B${i} is not inside the arena`);
  });
  arena.runways.forEach((runway, i) => {
    if (!inside(runway)) problems.push(`runway A${i} is not inside the arena`);
    const step = STEPS[runway.heading]!;
    if (!inside({ x: runway.x - step.x, y: runway.y - step.y }))
      problems.push(`runway A${i} has no room to land`);
  });
  arena.airways.forEach(({ from, to }, i) => {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    if (dx !== 0 && dy !== 0 && dx !== dy) problems.push(`airway ${i} is not straight or at 45°`);
  });
  if (arena.gates.length + arena.runways.length < 2) problems.push('needs two gates or runways');
  return problems;
}
