import type { Rng } from '@usr-games/kit';
import { type ChamberLayout, type ChamberPlan, connected } from './chambers';
import { type Garden, openGarden } from './garden';
import { type Cell, reach } from './geometry';
import {
  CLASSIC_RULES,
  freeSquare,
  type Ledger,
  type Round,
  type RoundRules,
  RUN_RULES,
  SNAKE_LENGTH,
} from './round';
import { chase } from './snake';
import { chunkFor, SMALLEST_EDGE } from './value';

const NOWHERE: Cell = { x: -1, y: -1 };

interface Blank {
  readonly garden: Garden;
  readonly rules: RoundRules;
  readonly chunk: number;
  readonly appetite: number;
  readonly loot: number;
  readonly penalty: number;
  readonly ledger: Ledger | null;
}

function blankRound(b: Blank): Round {
  return { ...b, you: NOWHERE, glints: [], snake: [], heading: 0, moves: 0, pickups: 0, warps: 0 };
}

/**
 * The body grows behind the head the way the original's `main()` grows it: five chase steps
 * taken with empty pockets. It is a random walk, not six distinct squares: it can fold onto
 * itself.
 */
function growBody(round: Round, rng: Rng): Round {
  let next = round;
  while (next.snake.length < SNAKE_LENGTH) {
    const from = next.snake[next.snake.length - 1]!;
    const view = {
      garden: next.garden,
      you: next.you,
      forbidden: [...next.glints, next.garden.door],
      boldness: 0,
      heading: next.heading,
    };
    const step = chase(from, view, rng);
    next = {
      ...next,
      snake: [...next.snake, step.cell],
      heading: step.direction < 0 ? next.heading : step.direction,
    };
  }
  return next;
}

/**
 * The original game on an open board of the given size, laid out in its own order: the door,
 * then you, the treasure and the snake's head on random free squares, then the body. It can put
 * the snake right beside you; the original did.
 */
export function classicRound(width: number, height: number, rng: Rng): Round {
  if (Math.min(width, height) < SMALLEST_EDGE) {
    throw new RangeError(`A board needs edges of at least ${SMALLEST_EDGE}.`);
  }
  const blank = {
    rules: CLASSIC_RULES,
    chunk: chunkFor(width, height),
    appetite: 0,
    loot: 0,
    penalty: 0,
    ledger: null,
  };
  const placing = blankRound({ ...blank, garden: openGarden(width, height, NOWHERE) });
  const door = freeSquare(placing, rng);
  let round = blankRound({ ...blank, garden: openGarden(width, height, door) });
  round = { ...round, you: freeSquare(round, rng) };
  round = { ...round, glints: [freeSquare(round, rng)] };
  round = { ...round, snake: [freeSquare(round, rng)] };
  return growBody(round, rng);
}

/** What a run carries from one chamber into the next. */
export interface Carry {
  readonly loot: number;
  readonly penalty: number;
  readonly ledger: Ledger;
}

export const EMPTY_POCKETS: Carry = { loot: 0, penalty: 0, ledger: { gross: 0, spent: 0 } };

/** No segment of the snake starts within this many squares of you. */
export const FAIR_DISTANCE = 6;
/** And its head starts at least this far away, so three steps can never be forced into it. */
export const HEAD_DISTANCE = 7;

/**
 * A chamber of a run: you come in at its start, the glints and the snake go on free squares,
 * and the snake always starts well away from you, unlike the original.
 */
export function chamberRound(
  plan: ChamberPlan,
  layout: ChamberLayout,
  carry: Carry,
  rng: Rng,
): Round {
  const blank = blankRound({
    garden: layout.garden,
    rules: { ...RUN_RULES, wakeAt: plan.wakeAt, peekAlways: plan.peekAlways },
    chunk: Math.round(chunkFor(plan.width, plan.height) * plan.rate),
    appetite: plan.appetite,
    loot: carry.loot,
    penalty: carry.penalty,
    ledger: carry.ledger,
  });
  let round: Round = { ...blank, you: layout.start };
  for (let i = 0; i < plan.glints; i++)
    round = { ...round, glints: [...round.glints, freeSquare(round, rng)] };
  for (;;) {
    let head = freeSquare(round, rng);
    while (reach(head, round.you) < HEAD_DISTANCE) head = freeSquare(round, rng);
    const grown = growBody({ ...round, snake: [head], heading: 0 }, rng);
    if (!grown.snake.every((s) => reach(s, round.you) >= FAIR_DISTANCE)) continue;
    // A sleeping snake lies still, so it must not lie across the only way through.
    if (plan.wakeAt > 0 && !connected(withHedges(layout.garden, grown.snake))) continue;
    return grown;
  }
}

function withHedges(garden: Garden, cells: readonly Cell[]): Garden {
  const ground = [...garden.ground];
  for (const c of cells) ground[c.y * garden.width + c.x] = 'hedge';
  return { ...garden, ground };
}

export function carryOf(round: Round): Carry {
  return { loot: round.loot, penalty: round.penalty, ledger: round.ledger ?? EMPTY_POCKETS.ledger };
}
