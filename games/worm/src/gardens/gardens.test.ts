import { describe, expect, it } from 'vitest';
import { cellAt, indexOf, isSolid, parseBoard } from '../engine/board';
import { DIRS, step } from '../engine/geometry';
import { botRun, starCount } from '../modes/gardens-play';
import { ATTRACT, GARDENS } from './gardens';

describe('the gardens', () => {
  it('are twelve, numbered in order, with ids of their own', () => {
    expect(GARDENS.map((g) => g.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(GARDENS.map((g) => g.id)).size).toBe(12);
  });

  it.each([...GARDENS, ATTRACT].map((g) => [g.title, g] as const))(
    '%s: a well-formed bed, a noodle lying on open soil, every open cell in reach',
    (_title, garden) => {
      const board = parseBoard(garden.map);
      const start = garden.start;
      for (const [i, cell] of start.entries()) {
        expect(board.terrain[indexOf(board, cell)], `start cell ${i}`).toBe('soil');
        if (i > 0)
          expect(Math.abs(cell.x - start[i - 1]!.x) + Math.abs(cell.y - start[i - 1]!.y)).toBe(1);
      }
      expect(board.terrain[indexOf(board, step(start[0]!, garden.heading))]).not.toBe('rock');
      // Walk the bed (any way round one-way soil, through tunnels, through roots): no pockets.
      const seen = new Set([indexOf(board, start[0]!)]);
      const queue = [start[0]!];
      while (queue.length > 0) {
        const cell = queue.pop()!;
        for (const dir of DIRS) {
          const n = step(cell, dir);
          if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height) continue;
          const i = indexOf(board, n);
          if (board.terrain[i] === 'rock' || seen.has(i)) continue;
          seen.add(i);
          queue.push(n);
          const exit = board.tunnelExit.get(i);
          if (exit && !seen.has(indexOf(board, exit))) {
            seen.add(indexOf(board, exit));
            queue.push(exit);
          }
        }
      }
      const unreached = board.terrain.flatMap((t, i) =>
        t !== 'rock' && !seen.has(i) ? [cellAt(board, i)] : [],
      );
      expect(unreached).toEqual([]);
      if (garden.goal !== null)
        expect(garden.goal).toBeLessThan(board.terrain.filter((t) => !isSolid(t)).length / 2);
    },
  );
});

describe('the gardens’ balance, from the house noodle’s runs', () => {
  // The same seeds as scripts/balance.ts, fewer of them: the full table is in NOTES.md.
  const RUNS = 100;
  it.each(GARDENS.map((g) => [g.number, g.title, g] as const))(
    '#%i %s is grown on nearly every run and three-starred on about one in five',
    (_number, _title, garden) => {
      const runs = Array.from({ length: RUNS }, (_, i) =>
        botRun(garden, `balance:${garden.id}:${i}`),
      );
      const grown = runs.filter((r) => r.stars.grown).length / RUNS;
      const three = runs.filter((r) => starCount(r.stars) === 3).length / RUNS;
      expect(grown).toBeGreaterThanOrEqual(0.87);
      expect(three).toBeGreaterThanOrEqual(0.1);
      expect(three).toBeLessThanOrEqual(0.4);
    },
    30_000,
  );
});
