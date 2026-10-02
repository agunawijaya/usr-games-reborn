import { GARDENS } from '../src/gardens/gardens';
import { botRun, starCount } from '../src/modes/gardens-play';

/**
 * The house noodle's runs through every garden, for setting goals and chain targets: a garden
 * is grown on at least 90 % of runs, and three-starred on 15–35 %. The bot never dashes, so its
 * third star comes with every grown garden and the chain target decides the three-star rate.
 *
 *   pnpm --filter @usr-games/game-worm exec tsx scripts/balance.ts [runs]
 */

const runs = Number(process.argv[2] ?? 200);
for (const spec of GARDENS) {
  const results = Array.from({ length: runs }, (_, i) => botRun(spec, `balance:${spec.id}:${i}`));
  const grown = results.filter((r) => r.stars.grown).length / runs;
  const three = results.filter((r) => starCount(r.stars) === 3).length / runs;
  const chains = new Map<number, number>();
  for (const r of results) chains.set(r.bestChain, (chains.get(r.bestChain) ?? 0) + 1);
  // For each chain target, the share of runs that would three-star.
  const byTarget = [2, 3, 4, 5, 6, 7]
    .map((t) => {
      const share = results.filter((r) => r.stars.grown && r.bestChain >= t).length / runs;
      return `≥${t}: ${(share * 100).toFixed(0)}%`;
    })
    .join('  ');
  const moves = results.reduce((s, r) => s + r.moves, 0) / runs;
  process.stdout.write(
    `${String(spec.number).padStart(2)} ${spec.title.padEnd(16)} goal ${String(spec.goal).padStart(3)} grown ${(grown * 100).toFixed(0).padStart(3)}%  3★ ${(three * 100).toFixed(0).padStart(3)}% (chain ${spec.chainTarget})  avg ${moves.toFixed(0)} moves | ${byTarget}
`,
  );
}
