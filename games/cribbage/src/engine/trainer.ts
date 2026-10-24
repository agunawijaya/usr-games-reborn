import type { Rng } from '@usr-games/kit';
import { type CardId, shuffledDeck } from '@usr-games/kit/cards';
import { sortByRank } from './cards';
import { countHand, type HandCount } from './score';

/**
 * The counting trainer: random hands to count, each four cards and a starter, now and then a
 * crib (where only a five-card flush counts). Hands worth nothing are mostly dealt again, since
 * there is little to learn from them, but not always: knowing a nineteen when you see one is a
 * skill too.
 */

export const SPRINT_SECONDS = 120;
export const RELAXED_HANDS = 10;

export interface TrainerHand {
  hand: CardId[];
  starter: CardId;
  isCrib: boolean;
  count: HandCount;
}

export function trainerHand(rng: Rng): TrainerHand {
  for (;;) {
    const cards = shuffledDeck(rng).slice(0, 5);
    const hand = sortByRank(cards.slice(0, 4));
    const starter = cards[4]!;
    const isCrib = rng.chance(0.2);
    const count = countHand(hand, starter, isCrib);
    if (count.total === 0 && rng.chance(0.7)) continue;
    return { hand, starter, isCrib, count };
  }
}

/** A typed answer: a whole number from 0 to 29, or null. */
export function readAnswer(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value <= 29 ? value : null;
}

/** Right if it is the total; for a hand worth nothing, the old "nineteen" is right as well. */
export function isRightCount(answer: number, total: number): boolean {
  return answer === total || (total === 0 && answer === 19);
}
