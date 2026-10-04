import type { Pose } from './types';

/**
 * Grid geometry: distance, bearings and arcs of fire, ported from sail/misc.c:51-177 with the
 * two arc fixes and the true modulo that Broadside's port documents (its ADR 004).
 */

/** Row and column steps by heading. A ship's stern lies one step behind her bow. */
export const DR: readonly number[] = [0, 1, 1, 0, -1, -1, -1, 0, 1];
export const DC: readonly number[] = [0, 0, -1, -1, -1, 0, 1, 1, 1];
/** Squares covered on each axis when sailing N squares on a diagonal heading. */
export const DTAB: readonly number[] = [0, 1, 1, 2, 3, 4, 4, 5];

export const turnLeft = (d: number): number => (d === 1 ? 8 : d - 1);
export const turnRight = (d: number): number => (d === 8 ? 1 : d + 1);

/** The longer axis plus half the shorter, in whole squares. */
export function distance(dr: number, dc: number): number {
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  return ar >= ac ? ar + Math.trunc(ac / 2) : ac + Math.trunc(ar / 2);
}

/**
 * Compass octant (1 = north, clockwise) of the vector (dr, dc), where dr > 0 points north. The
 * original steps one octant for every boundary crossed at a ratio of 2.4; its edge cases are
 * kept, so the zero vector reads as west.
 */
export function angle(dr: number, dc: number): number {
  let i: number;
  if (dc >= 0 && dr > 0) i = 0;
  else if (dr <= 0 && dc > 0) i = 2;
  else if (dc <= 0 && dr < 0) i = 4;
  else i = 6;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  if ((i === 0 || i === 4) && ac * 2.4 > ar) {
    i++;
    if (ac > ar * 2.4) i++;
  } else if ((i === 2 || i === 6) && ar * 2.4 > ac) {
    i++;
    if (ar > ac * 2.4) i++;
  }
  return (i % 8) + 1;
}

export const sternOf = (p: Pose): { row: number; col: number } => ({
  row: p.row + DR[p.dir]!,
  col: p.col + DC[p.dir]!,
});

/** Range between two ships, each two squares long; -1 when `to` has left the battle. */
export function range(from: Pose, to: Pose): number {
  if (!to.dir) return -1;
  const bowToBow = distance(to.row - from.row, to.col - from.col);
  if (bowToBow >= 5) return bowToBow;
  const s1 = sternOf(from);
  const s2 = sternOf(to);
  return Math.min(
    bowToBow,
    distance(to.row - s1.row, to.col - s1.col),
    distance(from.row - s2.row, from.col - s2.col),
    distance(s2.row - s1.row, s2.col - s1.col),
  );
}

/** Bearing of `to` relative to `from`'s heading: 1 dead ahead, 5 dead astern. */
export function relativeBearing(from: Pose, to: Pose): number {
  let a = angle(from.row - to.row, to.col - from.col) - from.dir + 1;
  if (a < 1) a += 8;
  return a;
}

/**
 * Which broadside of `from` bears on `to`: 'R' (starboard), 'L' (port) or null. Each battery
 * covers three octants; the target's bow is tried first, then her stern.
 */
export function gunsBear(from: Pose, to: Pose): 'L' | 'R' | null {
  let dr = from.row - to.row;
  let dc = to.col - from.col;
  for (let i = 2; i; i--) {
    let a = angle(dr, dc) - from.dir + 1;
    if (a < 1) a += 8;
    if (a >= 2 && a <= 4) return 'R';
    if (a >= 6 && a <= 8) return 'L';
    dr -= DR[to.dir]!;
    dc += DC[to.dir]!;
  }
  return null;
}

/** Compass angle from `from` to `on`'s bow (or her stern, with `stern`). */
export function compassTo(from: Pose, on: Pose, stern = false): number {
  let dr = from.row - on.row;
  let dc = on.col - from.col;
  if (stern) {
    dr -= DR[on.dir]!;
    dc += DC[on.dir]!;
  }
  return angle(dr, dc);
}

/** True when `from` is firing into `on`'s starboard side. */
export function hitsStarboard(from: Pose, on: Pose): boolean {
  const a = compassTo(from, on);
  const rel = (((a + 4 - on.dir - 1) % 8) + 8) % 8;
  return rel + 1 < 5;
}
