import type { Point } from './hand';
import { loopNoise } from './noise';

/**
 * The shape of a chamber in cross-section: an irregular hollow in the rock with a flattened
 * floor, and its tunnel mouths placed around the wall in the direction each tunnel's room lies on
 * the map, so the two views agree. Mouths never open in the middle of the floor, where the
 * explorer stands.
 */

export interface MouthPlan {
  to: number;
  /** Where on the wall it opens, as an angle from the chamber's centre (0 = right, y down). */
  angle: number;
}

export interface ChamberShape {
  center: Point;
  rx: number;
  ry: number;
  floorY: number;
  /** The wall as a closed loop of points. */
  wall: Point[];
  seed: number;
}

const FLOOR_FROM = 0.3 * Math.PI;
const FLOOR_TO = 0.7 * Math.PI;

export function chamberShape(width: number, height: number, seed: number): ChamberShape {
  const center = { x: width * 0.5, y: height * 0.53 };
  const rx = width * 0.355;
  const ry = height * 0.35;
  const floorY = center.y + ry * 0.74;
  const wall: Point[] = [];
  const steps = 160;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const swell = 1 + (loopNoise(angle, seed, 1.4, 4) - 0.5) * 0.42;
    let x = center.x + Math.cos(angle) * rx * swell;
    let y = center.y + Math.sin(angle) * ry * swell;
    // The floor is trodden flat, with a little give.
    const floor = floorY + (loopNoise(angle * 3, seed + 9, 2.2, 2) - 0.5) * height * 0.025;
    if (y > floor) y = floor;
    // A rounder, higher vault overhead.
    if (Math.sin(angle) < 0) y -= Math.sin(-angle) * ry * 0.06;
    x += (loopNoise(angle * 5, seed + 3, 1.2, 2) - 0.5) * width * 0.008;
    wall.push({ x, y });
  }
  return { center, rx, ry, floorY, wall, seed };
}

/** The point on the wall in a given direction from the centre. */
export function wallPoint(shape: ChamberShape, angle: number): Point {
  const steps = shape.wall.length;
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round((normalized / (Math.PI * 2)) * steps) % steps;
  return shape.wall[index]!;
}

export function wrap(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a < -Math.PI) a += Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  return a;
}

/**
 * Spreads the mouths round the wall: each starts in its room's map direction, mouths that would
 * open in the floor slide to the nearer lower corner, and crowded ones are eased apart.
 */
export function placeMouths(directions: { to: number; angle: number }[]): MouthPlan[] {
  const count = directions.length;
  const spacing = Math.min(0.62, (Math.PI * 1.55) / Math.max(1, count));
  const plans = directions.map((d) => ({ to: d.to, angle: avoidFloor(wrap(d.angle)) }));
  for (let round = 0; round < 80; round++) {
    plans.sort((a, b) => a.angle - b.angle);
    let moved = false;
    for (let i = 0; i < plans.length; i++) {
      const a = plans[i]!;
      const b = plans[(i + 1) % plans.length]!;
      if (plans.length < 2) break;
      let gap = b.angle - a.angle;
      if (i === plans.length - 1) gap += Math.PI * 2;
      if (gap < spacing) {
        const push = (spacing - gap) / 2 + 0.002;
        a.angle = avoidFloor(wrap(a.angle - push));
        b.angle = avoidFloor(wrap(b.angle + push));
        moved = true;
      }
    }
    if (!moved) break;
  }
  return plans.sort((a, b) => a.angle - b.angle);
}

export function avoidFloor(angle: number): number {
  const a = wrap(angle);
  if (a > FLOOR_FROM && a < FLOOR_TO) return a < Math.PI / 2 ? FLOOR_FROM : FLOOR_TO;
  return a;
}

/** Is a point inside the wall loop? Used to keep details in the rock or in the air. */
export function insideWall(shape: ChamberShape, p: Point): boolean {
  let inside = false;
  const wall = shape.wall;
  for (let i = 0, j = wall.length - 1; i < wall.length; j = i++) {
    const a = wall[i]!;
    const b = wall[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
