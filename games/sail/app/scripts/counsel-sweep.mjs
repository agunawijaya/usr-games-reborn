// How often the first lieutenant's counsel wins each playable scenario from each ship, over the
// first N seeds. Run: node scripts/counsel-sweep.mjs [seeds]
import { PLAYABLE, SCENARIOS } from '../src/engine/index.js';
import { autoplay } from '../src/career/autopilot.js';

const seeds = Number(process.argv[2] ?? 30);
for (const f of PLAYABLE) {
  const sc = SCENARIOS[f.id];
  const row = [];
  for (let ship = 0; ship < sc.ships.length; ship++) {
    let wins = 0;
    let best = null;
    for (let seed = 1; seed <= seeds; seed++) {
      const { st, log } = autoplay({ scenarioId: f.id, playerShip: ship, seed });
      if (st.result?.reason === 'victory') {
        wins += 1;
        if (!best || st.turn < best.turn) best = { seed, turn: st.turn, hull: Math.round((100 * st.ships[ship].specs.hull) / st.ships[ship].max.hull) };
      }
    }
    if (sc.ships.length <= 4 || wins) row.push(`${sc.ships[ship].name}: ${wins}/${seeds}${best ? ` (seed ${best.seed}, t${best.turn}, hull ${best.hull}%)` : ''}`);
  }
  process.stdout.write(`${String(f.id).padStart(2)} ${sc.name.padEnd(34)} ${row.join(' | ')}\n`);
}
