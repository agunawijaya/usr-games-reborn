// Grand Tour report: the bot plays every match many times and reports how often
// it wins and the points it scores. Run from the repository root:
// `npx tsx games/robots/app/scripts/tour-sim.ts [runs]`.

import { TOUR, scoreTarget, tourPlan } from '../src/modes/tour';
import { playMatch } from './bot';

const runs = Number(process.argv[2] ?? 40);

for (const [index, match] of TOUR.entries()) {
  const plan = tourPlan(index);
  const wins = Array.from({ length: runs }, (_, run) => playMatch(plan, run * 7919 + index)).filter((r) => r.won);
  const points = wins.map((r) => r.points).sort((a, b) => a - b);
  const median = points.length ? points[Math.floor(points.length / 2)] : 0;
  const winRate = String(Math.round((wins.length / runs) * 100)).padStart(3);
  const row = `${String(index + 1).padStart(2)} ${match.name.padEnd(16)} wins ${winRate}%`;
  process.stdout.write(`${row} · median points of wins ${median} · target ${scoreTarget(match)}\n`);
}
