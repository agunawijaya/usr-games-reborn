import { describe, expect, it } from 'vitest';
import { flyPlans, solvePuzzle } from './puzzle-solver';
import { PUZZLES } from './puzzles';

const cost = (plan: (typeof PUZZLES)[number]['solution'][number]) =>
  (plan.route ? 1 : 0) + (plan.altitude === null ? 0 : 1) + (plan.launch ? 1 : 0);

describe('clearance puzzles', () => {
  it.each(PUZZLES.map((p) => [p.id, p] as const))(
    '%s: the stored plan brings everyone home at par',
    (_, puzzle) => {
      expect(puzzle.solution).toHaveLength(puzzle.arrivals.length);
      expect(puzzle.solution.reduce((sum, plan) => sum + cost(plan), 0)).toBe(puzzle.par);
      expect(flyPlans(puzzle, puzzle.solution)).toBe(true);
    },
  );

  it.each(PUZZLES.filter((p) => p.par <= 4).map((p) => [p.id, p] as const))(
    '%s: no plan with fewer clearances exists',
    (_, puzzle) => {
      const cheaper = solvePuzzle(puzzle, { maxClearances: puzzle.par - 1, maxFlights: 200_000 });
      expect(cheaper).toBeNull();
    },
  );
});
