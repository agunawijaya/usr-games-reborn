import type { Rng } from '@usr-games/kit';
import { type Board, freeEdges } from '../engine/board';
import {
  controlValue,
  declineEdge,
  greedyPlayout,
  type Handout,
  handoutFrom,
  isLongPiece,
  judgeByModel,
  loonyValue,
  openingEdge,
  type Piece,
  pieces,
  piecesValue,
} from './endgame';
import { greedyGusMove } from './greedy-gus';
import { Position } from './position';
import { type Judge, searchSafeLines } from './search';
import { Solver } from './solver';

/**
 * The ladder of opponents, weakest first. Each adds one idea to the one before:
 *
 * - **Scribbler** draws any free line at random. (The original had no random player: its
 *   `test.cc` only tests the randomiser. Scribbler is ours.)
 * - **Greedy Gus** is the original's computer, ported line for line: take every box, otherwise
 *   give nothing away, otherwise give away as little as possible. It never declines a box.
 * - **Chain Counter** plays like Gus but counts: near the end of the safe lines it searches every
 *   way of drawing them and steers for the endgame Gus-style play would leave it.
 * - **Berlekamp's Pupil** knows the long chain rule and the double cross: it steers to be the one
 *   who does not open the first long chain, and declines the last two boxes when that keeps
 *   control.
 * - **Master** values endgames exactly (Berlekamp's simple loony endgames), searches the safe
 *   lines deeper, and solves the rest of the game outright once it is small enough.
 */
export type OpponentId = 'scribbler' | 'greedy-gus' | 'chain-counter' | 'pupil' | 'master';

export const OPPONENT_IDS: readonly OpponentId[] = [
  'scribbler',
  'greedy-gus',
  'chain-counter',
  'pupil',
  'master',
];

export interface Thinking {
  readonly rng: Rng;
  /** The clock, in seconds, that Greedy Gus seeds its random order from. */
  readonly clock: number;
}

interface Style {
  /** Search the safe lines once this few are left. */
  readonly searchFrom: number;
  readonly searchBudget: number;
  readonly judge: Judge;
  /** Solve the rest of the game exactly once this few lines are left (0: never). */
  readonly solveFrom: number;
  readonly solveBudget: number;
}

const PUPIL: Style = {
  searchFrom: 12,
  searchBudget: 40_000,
  judge: controlValue,
  solveFrom: 0,
  solveBudget: 0,
};

const MASTER: Style = {
  searchFrom: 16,
  searchBudget: 120_000,
  judge: judgeByModel,
  solveFrom: 32,
  solveBudget: 250_000,
};

export function chooseMove(id: OpponentId, board: Board, thinking: Thinking): number {
  switch (id) {
    case 'scribbler':
      return thinking.rng.pick(freeEdges(board));
    case 'greedy-gus':
      return greedyGusMove(board, thinking.clock);
    case 'chain-counter':
      return chainCounterMove(board, thinking);
    case 'pupil':
      return thoughtfulMove(board, thinking, PUPIL);
    case 'master':
      return thoughtfulMove(board, thinking, MASTER);
  }
}

/**
 * Gus, counting: near the end of the safe lines it tries every way of drawing them, and when it
 * must open a piece it opens the one that leaves it best off, each time playing the rest out the
 * way two greedy players would. It still never declines a box.
 */
function chainCounterMove(board: Board, thinking: Thinking): number {
  const position = Position.from(board);
  if (position.firstCapturable() < 0) {
    const safe = position.safeEdges();
    if (safe.length > 0 && safe.length <= 18) {
      const found = searchSafeLines(position, greedyPlayout, thinking.rng, 150_000);
      if (found.edge !== null) return found.edge;
    }
    if (safe.length === 0) {
      const opening = openCountedPiece(position, thinking.rng);
      if (opening !== null) return opening;
    }
  }
  return greedyGusMove(board, thinking.clock);
}

function openCountedPiece(position: Position, rng: Rng): number | null {
  let best: number[] = [];
  let bestValue = -Infinity;
  for (const piece of pieces(position)) {
    const edge = openingEdge(position, piece);
    if (edge < 0) continue;
    position.draw(edge);
    const value = -greedyPlayout(position);
    position.undraw(edge);
    if (value > bestValue) {
      bestValue = value;
      best = [edge];
    } else if (value === bestValue) {
      best.push(edge);
    }
  }
  return best.length ? rng.pick(best) : null;
}

function thoughtfulMove(board: Board, thinking: Thinking, style: Style): number {
  const position = Position.from(board);
  if (style.solveFrom > 0 && position.free <= style.solveFrom) {
    const solved = new Solver(style.solveBudget).solve(position);
    if (solved) return thinking.rng.pick([...solved.best]);
  }
  const taken = captureOrDecline(position);
  if (taken !== null) return taken;
  const safe = position.safeEdges();
  if (safe.length > 0) {
    if (safe.length <= style.searchFrom) {
      const found = searchSafeLines(position, style.judge, thinking.rng, style.searchBudget);
      if (found.edge !== null) return found.edge;
    }
    return thinking.rng.pick(safe);
  }
  return openBestPiece(position, thinking.rng) ?? thinking.rng.pick(position.freeEdgeList());
}

/**
 * With boxes to take: take them, except at the one moment that matters (the last two of a chain,
 * the last four of an opened loop), where the boxes are handed back if keeping control is worth
 * more than they are.
 */
export function captureOrDecline(position: Position): number | null {
  let decision: Handout | null = null;
  for (let box = 0; box < position.grid.boxes; box++) {
    if (position.sides[box] !== 3) continue;
    const run = handoutFrom(position, box);
    if (declineEdge(position, run) < 0) return position.lastSide(box);
    decision ??= run;
  }
  if (!decision) return null;
  const take = position.lastSide(decision.boxes[0]!);
  const inRun = new Set(decision.boxes);
  const rest = pieces(position).filter((piece) => !piece.boxes.some((box) => inRun.has(box)));
  const later = piecesValue(rest);
  const count = decision.boxes.length;
  // Take them and open the next piece yourself, or hand them over and make the opponent open it.
  return -count - later > count + later ? declineEdge(position, decision) : take;
}

/** Opens the piece that costs least, by the endgame model. */
export function openBestPiece(position: Position, rng: Rng): number | null {
  const found = pieces(position);
  if (found.length === 0) return null;
  let best: Piece[] = [];
  let bestValue = -Infinity;
  found.forEach((piece, i) => {
    const rest = found.filter((_, j) => j !== i);
    const value = -takerValue(piece, rest);
    if (value > bestValue) {
      bestValue = value;
      best = [piece];
    } else if (value === bestValue) {
      best.push(piece);
    }
  });
  // Among equals, give the smallest piece away.
  const smallest = Math.min(...best.map((piece) => piece.boxes.length));
  const choice = rng.pick(best.filter((piece) => piece.boxes.length === smallest));
  return openingEdge(position, choice);
}

function takerValue(piece: Piece, rest: readonly Piece[]): number {
  const chains = rest.filter((p) => p.kind === 'chain').map((p) => p.boxes.length);
  const loops = rest.filter((p) => p.kind === 'loop').map((p) => p.boxes.length);
  const later = loonyValue(chains, loops);
  const n = piece.boxes.length;
  if (!isLongPiece(piece)) return n + later;
  const handBack = piece.kind === 'loop' ? 8 : 4;
  return Math.max(n + later, n - handBack - later);
}
