import { composeShare, createRng } from '@usr-games/kit';
import { SCENARIOS, type Scenario } from './catalogue';
import { playScenario } from './run';

/**
 * The Daily Deal: one scenario for everyone each day, on the same dice. The scenarios come round
 * in a shuffled order, a fresh shuffle every twenty-four days, and the day's dice are the first
 * of the day's seeds that the pilot can win with, so every Daily Deal is proven winnable before
 * anyone plays it. The coach stays off, and the first try of the day is the one that counts.
 */

export interface DailyDeal {
  readonly scenario: Scenario;
  /** The game's seed: the day's seed and which of its tries proved winnable. */
  readonly seed: string;
}

/** Seeds tried before giving up on proving a day; none has needed more than a handful. */
const TRIES = 40;

export function dailyScenario(dayNumber: number): Scenario {
  const cycle = Math.floor((dayNumber - 1) / SCENARIOS.length);
  const order = createRng(`monop:daily-cycle:${cycle}`).shuffle([...SCENARIOS]);
  return order[(((dayNumber - 1) % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length]!;
}

export function dailyDeal(daySeed: string, dayNumber: number): DailyDeal {
  const scenario = dailyScenario(dayNumber);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const seed = `${daySeed}:${attempt}`;
    if (playScenario(scenario, seed).verdict.won) return { scenario, seed };
  }
  return { scenario, seed: `${daySeed}:0` };
}

export interface DailyRecord {
  readonly number: number;
  readonly scenario: string;
  readonly won: boolean;
  readonly turns: number;
  /** Lots built on, and trades made. */
  readonly towers: number;
  readonly deals: number;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** `Deeds & Dice #42 · won in 14 turns · 🏙️ 3 towers · 🤝 2 deals` */
export function dailyShareText(dateKey: string, record: DailyRecord): string {
  const result = record.won ? `won in ${count(record.turns, 'turn', 'turns')}` : 'not this time';
  return composeShare({
    title: 'Deeds & Dice',
    daily: dateKey,
    headline: `${result} · 🏙️ ${count(record.towers, 'tower', 'towers')} · 🤝 ${count(record.deals, 'deal', 'deals')}`,
  });
}
