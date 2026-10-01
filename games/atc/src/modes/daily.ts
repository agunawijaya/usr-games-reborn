import {
  composeShare,
  type DateKey,
  dailyNumber,
  emojiGrid,
  hashString,
  type ShareCell,
} from '@usr-games/kit';
import { ENDLESS_ARENAS, isFast } from '../arenas/library';
import type { Arena } from '../engine/arena';

/**
 * The Daily Sky: one arena and one traffic seed a day, the same for everyone. The 1986 game's
 * `-r seed` option finally has a purpose. The sky lasts four quarters of forty ticks; the fast
 * arenas only come on even-numbered days, so two fast days never follow each other.
 */

export const DAILY_QUARTER_TICKS = 40;
export const DAILY_QUARTERS = 4;
export const DAILY_TICKS = DAILY_QUARTER_TICKS * DAILY_QUARTERS;

export interface DailySky {
  number: number;
  dateKey: DateKey;
  arena: Arena;
  seed: string;
  ticks: number;
}

export function dailySky(dateKey: DateKey): DailySky {
  const number = dailyNumber(dateKey);
  const fastAllowed = number % 2 === 0;
  const pool = ENDLESS_ARENAS.filter((arena) => fastAllowed || !isFast(arena));
  const seed = `skyloom:daily:${dateKey}`;
  const arena = pool[hashString(seed) % pool.length]!;
  return { number, dateKey, arena, seed, ticks: DAILY_TICKS };
}

export interface DailyResult {
  safe: number;
  /** The tick the sky was lost on, or null if all four quarters were flown. */
  lostAt: number | null;
  /** Ticks on which a near-miss happened. */
  nearMissTicks: readonly number[];
  longestString: number;
}

/** One square per quarter: green when flown cleanly, yellow with a near-miss, dark where lost. */
export function dailyQuarters(result: DailyResult): ShareCell[] {
  return Array.from({ length: DAILY_QUARTERS }, (_, q) => {
    const from = q * DAILY_QUARTER_TICKS + 1;
    const to = from + DAILY_QUARTER_TICKS - 1;
    if (result.lostAt !== null && result.lostAt < from) return 'empty';
    if (result.lostAt !== null && result.lostAt <= to) return 'miss';
    return result.nearMissTicks.some((t) => t >= from && t <= to) ? 'near' : 'hit';
  });
}

/** "Skyloom #42 · 23 safe · 🟩🟩🟩🟨 · longest string: 5 ✈" — no link, ever. */
export function dailyShareText(sky: DailySky, result: DailyResult, colorBlind = false): string {
  const squares = emojiGrid([dailyQuarters(result)], colorBlind);
  const string = result.longestString >= 2 ? ` · longest string: ${result.longestString} ✈` : '';
  return composeShare({
    title: 'Skyloom',
    daily: sky.dateKey,
    headline: `${result.safe} safe · ${squares}${string}`,
  });
}
