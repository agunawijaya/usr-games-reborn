/**
 * Finds each puzzle's par: the fewest clearances that bring every plane home.
 * Usage: pnpm exec tsx games/atc/scripts/puzzle-pars.ts [max clearances] [max flights] [puzzle ids…]
 */
import { solvePuzzle } from '../src/modes/puzzle-solver';
import { PUZZLES } from '../src/modes/puzzles';

const print = (text: string) => process.stdout.write(`${text}\n`);

const [maxClearances = '10', maxFlights = '400000', ...ids] = process.argv.slice(2);
for (const puzzle of PUZZLES.filter((p) => ids.length === 0 || ids.includes(p.id))) {
  const started = performance.now();
  const solution = solvePuzzle(puzzle, {
    maxClearances: Number(maxClearances),
    maxFlights: Number(maxFlights),
  });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const found = solution ? `${solution.clearances}` : 'none found';
  print(
    `${puzzle.id.padEnd(24)} par now ${String(puzzle.par).padStart(2)} · solver ${found.padStart(10)} · ${seconds} s`,
  );
  if (solution) print(`  ${JSON.stringify(solution.plans)}`);
}
