// Picks a seed for each Frontier Tour sortie: among the first N seeds, the one the autopilot wins
// with the most room to spare and without an escape, so every sortie is known to be winnable by
// following the bridge computer's advice alone. Also prints how often the autopilot wins each setup over all N seeds,
// the tour's difficulty curve. Run: node scripts/tour-search.mjs [seeds]

import { autoplay } from '../src/career/autopilot.js';
import { judgeCommendation } from '../src/career/orders.js';
import { SORTIES, sortiePreset } from '../src/career/missions.js';

const seeds = Number(process.argv[2] ?? 60);
const say = (line) => process.stdout.write(`${line}\n`);

for (const sortie of SORTIES) {
  let wins = 0;
  let best = null;
  for (let seed = 1; seed <= seeds; seed++) {
    const { game, log, turns, escapes } = autoplay({ difficulty: sortiePreset(sortie), seed });
    if (!game.won || escapes > 0) continue;
    wins += 1;
    const spare = game.stardateEnd - game.stardate;
    const room = spare + game.ship.hull / 10;
    if (!best || room > best.room) {
      const earned = sortie.commendations.map((c) => judgeCommendation(c, game, log));
      best = { seed, room, spare, hull: game.ship.hull, orders: log.orders, turns, earned };
    }
  }
  const pick = best
    ? `seed ${best.seed}: ${best.spare.toFixed(1)} sd spare, hull ${best.hull}%, ${best.orders} orders, stars ${best.earned.map((e) => (e ? '★' : '☆')).join('')}`
    : 'NO WINNING SEED';
  say(`${String(sortie.number).padStart(2)} ${sortie.name.padEnd(18)} autopilot wins ${String(wins).padStart(3)}/${seeds} · ${pick}`);
}
