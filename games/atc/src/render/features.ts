import type { Arena, Runway } from '../engine/arena';
import { type Cell, STEPS } from '../engine/geometry';

/**
 * Where the fixed things of an arena sit, in cell units (a cell's centre is at x + 0.5). Both the
 * printed ground and the live layers read these, so a light drawn on the chart and the same light
 * flashing in a ripple always coincide.
 */

export interface Point {
  x: number;
  y: number;
}

export function centre(cell: Cell): Point {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

/** Unit vector of a heading, in cell units (diagonals normalised). */
export function headingVector(heading: number): Point {
  const step = STEPS[((heading % 8) + 8) % 8]!;
  const length = Math.hypot(step.x, step.y);
  return { x: step.x / length, y: step.y / length };
}

export const APPROACH_LIGHTS = 7;

/**
 * Approach lights run back from the runway threshold along the line planes land on, ordered from
 * the farthest to the nearest, which is the order a ripple runs in.
 */
export function approachLights(runway: Runway): Point[] {
  const c = centre(runway);
  const along = headingVector(runway.heading);
  const lights: Point[] = [];
  for (let i = APPROACH_LIGHTS - 1; i >= 0; i--) {
    const distance = 1.05 + i * 0.42;
    lights.push({ x: c.x - along.x * distance, y: c.y - along.y * distance });
  }
  return lights;
}

/** The runway strip: its two ends, the threshold first. */
export function runwayEnds(runway: Runway): [Point, Point] {
  const c = centre(runway);
  const along = headingVector(runway.heading);
  const half = 0.82;
  return [
    { x: c.x - along.x * half, y: c.y - along.y * half },
    { x: c.x + along.x * half, y: c.y + along.y * half },
  ];
}

/** Arena centre in cell units: where the scope's range rings are centred. */
export function arenaCentre(arena: Arena): Point {
  return { x: arena.width / 2, y: arena.height / 2 };
}
