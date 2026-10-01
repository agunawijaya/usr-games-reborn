import type { Category } from '../manifest/manifest';
import type { GameResult } from '../contract/contract';

/**
 * Every number that turns play into XP lives here, so balance changes are one-file edits
 * that the simulations immediately re-check.
 *
 * The shape of the rules:
 * - A completed session earns XP that grows with the game's typical length.
 * - The first few sessions of the same game each day earn in full; after that returns fade,
 *   so the quickest way up is variety rather than grinding one game.
 * - Toys (screensavers and the like) earn a small amount once a day, so leaving one running
 *   is never worth anything.
 * - A soft daily ceiling slows (never stops) very long days; no warning copy, no penalty.
 */
export const XP_RULES = {
  sessionBase: 8,
  sessionPerMinute: 2.4,
  sessionMin: 10,
  sessionMax: 50,
  toySession: 6,
  firstWinOfDay: 25,
  dailyChallenge: 40,
  eventMax: 25,
  eventsPerSession: 30,
  /** Multiplier for the nth session of one game on one day; the last entry repeats. */
  sameGameMultipliers: [1, 1, 1, 0.5, 0.25, 0.1] as readonly number[],
  dailySoftCap: 650,
  overCapRate: 0.25,
  cronJob: 150,
  cronFullWeekBonus: 100,
} as const;

export interface GameInfo {
  id: string;
  title: string;
  category: Category;
  sessionMinutes: readonly [number, number];
  daily: boolean;
  cronGoals?: readonly { id: string; stat: string; label: string; min: number; max: number }[];
}

export function isToy(game: Pick<GameInfo, 'category'>): boolean {
  return game.category === 'toys';
}

export function sessionXp(game: Pick<GameInfo, 'sessionMinutes' | 'category'>): number {
  if (isToy(game)) return XP_RULES.toySession;
  const [shortest, longest] = game.sessionMinutes;
  const typical = (shortest + longest) / 2;
  const raw = Math.round(XP_RULES.sessionBase + XP_RULES.sessionPerMinute * typical);
  return Math.min(XP_RULES.sessionMax, Math.max(XP_RULES.sessionMin, raw));
}

export function sameGameMultiplier(sessionNumberToday: number): number {
  const table = XP_RULES.sameGameMultipliers;
  const index = Math.min(Math.max(0, sessionNumberToday - 1), table.length - 1);
  return table[index] as number;
}

/** Games may flag milestones; each is clamped and the session total is capped. */
export function eventsXp(events: GameResult['xpEvents']): number {
  if (!events) return 0;
  const total = events.reduce(
    (sum, event) => sum + Math.min(XP_RULES.eventMax, Math.max(0, Math.round(event.xp) || 0)),
    0,
  );
  return Math.min(XP_RULES.eventsPerSession, total);
}

/** Applies the soft ceiling to `amount` given how much play XP the day already holds. */
export function applySoftCap(alreadyToday: number, amount: number): number {
  const room = Math.max(0, XP_RULES.dailySoftCap - alreadyToday);
  const full = Math.min(room, amount);
  return Math.round(full + (amount - full) * XP_RULES.overCapRate);
}

/** A session counts as completed unless the player quit it. */
export function completedSession(result: Pick<GameResult, 'outcome'>): boolean {
  return result.outcome !== 'quit';
}
