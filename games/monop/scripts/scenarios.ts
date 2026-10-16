import { SCENARIOS } from '../src/scenarios/catalogue';
import { playScenario } from '../src/scenarios/run';

/**
 * The scenarios' proof: a hard rival's mind plays your seat in every scenario over many seeds,
 * keeping to its restrictions. Prints the share it wins and the turns a win takes.
 *
 *   pnpm --filter @usr-games/game-monop scenarios [seeds] [scenario-id…]
 */

const out = (line = '') => process.stdout.write(`${line}\n`);
const seeds = Number(process.argv[2] ?? 100);
const only = process.argv.slice(3);

out(`| # | Scenario | Pilot wins | Turns to win (mean) | ms a game |`);
out(`| -: | --- | -: | -: | -: |`);
for (const scenario of SCENARIOS) {
  if (only.length && !only.includes(scenario.id)) continue;
  let wins = 0;
  let turns = 0;
  const started = performance.now();
  const reasons = new Map<string, number>();
  for (let i = 0; i < seeds; i++) {
    const run = playScenario(scenario, `${scenario.id}:proof:${i}`);
    if (run.verdict.won) {
      wins += 1;
      turns += run.verdict.turns;
    } else reasons.set(run.verdict.reason, (reasons.get(run.verdict.reason) ?? 0) + 1);
  }
  const ms = (performance.now() - started) / seeds;
  const why = [...reasons].map(([r, n]) => `${n}× ${r}`).join('; ');
  out(
    `| ${scenario.number} | ${scenario.title} | ${((wins / seeds) * 100).toFixed(0)} % | ${wins ? (turns / wins).toFixed(1) : '—'} | ${ms.toFixed(0)} | ${why}`,
  );
}
