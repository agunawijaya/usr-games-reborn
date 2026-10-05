import { createRng } from '@usr-games/kit';
import { shuffledDeck } from '@usr-games/kit/cards';
import { applyMove, type Layout, openDeal, type RuleSet } from '../src/engine/rules';
import { solve } from '../src/engine/solver';

/**
 * How many random deals can be won? Runs the solver over seeded deals and prints the share
 * proven winnable, proven lost and left unsettled by the budget, with node counts and times.
 * `pnpm --filter @usr-games/game-canfield solve-stats [deals] [budget] [standard|relaxed] [maxRuns]`
 */

const deals = Number(process.argv[2] ?? 200);
const budget = Number(process.argv[3] ?? 300_000);
const rules = (process.argv[4] ?? 'standard') as RuleSet;
const maxRuns = process.argv[5] ? Number(process.argv[5]) : undefined;

function replays(layout: Layout, line: ReturnType<typeof solveOne>['line']): boolean {
  let state = layout;
  for (const move of line ?? []) {
    const step = applyMove(state, move);
    if (!step) return false;
    state = step.layout;
  }
  return state.outcome === 'won';
}

function solveOne(seed: string) {
  const layout = openDeal(shuffledDeck(createRng(seed)), rules).layout;
  const started = performance.now();
  const verdict = solve(layout, { nodeBudget: budget, maxRuns });
  const ms = performance.now() - started;
  return {
    layout,
    verdict: verdict.result,
    nodes: verdict.nodes,
    ms,
    line: verdict.result === 'winnable' ? verdict.line : undefined,
  };
}

const print = (line: string) => process.stdout.write(`${line}\n`);

const tally = { winnable: 0, unwinnable: 0, unknown: 0 };
const times: Record<string, number[]> = { winnable: [], unwinnable: [], unknown: [] };
const nodes: Record<string, number[]> = { winnable: [], unwinnable: [], unknown: [] };
let badLines = 0;
for (let i = 0; i < deals; i++) {
  const result = solveOne(`stats:${i}`);
  tally[result.verdict] += 1;
  times[result.verdict]!.push(result.ms);
  nodes[result.verdict]!.push(result.nodes);
  if (result.line && !replays(result.layout, result.line)) badLines += 1;
}

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};
const max = (values: number[]) => (values.length ? Math.max(...values) : 0);
const pct = (n: number) => `${((100 * n) / deals).toFixed(1)} %`;

print(`${deals} deals, ${rules}, budget ${budget}${maxRuns ? `, max runs ${maxRuns}` : ''}`);
for (const kind of ['winnable', 'unwinnable', 'unknown'] as const) {
  print(
    `${kind.padEnd(11)} ${String(tally[kind]).padStart(5)}  ${pct(tally[kind]).padStart(7)}  ` +
      `nodes median ${median(nodes[kind]!)} max ${max(nodes[kind]!)}  ` +
      `ms median ${median(times[kind]!).toFixed(0)} max ${max(times[kind]!).toFixed(0)}`,
  );
}
print(`winning lines that fail to replay: ${badLines}`);
