import type { Rng } from '@usr-games/kit';
import { type Garden, isOpen } from './garden';
import { type Cell, DIRECTION_LENGTH, DIRECTIONS, moved, same } from './geometry';

/**
 * The snake's step, as `chase()` in snake.c takes it. A comment there owns up to leaving bugs in
 * on purpose so the snake would not play too well, and every one of those bugs is part of the
 * game, so this file follows it line by line:
 *
 * 1. Aim: of the eight directions, the one whose cosine with the line to you is largest (the
 *    first one wins a tie; standing on the head itself, north wins).
 * 2. Weigh: every direction it may take weighs 1, except the aimed one, which weighs loot / 10,
 *    so with empty pockets the snake never heads straight for you. The direction it took last
 *    time gets loot / 20 on top: the richer you are, the more it keeps its course.
 * 3. Draw: a ten-bit random number modulo the total picks the direction.
 *
 * It may not leave the board, step onto a glint or onto the door. Hedges stop it in Full
 * Pockets' chambers; the original had none.
 */

export interface ChaseView {
  readonly garden: Garden;
  readonly you: Cell;
  /** Squares the snake will not enter: the glints and the door. */
  readonly forbidden: readonly Cell[];
  /** The loot that drives its boldness: your loot, plus the chamber's own appetite in a run. */
  readonly boldness: number;
  /** The direction it took last time (`oldw`). */
  readonly heading: number;
}

/** Step 1: the direction that points most nearly at you. */
export function aimAt(from: Cell, you: Cell): number {
  const dx = you.x - from.x;
  const dy = you.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  let aim = 0;
  let best = 0;
  DIRECTIONS.forEach((step, index) => {
    const along = dx * step.dx + dy * step.dy;
    const cosine = distance > 0 ? along / (distance * DIRECTION_LENGTH[index]!) : 1;
    if (cosine > best) {
      best = cosine;
      aim = index;
    }
  });
  return aim;
}

function mayEnter(view: ChaseView, cell: Cell): boolean {
  return isOpen(view.garden, cell) && !view.forbidden.some((f) => same(f, cell));
}

/** Step 2: the weight of each of the eight directions, zero where the snake may not go. */
export function chaseWeights(from: Cell, view: ChaseView): number[] {
  const aim = aimAt(from, view.you);
  // A Lucky Break in debt leaves the loot below zero; the original's weights went negative with
  // it and its draw misbehaved. Here a snake can be timid, never less than timid.
  const bold = Math.max(0, Math.trunc(view.boldness / 10));
  const steady = Math.max(0, Math.trunc(view.boldness / 20));
  return DIRECTIONS.map((_, index) => {
    if (!mayEnter(view, moved(from, index))) return 0;
    return (index === aim ? bold : 1) + (index === view.heading ? steady : 0);
  });
}

/**
 * When every weight is zero the original divides by zero and stops. That happens only when the
 * aimed square is the one way out and your pockets are nearly empty; here the snake takes it.
 * With no way out at all, it stays where it is.
 */
function fallbackDirection(from: Cell, view: ChaseView): number {
  const aim = aimAt(from, view.you);
  if (mayEnter(view, moved(from, aim))) return aim;
  return -1;
}

export interface SnakeStep {
  readonly cell: Cell;
  /** The direction taken, or -1 when the snake had nowhere to go. */
  readonly direction: number;
}

/** Step 3: one step of the snake's head from `from`. */
export function chase(from: Cell, view: ChaseView, rng: Rng): SnakeStep {
  const weights = chaseWeights(from, view);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) {
    const direction = fallbackDirection(from, view);
    return { cell: direction < 0 ? from : moved(from, direction), direction };
  }
  // `((random() >> 6) & 01777) % w`: ten random bits, folded onto the total.
  let roll = rng.int(0, 1023) % total;
  let direction = 0;
  while (roll >= weights[direction]!) {
    roll -= weights[direction]!;
    direction++;
  }
  return { cell: moved(from, direction), direction };
}

export interface StrikeChance {
  readonly cell: Cell;
  readonly chance: number;
}

/**
 * Where the head may land next turn and how likely each square is, counting the modulo fold of
 * the ten random bits exactly (it favours the first directions very slightly).
 */
export function strikeChances(from: Cell, view: ChaseView): StrikeChance[] {
  const weights = chaseWeights(from, view);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) {
    const direction = fallbackDirection(from, view);
    return direction < 0 ? [] : [{ cell: moved(from, direction), chance: 1 }];
  }
  // Of the 1024 ten-bit values, each remainder below `1024 % total` turns up once more than the
  // rest; a direction owns the remainders its weight covers, in order.
  const base = Math.floor(1024 / total);
  const extra = 1024 % total;
  let start = 0;
  const counts = weights.map((weight) => {
    const end = start + weight;
    const count = weight * base + Math.max(0, Math.min(end, extra) - Math.min(start, extra));
    start = end;
    return count;
  });
  return counts.flatMap((count, direction) =>
    count > 0 ? [{ cell: moved(from, direction), chance: count / 1024 }] : [],
  );
}

/** The chance that the snake's next step is aimed straight at you: its boldness, as a number. */
export function boldnessChance(from: Cell, view: ChaseView): number {
  const aimed = moved(from, aimAt(from, view.you));
  return strikeChances(from, view).find((s) => same(s.cell, aimed))?.chance ?? 0;
}
