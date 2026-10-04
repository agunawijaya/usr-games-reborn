import { type EncounterKind } from '../src/voyage/types';
import { buildEncounter } from '../src/voyage/encounters';
import { playEncounter, playLife, type SimStyle } from '../src/bots/sim';
import { pressureAt, ARC } from '../src/voyage/life';
import { dailyEncounter } from '../src/voyage/daily';

const say = (line: string) => process.stdout.write(`${line}\n`);

/**
 * The balance report: every encounter of the arc at its own pressure, played by each bot over
 * many seeds, then whole lives from launch to epilogue. `tsx scripts/sim.ts [runs]`.
 */

const runs = Number(process.argv[2] ?? 60);
const styles: SimStyle[] = ['idle', 'computer', 'gunner', 'seaman'];

function pct(n: number, of: number): string {
  return `${Math.round((100 * n) / of)}%`.padStart(5);
}

say(`Encounters, ${runs} seeds each (win% / taken% / turns)`);
ARC.forEach((chapter, index) => {
  for (const kind of chapter.kinds) {
    const row: string[] = [];
    for (const style of styles) {
      let wins = 0;
      let lost = 0;
      let turns = 0;
      for (let i = 0; i < runs; i++) {
        const encounter = buildEncounter(kind as EncounterKind, `sim:${kind}:${index}:${i}`, {
          flagship: {
            name: 'Kittiwake',
            qual: [2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5][index] as 2,
            refits: [],
            away: 0,
          },
          squadron: [],
          pressure: pressureAt(index),
        });
        const { battle } = playEncounter(encounter, style);
        if (battle.end?.win) wins++;
        if (battle.end?.win === false) lost++;
        turns += battle.turn;
      }
      row.push(
        `${style} ${pct(wins, runs)} ${pct(lost, runs)} ${(turns / runs).toFixed(0).padStart(3)}`,
      );
    }
    say(`${String(index).padStart(2)} ${kind.padEnd(9)} ${row.join('  |  ')}`);
  }
});

for (const style of styles) {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const encounter = buildEncounter('recapture', `sim:retake:${i}`, {
      flagship: { name: 'Kittiwake', qual: 3, refits: [], away: 0 },
      squadron: [],
      pressure: 2,
    });
    if (playEncounter(encounter, style).battle.end?.win) wins++;
  }
  say(`recapture ${style.padEnd(8)} ${pct(wins, runs)}`);
}

say(`\nToday's Weather over ${runs} days (gunner)`);
let dailyWins = 0;
for (let i = 0; i < runs; i++) {
  const { battle } = playEncounter(
    dailyEncounter(`2026-10-${String(i).padStart(2, '0')}`),
    'gunner',
  );
  if (battle.end?.win) dailyWins++;
}
say(`win ${pct(dailyWins, runs)}`);

say(`\nWhole lives, ${Math.min(runs, 30)} seeds`);
for (const style of ['gunner', 'seaman'] as const) {
  const endings: Record<string, number> = {};
  let renown = 0;
  let hulls = 0;
  let squadron = 0;
  let elite = 0;
  const lives = Math.min(runs, 30);
  for (let i = 0; i < lives; i++) {
    const life = playLife(`sim-life-${i}`, style, (n) => i % n);
    endings[life.ending ?? 'none'] = (endings[life.ending ?? 'none'] ?? 0) + 1;
    renown += life.renown;
    hulls += life.hull - 1;
    squadron += life.squadron.length;
    if (life.crew.qual === 5) elite++;
  }
  say(
    `${style}: renown ${(renown / lives).toFixed(0)}, ships lost ${(hulls / lives).toFixed(2)}, squadron ${(squadron / lives).toFixed(1)}, elite ${pct(elite, lives)}, endings ${JSON.stringify(endings)}`,
  );
}
