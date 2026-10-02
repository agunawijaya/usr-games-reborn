import { restoreRng, type Rng } from '@usr-games/kit';
import { type Board, type Terrain, cellAt, indexOf, inside, isSolid, landing } from './board';
import { type Cell, type Dir, dirBetween, isHorizontal, OPPOSITE } from './geometry';

/**
 * One noodle in one box, played a move at a time. The order of a move is the 1980 one
 * (worm.c, `process`):
 *
 * 1. If nothing is left to digest, the tail moves up; otherwise one unit of growth is used
 *    and the tail stays where it is.
 * 2. The head looks at the cell ahead. A digit is eaten: its value joins the growth still to
 *    come, and the score goes up by that whole pending growth (not by the digit), which is the
 *    accidental combo Noodle Nine calls a chain. Anything else that is not empty ends the game.
 * 3. The head moves in. Because the tail moved first, chasing your own tail is safe, unless
 *    you are still growing.
 *
 * Noodle Nine's additions sit on top: a reverse into your own neck is refused instead of
 * ending the game, the score of a bite is multiplied by the tempo, and a box filled after any
 * move (not only at a bite) counts as filled. Gardens bring the rest: roots the noodle can chew
 * through (they grow back), mud that ends a dash, a length to grow to, and a bonus for eating
 * one to nine in order.
 */

export interface Digit {
  readonly at: Cell;
  readonly value: number;
}

/** A digit planned in advance, for puzzles and the daily garden. Without `at`, it lands at random. */
export interface PlannedDigit {
  readonly value: number;
  readonly at?: Cell;
}

/** `out-of-numbers`: a fixed sequence ran out, digestion finished and the box is not full. */
export type LossKind = 'wall' | 'rock' | 'self' | 'flow' | 'out-of-numbers';

/** `grown`: the garden's length goal was reached. */
export type Status = 'waiting' | 'playing' | 'lost' | 'filled' | 'grown';

export interface Bite {
  readonly value: number;
  /** Growth still to come just before the bite: what the chain is built on. */
  readonly carried: number;
  /** Pending growth after the bite: the 1980 score of this bite. */
  readonly pending: number;
  readonly multiplier: number;
  /** Points scored: `pending × multiplier`, rounded. */
  readonly points: number;
  /** 1 for a bite on an empty stomach; 2 and up for bites taken while still digesting. */
  readonly chain: number;
  readonly at: Cell;
  readonly move: number;
  readonly dashing: boolean;
  /** How far the run 1, 2, 3 … has got with this bite; 0 when this bite is not part of one. */
  readonly countUp: number;
  /** Extra points for completing one to nine in order (count-up gardens only). */
  readonly bonus: number;
}

export type MoveEvent =
  | { kind: 'moved'; dir: Dir; from: Cell; to: Cell; tunnel: boolean; mud: boolean }
  | { kind: 'bite'; bite: Bite }
  | { kind: 'bump'; dir: Dir }
  | { kind: 'chewed'; at: Cell }
  | { kind: 'regrew'; at: Cell }
  | { kind: 'lost'; loss: LossKind; at: Cell }
  | { kind: 'filled' }
  | { kind: 'grown' };

export interface Game {
  readonly board: Board;
  /** Head first. */
  body: Cell[];
  /** The way the noodle last moved; null before the first move. */
  heading: Dir | null;
  growing: number;
  score: number;
  digit: Digit | null;
  /** Steps left in a dash after the current one. */
  dashLeft: number;
  chain: number;
  bestChain: number;
  moves: number;
  bites: number;
  /** Dashes started, for the no-dash star. */
  dashes: number;
  countUp: number;
  status: Status;
  loss: { kind: LossKind; at: Cell } | null;
  /** Indexes of cells the body covers, for constant-time collision checks. */
  occupied: Set<number>;
  readonly random: Rng;
  /** Digits still to come in a fixed sequence; null when every digit is random. */
  plan: PlannedDigit[] | null;
  /** The values random digits are drawn from. */
  readonly digitRange: { readonly min: number; readonly max: number };
  /** The length that grows the garden; null in a box with no goal. */
  readonly goal: number | null;
  readonly countUpBonus: boolean;
  /**
   * Root cells chewed open, each with the move on which it grows back; null while the body is
   * still in it (the clock starts when the tail has left).
   */
  chewed: Map<number, number | null>;
}

export interface NewGame {
  board: Board;
  /** Head first. */
  body: readonly Cell[];
  random: Rng;
  plan?: readonly PlannedDigit[];
  /** Start already moving this way (gardens); the 1980 worm waits for the first key. */
  heading?: Dir;
  /** Random digits are drawn from `min` to `max` (1 to 9 unless a garden says otherwise). */
  digits?: { min: number; max: number };
  /** Grow to this length to finish the garden. */
  goal?: number;
  /** Eating 1 to 9 in order earns COUNT_UP_BONUS. */
  countUpBonus?: boolean;
}

/** Dashes move this many cells including the first step: nine across, five up or down. */
export const DASH_ACROSS = 9;
export const DASH_UPDOWN = 5;

/** Moves a chewed root takes to grow back once the tail has left its cell. */
export const ROOT_REGROW = 10;

/** Points for eating one to nine in order, before the tempo multiplier. */
export const COUNT_UP_BONUS = 99;

export function createGame(options: NewGame): Game {
  const game: Game = {
    board: options.board,
    body: options.body.map((c) => ({ ...c })),
    heading: options.heading ?? null,
    growing: 0,
    score: 0,
    digit: null,
    dashLeft: 0,
    chain: 0,
    bestChain: 0,
    moves: 0,
    bites: 0,
    dashes: 0,
    countUp: 0,
    status: 'waiting',
    loss: null,
    occupied: new Set(options.body.map((c) => indexOf(options.board, c))),
    random: options.random,
    plan: options.plan ? [...options.plan] : null,
    digitRange: options.digits ?? { min: 1, max: 9 },
    goal: options.goal ?? null,
    countUpBonus: options.countUpBonus ?? false,
    chewed: new Map(),
  };
  placeDigit(game);
  return game;
}

/** A copy that can be played on without touching the original, random source included. */
export function cloneGame(game: Game): Game {
  return {
    ...game,
    body: game.body.map((c) => ({ ...c })),
    occupied: new Set(game.occupied),
    random: restoreRng(game.random.state()),
    plan: game.plan ? [...game.plan] : null,
    loss: game.loss ? { ...game.loss } : null,
    chewed: new Map(game.chewed),
  };
}

export function head(game: Game): Cell {
  return game.body[0]!;
}

/** Cells a digit could land on and the noodle could move into freely: open and not under the body. */
export function isFree(game: Game, cell: Cell): boolean {
  const { board } = game;
  if (!inside(board, cell)) return false;
  const index = indexOf(board, cell);
  return !isSolid(board.terrain[index]!) && !game.occupied.has(index);
}

/** A root cell that is still there to be chewed, as opposed to one chewed open. */
export function isStandingRoot(game: Game, index: number): boolean {
  return game.board.terrain[index] === 'root' && !game.chewed.has(index);
}

/** Every open cell, and every root cell, is under the body. */
function isFilled(game: Game): boolean {
  let rootsUnderBody = 0;
  for (const [, regrowsAt] of game.chewed) if (regrowsAt === null) rootsUnderBody++;
  return game.body.length - rootsUnderBody === game.board.openCount;
}

/** Puts up the next digit: the next planned one, or a random value on a random free cell. */
export function placeDigit(game: Game): void {
  const { board } = game;
  const planned = game.plan?.shift();
  if (game.plan && !planned) {
    game.digit = null;
    return;
  }
  // As in 1980, the value is chosen before the place.
  const value = planned?.value ?? game.random.int(game.digitRange.min, game.digitRange.max);
  if (planned?.at && isFree(game, planned.at)) {
    game.digit = { at: planned.at, value };
    return;
  }
  // Never in a tunnel mouth (it is a doorway, not a place) or on one-way soil (it may only be
  // reachable from a single side, or not at all).
  const free: number[] = [];
  for (let i = 0; i < board.terrain.length; i++) {
    const terrain = board.terrain[i]!;
    if (!isSolid(terrain) && terrain !== 'tunnel' && terrain !== 'flow' && !game.occupied.has(i))
      free.push(i);
  }
  game.digit = free.length > 0 ? { at: cellAt(board, game.random.pick(free)), value } : null;
}

function blockedBy(game: Game, cell: Cell, dir: Dir): LossKind | null {
  const { board } = game;
  if (!inside(board, cell)) return 'wall';
  const index = indexOf(board, cell);
  const terrain: Terrain = board.terrain[index]!;
  if (terrain === 'rock') return 'rock';
  if (terrain === 'flow' && board.flow.get(index) !== dir) return 'flow';
  if (game.occupied.has(index)) return 'self';
  return null;
}

export interface MoveOptions {
  /** The tempo's score multiplier for a bite on this move. */
  multiplier?: number;
  dashing?: boolean;
}

/** Moves the noodle one cell. A reverse into the neck is refused as a bump. */
export function move(game: Game, dir: Dir, options: MoveOptions = {}): MoveEvent[] {
  if (game.status === 'lost' || game.status === 'filled') return [];
  // Before the first move there is no heading yet; the way the body lies says which way is back.
  const facing = game.heading ?? (game.body[1] ? dirBetween(game.body[1], game.body[0]!) : null);
  if (facing && dir === OPPOSITE[facing] && game.body.length > 1) {
    game.dashLeft = 0;
    return [{ kind: 'bump', dir }];
  }
  game.status = 'playing';
  const events: MoveEvent[] = [];
  const from = head(game);

  // 1. The tail moves up, or one unit of growth is used.
  let freedTail: Cell | null = null;
  if (game.growing === 0) {
    freedTail = game.body.pop()!;
    game.occupied.delete(indexOf(game.board, freedTail));
  } else game.growing--;

  // 2. What lies ahead.
  const to = landing(game.board, from, dir);
  const digit = game.digit;
  const eats = digit !== null && to.x === digit.at.x && to.y === digit.at.y;
  if (!eats) {
    const blocked = blockedBy(game, to, dir);
    if (blocked) {
      // The run is over; the body stays as it was, for the bonk to be drawn whole.
      if (freedTail) {
        game.body.push(freedTail);
        game.occupied.add(indexOf(game.board, freedTail));
      } else game.growing++;
      game.status = 'lost';
      game.loss = { kind: blocked, at: to };
      game.dashLeft = 0;
      return [{ kind: 'lost', loss: blocked, at: to }];
    }
  }
  if (freedTail) {
    const tailIndex = indexOf(game.board, freedTail);
    // This move is number `game.moves + 1`; a chewed root grows back ROOT_REGROW moves after it.
    if (game.chewed.has(tailIndex)) game.chewed.set(tailIndex, game.moves + 1 + ROOT_REGROW);
  }

  // 3. The head moves in.
  const toIndex = indexOf(game.board, to);
  game.body.unshift(to);
  game.occupied.add(toIndex);
  game.heading = dir;
  game.moves++;
  const terrain = game.board.terrain[toIndex];
  events.push({
    kind: 'moved',
    dir,
    from,
    to,
    tunnel: Math.abs(to.x - from.x) + Math.abs(to.y - from.y) > 1,
    mud: terrain === 'mud',
  });
  if (terrain === 'root') {
    // A mouthful of root: it opens the way, but it ends a dash and the chain starts over.
    if (!game.chewed.has(toIndex)) {
      events.push({ kind: 'chewed', at: to });
      game.chain = 0;
      game.dashLeft = 0;
    }
    game.chewed.set(toIndex, null);
  }

  if (eats && digit) events.push({ kind: 'bite', bite: eat(game, digit, to, options) });
  else if (game.growing === 0) {
    // A chain lasts while there is something to digest.
    game.chain = 0;
  }
  events.push(...regrowRoots(game));

  if (isFilled(game)) {
    game.status = 'filled';
    events.push({ kind: 'filled' });
  } else if (game.goal !== null && game.body.length + game.growing >= game.goal) {
    game.status = 'grown';
    events.push({ kind: 'grown' });
  } else if (game.plan && game.plan.length === 0 && !game.digit && game.growing === 0) {
    game.status = 'lost';
    game.loss = { kind: 'out-of-numbers', at: to };
    events.push({ kind: 'lost', loss: 'out-of-numbers', at: to });
  }
  return events;
}

function eat(game: Game, digit: Digit, at: Cell, options: MoveOptions): Bite {
  const carried = game.growing;
  game.growing += digit.value;
  const multiplier = options.multiplier ?? 1;
  game.countUp = digit.value === game.countUp + 1 ? game.countUp + 1 : digit.value === 1 ? 1 : 0;
  const bonus = game.countUpBonus && game.countUp === 9 ? COUNT_UP_BONUS : 0;
  const points = Math.round((game.growing + bonus) * multiplier);
  game.score += points;
  game.chain = carried > 0 ? game.chain + 1 : 1;
  game.bestChain = Math.max(game.bestChain, game.chain);
  game.bites++;
  game.dashLeft = 0;
  const bite: Bite = {
    value: digit.value,
    carried,
    pending: game.growing,
    multiplier,
    points,
    chain: game.chain,
    at,
    move: game.moves,
    dashing: options.dashing ?? false,
    countUp: game.countUp,
    bonus,
  };
  placeDigit(game);
  return bite;
}

/** Chewed roots whose time has come grow back, unless something is in the way. */
function regrowRoots(game: Game): MoveEvent[] {
  const events: MoveEvent[] = [];
  for (const [index, regrowsAt] of game.chewed) {
    if (regrowsAt === null || game.moves < regrowsAt || game.occupied.has(index)) continue;
    game.chewed.delete(index);
    events.push({ kind: 'regrew', at: cellAt(game.board, index) });
  }
  return events;
}

/**
 * Starts a dash: the first step now, then `DASH_ACROSS - 1` or `DASH_UPDOWN - 1` more through
 * `continueDash`, stopping early when a digit is eaten, as the capital HJKL keys did in 1980.
 */
export function startDash(game: Game, dir: Dir, options: MoveOptions = {}): MoveEvent[] {
  const events = move(game, dir, { ...options, dashing: true });
  const moved = events.some((e) => e.kind === 'moved');
  if (moved) game.dashes++;
  game.dashLeft =
    moved && !endsDash(events) ? (isHorizontal(dir) ? DASH_ACROSS : DASH_UPDOWN) - 1 : 0;
  return events;
}

/** The next step of a dash in progress; nothing when the dash is over. */
export function continueDash(game: Game, options: MoveOptions = {}): MoveEvent[] {
  if (game.dashLeft <= 0 || !game.heading) return [];
  game.dashLeft--;
  const events = move(game, game.heading, { ...options, dashing: true });
  if (endsDash(events)) game.dashLeft = 0;
  return events;
}

/** A dash stops at a bite (as in 1980), and in Noodle Nine also in mud and at a root. */
function endsDash(events: readonly MoveEvent[]): boolean {
  return events.some(
    (e) => e.kind === 'bite' || e.kind === 'chewed' || (e.kind === 'moved' && e.mud),
  );
}
