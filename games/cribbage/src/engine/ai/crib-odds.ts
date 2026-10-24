import { type CardId, cardId, type Rank, SUITS } from '@usr-games/kit/cards';
import { scoreHand } from '../score';

/**
 * What two cards are worth in a crib, on average. For every pair of ranks, suited and offsuit,
 * add up the crib score of all C(50,2) × 48 = 58,800 ways the other two crib cards and the
 * starter can fall. Earl Cohen's computer looked these sums up from a table printed in its
 * source; we work them out from the rules with our own counter instead (the generator script
 * writes `crib-sums.ts`, and a test recomputes entries to prove the file). Side by side with the
 * original table, every offsuit sum agrees exactly and every suited sum there is 8,580 higher:
 * the original also counted four-card flushes in the crib (see NOTES.md and `classic.ts`).
 */

export const CRIB_DEALS = 58_800;

/** Every crib two given cards can grow into, summed: the slow way, for the generator and tests. */
export function sumCribScores(first: CardId, second: CardId): number {
  const rest: CardId[] = [];
  for (let card = 0; card < 52; card++) if (card !== first && card !== second) rest.push(card);
  const crib: CardId[] = [first, second, 0, 0];
  let total = 0;
  for (let i = 0; i < rest.length; i++) {
    crib[2] = rest[i]!;
    for (let j = i + 1; j < rest.length; j++) {
      crib[3] = rest[j]!;
      for (let k = 0; k < rest.length; k++) {
        if (k === i || k === j) continue;
        total += scoreHand(crib, rest[k]!, true);
      }
    }
  }
  return total;
}

/** The two representative cards for a pair of ranks; suited pairs must differ in rank. */
export function representativePair(low: Rank, high: Rank, suited: boolean): [CardId, CardId] {
  return [cardId(SUITS[0], low), cardId(suited ? SUITS[0] : SUITS[1], high)];
}

/** Both tables in full, row = lower rank, column = higher rank (ranks 1–13; 0 where impossible). */
export function computeCribSums(): { suited: number[][]; offsuit: number[][] } {
  const table = (suited: boolean) =>
    Array.from({ length: 13 }, (_, row) =>
      Array.from({ length: 13 }, (_, column) => {
        const low = (row + 1) as Rank;
        const high = (column + 1) as Rank;
        if (high < low || (suited && high === low)) return 0;
        const [a, b] = representativePair(low, high, suited);
        return sumCribScores(a, b);
      }),
    );
  return { suited: table(true), offsuit: table(false) };
}
