import { botOrder } from '../src/engine/bot';
import { applyOrder } from '../src/engine/orders';
import { knownCalls } from '../src/engine/preview';
import { newWatch } from '../src/engine/setup';

/**
 * Looks for an open-watch code and a number of autopilot orders after which a call is live and
 * gleaners are in the ship's zone, for the documentation's mid-watch screenshot.
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
search: for (const a of words) {
  for (const b of words) {
    const code = `${a}-${b}`;
    let state = newWatch({
      seed: `lightkeeper:code:${code}:3:1:commission`,
      rank: 3,
      length: 1,
      ruleSet: 'commission',
    }).state;
    for (let n = 1; n <= 30 && !state.outcome; n++) {
      const result = applyOrder(state, botOrder(state));
      state = result.accepted ? result.state : applyOrder(state, { type: 'rest', days: 0.3 }).state;
      if (knownCalls(state).length >= 2 && state.gleaners.length >= 2) {
        say(
          `${code} after ${n} orders: ${knownCalls(state).length} calls, ${state.gleaners.length} gleaners here`,
        );
        break search;
      }
    }
  }
}
