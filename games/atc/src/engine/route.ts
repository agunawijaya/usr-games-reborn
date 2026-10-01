import type { Arena } from './arena';
import { type Cell, type Heading, HEADING_COUNT, sameCell, step, toHeading } from './geometry';

/**
 * Turning a drawn line into a flyable route. A plane turns at most a quarter turn per move, so
 * the route is searched over (cell, heading) pairs rather than cells alone: the result is the
 * shortest legal path through every waypoint in order, preferring straight lines when two paths
 * are equally short.
 */

export interface RouteStart {
  cell: Cell;
  heading: Heading;
}

export interface RouteOptions {
  /** The heading the route must arrive on at its last waypoint (a runway's landing heading). */
  arriveHeading?: Heading;
  /** The last waypoint may sit on the border (a gate). */
  endsAtGate?: boolean;
}

export interface PlannedRoute {
  /** Every cell the plane will fly through, in order, excluding where it starts. */
  cells: Cell[];
  /** Heading on arrival at the last cell. */
  heading: Heading;
}

const TURN_COST = 0.01;
const MAX_TURN = 2;

export function planRoute(
  arena: Arena,
  start: RouteStart,
  waypoints: readonly Cell[],
  options: RouteOptions = {},
): PlannedRoute | null {
  const cells: Cell[] = [];
  let from = start;
  for (const [index, target] of waypoints.entries()) {
    const last = index === waypoints.length - 1;
    const leg = planLeg(arena, from, target, {
      arriveHeading: last ? options.arriveHeading : undefined,
      allowBorderEnd: last && options.endsAtGate === true,
    });
    if (!leg) return null;
    cells.push(...leg.cells);
    from = { cell: target, heading: leg.heading };
  }
  return { cells, heading: from.heading };
}

interface LegOptions {
  arriveHeading: Heading | undefined;
  allowBorderEnd: boolean;
}

interface SearchNode {
  cell: Cell;
  heading: Heading;
  cost: number;
  parent: SearchNode | null;
}

function inside(arena: Arena, cell: Cell): boolean {
  return cell.x >= 1 && cell.x < arena.width - 1 && cell.y >= 1 && cell.y < arena.height - 1;
}

/** Dijkstra over (cell, heading); small enough (30 × 21 × 8 states) to run on every drag. */
function planLeg(
  arena: Arena,
  from: RouteStart,
  target: Cell,
  options: LegOptions,
): PlannedRoute | null {
  if (sameCell(from.cell, target) && options.arriveHeading === undefined) {
    return { cells: [], heading: from.heading };
  }
  const keyOf = (cell: Cell, heading: number) =>
    (cell.y * arena.width + cell.x) * HEADING_COUNT + heading;
  const best = new Map<number, number>();
  const open = new NodeQueue();
  open.push({ cell: from.cell, heading: from.heading, cost: 0, parent: null });
  best.set(keyOf(from.cell, from.heading), 0);

  while (open.size > 0) {
    const node = open.pop();
    if (node.cost > (best.get(keyOf(node.cell, node.heading)) ?? Infinity)) continue;
    const arrived =
      node.parent !== null &&
      sameCell(node.cell, target) &&
      (options.arriveHeading === undefined || node.heading === options.arriveHeading);
    if (arrived) return { cells: pathTo(node), heading: node.heading };

    for (let turn = -MAX_TURN; turn <= MAX_TURN; turn++) {
      const heading = toHeading(node.heading + turn);
      const cell = step(node.cell, heading);
      const isTarget = sameCell(cell, target);
      if (!inside(arena, cell) && !(isTarget && options.allowBorderEnd)) continue;
      const cost = node.cost + 1 + Math.abs(turn) * TURN_COST;
      const key = keyOf(cell, heading);
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      open.push({ cell, heading, cost, parent: node });
    }
  }
  return null;
}

/**
 * A binary heap ordered by cost, then by arrival, so equally short routes are chosen in the
 * order they were found and the planner stays deterministic.
 */
class NodeQueue {
  private readonly items: { node: SearchNode; order: number }[] = [];
  private arrivals = 0;

  get size(): number {
    return this.items.length;
  }

  push(node: SearchNode): void {
    const items = this.items;
    items.push({ node, order: this.arrivals++ });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(items[i]!, items[parent]!)) break;
      [items[i], items[parent]] = [items[parent]!, items[i]!];
      i = parent;
    }
  }

  pop(): SearchNode {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && this.before(items[left]!, items[smallest]!)) smallest = left;
        if (right < items.length && this.before(items[right]!, items[smallest]!)) smallest = right;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest]!, items[i]!];
        i = smallest;
      }
    }
    return top.node;
  }

  private before(a: { node: SearchNode; order: number }, b: { node: SearchNode; order: number }) {
    return a.node.cost < b.node.cost || (a.node.cost === b.node.cost && a.order < b.order);
  }
}

function pathTo(node: SearchNode): Cell[] {
  const cells: Cell[] = [];
  for (let at: SearchNode | null = node; at?.parent; at = at.parent) cells.push(at.cell);
  return cells.reverse();
}
