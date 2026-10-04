import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { type Board, horizontalEdge, isFull, newBoard, play, verticalEdge } from '../engine/board';
import { loonyValue, pieces } from './endgame';
import { chooseMove, OPPONENT_IDS } from './opponents';
import { Position } from './position';
import { Solver } from './solver';

/** Every move, no pruning: only a memo of positions already worked out, so it stays plainly right. */
function bruteValue(position: Position, memo = new Map<string, number>()): number {
  if (position.free === 0) return 0;
  const key = position.key();
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = -Infinity;
  for (const edge of position.freeEdgeList()) {
    const closed = position.draw(edge);
    const value = closed > 0 ? closed + bruteValue(position, memo) : -bruteValue(position, memo);
    position.undraw(edge);
    best = Math.max(best, value);
  }
  memo.set(key, best);
  return best;
}

/** A random position on a small board with `left` lines still to draw. */
function randomPosition(columns: number, rows: number, left: number, seed: string): Board {
  const rng = createRng(seed);
  let board = newBoard({ columns, rows });
  const order = rng.shuffle([...board.drawn.keys()]);
  for (const edge of order.slice(0, board.drawn.length - left)) board = play(board, edge).board;
  return board;
}

describe('the exact solver', () => {
  it('agrees with a plain search on small positions', () => {
    for (let i = 0; i < 40; i++) {
      const board = randomPosition(2 + (i % 2), 2, 9 + (i % 4), `solver-${i}`);
      const exact = new Solver(1_000_000).value(Position.from(board));
      expect(exact).toBe(bruteValue(Position.from(board)));
    }
  });

  it('knows a 1 × 1 board: whoever draws the fourth line takes the box', () => {
    let board = newBoard({ columns: 1, rows: 1 });
    for (const edge of [0, 1, 2]) board = play(board, edge).board;
    expect(new Solver(1000).value(Position.from(board))).toBe(1);
  });

  it('declines the last two boxes of a chain when that wins', () => {
    // Two chains of four on a 4 × 2 board; the top one opened, two of its boxes already taken.
    let board = newBoard({ columns: 4, rows: 2 });
    for (let c = 0; c < 4; c++) {
      for (const row of [0, 1, 2])
        board = play({ ...board, toMove: 0 }, horizontalEdge(board, row, c)).board;
    }
    for (const c of [0, 1, 2])
      board = play({ ...board, toMove: 0 }, verticalEdge(board, 0, c)).board;
    board = { ...board, toMove: 0 };
    const solved = new Solver(100_000).solve(Position.from(board))!;
    // Taking both and opening the bottom chain nets 2 − 4; handing two over nets −2 + 4.
    expect(solved.value).toBe(2);
    expect(solved.best).toEqual([verticalEdge(board, 0, 4)]);
  });
});

describe('the endgame model', () => {
  it('values a lone long chain at its length for the taker', () => {
    expect(loonyValue([5], [])).toBe(-5);
  });

  it('keeps control through a run of long chains', () => {
    // The controller takes 1 of the first three, hands 2 back, then takes all four: 5 to 2.
    expect(loonyValue([3, 4], [])).toBe(-3);
    // Two chains handed back two boxes at a time, the last one taken whole: 5 to 4.
    expect(loonyValue([3, 3, 3], [])).toBe(-1);
  });

  it('charges four boxes for keeping control through a loop', () => {
    // The loop goes first: hand all four back (−4) and take the six, or take four and lose six.
    expect(loonyValue([6], [4])).toBe(-2);
  });

  it('finds the pieces of a board', () => {
    let board = newBoard({ columns: 4, rows: 2 });
    for (let c = 0; c < 4; c++)
      for (const row of [0, 1, 2])
        board = play({ ...board, toMove: 0 }, horizontalEdge(board, row, c)).board;
    const found = pieces(Position.from(board));
    expect(found.map((p) => `${p.kind}${p.boxes.length}`).sort()).toEqual(['chain4', 'chain4']);
  });
});

describe('the opponents', () => {
  it('each finish games on a 4 × 4 board with legal moves only', () => {
    for (const id of OPPONENT_IDS) {
      const rng = createRng(`legal-${id}`);
      let board = newBoard({ columns: 4, rows: 4 });
      let clock = 1_000_000;
      while (!isFull(board)) {
        const edge = chooseMove(id, board, { rng, clock: clock++ });
        expect(board.drawn[edge]).toBe(0);
        board = play(board, edge).board;
      }
      expect(board.scores[0] + board.scores[1]).toBe(16);
    }
  });
});
