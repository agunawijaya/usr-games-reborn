import { type CardId, rankOf } from '@usr-games/kit/cards';
import { valueOf } from './cards';

/**
 * Points made during the play to 31. Each card laid can make a fifteen or thirty-one (2), pair
 * the card before it (2, or 6 and 12 for three and four of a rank in a row) and finish a run
 * with the cards just before it, in any order (1 per card). Only the cards since the count last
 * went back to zero take part.
 */

export const PLAY_LIMIT = 31;

export type PegKind = 'fifteen' | 'thirty-one' | 'pair' | 'run';

export interface PegCombo {
  kind: PegKind;
  points: number;
  /** The cards that make it, the new card last. */
  cards: CardId[];
}

export interface PegResult {
  count: number;
  combos: PegCombo[];
  points: number;
}

export function countOf(pile: readonly CardId[]): number {
  return pile.reduce((sum, card) => sum + valueOf(card), 0);
}

export function canPlay(card: CardId, count: number): boolean {
  return count + valueOf(card) <= PLAY_LIMIT;
}

/** How many cards of the same rank sit at the end of the pile, the new card included. */
function sameRankTail(pile: readonly CardId[], card: CardId): number {
  let length = 1;
  for (let i = pile.length - 1; i >= 0 && rankOf(pile[i]!) === rankOf(card); i--) length++;
  return length;
}

/**
 * The longest stretch at the end of the pile, the new card included, whose ranks are all
 * different and close up into a sequence. Shorter runs inside it score nothing extra.
 */
function runTail(pile: readonly CardId[], card: CardId): number {
  const ranks = [...pile.map(rankOf), rankOf(card)];
  let best = 0;
  for (let length = 3; length <= ranks.length; length++) {
    const tail = ranks.slice(ranks.length - length);
    if (new Set(tail).size !== length) break;
    if (Math.max(...tail) - Math.min(...tail) === length - 1) best = length;
  }
  return best;
}

/**
 * Scores `card` laid on `pile` (the cards since the last reset). The play must be legal: the
 * caller checks `canPlay` first.
 */
export function pegScore(pile: readonly CardId[], card: CardId): PegResult {
  const count = countOf(pile) + valueOf(card);
  const combos: PegCombo[] = [];
  if (count === 15) combos.push({ kind: 'fifteen', points: 2, cards: [...pile, card] });
  if (count === PLAY_LIMIT) combos.push({ kind: 'thirty-one', points: 2, cards: [...pile, card] });
  const pairLength = sameRankTail(pile, card);
  if (pairLength >= 2) {
    combos.push({
      kind: 'pair',
      points: pairLength * (pairLength - 1),
      cards: [...pile.slice(pile.length - pairLength + 1), card],
    });
  } else {
    const runLength = runTail(pile, card);
    if (runLength >= 3) {
      combos.push({
        kind: 'run',
        points: runLength,
        cards: [...pile.slice(pile.length - runLength + 1), card],
      });
    }
  }
  return { count, combos, points: combos.reduce((sum, combo) => sum + combo.points, 0) };
}

/** Just the points, for the computer players' searches. */
export function pegPoints(pile: readonly CardId[], card: CardId): number {
  return pegScore(pile, card).points;
}
