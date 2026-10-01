import { restoreRng, type Rng } from '@usr-games/kit';
import type { Beat } from './beats';
import type { LossReason, Outcome, WatchState } from './types';

/**
 * Everything one order works with: the state (mutated in place on a private copy), the random
 * stream, the beats it produces, and the per-order bookkeeping the original kept in `Move`.
 */

export interface OrderInfo {
  /** Free orders (scans, settings) give the gleaners no turn. */
  free: boolean;
  shieldChanged: boolean;
  /** 0 in the same zone, 1 just arrived, 2 leaving: picks the gleaners' move odds. */
  zoneMoment: 0 | 1 | 2;
  resting: boolean;
  /** Days this order took. */
  time: number;
}

export interface Ctx {
  s: WatchState;
  rng: Rng;
  beats: Beat[];
  order: OrderInfo;
}

/** Thrown to end the watch from deep inside a rule, the way the original long-jumped home. */
export class EndOfWatch extends Error {
  constructor(readonly outcome: Outcome) {
    super(outcome.kind);
  }
}

export function makeCtx(s: WatchState): Ctx {
  return {
    s,
    rng: restoreRng(s.rng),
    beats: [],
    order: { free: true, shieldChanged: false, zoneMoment: 0, resting: false, time: 0 },
  };
}

/** A whole number in [0, n), or 0 when n is not positive, like the original's `ranf`. */
export function ranf(ctx: Ctx, n: number): number {
  if (n <= 0) return 0;
  return Math.floor(ctx.rng.next() * n);
}

/** A float in [0, 1). */
export function franf(ctx: Ctx): number {
  return ctx.rng.next();
}

/** A float in (0, 1], safe to take the logarithm of. */
export function franfOpen(ctx: Ctx): number {
  return 1 - ctx.rng.next();
}

export function emit(ctx: Ctx, beat: Beat) {
  ctx.beats.push(beat);
}

export function lose(ctx: Ctx, reason: LossReason): never {
  emit(ctx, { type: 'lost', reason });
  throw new EndOfWatch({ kind: 'lost', reason });
}

export function win(ctx: Ctx): never {
  emit(ctx, { type: 'won' });
  throw new EndOfWatch({ kind: 'won' });
}
