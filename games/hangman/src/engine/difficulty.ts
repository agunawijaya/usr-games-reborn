import { distinctLetters, LETTER_FREQUENCY } from './letters';

/**
 * Difficulty tiers, computed from a word's length and the rarity of its letters, never guessed
 * by hand. Two features:
 *
 * - **distinct letters**: each one is a slot the player can fill; fewer of them leave fewer ways
 *   to make progress, so short words are harder than long ones;
 * - **rarity**: the mean, over the word's distinct letters, of how many halvings of frequency
 *   each sits below `e`, the commonest letter (`e` is 0, `z` is about 7.5).
 *
 * The score is a straight line fitted to how many wrong letters the well-read model player
 * needs (`scripts/difficulty.ts`, numbers in docs/NOTES.md), and the cut-offs split the core
 * deck into thirds.
 */
export type Tier = 'easy' | 'medium' | 'hard';

const E = LETTER_FREQUENCY.e!;

export function letterRarity(letter: string): number {
  return Math.log2(E / LETTER_FREQUENCY[letter]!);
}

export function wordFeatures(word: string): { distinct: number; rarity: number } {
  const letters = distinctLetters(word);
  const rarity =
    letters.reduce((total, letter) => total + letterRarity(letter), 0) / letters.length;
  return { distinct: letters.length, rarity };
}

/** Fitted on the core deck on 2026-10-05 (see docs/NOTES.md). */
export const DIFFICULTY_FIT = { base: 2.505, perDistinct: -0.455, perRarity: 1.304 };
export const TIER_CUTOFFS = { mediumFrom: 1.056, hardFrom: 1.816 };

export function difficultyScore(word: string): number {
  const { distinct, rarity } = wordFeatures(word);
  return (
    DIFFICULTY_FIT.base + DIFFICULTY_FIT.perDistinct * distinct + DIFFICULTY_FIT.perRarity * rarity
  );
}

export function tierOf(word: string): Tier {
  const score = difficultyScore(word);
  if (score >= TIER_CUTOFFS.hardFrom) return 'hard';
  return score >= TIER_CUTOFFS.mediumFrom ? 'medium' : 'easy';
}
