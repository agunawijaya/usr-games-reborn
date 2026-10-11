import { createRng } from '@usr-games/kit';
import type { BoardWord } from './solver';

/**
 * The AI word-hunter for Duel. It plays the same board in real time, like a person: it knows a
 * share of the board's words (common and short ones far more often than rare and long ones),
 * finds the easy ones first, and needs a moment per word, longer for longer words. A hunt is
 * planned in full when the round starts, from a seed, so it replays exactly and the screen only
 * reveals each find when its moment comes.
 */

export type Strength = 1 | 2 | 3 | 4 | 5;

export const STRENGTHS: readonly Strength[] = [1, 2, 3, 4, 5];

export interface HunterProfile {
  strength: Strength;
  name: string;
  /** How it plays, for the setup screen. */
  blurb: string;
  /** Scales the chance of knowing a word. */
  reach: number;
  /** Words per second it can manage at its quickest. */
  pace: number;
}

export const HUNTERS: Record<Strength, HunterProfile> = {
  1: {
    strength: 1,
    name: 'Nibbler',
    blurb: 'Short, everyday words, taken slowly.',
    reach: 0.22,
    pace: 0.42,
  },
  2: {
    strength: 2,
    name: 'Browser',
    blurb: 'A steady eye for common words.',
    reach: 0.42,
    pace: 0.6,
  },
  3: {
    strength: 3,
    name: 'Reader',
    blurb: 'Quick, and knows a fair few longer words.',
    reach: 0.62,
    pace: 0.8,
  },
  4: {
    strength: 4,
    name: 'Scholar',
    blurb: 'Fast, deep, and fond of rare words.',
    reach: 0.8,
    pace: 1.05,
  },
  5: {
    strength: 5,
    name: 'Lexicon',
    blurb: 'Reads a board like a dictionary does.',
    reach: 0.97,
    pace: 1.45,
  },
};

/** Rarer words are harder to know: common, uncommon, rare, very rare. */
const TIER_FACTOR = [1, 0.72, 0.48, 0.3] as const;

function lengthFactor(letters: number): number {
  if (letters <= 4) return 1;
  if (letters === 5) return 0.9;
  if (letters === 6) return 0.76;
  if (letters === 7) return 0.6;
  return 0.45;
}

export function knowChance(word: BoardWord, profile: HunterProfile): number {
  return Math.min(0.98, profile.reach * TIER_FACTOR[word.tier] * lengthFactor(word.word.length));
}

export interface HunterFind {
  word: string;
  path: readonly number[];
  /** Seconds into the round. */
  at: number;
}

/** The hunt for a whole round: every word it will find, and when. */
export function planHunt(
  words: readonly BoardWord[],
  strength: Strength,
  seconds: number,
  seed: string,
): HunterFind[] {
  const profile = HUNTERS[strength];
  const rng = createRng(`hunter:${strength}:${seed}`);
  const known = words
    .filter((word) => rng.chance(knowChance(word, profile)))
    .map((word) => ({
      word,
      // Easy words come to mind first; a little noise keeps the order human.
      ease: word.tier * 0.6 + Math.max(0, word.word.length - 4) * 0.35 + rng.float(0, 1.4),
    }))
    .sort((a, b) => a.ease - b.ease);
  const finds: HunterFind[] = [];
  // Everyone needs a moment to take the board in.
  let at = 2 + rng.float(0, 2) / profile.pace;
  for (const { word } of known) {
    at += ((1.1 + 0.42 * word.word.length) / profile.pace / 2.2) * rng.float(0.7, 1.3);
    if (at > seconds) break;
    finds.push({ word: word.word, path: word.path, at });
  }
  return finds;
}

/** The finds made by `elapsed` seconds into the round. */
export function foundBy(plan: readonly HunterFind[], elapsed: number): HunterFind[] {
  return plan.filter((find) => find.at <= elapsed);
}
