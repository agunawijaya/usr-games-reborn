// Finds a seed for every Grand Tour match whose waves the calibration bot wins
// about as often as the match's ease band asks, and sets the score target a
// little above the bot's median. Writes src/modes/tour-seeds.ts. Deterministic:
// `npx tsx games/robots/app/scripts/tour-search.ts [runs] [match-id]`.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashSeed } from '../src/modes/daily';
import { TOUR, tourPlan } from '../src/modes/tour';
import { TOUR_SEEDS } from '../src/modes/tour-seeds';
import { playMatch } from './bot';

const runs = Number(process.argv[2] ?? 16);
const only = process.argv[3];
const MAX_SALTS = 60;
const found: Record<string, { seed: number; target: number }> = { ...TOUR_SEEDS };
const say = (text: string) => process.stdout.write(`${text}\n`);

for (const [index, match] of TOUR.entries()) {
  if (only && match.id !== only) continue;
  const [lowest, highest] = match.ease;
  let chosen: { seed: number; target: number; rate: number; salt: number } | null = null;
  for (let salt = 0; salt < MAX_SALTS && !chosen; salt++) {
    const seed = hashSeed(`robots:tour:${match.id}:${salt}`);
    const plan = tourPlan(index, seed);
    const results = Array.from({ length: runs }, (_, run) => playMatch(plan, run * 7919 + 17));
    const wins = results.filter((r) => r.won);
    const rate = wins.length / runs;
    if (rate < lowest || rate > highest) continue;
    const points = wins.map((r) => r.points).sort((a, b) => a - b);
    const median = points[Math.floor(points.length / 2)];
    chosen = { seed, target: Math.round((median * 1.15) / 10) * 10, rate, salt };
  }
  if (!chosen) {
    say(`${match.name}: no seed in ${MAX_SALTS} tries`);
    continue;
  }
  found[match.id] = { seed: chosen.seed, target: chosen.target };
  say(`${match.name}: salt ${chosen.salt}, bot wins ${Math.round(chosen.rate * 100)}%, target ${chosen.target}`);
}

const target = fileURLToPath(new URL('../src/modes/tour-seeds.ts', import.meta.url));
const lines = TOUR.filter((m) => found[m.id]).map(
  (m) => `  '${m.id}': { seed: ${found[m.id].seed}, target: ${found[m.id].target} },`,
);
const header = [
  '// Written by scripts/tour-search.ts: the seed of every Grand Tour match and its score target.',
  'export const TOUR_SEEDS: Readonly<Record<string, { seed: number; target: number }>> = {',
];
writeFileSync(target, [...header, ...lines, '};', ''].join('\n'));
say(`wrote ${target}`);
