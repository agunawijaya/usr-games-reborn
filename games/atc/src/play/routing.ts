import { type Arena, type Place, placeLabel } from '../engine/arena';
import { type Cell, sameCell } from '../engine/geometry';
import { planRoute } from '../engine/route';
import { CEILING, type Plane, planeName } from '../engine/world';
import type { Point } from '../render/features';

/**
 * Drawing a route with the pointer. The pointer's path picks the waypoints: a beacon it passes
 * over is pinned, and where it rests at the end snaps to a gate, a runway, a beacon or the cell
 * underneath. The route itself always comes from the route planner, so it is legal by
 * construction; this module only decides where it goes and whether that makes sense.
 */

export type Feature =
  | { kind: 'gate'; index: number; cell: Cell }
  | { kind: 'runway'; index: number; cell: Cell }
  | { kind: 'beacon'; index: number; cell: Cell }
  | { kind: 'cell'; cell: Cell };

/** How close the pointer must come to a fixed point to snap to it, in cells. */
const SNAP = 0.75;

export function featureAt(arena: Arena, point: Point, snapping: boolean): Feature {
  const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
  if (snapping) {
    const near = (c: Cell) => Math.hypot(c.x + 0.5 - point.x, c.y + 0.5 - point.y) <= SNAP;
    const gate = arena.gates.findIndex(near);
    if (gate >= 0) return { kind: 'gate', index: gate, cell: arena.gates[gate]! };
    const runway = arena.runways.findIndex(near);
    if (runway >= 0) return { kind: 'runway', index: runway, cell: arena.runways[runway]! };
    const beacon = arena.beacons.findIndex(near);
    if (beacon >= 0) return { kind: 'beacon', index: beacon, cell: arena.beacons[beacon]! };
  }
  return { kind: 'cell', cell };
}

export interface Sketch {
  /** Beacons the pointer has passed over, in order. */
  pinned: number[];
  end: Feature;
}

export function startSketch(): Sketch {
  return { pinned: [], end: { kind: 'cell', cell: { x: -1, y: -1 } } };
}

/** Follows the pointer: pins beacons it crosses, unpins one it backs away from. */
export function extendSketch(sketch: Sketch, feature: Feature): Sketch {
  const pinned = [...sketch.pinned];
  if (feature.kind === 'beacon') {
    const at = pinned.indexOf(feature.index);
    if (at < 0) pinned.push(feature.index);
    else pinned.splice(at + 1);
  }
  return { pinned, end: feature };
}

export interface Draft {
  cells: Cell[];
  valid: boolean;
  /** One line under the ghost route: where it goes, or why it cannot. */
  label: string;
}

function placeOf(feature: Feature): Place | null {
  return feature.kind === 'gate' || feature.kind === 'runway'
    ? { kind: feature.kind, index: feature.index }
    : null;
}

function samePlace(a: Place, b: Place | null): boolean {
  return b !== null && a.kind === b.kind && a.index === b.index;
}

export function draftRoute(arena: Arena, plane: Plane, sketch: Sketch): Draft {
  const name = planeName(plane);
  if (plane.onGround)
    return {
      cells: [],
      valid: false,
      label: `${name} is on the ground: give it an altitude first`,
    };
  const end = sketch.end;
  const endPlace = placeOf(end);
  if (endPlace && !samePlace(plane.destination, endPlace)) {
    return {
      cells: [],
      valid: false,
      label: `${placeLabel(endPlace)} is not where ${name} is going (${placeLabel(plane.destination)})`,
    };
  }
  const waypoints: Cell[] = sketch.pinned
    .map((i) => arena.beacons[i]!)
    .filter((beacon, i, list) => !sameCell(beacon, end.cell) || i < list.length - 1);
  if (!(
    end.kind === 'beacon' &&
    waypoints.length > 0 &&
    sameCell(waypoints[waypoints.length - 1]!, end.cell)
  )) {
    waypoints.push(end.cell);
  }
  const toRunway = end.kind === 'runway';
  const planned = planRoute(arena, { cell: plane, heading: plane.heading }, waypoints, {
    arriveHeading: toRunway ? arena.runways[end.index]!.heading : undefined,
    endsAtGate: end.kind === 'gate',
  });
  if (!planned || planned.cells.length === 0) {
    return {
      cells: [],
      valid: false,
      label: 'No legal route there: a plane turns at most 90° a move',
    };
  }
  const via = sketch.pinned.map((i) => `B${i}`).join(', ');
  const target = endPlace ? placeLabel(endPlace) : end.kind === 'beacon' ? `B${end.index}` : 'here';
  const moves = planned.cells.length;
  if (toRunway && plane.altitude > moves) {
    return {
      cells: planned.cells,
      valid: true,
      label: `${name} is too high to land in ${moves} moves: draw it longer`,
    };
  }
  if (end.kind === 'gate' && CEILING - plane.altitude > moves) {
    return {
      cells: planned.cells,
      valid: true,
      label: `${name} cannot climb to 9 000 ft in ${moves} moves`,
    };
  }
  const action = toRunway ? 'lands on' : end.kind === 'gate' ? 'leaves by' : 'flies to';
  return {
    cells: planned.cells,
    valid: true,
    label: `${name} ${action} ${target}${via ? ` via ${via}` : ''} · ${moves} moves`,
  };
}
