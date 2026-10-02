import { createRng, type Rng } from '@usr-games/kit';
import { type ChamberPlan, layOutChamber, planRun } from './chambers';
import { pockets, type Round } from './round';
import { type Carry, carryOf, chamberRound, EMPTY_POCKETS } from './setup';

/**
 * A run: a chain of chambers going down. Each door asks the same question: bank what you carry
 * and end the run, or go deeper, where the glints are worth more and the snake is bolder. Your
 * pockets and the snake's boldness come with you.
 */
export interface Run {
  readonly seed: string;
  readonly plans: readonly ChamberPlan[];
  /** 0-based index into `plans`. */
  readonly index: number;
  readonly round: Round;
}

/**
 * Each chamber's layout comes from the seed and its depth alone, so a Daily Run's chambers are
 * the same for everyone however they played the one before.
 */
export function layoutRng(seed: string, depth: number): Rng {
  return createRng(`${seed}:chamber:${depth}`);
}

/** The stream for what happens in play: the snake's steps, new glints, warps and the dial. */
export function playRng(seed: string, depth: number): Rng {
  return createRng(`${seed}:play:${depth}`);
}

function enter(seed: string, plans: readonly ChamberPlan[], index: number, carry: Carry): Run {
  const plan = plans[index]!;
  const rng = layoutRng(seed, plan.depth);
  const layout = layOutChamber(plan, rng);
  return { seed, plans, index, round: chamberRound(plan, layout, carry, rng) };
}

export function startRun(seed: string, length: number): Run {
  const plans = planRun(createRng(`${seed}:plan`), length);
  return enter(seed, plans, 0, EMPTY_POCKETS);
}

export function currentPlan(run: Run): ChamberPlan {
  return run.plans[run.index]!;
}

export function isLastChamber(run: Run): boolean {
  return run.index >= run.plans.length - 1;
}

/** Through the door and down the steps, pockets and all. */
export function goDeeper(run: Run): Run {
  if (isLastChamber(run)) throw new RangeError('This is the last chamber.');
  return enter(run.seed, run.plans, run.index + 1, carryOf(run.round));
}

/** What banking now would put in the vault. A debt banks as nothing. */
export function bankable(run: Run): number {
  return Math.max(0, pockets(run.round));
}
