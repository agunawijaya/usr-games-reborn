import { type CardId, rankOf, suitIndexOf } from '@usr-games/kit/cards';
import { valueOf } from '../cards';
import { canPlay, PLAY_LIMIT, pegPoints } from '../peg';
import { scoreHand } from '../score';
import { CRIB_DEALS } from './crib-odds';
import { CRIB_SUMS } from './crib-sums';

/**
 * Classic: Earl T. Cohen's computer player from the Berkeley cribbage, ported decision for
 * decision (adapted from `support.c` and `score.c`, © 1980, 1993 The Regents of the University
 * of California, BSD licence: LICENSES/BSD-3-Clause-UCB.txt). The tests replay positions
 * recorded from the C program and expect the same card every time.
 *
 * It keeps the original's slips on purpose, because they are its character:
 * - weighing a discard, it scores the four cards it keeps as if they were a crib, so a
 *   four-card flush in its own hand is worth nothing to it unless the starter matches;
 * - its crib values come from a table that also credits four-card flushes in the crib.
 */

/** The original sorts hands by rank, then spades, hearts, diamonds, clubs; ties go to the first. */
function originalOrder(card: CardId): number {
  return rankOf(card) * 4 + (3 - suitIndexOf(card));
}

export function sortLikeOriginal(cards: readonly CardId[]): CardId[] {
  return [...cards].sort((a, b) => originalOrder(a) - originalOrder(b));
}

/**
 * Cohen's crib table counted a four-card flush in the crib, which the rules do not allow: for
 * two suited cards that is 4 points for each of the C(11,2) × 39 deals where the other two crib
 * cards share their suit and the starter does not. Our own sums leave it out, so Classic adds it
 * back to stay faithful. Every offsuit entry already matches the original table exactly.
 */
export const FOUR_CARD_CRIB_FLUSH_SUM = 4 * 55 * 39;

/** The rounded average the original's `adjust` returns for laying `a` and `b` in a crib. */
export function cribAdjust(a: CardId, b: CardId): number {
  const low = Math.min(rankOf(a), rankOf(b));
  const high = Math.max(rankOf(a), rankOf(b));
  const suited = suitIndexOf(a) === suitIndexOf(b);
  const sum = suited
    ? CRIB_SUMS.suited[low - 1]![high - 1]! + FOUR_CARD_CRIB_FLUSH_SUM
    : CRIB_SUMS.offsuit[low - 1]![high - 1]!;
  return Math.floor((sum + CRIB_DEALS / 2) / CRIB_DEALS);
}

/**
 * The discard (`cdiscard`): for each of the fifteen ways to lay away two cards, add up the kept
 * hand's score against every card it cannot see, plus (its crib) or minus (yours) the crib
 * table's rounded value once per card. The highest total wins; on a tie, the earliest pair.
 */
export function classicDiscard(hand: readonly CardId[], ownCrib: boolean): [CardId, CardId] {
  const sorted = sortLikeOriginal(hand);
  const unseen: CardId[] = [];
  for (let card = 0; card < 52; card++) if (!sorted.includes(card)) unseen.push(card);
  let best: [CardId, CardId] = [sorted[0]!, sorted[1]!];
  let bestSum = -Infinity;
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const kept = sorted.filter((_, index) => index !== i && index !== j);
      const crib = cribAdjust(sorted[i]!, sorted[j]!);
      let sum = 0;
      for (const starter of unseen) {
        sum += scoreHand(kept, starter, true) + (ownCrib ? crib : -crib);
      }
      if (sum > bestSum) {
        bestSum = sum;
        best = [sorted[i]!, sorted[j]!];
      }
    }
  }
  return best;
}

/** `anysumto`: the first card that brings the count to `target`, or −1. */
function cardReaching(hand: readonly CardId[], count: number, target: number): number {
  return hand.findIndex((card) => count + valueOf(card) === target);
}

/** `numofval`: how many cards in the hand have the given value. */
function cardsWorth(hand: readonly CardId[], value: number): number {
  return hand.filter((card) => valueOf(card) === value).length;
}

/** Counts to aim for after laying a card, in the order the original tries them (`tv`). */
const SETUP_COUNTS = [8, 7, 9, 6, 11, 12, 13, 14, 10, 5] as const;

/**
 * The quiet play (`cchose`), used when no card scores. In order: lead or follow towards a
 * count of 4 (or 3 on the lead); leave a count from 11 to 20 when it holds the card that would
 * answer a ten with 31; leave a count that would let it pair your fifteen; otherwise lay its
 * highest card that avoids the dangerous counts 5, 10 and 21, then 5 and 21.
 */
export function classicQuietPlay(hand: readonly CardId[], count: number): number {
  if (hand.length <= 1) return 0;
  if (count < 4) {
    const toFour = cardReaching(hand, count, 4);
    if (toFour >= 0) return toFour;
    const toThree = cardReaching(hand, count, 3);
    if (toThree >= 0 && count === 0) return toThree;
  }
  if (count > 0 && count < 20) {
    for (let answer = 1; answer <= 10; answer++) {
      const index = cardReaching(hand, count, 21 - answer);
      if (index < 0) continue;
      const held = cardsWorth(hand, answer);
      if (held > 1 || (held === 1 && valueOf(hand[index]!) !== answer)) return index;
    }
  }
  if (count < 15) {
    for (const target of SETUP_COUNTS) {
      const index = cardReaching(hand, count, target);
      if (index < 0) continue;
      const held = cardsWorth(hand, 15 - target);
      if (held > 1 || (held === 1 && valueOf(hand[index]!) !== 15 - target)) return index;
    }
  }
  for (let i = hand.length - 1; i >= 0; i--) {
    const next = count + valueOf(hand[i]!);
    if (next <= PLAY_LIMIT && next !== 5 && next !== 10 && next !== 21) return i;
  }
  let fallback = -1;
  for (let i = hand.length - 1; i >= 0; i--) {
    const next = count + valueOf(hand[i]!);
    if (next > PLAY_LIMIT) continue;
    if (fallback < 0) fallback = i;
    if (next !== 5 && next !== 21) return i;
  }
  return fallback;
}

/**
 * The play (from `peg`): take the card that scores most right now, the earliest on a tie;
 * when nothing scores, fall back on the quiet play. `hand` is its remaining cards and `pile`
 * the cards since the count was last reset.
 */
export function classicPlay(hand: readonly CardId[], pile: readonly CardId[]): CardId {
  const sorted = sortLikeOriginal(hand);
  const count = pile.reduce((sum, card) => sum + valueOf(card), 0);
  let best = -1;
  let bestPoints = 0;
  sorted.forEach((card, index) => {
    if (!canPlay(card, count)) return;
    const points = pegPoints(pile, card);
    if (points > bestPoints) {
      bestPoints = points;
      best = index;
    }
  });
  if (best < 0) best = classicQuietPlay(sorted, count);
  return sorted[best]!;
}
