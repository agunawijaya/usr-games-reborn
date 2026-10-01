/**
 * Runs the house controller over many seeds on chosen arenas and prints the spread, for tuning
 * shift targets. Usage: pnpm exec tsx games/atc/scripts/balance.ts [seeds] [ticks] [arena ids…]
 */
import { ENDLESS_ARENAS } from '../src/arenas/library';
import { simulateShift } from '../src/engine/sim';

const print = (text: string) => process.stdout.write(`${text}\n`);

const [seeds = '50', ticks = '300', ...ids] = process.argv.slice(2);
const arenas = ENDLESS_ARENAS.filter((a) => ids.length === 0 || ids.includes(a.id));
for (const arena of arenas) {
  const started = performance.now();
  const results = Array.from({ length: Number(seeds) }, (_, i) =>
    simulateShift(arena, `balance:${arena.id}:${i}`, Number(ticks)),
  );
  const survived = results.filter((r) => r.loss === null).length;
  const safe = results.map((r) => r.safe).sort((a, b) => a - b);
  const losses = new Map<string, number>();
  for (const r of results) if (r.loss) losses.set(r.loss, (losses.get(r.loss) ?? 0) + 1);
  const ms = (performance.now() - started) / results.length;
  print(
    `${arena.id.padEnd(16)} survived ${survived}/${results.length}  safe median ${safe[Math.floor(safe.length / 2)]} (p10 ${safe[Math.floor(safe.length * 0.1)]}, p90 ${safe[Math.floor(safe.length * 0.9)]})  near ${(results.reduce((s, r) => s + r.nearMisses, 0) / results.length).toFixed(1)}  string ${Math.max(...results.map((r) => r.longestString))}  ${[...losses].map(([k, n]) => `${k}:${n}`).join(' ')}  ${ms.toFixed(0)} ms/shift`,
  );
}
