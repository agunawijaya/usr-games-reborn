import { botOrder } from '../src/engine/bot';
import { applyOrder } from '../src/engine/orders';
import { scoreSheet } from '../src/engine/score';
import { newWatch } from '../src/engine/setup';
import type { RankId, RuleSet, WatchLength } from '../src/engine/types';

const say = (...parts: unknown[]) =>
  process.stdout
    .write(`${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')}
`);
/**
 * Prints one watch order by order, for reading the bot and the rules together:
 * `tsx scripts/trace.ts <rank> <seed> [ruleSet] [length]`.
 */

const rank = Number(process.argv[2] ?? 1) as RankId;
const seed = process.argv[3] ?? 'trace';
const ruleSet = (process.argv[4] ?? 'commission') as RuleSet;
const length = Number(process.argv[5] ?? 1) as WatchLength;

const start = newWatch({ seed, rank, length, ruleSet });
let state = start.state;
const zone = (p: { row: number; col: number }) => `${'ABCDEFGH'[p.col]}${p.row + 1}`;
say(
  `rank ${rank} · ${state.params.gleaners} gleaners · ${state.params.harbours} harbours · ${state.params.time} days · start ${zone(state.ship.zone)}`,
);
for (let i = 0; i < 400 && !state.outcome; i++) {
  const order = botOrder(state);
  const result = applyOrder(state, order);
  const s = result.state;
  const beats = result.beats
    .filter((b) => !['scanned', 'gleaner-moved', 'entered', 'clock'].includes(b.type))
    .map((b) => {
      if (b.type === 'shot') return `shot ${b.hit}/${b.absorbed}`;
      if (b.type === 'beam') return `beam ${b.hit}`;
      if (b.type === 'refused') return `REFUSED ${b.reason} ${b.system ?? ''}`;
      if (b.type === 'travel')
        return `travel ${zone(b.to.zone)} ${b.days.toFixed(2)}d ${b.energy}e`;
      if (b.type === 'flare') return `flare ${b.end}${b.misfire ? ' misfire' : ''}`;
      if (b.type === 'critical' || b.type === 'damaged') return `${b.type} ${b.system}`;
      return b.type;
    });
  say(
    `${String(i).padStart(3)} ${JSON.stringify(order)} → E${s.ship.energy} S${s.ship.shield}${s.ship.shieldUp ? '↑' : '↓'} F${s.ship.flares} day ${(s.now.date - s.params.date).toFixed(2)} left ${s.now.time.toFixed(2)} G${s.now.gleaners} @${zone(s.ship.zone)} [${beats.join(', ')}]`,
  );
  if (!result.accepted) {
    state = applyOrder(state, { type: 'rest', days: 0.3 }).state;
    continue;
  }
  state = s;
}
say(JSON.stringify(state.outcome), scoreSheet(state));
