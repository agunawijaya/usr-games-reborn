import { type GlintTier } from './glint';
import { hash } from './noise';
import type { Point } from './shapes';

/**
 * The shapes of the signature moments, as plain geometry for the view to draw: the coil round
 * you when you are caught, the glints spilling from your burst satchel, and the stream that
 * pours into the vault when you bank.
 */

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * The snake's spine wrapped round a point: the tail on the outside, the head finishing on top of
 * the coil and turned toward you. `progress` 0 is the snake as it lay, 1 the full coil.
 */
export function coilSpine(
  from: readonly Point[],
  centre: Point,
  cell: number,
  progress: number,
): Point[] {
  const turns = 1.55;
  const count = 26;
  const start = -Math.PI * 0.35;
  const coil = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const angle = start - t * turns * Math.PI * 2;
    const radius = cell * (0.74 + t * 0.56);
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius * 0.9 };
  });
  const p = easeOut(clamp01(progress));
  if (p >= 1) return coil;
  // On the way: every point of the old body slides to its place on the coil.
  return coil.map((target, i) => {
    const source = from[Math.min(from.length - 1, Math.floor((i / count) * from.length))] ?? target;
    return { x: source.x + (target.x - source.x) * p, y: source.y + (target.y - source.y) * p };
  });
}

export interface FlyingGlint {
  readonly x: number;
  readonly y: number;
  readonly tier: GlintTier;
  /** Height above the stones, for the arc and the shadow. */
  readonly lift: number;
  readonly tumble: number;
  readonly landed: boolean;
}

/** Glints bursting from the satchel and rolling away over the flagstones. */
export function spill(
  origin: Point,
  cell: number,
  count: number,
  seed: number,
  progress: number,
  tiers: readonly GlintTier[],
): FlyingGlint[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = hash(i, 1, seed) * Math.PI * 2;
    const distance = cell * (1.25 + hash(i, 2, seed) * 2.2);
    const delay = hash(i, 3, seed) * 0.25;
    const t = clamp01((progress - delay) / 0.7);
    const e = easeOut(t);
    const end = {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance * 0.85,
    };
    return {
      x: origin.x + (end.x - origin.x) * e,
      y: origin.y + (end.y - origin.y) * e,
      tier: tiers[i % tiers.length]!,
      lift: Math.sin(Math.PI * t) * cell * (0.6 + hash(i, 4, seed) * 0.6),
      tumble: (hash(i, 5, seed) - 0.5) * 9 * t,
      landed: t >= 1,
    };
  });
}

/** The fall from the upturned satchel into the open vault, bowing out a little as it drops. */
export function pourPath(from: Point, into: Point, cell: number): (t: number) => Point {
  const control = { x: (from.x + into.x) / 2 + cell * 0.22, y: from.y + (into.y - from.y) * 0.25 };
  return (t: number) => ({
    x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * control.x + t * t * into.x,
    y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * control.y + t * t * into.y,
  });
}

/** Glints in the stream at a moment: evenly spaced along the arc, moving on. */
export function pourStream(
  path: (t: number) => Point,
  time: number,
  count: number,
  tiers: readonly GlintTier[],
) {
  return Array.from({ length: count }, (_, i) => {
    const t = (time * 0.9 + i / count) % 1;
    // Falling, so they gather speed: slow out of the satchel, fast into the vault.
    const fall = t * t;
    return { ...path(fall), t: fall, tier: tiers[i % tiers.length]!, tumble: fall * 6 + i };
  });
}
