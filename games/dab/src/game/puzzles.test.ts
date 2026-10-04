import { describe, expect, it } from 'vitest';
import { Position } from '../ai/position';
import { Solver } from '../ai/solver';
import { PUZZLES, puzzleBoard } from './puzzles';

/** A line that closes nothing and leaves a box with three sides. */
function gives(position: Position, edge: number): boolean {
  if (position.isSafe(edge)) return false;
  const closed = position.draw(edge);
  position.undraw(edge);
  return closed === 0;
}

describe('the endgame puzzles', () => {
  it('number forty', () => {
    expect(PUZZLES).toHaveLength(40);
  });

  it('each have a best move that gives boxes away, and a target the solver confirms', () => {
    for (const puzzle of PUZZLES) {
      const position = Position.from(puzzleBoard(puzzle));
      const solved = new Solver(2_000_000).solveEvery(position)!;
      expect(solved, `puzzle ${puzzle.number}`).not.toBeNull();
      expect((puzzle.open + solved.value) / 2, `puzzle ${puzzle.number}`).toBe(puzzle.target);
      expect(
        solved.best.every((edge) => gives(position, edge)),
        `puzzle ${puzzle.number}`,
      ).toBe(true);
      // Something tempting is at least two boxes worse.
      const worst = Math.min(...solved.scored.map((s) => s.value));
      expect(solved.value - worst, `puzzle ${puzzle.number}`).toBeGreaterThanOrEqual(2);
      if (puzzle.kind !== 'choice') {
        const quiet = solved.scored.filter((s) => !gives(position, s.edge));
        expect(
          Math.max(...quiet.map((s) => s.value)),
          `puzzle ${puzzle.number}`,
        ).toBeLessThanOrEqual(solved.value - 2);
      }
    }
  });

  it('are of the kind they say', () => {
    for (const puzzle of PUZZLES) {
      const position = Position.from(puzzleBoard(puzzle));
      const capturable = position.firstCapturable() >= 0;
      const safe = position.safeEdges().length > 0;
      const kind = capturable ? 'decline' : safe ? 'sacrifice' : 'choice';
      expect(kind, `puzzle ${puzzle.number}`).toBe(puzzle.kind);
    }
  });
});
