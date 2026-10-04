import { describe, expect, it } from 'vitest';
import { greedyGusMove } from '../ai/greedy-gus';
import {
  edgeCount,
  horizontalEdge,
  isFull,
  newBoard,
  play,
  verticalEdge,
  type Board,
} from './board';
import { components, isLong, safeEdges } from './chains';
import { Permutation, Rand48 } from './rand48';

/** lrand48 by the book, in BigInt, to check the fast version against. */
function referenceLrand48(seed: number, count: number): number[] {
  let x = (BigInt(seed >>> 0) << 16n) | 0x330en;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    x = (0x5deece66dn * x + 0xbn) & ((1n << 48n) - 1n);
    out.push(Number(x >> 17n));
  }
  return out;
}

describe('the random numbers', () => {
  it('match lrand48 to the bit for any seed', () => {
    for (const seed of [0, 1, 1_072_000_000, 2 ** 31 - 1, 4_000_000_000]) {
      const generator = new Rand48();
      generator.seed(seed);
      const ours = Array.from({ length: 200 }, () => generator.next());
      expect(ours).toEqual(referenceLrand48(seed, 200));
    }
  });

  it('hand out every value once, in the same order for the same second', () => {
    const order = (clock: number) => {
      const p = new Permutation(10, new Rand48(), clock);
      return Array.from({ length: 11 }, () => p.next());
    };
    const first = order(1_072_483_200);
    expect([...first.slice(0, 10)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(first[10]).toBe(10);
    expect(order(1_072_483_200)).toEqual(first);
  });
});

describe('the board', () => {
  it('passes the turn after a line that closes nothing, and keeps it after a box', () => {
    let board = newBoard({ columns: 2, rows: 1 });
    board = play(board, horizontalEdge(board, 0, 0)).board;
    expect(board.toMove).toBe(1);
    board = play(board, horizontalEdge(board, 1, 0)).board;
    board = play(board, verticalEdge(board, 0, 0)).board;
    expect(board.toMove).toBe(1);
    const closing = play(board, verticalEdge(board, 0, 1));
    expect(closing.closed).toEqual([0]);
    expect(closing.board.toMove).toBe(1);
    expect(closing.board.scores).toEqual([0, 1]);
  });

  it('closes two boxes with one line', () => {
    let board: Board = newBoard({ columns: 2, rows: 1 });
    for (const edge of [0, 1, 2, 3]) board = play(board, edge).board;
    board = play(board, verticalEdge(board, 0, 0)).board;
    board = play(board, verticalEdge(board, 0, 2)).board;
    const both = play(board, verticalEdge(board, 0, 1));
    expect(both.closed).toHaveLength(2);
  });
});

describe('Greedy Gus, the original computer', () => {
  it('always closes a box when one is there to take', () => {
    let board = newBoard({ columns: 3, rows: 3 });
    for (const edge of [
      horizontalEdge(board, 0, 0),
      horizontalEdge(board, 1, 0),
      verticalEdge(board, 0, 0),
    ]) {
      board = play(board, edge).board;
    }
    expect(greedyGusMove(board, 1_072_483_200)).toBe(verticalEdge(board, 0, 1));
  });

  it('gives nothing away while it can avoid it, and gives the same answer for the same second', () => {
    const board = newBoard({ columns: 5, rows: 5 });
    const move = greedyGusMove(board, 1_072_483_200);
    expect(safeEdges(board)).toContain(move);
    expect(greedyGusMove(board, 1_072_483_200)).toBe(move);
  });

  it('plays whole games against itself without ever stalling', () => {
    for (let game = 0; game < 30; game++) {
      let board = newBoard({ columns: 4, rows: 4 });
      let clock = 1_072_483_200 + game * 97;
      while (!isFull(board)) {
        board = play(board, greedyGusMove(board, clock)).board;
        clock++;
      }
      expect(board.scores[0] + board.scores[1]).toBe(16);
      expect(board.history).toHaveLength(edgeCount(board));
    }
  });
});

describe('chains and loops', () => {
  it('finds a long chain along the top row', () => {
    let board = newBoard({ columns: 3, rows: 2 });
    for (let c = 0; c < 3; c++) {
      board = play({ ...board, toMove: 0 }, horizontalEdge(board, 0, c)).board;
      board = play({ ...board, toMove: 0 }, horizontalEdge(board, 1, c)).board;
    }
    const chains = components(board);
    expect(chains).toHaveLength(1);
    expect(chains[0]!.kind).toBe('chain');
    expect(chains[0]!.boxes).toHaveLength(3);
    expect(isLong(chains[0]!)).toBe(true);
  });

  it('finds a loop of four', () => {
    let board = newBoard({ columns: 2, rows: 2 });
    const outside = [
      horizontalEdge(board, 0, 0),
      horizontalEdge(board, 0, 1),
      horizontalEdge(board, 2, 0),
      horizontalEdge(board, 2, 1),
      verticalEdge(board, 0, 0),
      verticalEdge(board, 1, 0),
      verticalEdge(board, 0, 2),
      verticalEdge(board, 1, 2),
    ];
    for (const edge of outside) board = play({ ...board, toMove: 0 }, edge).board;
    const loops = components(board);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.kind).toBe('loop');
    expect(loops[0]!.boxes).toHaveLength(4);
  });
});
