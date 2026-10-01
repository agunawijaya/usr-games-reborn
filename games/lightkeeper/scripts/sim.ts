import { type BotStyle, botOrder, captainFor, STEADY_CAPTAIN } from '../src/engine/bot';
import { applyOrder } from '../src/engine/orders';
import { earnsPromotion, lightsKept, scoreSheet } from '../src/engine/score';
import { CAREER_TUNING } from '../src/engine/params';
import { newWatch } from '../src/engine/setup';
import type { RankId, RuleSet, WatchLength, WatchState } from '../src/engine/types';

const say = (...parts: unknown[]) =>
  process.stdout
    .write(`${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')}
`);
/**
 * Plays many watches with the steady captain and prints how they went, per rank:
 * `pnpm --filter @usr-games/game-lightkeeper sim [runs] [ruleSet] [length]`.
 */

const runs = Number(process.argv[2] ?? 100);
const ruleSet = (process.argv[3] ?? 'commission') as RuleSet;
const length = Number(process.argv[4] ?? 1) as WatchLength;

const STYLES: Record<string, BotStyle | null> = {
  adaptive: null,
  steady: STEADY_CAPTAIN,
  bold: { ...STEADY_CAPTAIN, arriveShielded: false },
  fortress: { ...STEADY_CAPTAIN, travelShielded: true, homeEnergy: 2200 },
};
const style = STYLES[process.argv[5] ?? 'adaptive'] ?? null;
if (process.argv[6]) CAREER_TUNING.extraDays = Number(process.argv[6]);
if (process.argv[7]) CAREER_TUNING.skillStep = Number(process.argv[7]);
if (process.argv[8]) CAREER_TUNING.extraGleaners = Number(process.argv[8]);
if (process.argv[9]) CAREER_TUNING.callDelay = Number(process.argv[9]);

export function playOut(rank: RankId, seed: string, set: RuleSet, len: WatchLength, cap = 600) {
  let { state } = newWatch({ seed, rank, length: len, ruleSet: set });
  let refusals = 0;
  let orders = 0;
  while (!state.outcome && orders < cap) {
    const order = botOrder(state, style ?? captainFor(state));
    const result = applyOrder(state, order);
    orders++;
    if (!result.accepted) {
      refusals++;
      if (refusals > 40) break;
      state = applyOrder(state, { type: 'rest', days: 0.3 }).state;
      continue;
    }
    state = result.state;
  }
  return { state, orders, refusals };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function summarise(rank: RankId) {
  const outcomes: Record<string, number> = {};
  const orders: number[] = [];
  const days: number[] = [];
  const kept: number[] = [];
  const scores: number[] = [];
  let wins = 0;
  let promotions = 0;
  let calls = 0;
  for (let i = 0; i < runs; i++) {
    const { state, orders: count } = playOut(rank, `sim:${rank}:${i}`, ruleSet, length);
    const key = outcomeKey(state);
    outcomes[key] = (outcomes[key] ?? 0) + 1;
    orders.push(count);
    days.push(state.now.date - state.params.date);
    kept.push(lightsKept(state));
    scores.push(scoreSheet(state).total);
    calls += state.ship.callsIssued;
    if (state.outcome?.kind === 'won') wins++;
    if (earnsPromotion(state)) promotions++;
  }
  say(
    `rank ${rank}: win ${pct(wins)} promote ${pct(promotions)} · orders ${median(orders)} · days ${median(days).toFixed(1)} · lights ${median(kept)} · score ${median(scores)} · calls/watch ${(calls / runs).toFixed(1)}`,
  );
  say(
    `         ${Object.entries(outcomes)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`,
  );
}

function outcomeKey(state: WatchState) {
  if (!state.outcome) return 'unfinished';
  if (state.outcome.kind === 'lost') return `lost:${state.outcome.reason}`;
  return state.outcome.kind;
}

function pct(n: number) {
  return `${Math.round((100 * n) / runs)}%`;
}

if (process.argv[1]?.endsWith('sim.ts')) {
  say(
    `${runs} watches per rank · ${ruleSet} rules · length ${length} · ${process.argv[5] ?? 'adaptive'} · ${JSON.stringify(CAREER_TUNING)}`,
  );
  for (const rank of [1, 2, 3, 4, 5, 6] as RankId[]) summarise(rank);
}
