import type { Position } from './position';

/**
 * The exact solver: a negamax search with alpha–beta and a transposition table, worth what a
 * position is worth to the player to move (their boxes minus the opponent's, from here on).
 *
 * Two facts cut the tree down (Berlekamp; Barker and Korf, 2012):
 * - A box that can be taken without handing a new box over should simply be taken.
 * - When a run of boxes is being taken, the only alternative worth looking at is declining its
 *   last two (the last four of an opened loop); declining earlier only gives more away.
 *
 * The search counts the positions it visits and gives up past its budget, so a move never
 * takes long; the caller then falls back on the endgame model.
 */

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

class OutOfBudget extends Error {}

export interface Solved {
  readonly value: number;
  /** Every move that reaches the value. */
  readonly best: readonly number[];
  /** What each move tried is worth. */
  readonly scored: ReadonlyArray<{ readonly edge: number; readonly value: number }>;
}

export class Solver {
  private readonly table = new Map<string, { value: number; flag: number }>();
  private visited = 0;

  constructor(private readonly budget: number) {}

  /**
   * The exact value and best moves, or null when the position is too big for the budget. Works on
   * a copy: giving up mid-search leaves lines drawn.
   */
  solve(original: Position): Solved | null {
    return this.score(original, (position) => this.moves(position));
  }

  /** As `solve`, but tries every free line at the top, not just the ones worth trying. */
  solveEvery(original: Position): Solved | null {
    return this.score(original, (position) => position.freeEdgeList());
  }

  private score(original: Position, choices: (position: Position) => number[]): Solved | null {
    const position = original.copy();
    this.visited = 0;
    try {
      const scored = choices(position).map((edge) => {
        const closed = position.draw(edge);
        const value =
          closed > 0
            ? closed + this.negamax(position, -Infinity, Infinity)
            : -this.negamax(position, -Infinity, Infinity);
        position.undraw(edge);
        return { edge, value };
      });
      const value = Math.max(...scored.map((s) => s.value));
      return { value, best: scored.filter((s) => s.value === value).map((s) => s.edge), scored };
    } catch (error) {
      if (error instanceof OutOfBudget) return null;
      throw error;
    }
  }

  /** The value only, for tests and puzzles. */
  value(original: Position): number | null {
    const position = original.copy();
    this.visited = 0;
    try {
      return this.negamax(position, -Infinity, Infinity);
    } catch (error) {
      if (error instanceof OutOfBudget) return null;
      throw error;
    }
  }

  private negamax(position: Position, alpha: number, beta: number): number {
    if (position.free === 0) return 0;
    if (++this.visited > this.budget) throw new OutOfBudget();
    const key = position.key();
    const entry = this.table.get(key);
    const startAlpha = alpha;
    if (entry) {
      if (entry.flag === EXACT) return entry.value;
      if (entry.flag === LOWER) alpha = Math.max(alpha, entry.value);
      else beta = Math.min(beta, entry.value);
      if (alpha >= beta) return entry.value;
    }
    let best = -Infinity;
    for (const edge of this.moves(position)) {
      const closed = position.draw(edge);
      const value =
        closed > 0
          ? closed + this.negamax(position, alpha - closed, beta - closed)
          : -this.negamax(position, -beta, -alpha);
      position.undraw(edge);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    const flag = best <= startAlpha ? UPPER : best >= beta ? LOWER : EXACT;
    this.table.set(key, { value: best, flag });
    return best;
  }

  /** The moves worth trying, best first. */
  moves(position: Position): number[] {
    const capturable = position.firstCapturable();
    if (capturable >= 0) return this.captureMoves(position, capturable);
    const safe: number[] = [];
    const giving: number[] = [];
    for (let edge = 0; edge < position.grid.edges; edge++) {
      if (position.drawn[edge]) continue;
      (position.isSafe(edge) ? safe : giving).push(edge);
    }
    return [...safe, ...giving];
  }

  private captureMoves(position: Position, box: number): number[] {
    const { grid, sides } = position;
    const take = position.lastSide(box);
    const next = grid.across(take, box);
    // Taking it hands nothing on: nothing to think about.
    if (next < 0 || sides[next] !== 2) return [take];
    let far = -1;
    for (const edge of position.freeSides(next)) if (edge !== take) far = edge;
    const beyond = far < 0 ? -1 : grid.across(far, next);
    const beyondSides = beyond < 0 ? -1 : sides[beyond]!;
    // Two boxes left at the end of a chain: take them, or hand both back with the far line.
    if (beyondSides < 2) return [take, far];
    // Four boxes left of an opened loop (three sides at both ends): take, or split in the middle.
    if (beyondSides === 2) {
      let last = -1;
      for (const edge of position.freeSides(beyond)) if (edge !== far) last = edge;
      const end = last < 0 ? -1 : grid.across(last, beyond);
      if (end >= 0 && end !== box && sides[end] === 3) return [take, far];
    }
    return [take];
  }
}
