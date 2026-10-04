import { botOrder } from '../src/engine/bot';
import { applyOrder } from '../src/engine/orders';
import { newWatch } from '../src/engine/setup';

/**
 * Looks for an open-watch code and a number of autopilot orders whose last order saves a world in
 * the ship's own zone (a `world-relit` beat the Lantern earned there), for the documentation's
 * picture of the saved-world moment. Run with `pnpm exec tsx scripts/find-rescue.ts`.
 */
const say = (line: string) => process.stdout.write(`${line}\n`);
const words = [
  'lantern',
  'tide',
  'rook',
  'amber',
  'gale',
  'beacon',
  'fen',
  'moth',
  'lark',
  'quill',
];
let found = 0;
search: for (const a of words) {
  for (const b of words) {
    const code = `${a}-${b}`;
    let state = newWatch({
      seed: `lightkeeper:code:${code}:1:1:classic`,
      code,
      rank: 1,
      length: 1,
      ruleSet: 'classic',
    }).state;
    for (let n = 1; n <= 80 && !state.outcome; n++) {
      const result = applyOrder(state, botOrder(state));
      const accepted = result.accepted ? result : applyOrder(state, { type: 'rest', days: 0.3 });
      const saved = accepted.beats.find(
        (beat) =>
          beat.type === 'world-relit' &&
          beat.byUs &&
          beat.zone.row === accepted.state.ship.zone.row &&
          beat.zone.col === accepted.state.ship.zone.col,
      );
      state = accepted.state;
      if (saved) {
        say(`${code}: order ${n} saves a world in the ship's zone (accepted: ${result.accepted})`);
        if (++found >= 5) break search;
        break;
      }
    }
  }
}
