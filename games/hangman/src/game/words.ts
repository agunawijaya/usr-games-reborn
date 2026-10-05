import type { Rng } from '@usr-games/kit';
import { CORE_DECK, type Deck, deckById } from '../decks/decks';
import { dailyWord } from '../engine/daily';
import { type Tier, tierOf } from '../engine/difficulty';
import { pickFair } from '../engine/pickers';
import { RUN_LENGTH } from '../engine/tide-run';
import type { TierChoice } from './saves';

/**
 * Where each mode's words come from. Every pick is fair (uniform over the words it may take);
 * a beach avoids words played recently while it has others to offer.
 */
export const CLASSIC_MIN_LENGTH = 6;
export const TUTORIAL_WORD = 'shore';

export function wordsOf(deck: Deck, tier: TierChoice): string[] {
  return tier === 'any' ? deck.words : deck.words.filter((word) => tierOf(word) === tier);
}

/** A fair pick that skips recently played words while any others remain. */
export function pickFresh(words: readonly string[], recent: readonly string[], rng: Rng): string {
  const seen = new Set(recent);
  const fresh = words.filter((word) => !seen.has(word));
  return pickFair(fresh.length > 0 ? fresh : words, rng);
}

/** Classic keeps the original's rule: the everyday deck, six letters and up. */
export function classicWords(): string[] {
  return CORE_DECK.words.filter((word) => word.length >= CLASSIC_MIN_LENGTH);
}

/** The Daily pool: everyday words of five to ten letters, of medium difficulty or harder. */
export function dailyPool(): string[] {
  return CORE_DECK.words.filter(
    (word) => word.length >= 5 && word.length <= 10 && tierOf(word) !== 'easy',
  );
}

export function dailyWordFor(dailyNumber: number): string {
  return dailyWord(dailyPool(), dailyNumber);
}

/** A Tide run climbs: three easy words, four medium, three hard, from one deck. */
const RUN_PLAN: readonly Tier[] = [
  'easy',
  'easy',
  'easy',
  'medium',
  'medium',
  'medium',
  'medium',
  'hard',
  'hard',
  'hard',
];

export function runWords(deckId: string, recent: readonly string[], rng: Rng): string[] {
  const deck = deckById(deckId);
  const chosen: string[] = [];
  for (const tier of RUN_PLAN.slice(0, RUN_LENGTH)) {
    const pool = wordsOf(deck, tier).filter((word) => !chosen.includes(word));
    chosen.push(pickFresh(pool.length > 0 ? pool : deck.words, recent, rng));
  }
  return chosen;
}
