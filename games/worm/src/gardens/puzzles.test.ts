import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { parseBoard } from '../engine/board';
import { createGame, move } from '../engine/game';
import { solveFill } from '../engine/solver';
import { PUZZLES, routeDirs } from './puzzles';

describe('the fill puzzles', () => {
  it('are fifteen, from 5 × 5 to 12 × 9, numbered in order', () => {
    expect(PUZZLES.map((p) => p.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    const sizes = PUZZLES.map((p) => [p.map[0]!.length, p.map.length]);
    expect(sizes[0]).toEqual([5, 5]);
    expect(sizes.at(-1)).toEqual([12, 9]);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(15);
  });

  it('give the noodle exactly the growth it needs to fill its box', () => {
    for (const puzzle of PUZZLES) {
      const board = parseBoard(puzzle.map);
      const growth = puzzle.plan.reduce((sum, d) => sum + d.value, 0);
      expect(puzzle.start.length + growth, puzzle.title).toBe(board.openCount);
    }
  });

  it.each(PUZZLES.map((p) => [p.number, p.title, p] as const))(
    '#%i %s is filled by its route under the game’s own rules',
    (_number, _title, puzzle) => {
      const game = createGame({
        board: parseBoard(puzzle.map),
        body: puzzle.start,
        heading: puzzle.heading,
        plan: puzzle.plan,
        random: createRng('replay'),
      });
      for (const dir of routeDirs(puzzle.route)) move(game, dir);
      expect(game.status).toBe('filled');
      expect(game.moves).toBe(puzzle.par);
    },
  );

  it.each(PUZZLES.map((p) => [p.number, p.title, p] as const))(
    '#%i %s is proved solvable by the solver on its own, within par',
    (_number, _title, puzzle) => {
      const result = solveFill(
        {
          board: parseBoard(puzzle.map),
          body: puzzle.start,
          heading: puzzle.heading,
          plan: puzzle.plan,
        },
        { budget: 400_000, maxMoves: puzzle.par },
      );
      expect(result.moves).not.toBeNull();
      // Its answer must hold up in the real game too.
      const game = createGame({
        board: parseBoard(puzzle.map),
        body: puzzle.start,
        heading: puzzle.heading,
        plan: puzzle.plan,
        random: createRng('check'),
      });
      for (const dir of result.moves!) move(game, dir);
      expect(game.status).toBe('filled');
    },
  );
});
