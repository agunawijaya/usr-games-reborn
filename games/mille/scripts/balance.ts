import type { Level } from '../src/ai/players';
import { type Length, newMatch, playOut } from '../src/engine/match';

/**
 * Seeded head-to-head runs between the drivers, for NOTES.md:
 *   pnpm --filter @usr-games/game-mille balance [games] [length] [a-b …]
 * e.g. `balance 2000 full classic-rookie sly-classic`. Seats swap every game so neither driver
 * always opens; the report counts wins for the first-named driver.
 */

const games = Number(process.argv[2] ?? 400);
const length = (process.argv[3] ?? 'full') as Length;
const pairs = process.argv.slice(4).length
  ? process.argv.slice(4)
  : ['classic-rookie', 'sly-classic', 'sly-rookie', 'classic-classic'];
const teams = process.env.TEAMS === '1';
// SHARD=i SHARDS=n runs only the games numbered i mod n, so a long run can use every core.
const shard = Number(process.env.SHARD ?? 0);
const shards = Number(process.env.SHARDS ?? 1);

function line(text: string): void {
  process.stdout.write(`${text}\n`);
}

for (const pair of pairs) {
  const [a, b] = pair.split('-') as [Level, Level];
  let wins = 0;
  let losses = 0;
  let hands = 0;
  let coups = 0;
  let extensions = 0;
  let points = 0;
  const started = performance.now();
  let played = 0;
  for (let g = shard; g < games; g += shards) {
    played++;
    const aSeat = g % 2;
    const drivers: Level[] = teams ? [a, b, a, b] : [a, b];
    if (aSeat === 1) drivers.reverse();
    const match = playOut(newMatch({ teams, length, seed: `balance:${pair}:${g}`, drivers }));
    const aSide = aSeat as 0 | 1;
    if (match.winner === aSide) wins++;
    else if (match.winner !== null) losses++;
    hands += match.history.length;
    for (const record of match.history) {
      coups += record.scores[aSide].coups / 300;
      if (record.extended) extensions++;
      points += record.scores[aSide].total;
    }
  }
  const ms = performance.now() - started;
  line(
    `${pair.padEnd(16)} ${played} ${length} games: ${a} wins ${((100 * wins) / played).toFixed(1)}%` +
      ` (losses ${((100 * losses) / played).toFixed(1)}%), ${(hands / played).toFixed(2)} hands/game,` +
      ` ${(points / hands).toFixed(0)} pts/hand for ${a}, ${(coups / hands).toFixed(3)} coups/hand,` +
      ` ${((100 * extensions) / hands).toFixed(1)}% hands extended, ${(ms / played).toFixed(1)} ms/game` +
      ` [raw ${wins} ${losses} ${played} ${hands} ${points} ${coups} ${extensions}]`,
  );
}
