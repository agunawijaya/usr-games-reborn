import type { Rng } from '@usr-games/kit';
import { type Garden, groundAt, isOpen } from './garden';
import { type Cell, isDiagonal, moved, same } from './geometry';
import { chase, type ChaseView } from './snake';
import { LOOT_PER_PICKUP, pocketValue, WARP_PENALTY_DIVISOR } from './value';

/** The snake is six squares long, head first. */
export const SNAKE_LENGTH = 6;

/**
 * What a run counts in glints. Classic keeps the original's single sum (`cashvalue`); a run's
 * chambers each pay their own rate, so it keeps a ledger: everything ever picked up, and
 * everything warping has cost (a tenth of that total each time, as the original charged).
 */
export interface Ledger {
  readonly gross: number;
  readonly spent: number;
}

export interface RoundRules {
  /** The original walks in four directions only. */
  readonly diagonals: boolean;
  /** The original keeps the top-left strip free of treasure for its score display. */
  readonly scoreStrip: boolean;
  /** Pickups in this chamber before a sleeping snake wakes; 0 when it starts awake. */
  readonly wakeAt: number;
  /** The mirror chamber: peeking always points the way. */
  readonly peekAlways: boolean;
  /**
   * How far out of line peeking still points. Null keeps the original's fractions of the board
   * (a twelfth of the width, a seventh of the height); a run's small chambers use what those
   * fractions came to on the original's own 78 × 22 board instead.
   */
  readonly peekSpan: { readonly columns: number; readonly rows: number } | null;
}

export const CLASSIC_RULES: RoundRules = {
  diagonals: false,
  scoreStrip: true,
  wakeAt: 0,
  peekAlways: false,
  peekSpan: null,
};
export const RUN_RULES: RoundRules = {
  diagonals: true,
  scoreStrip: false,
  wakeAt: 0,
  peekAlways: false,
  peekSpan: { columns: Math.trunc(78 / 12), rows: Math.trunc(22 / 7) },
};

/** Everything one chamber's play needs, as plain data. */
export interface Round {
  readonly garden: Garden;
  readonly you: Cell;
  /** The treasure on the ground: one glint, or two in a twin chamber. */
  readonly glints: readonly Cell[];
  /** Head first; segments may share a square, as they could in the original. */
  readonly snake: readonly Cell[];
  /** The direction the snake took last (`oldw`). */
  readonly heading: number;
  /** The original's loot: 25 a pickup. It drives the snake's boldness, and carries through a run. */
  readonly loot: number;
  /** Warp penalties, in loot. */
  readonly penalty: number;
  /** What one pickup is worth here (the original's `chunk`, times the chamber's rate in a run). */
  readonly chunk: number;
  /** A run's chamber adds its own appetite to the snake's boldness; 0 in Classic. */
  readonly appetite: number;
  /** A run's glints; null in Classic, which works them out from loot. */
  readonly ledger: Ledger | null;
  readonly rules: RoundRules;
  readonly moves: number;
  /** Pickups in this chamber (the sleeping snake counts them). */
  readonly pickups: number;
  readonly warps: number;
}

export function pockets(round: Round): number {
  if (round.ledger) return round.ledger.gross - round.ledger.spent;
  return pocketValue(round.chunk, round.loot, round.penalty);
}

export function isAsleep(round: Round): boolean {
  return round.pickups < round.rules.wakeAt;
}

export function chaseView(round: Round): ChaseView {
  return {
    garden: round.garden,
    you: round.you,
    forbidden: [...round.glints, round.garden.door],
    boldness: round.loot + round.appetite,
    heading: round.heading,
  };
}

/** `snrand()`: a random free square, not under you, a glint, the door or the snake. */
export function freeSquare(round: Round, rng: Rng): Cell {
  const { garden } = round;
  for (;;) {
    const cell = { x: rng.int(0, garden.width - 1), y: rng.int(0, garden.height - 1) };
    if (round.rules.scoreStrip && cell.y === 0 && cell.x < 5) continue;
    if (!isOpen(garden, cell)) continue;
    if (same(cell, round.you) || same(cell, garden.door)) continue;
    if (round.glints.some((g) => same(g, cell))) continue;
    if (round.snake.some((s) => same(s, cell))) continue;
    return cell;
  }
}

export type CaughtBy = 'head' | 'body' | 'tail';

export type TurnEvent =
  | { readonly kind: 'bump' }
  | { readonly kind: 'step'; readonly to: Cell }
  | { readonly kind: 'pickup'; readonly at: Cell; readonly glintAt: Cell; readonly worth: number }
  | { readonly kind: 'door' }
  | { readonly kind: 'snake'; readonly direction: number; readonly swimming: boolean }
  | { readonly kind: 'wake' }
  | { readonly kind: 'caught'; readonly by: CaughtBy };

export interface Turn {
  readonly round: Round;
  readonly events: readonly TurnEvent[];
}

/** Whether a body laid out as `snake`, with `oldTail` just vacated, has caught you at `you`. */
function caughtBy(snake: readonly Cell[], oldTail: Cell | null, you: Cell): CaughtBy | null {
  const hit = snake.findIndex((segment) => same(segment, you));
  if (hit === 0) return 'head';
  if (hit > 0) return 'body';
  return oldTail && same(oldTail, you) ? 'tail' : null;
}

/**
 * One step of the snake (`pushsnake()`): every segment moves up one place, the head chases from
 * where it was, and you are caught if any segment is on you, or if you stand on the square the
 * tail just left (the original's way of catching a player who steps onto the tail).
 */
function snakeStep(round: Round, rng: Rng, swimming: boolean): Turn {
  const oldTail = round.snake[round.snake.length - 1]!;
  const head = round.snake[0]!;
  const step = chase(head, chaseView(round), rng);
  const snake = [step.cell, ...round.snake.slice(0, -1)];
  const heading = step.direction < 0 ? round.heading : step.direction;
  const next = { ...round, snake, heading };
  const events: TurnEvent[] = [{ kind: 'snake', direction: step.direction, swimming }];
  const by = caughtBy(snake, oldTail, round.you);
  if (by) events.push({ kind: 'caught', by });
  return { round: next, events };
}

/**
 * The snake's half of a turn. Asleep, it lies still (though walking into it still counts). In
 * a pool it swims: a second step straight after the first.
 */
export function snakeTurn(round: Round, rng: Rng): Turn {
  if (isAsleep(round)) {
    const by = caughtBy(round.snake, null, round.you);
    return { round, events: by ? [{ kind: 'caught', by }] : [] };
  }
  const swimming = groundAt(round.garden, round.snake[0]!) === 'pool';
  const first = snakeStep(round, rng, false);
  if (!swimming || first.events.some((e) => e.kind === 'caught')) return first;
  const second = snakeStep(first.round, rng, true);
  return { round: second.round, events: [...first.events, ...second.events] };
}

function pickUp(round: Round, at: Cell, index: number, rng: Rng): Turn {
  const placed = { ...round, glints: round.glints.filter((_, i) => i !== index) };
  const glintAt = freeSquare(placed, rng);
  const wasAsleep = isAsleep(round);
  const next: Round = {
    ...round,
    glints: round.glints.map((g, i) => (i === index ? glintAt : g)),
    loot: round.loot + LOOT_PER_PICKUP,
    ledger: round.ledger && { ...round.ledger, gross: round.ledger.gross + round.chunk },
    pickups: round.pickups + 1,
  };
  const events: TurnEvent[] = [{ kind: 'pickup', at, glintAt, worth: round.chunk }];
  if (wasAsleep && !isAsleep(next)) events.push({ kind: 'wake' });
  return { round: next, events };
}

/**
 * Your step, then the snake's. Walking into a wall or a hedge is a bump that costs nothing
 * (the original spent the turn anyway). Picking up a glint or reaching the door ends the turn
 * before the snake moves, exactly as the original's `continue` and exit do.
 */
export function step(round: Round, direction: number, rng: Rng): Turn {
  if (!round.rules.diagonals && isDiagonal(direction)) {
    return { round, events: [{ kind: 'bump' }] };
  }
  const to = moved(round.you, direction);
  if (!isOpen(round.garden, to)) return { round, events: [{ kind: 'bump' }] };
  const walked: Round = { ...round, you: to, moves: round.moves + 1 };
  const stepped: TurnEvent = { kind: 'step', to };
  const picked = walked.glints.findIndex((g) => same(g, to));
  if (picked >= 0) {
    const pickup = pickUp(walked, to, picked, rng);
    return { round: pickup.round, events: [stepped, ...pickup.events] };
  }
  if (same(to, walked.garden.door)) return { round: walked, events: [stepped, { kind: 'door' }] };
  const snake = snakeTurn(walked, rng);
  return { round: snake.round, events: [stepped, ...snake.events] };
}

/** What a warp would cost right now, in glints. */
export function warpCost(round: Round): number {
  if (round.ledger) return Math.trunc(round.ledger.gross / WARP_PENALTY_DIVISOR);
  return (
    pockets(round) -
    pocketValue(
      round.chunk,
      round.loot,
      round.penalty + Math.trunc(round.loot / WARP_PENALTY_DIVISOR),
    )
  );
}

/** `spacewarp(0)`: you land on a random free square and a tenth of your loot becomes penalty. */
export function warp(round: Round, rng: Rng): Round {
  return {
    ...round,
    you: freeSquare(round, rng),
    penalty: round.penalty + Math.trunc(round.loot / WARP_PENALTY_DIVISOR),
    ledger: round.ledger && { ...round.ledger, spent: round.ledger.spent + warpCost(round) },
    warps: round.warps + 1,
  };
}

export interface LuckyBreak {
  /** The digit the pockets end on (the original's `cashvalue % 10`, negative in debt). */
  readonly digit: number;
  /** The digit the wheel stops on. */
  readonly roll: number;
  readonly escaped: boolean;
  /** After an escape: you are elsewhere, and the penalty has been folded into the loot. */
  readonly round: Round;
}

/**
 * The capture roll, a pinball-style match: a digit from eight random bits modulo ten (so 0 to 5 come
 * up a shade more often than 6 to 9) against the last digit of your pockets. A match throws you
 * clear. It refunds nothing: the penalty is subtracted from the loot and reset, so the pockets
 * show the same worth and the snake grows a little less bold.
 */
export function luckyBreak(round: Round, rng: Rng): LuckyBreak {
  const digit = pockets(round) % 10;
  const roll = rng.int(0, 255) % 10;
  if (roll !== digit) return { digit, roll, escaped: false, round };
  const landed = { ...round, you: freeSquare(round, rng) };
  return {
    digit,
    roll,
    escaped: true,
    round: { ...landed, loot: round.loot - round.penalty, penalty: 0 },
  };
}

/** The chance of a Lucky Break for a given last digit: 26 in 256 for 0–5, 25 for 6–9, none below 0. */
export function luckyChance(digit: number): number {
  if (digit < 0 || digit > 9) return 0;
  return (digit <= 5 ? 26 : 25) / 256;
}

export interface Peek {
  readonly target: 'glint' | 'door';
  /** The squares the arrows cover, from beside you to the target's row or column. */
  readonly path: readonly Cell[];
  /** The direction of each square's arrow. */
  readonly directions: readonly number[];
}

function line(from: Cell, to: Cell, axis: 'x' | 'y'): { path: Cell[]; directions: number[] } {
  const path: Cell[] = [];
  const directions: number[] = [];
  if (axis === 'y') {
    const dy = Math.sign(to.y - from.y);
    for (let y = from.y + dy; y !== to.y + dy; y += dy) {
      path.push({ x: from.x, y });
      directions.push(dy > 0 ? 4 : 0);
    }
  } else {
    const dx = Math.sign(to.x - from.x);
    for (let x = from.x + dx; x !== to.x + dx; x += dx) {
      path.push({ x, y: from.y });
      directions.push(dx > 0 ? 2 : 6);
    }
  }
  return { path, directions };
}

function stretch(round: Round, target: Cell): Omit<Peek, 'target'> | null {
  const { you, garden } = round;
  const span = round.rules.peekSpan ?? {
    columns: Math.trunc(garden.width / 12),
    rows: Math.trunc(garden.height / 7),
  };
  if (Math.abs(target.x - you.x) < span.columns && you.y !== target.y) {
    return line(you, target, 'y');
  }
  if (Math.abs(target.y - you.y) < span.rows && you.x !== target.x) {
    return line(you, target, 'x');
  }
  return null;
}

/** The mirror chamber's peek: down your column to the glint's row, then along it to the glint. */
function mirrorPath(round: Round, target: Cell): Omit<Peek, 'target'> | null {
  const { you } = round;
  if (same(you, target)) return null;
  const down =
    you.y === target.y ? { path: [], directions: [] } : line(you, { x: you.x, y: target.y }, 'y');
  const corner = { x: you.x, y: target.y };
  const across = corner.x === target.x ? { path: [], directions: [] } : line(corner, target, 'x');
  return {
    path: [...down.path, ...across.path],
    directions: [...down.directions, ...across.directions],
  };
}

/**
 * The original's `p`: arrows toward the treasure when it is nearly in line with you (within a
 * twelfth of the width across, or a seventh of the height up and down), else toward the door,
 * else a shrug. On narrow boards those fractions round down to nothing and peeking never helps.
 * In the mirror chamber it always shows the way to the nearest glint.
 */
export function peek(round: Round): Peek | null {
  if (round.rules.peekAlways) {
    const nearest = [...round.glints].sort(
      (a, b) =>
        Math.abs(a.x - round.you.x) +
        Math.abs(a.y - round.you.y) -
        Math.abs(b.x - round.you.x) -
        Math.abs(b.y - round.you.y),
    )[0];
    const found = nearest ? mirrorPath(round, nearest) : null;
    return found ? { target: 'glint', ...found } : null;
  }
  for (const glint of round.glints) {
    const found = stretch(round, glint);
    if (found) return { target: 'glint', ...found };
  }
  const door = stretch(round, round.garden.door);
  return door ? { target: 'door', ...door } : null;
}
