import { inBounds, isBlocked } from '../engine/layout';
import { STEPS, tangleAt, vacuumAt } from '../engine/rules';
import type { RoomState, Step } from '../engine/types';

/**
 * How the original program judged danger, which is what its built-in strategies see: a
 * square is deadly when any robot stands right next to it. That is exact for plain robots;
 * the rivals carry the same idea into rooms with mops and turbos, and pay for it.
 */

export function eatenClassic(state: RoomState, x: number, y: number): boolean {
  for (const v of state.vacuums) {
    if (v.alive && Math.abs(v.x - x) <= 1 && Math.abs(v.y - y) <= 1) return true;
  }
  return false;
}

/** The original's do_move check: on the field, nothing there, and not next to a robot. */
export function canStepClassic(state: RoomState, dx: Step, dy: Step): boolean {
  const x = state.cat.x + dx;
  const y = state.cat.y + dy;
  if (!inBounds(state.layout, x, y) || isBlocked(state.layout, x, y)) return false;
  if (vacuumAt(state.vacuums, x, y) || tangleAt(state.tangles, x, y)) return false;
  return !eatenClassic(state, x, y);
}

/** The original's must_telep: is there any square, staying put included, that is safe? */
export function mustTeleportClassic(state: RoomState): boolean {
  return !STEPS.some(([dx, dy]) => canStepClassic(state, dx, dy));
}
