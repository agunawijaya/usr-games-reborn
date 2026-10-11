/**
 * Points, chain combos and coverage. Points grow steeply with length, so one long word is worth
 * a handful of short ones; finding words in quick succession multiplies them; coverage is the
 * 1988 game's own measure, your share of every word the board holds.
 */

/** Letters needed by default, as in the original (its `-w` switch raised it). */
export const MIN_LETTERS = 3;

export function basePoints(word: string): number {
  const letters = word.length;
  if (letters < MIN_LETTERS) return 0;
  if (letters <= 4) return 1;
  if (letters === 5) return 2;
  if (letters === 6) return 3;
  if (letters === 7) return 5;
  return 11;
}

/** A word found within this many seconds of the last one keeps the chain going. */
export const COMBO_WINDOW_SECONDS = 4;
export const COMBO_MULTIPLIERS = [1, 1.5, 2, 3] as const;
export const TOP_COMBO = COMBO_MULTIPLIERS.length - 1;

export interface Combo {
  /** 0 is no chain (×1); 3 is the top step (×3). */
  level: number;
  lastAt: number | null;
}

export const NO_COMBO: Combo = { level: 0, lastAt: null };

export function comboAfterWord(combo: Combo, at: number): Combo {
  const inTime = combo.lastAt !== null && at - combo.lastAt <= COMBO_WINDOW_SECONDS;
  return { level: inTime ? Math.min(TOP_COMBO, combo.level + 1) : 0, lastAt: at };
}

export function multiplierFor(level: number): number {
  return COMBO_MULTIPLIERS[Math.max(0, Math.min(TOP_COMBO, level))]!;
}

/** Seconds of chain left at `at`, for the meter that drains between words. */
export function comboTimeLeft(combo: Combo, at: number): number {
  if (combo.lastAt === null) return 0;
  return Math.max(0, COMBO_WINDOW_SECONDS - (at - combo.lastAt));
}

export function wordScore(word: string, comboLevel: number): number {
  return Math.round(basePoints(word) * multiplierFor(comboLevel));
}

/** The share of the board's words found, 0–1; an empty board counts as fully covered. */
export function coverage(found: number, total: number): number {
  return total === 0 ? 1 : found / total;
}

/**
 * The lifetime average, pooled the way the 1988 program pooled it: all words found over all
 * words there were, not a mean of each round's percentage.
 */
export function pooledAverage(found: number, total: number): number {
  return total === 0 ? 0 : found / total;
}

export function percent(share: number): number {
  return Math.round(share * 100);
}
