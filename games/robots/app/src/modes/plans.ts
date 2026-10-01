// A match plan says everything a run needs to know beyond the rules
// themselves: how many robots each wave brings, how many teleports you get,
// whether the robots keep time on their own, and how loud the crowd starts.
// The rules engine (src/game/) never sees a plan; Game.tsx applies it.

import { MAX_ROBOTS, ROBOTS_PER_LEVEL } from '../game/state';
import { dailyNumber, dailySeed, weekday } from './daily';

export type ModeId = 'exhibition' | 'tour' | 'showdown' | 'blitz' | 'custom';

export type MatchPlan = Readonly<{
  mode: ModeId;
  title: string;
  /** One line under the title: the rule that makes this match different. */
  rule: string;
  /** Fixed for the tour and the showdown, so everyone meets the same waves. */
  seed: number | null;
  /** Robots per wave; null means the original's escalation, wave after wave. */
  waves: readonly number[] | null;
  startWave: number;
  /** Teleports for the whole run; null is unlimited. */
  teleports: number | null;
  /** Seconds before the robots move on their own (the original's hidden -r); null waits for you. */
  tempo: number | null;
  allowWait: boolean;
  hypeGain: number;
  startHype: number;
  /** Jumbotron calls, one optional challenge per wave. */
  calls: boolean;
  tourIndex?: number;
  dateKey?: string;
}>;

const BASE = {
  seed: null,
  waves: null,
  startWave: 1,
  teleports: null,
  tempo: null,
  allowWait: true,
  hypeGain: 1,
  startHype: 0,
  calls: true,
} as const;

/** The original's escalation: ten more robots each level, never more than forty. */
export function classicRobots(level: number): number {
  return Math.min(level * ROBOTS_PER_LEVEL, MAX_ROBOTS);
}

export function robotsForWave(plan: MatchPlan, level: number): number {
  if (!plan.waves) return classicRobots(level);
  return plan.waves[Math.min(plan.waves.length, Math.max(1, level - plan.startWave + 1)) - 1];
}

/** True when clearing this level ends the match (endless plans never end that way). */
export function isFinalWave(plan: MatchPlan, level: number): boolean {
  return plan.waves !== null && level - plan.startWave + 1 >= plan.waves.length;
}

export function waveCount(plan: MatchPlan): number | null {
  return plan.waves ? plan.waves.length : null;
}

export function exhibitionPlan(): MatchPlan {
  return { ...BASE, mode: 'exhibition', title: 'Exhibition', rule: 'The original, wave after wave, with a crowd that loves a pile-up.' };
}

export const BLITZ_TEMPOS = [3, 2, 1.5] as const;

export function blitzPlan(tempo: number): MatchPlan {
  return {
    ...BASE,
    mode: 'blitz',
    title: `Blitz · ${tempo} s`,
    rule: `The robots will not wait: every ${tempo} seconds they move whether you do or not.`,
    tempo,
  };
}

export type CustomOptions = Readonly<{ startWave: number; teleports: number | null; tempo: number | null; allowWait: boolean }>;

export function customPlan(options: CustomOptions): MatchPlan {
  const parts = [`from wave ${options.startWave}`];
  parts.push(options.teleports === null ? 'unlimited teleports' : `${options.teleports} teleport${options.teleports === 1 ? '' : 's'}`);
  if (options.tempo !== null) parts.push(`robots move every ${options.tempo} s`);
  if (!options.allowWait) parts.push('no waiting');
  return { ...BASE, mode: 'custom', title: 'Custom match', rule: `${parts.join(' · ')}. Just for practice: no records.`, ...options };
}

// ------------------------------------------------------------------ daily

type DailyRule = Readonly<{ name: string; rule: string; change: Partial<MatchPlan> }>;

/** Monday first. Each day of the week bends one thing. */
export const DAILY_RULES: readonly DailyRule[] = [
  { name: 'Classic Monday', rule: 'No twists: the original escalation, the same waves for everyone.', change: {} },
  { name: 'Two-Teleport Tuesday', rule: 'Two teleports for the whole run. Spend them well.', change: { teleports: 2 } },
  { name: 'Wired Wednesday', rule: 'The crowd is wired: hype builds half as fast again.', change: { hypeGain: 1.5 } },
  { name: 'Blitz Thursday', rule: 'The robots move every 3 seconds whether you do or not.', change: { tempo: 3 } },
  { name: 'Forty Friday', rule: 'Straight in at wave 4: forty robots from the first whistle.', change: { startWave: 4 } },
  { name: 'Showtime Saturday', rule: 'The stands are already roaring: you start at Roaring hype.', change: { startHype: 50 } },
  { name: 'No-Wait Sunday', rule: 'No waiting today: every turn is your move.', change: { allowWait: false } },
];

export function showdownPlan(dateKey: string): MatchPlan {
  const day = DAILY_RULES[weekday(dateKey)];
  return {
    ...BASE,
    ...day.change,
    mode: 'showdown',
    title: `Showdown #${dailyNumber(dateKey)}`,
    rule: `${day.name}. ${day.rule}`,
    seed: dailySeed(dateKey),
    dateKey,
  };
}

export function dailyRuleName(dateKey: string): string {
  return DAILY_RULES[weekday(dateKey)].name;
}
