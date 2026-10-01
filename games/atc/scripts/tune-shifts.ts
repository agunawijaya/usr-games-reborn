/**
 * Plays every campaign shift with the house controller over many seeds and prints what it
 * reaches, with the target (90 % of seeds meet it) and fuel star (about 30 % earn it) those
 * results suggest. Usage: pnpm exec tsx games/atc/scripts/tune-shifts.ts [seeds]
 */
import { SHIFTS, starCount } from '../src/modes/shifts';
import { simulateCampaignShift } from '../src/modes/sim-shift';

const print = (text: string) => process.stdout.write(`${text}\n`);

const seeds = Number(process.argv[2] ?? '200');
for (const shift of SHIFTS) {
  const runs = Array.from({ length: seeds }, (_, i) =>
    simulateCampaignShift(shift, `shift:${shift.id}:${i}`),
  );
  const completed = runs.filter((r) => r.loss === null);
  const safe = completed.map((r) => r.safe).sort((a, b) => a - b);
  const fuel = completed.map((r) => r.fuelLeft).sort((a, b) => a - b);
  const at = (list: number[], q: number) =>
    list[Math.min(list.length - 1, Math.floor(list.length * q))] ?? 0;
  const one = runs.filter((r) => r.stars.target).length / seeds;
  const three = runs.filter((r) => starCount(r.stars) === 3).length / seeds;
  print(
    `${String(shift.number).padStart(2)} ${shift.id.padEnd(18)} done ${completed.length}/${seeds}  safe p10 ${at(safe, 0.1)} med ${at(safe, 0.5)}  fuel p50 ${at(fuel, 0.5).toFixed(2)} p70 ${at(fuel, 0.7).toFixed(2)}  ★ ${(one * 100).toFixed(0)}%  ★★★ ${(three * 100).toFixed(0)}%  (target ${shift.target}, fuel ${shift.fuelStar})`,
  );
}
