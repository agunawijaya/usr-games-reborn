import type { Rng } from '@usr-games/kit';
import type { ChamberPlan } from '../engine/chambers';
import { type Garden, isOpen } from '../engine/garden';
import { type Cell, DIRECTIONS, ORTHOGONAL, reach, same } from '../engine/geometry';
import { stepRisks } from '../engine/risk';
import { isAsleep, luckyBreak, pockets, type Round, step, warp, warpCost } from '../engine/round';
import {
  bankable,
  currentPlan,
  goDeeper,
  isLastChamber,
  playRng,
  type Run,
  startRun,
} from '../engine/run';

/**
 * Two players that never tire, for the attract mode and for balance: a cautious one that takes
 * a glint or two and banks, and a greedy one that fills its pockets and always goes deeper.
 * Both read the snake exactly (the capture risk of every step) and walk the shortest way round
 * hedges and the snake's body.
 */
export interface BotStyle {
  readonly name: string;
  /** Glints to pick up in a chamber before making for the door. */
  readonly quota: (plan: ChamberPlan) => number;
  /** At a door: true goes deeper, false banks. */
  readonly deeper: (run: Run) => boolean;
  /** A step this risky makes the bot warp instead, if it can afford it. */
  readonly warpAt: number;
  /** How much it dislikes ending a step close to the snake's head. */
  readonly caution: number;
  /** How many steps of detour it would take to avoid a certain capture. */
  readonly riskAversion: number;
}

export const CAUTIOUS: BotStyle = {
  name: 'cautious',
  quota: () => 2,
  deeper: () => false,
  warpAt: 0.2,
  caution: 3,
  riskAversion: 1000,
};

export const GREEDY: BotStyle = {
  name: 'greedy',
  quota: (plan) => 8 + Math.floor(plan.depth / 2),
  deeper: (run) => !isLastChamber(run),
  warpAt: 0.45,
  caution: 1,
  riskAversion: 30,
};

/** Steps from every square to `target`, round hedges and the snake's body. */
export function distances(
  garden: Garden,
  target: Cell,
  blocked: readonly Cell[],
  diagonals: boolean,
): Int32Array {
  const field = new Int32Array(garden.width * garden.height).fill(-1);
  const index = (c: Cell) => c.y * garden.width + c.x;
  const isBlocked = (c: Cell) => blocked.some((b) => same(b, c)) && !same(c, target);
  const directions = diagonals ? DIRECTIONS.map((_, i) => i) : ORTHOGONAL;
  field[index(target)] = 0;
  const queue: Cell[] = [target];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const d of directions) {
      const step = DIRECTIONS[d]!;
      const next = { x: cell.x + step.dx, y: cell.y + step.dy };
      if (!isOpen(garden, next) || isBlocked(next) || field[index(next)]! >= 0) continue;
      field[index(next)] = field[index(cell)]! + 1;
      queue.push(next);
    }
  }
  return field;
}

/** The bot's step: the safest way toward its target, or null to warp out of trouble. */
export function chooseStep(round: Round, target: Cell, style: BotStyle): number | null {
  const field = distances(round.garden, target, round.snake, round.rules.diagonals);
  const head = round.snake[0]!;
  const awake = !isAsleep(round);
  const options = stepRisks(round).map((option) => {
    const distance = field[option.to.y * round.garden.width + option.to.x]!;
    const reached = same(option.to, target);
    // Keeping clear of the head matters only while it can move, and never stops a pickup.
    const near = awake && !reached ? Math.max(0, 3 - reach(option.to, head)) : 0;
    const steps = distance < 0 ? 200 : distance;
    return {
      ...option,
      steps,
      cost: option.risk * style.riskAversion + steps + near * style.caution,
    };
  });
  options.sort((a, b) => a.cost - b.cost || a.steps - b.steps);
  const best = options[0];
  if (!best) return null;
  // Walled off from its target (the snake across a corridor), it warps rather than pace about.
  const cut = field[round.you.y * round.garden.width + round.you.x]! < 0;
  if (cut && warpCost(round) <= Math.max(0, pockets(round))) return null;
  if (best.risk >= style.warpAt && warpCost(round) <= Math.max(0, pockets(round))) return null;
  return best.direction;
}

function nearestGlint(round: Round): Cell {
  return [...round.glints].sort((a, b) => reach(a, round.you) - reach(b, round.you))[0]!;
}

export interface RunOutcome {
  /** Glints banked, or null when the snake caught the bot for good. */
  readonly banked: number | null;
  /** The deepest chamber reached (1-based). */
  readonly deepest: number;
  readonly pickups: number;
  readonly warps: number;
  readonly luckyBreaks: number;
  readonly turns: number;
}

/** The most steps a bot takes in one chamber before it gives up on glints and leaves. */
const PATIENCE = 400;
/** A bot still in the same chamber after this many steps is stuck: a bug to report, not play. */
const STUCK = 3000;

export class StuckBot extends Error {}

export function playRun(seed: string, style: BotStyle, length: number): RunOutcome {
  let run = startRun(seed, length);
  let pickups = 0;
  let warps = 0;
  let luckyBreaks = 0;
  let turns = 0;
  for (;;) {
    const plan = currentPlan(run);
    const rng: Rng = playRng(seed, plan.depth);
    let round = run.round;
    let steps = 0;
    let atDoor = false;
    while (!atDoor) {
      const wantsGlints = round.pickups < style.quota(plan) && steps < PATIENCE;
      const target = wantsGlints ? nearestGlint(round) : round.garden.door;
      const direction = chooseStep(round, target, style);
      steps++;
      if (steps > STUCK)
        throw new StuckBot(`${style.name} stuck in chamber ${plan.depth} of ${seed}`);
      turns++;
      if (direction === null) {
        round = warp(round, rng);
        warps++;
        continue;
      }
      const turn = step(round, direction, rng);
      round = turn.round;
      for (const event of turn.events) {
        if (event.kind === 'pickup') pickups++;
        if (event.kind === 'door') atDoor = true;
        if (event.kind === 'caught') {
          const roll = luckyBreak(round, rng);
          if (!roll.escaped)
            return { banked: null, deepest: plan.depth, pickups, warps, luckyBreaks, turns };
          luckyBreaks++;
          round = roll.round;
        }
      }
    }
    run = { ...run, round };
    if (!style.deeper(run))
      return { banked: bankable(run), deepest: plan.depth, pickups, warps, luckyBreaks, turns };
    run = goDeeper(run);
  }
}
