import { botOrder } from '../src/engine/bot';
import { applyOrder } from '../src/engine/orders';
import { earnsPromotion } from '../src/engine/score';
import { newWatch } from '../src/engine/setup';
import type { RankId } from '../src/engine/types';

const say = (...parts: unknown[]) =>
  process.stdout
    .write(`${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')}
`);
/** Win and promotion rates over many seeds: `tsx scripts/rates.ts <rank> <runs> [prefix]`. */
const rank = Number(process.argv[2] ?? 1) as RankId;
const runs = Number(process.argv[3] ?? 60);
const prefix = process.argv[4] ?? 'balance';
let wins = 0;
let promotions = 0;
const reasons: Record<string, number> = {};
for (let i = 0; i < runs; i++) {
  let state = newWatch({
    seed: `${prefix}:${rank}:${i}`,
    rank,
    length: 1,
    ruleSet: 'commission',
  }).state;
  for (let orders = 0; orders < 400 && !state.outcome; orders++) {
    const result = applyOrder(state, botOrder(state));
    state = result.accepted ? result.state : applyOrder(state, { type: 'rest', days: 0.3 }).state;
  }
  if (state.outcome?.kind === 'won') wins++;
  if (earnsPromotion(state)) promotions++;
  const key =
    state.outcome?.kind === 'lost' ? state.outcome.reason : (state.outcome?.kind ?? 'unfinished');
  reasons[key] = (reasons[key] ?? 0) + 1;
}
say(`rank ${rank}: wins ${wins}/${runs}, promotions ${promotions}/${runs}`, reasons);
