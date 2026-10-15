import { createRng } from '@usr-games/kit';
import { newMatch, nextDriverAction, step } from '../src/engine/match';
import { SLY_TUNING, type SlyTuning, slyDecide } from '../src/ai/sly';
import { scoreHand } from '../src/engine/score';

/**
 * Sly's tuning bench (NOTES.md, "Building Sly"): each deal is played twice from the same seat
 * against Classic, once by Classic and once by Sly with the given tuning, and the difference in
 * that seat's lead is averaged.
 *   npx tsx scripts/tune-sly.ts 600 '{"strict":{"search":48,"overrideZ":2.5}}'
 */

const hands = Number(process.argv[2] ?? 2000);
const variants: Record<string, Partial<SlyTuning> | null> = JSON.parse(
  process.argv[3] ?? '{"base":{}}',
);

function lead(g: number, seat: number, tuning: SlyTuning | null): number {
  const match = newMatch({
    teams: false,
    length: 'single',
    seed: `tune:${g}`,
    drivers: ['classic', 'classic'],
  });
  const rng = createRng(`tune-rng:${g}:${seat}`);
  while (!match.hand.over) {
    const h = match.hand;
    const action =
      tuning && h.turn === seat
        ? slyDecide(h, seat, match.drivers[seat]!.memory, rng, tuning)
        : nextDriverAction(match)!;
    step(match, action);
  }
  const s = scoreHand(match.hand);
  return s[seat as 0 | 1].total - s[(1 - seat) as 0 | 1].total;
}

const baseline: number[] = [];
for (let g = 0; g < hands; g++) baseline.push(lead(g >> 1, g % 2, null));
for (const [name, patch] of Object.entries(variants)) {
  const tuning = { ...SLY_TUNING, ...(patch ?? {}) };
  let sum = 0,
    sq = 0,
    better = 0,
    worse = 0;
  for (let g = 0; g < hands; g++) {
    const d = lead(g >> 1, g % 2, tuning) - baseline[g]!;
    sum += d;
    sq += d * d;
    if (d > 0) better++;
    if (d < 0) worse++;
  }
  const mean = sum / hands;
  const se = Math.sqrt(sq / hands - mean * mean) / Math.sqrt(hands);
  process.stdout.write(
    `${name.padEnd(14)} gain over Classic ${mean.toFixed(1)} ± ${se.toFixed(1)} pts/hand  (better ${better}, worse ${worse})\n`,
  );
}
