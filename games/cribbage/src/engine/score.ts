import { type CardId, JACK, rankOf, suitIndexOf } from '@usr-games/kit/cards';
import { byRank, combinations, valueOf } from './cards';

/**
 * Counting a hand at the show: four cards plus the starter (the crib likewise), scored for
 * fifteens, runs, pairs, a flush and his nobs. Two versions live here. `countHand` lists every
 * scoring combination with its cards, in the order a player says them aloud, because the table
 * lights them up one at a time; `scoreHand` returns only the total, allocates nothing and is
 * what the computer players call hundreds of thousands of times while they weigh a discard.
 * The tests hold both against an independent brute-force counter over every possible hand.
 */

export type ShowKind = 'fifteen' | 'run' | 'pair' | 'flush' | 'nobs';

export interface ShowCombo {
  kind: ShowKind;
  /** The cards that make it, lowest rank first. */
  cards: CardId[];
  points: number;
}

export interface HandCount {
  hand: CardId[];
  starter: CardId;
  isCrib: boolean;
  /** Fifteens, then runs, then pairs, then the flush and his nobs: the customary order. */
  combos: ShowCombo[];
  total: number;
}

/** The pair names the table uses: two of a kind, three (pair royal) and four (double). */
export function pairName(cards: number): string {
  if (cards >= 4) return 'Double pair royal';
  if (cards === 3) return 'Pair royal';
  return 'Pair';
}

function fifteens(cards: readonly CardId[]): ShowCombo[] {
  const found: ShowCombo[] = [];
  for (let size = 2; size <= cards.length; size++) {
    for (const group of combinations(cards, size)) {
      if (group.reduce((sum, card) => sum + valueOf(card), 0) === 15) {
        found.push({ kind: 'fifteen', cards: group, points: 2 });
      }
    }
  }
  return found;
}

/**
 * Runs count only at their longest: with 3-4-5-6 on the table the 3-4-5 inside it scores
 * nothing extra. A duplicated rank doubles the run, so 3-4-4-5 holds two runs of three, each
 * listed with its own four.
 */
function runs(cards: readonly CardId[]): ShowCombo[] {
  const byRankGroup = new Map<number, CardId[]>();
  for (const card of cards) {
    const group = byRankGroup.get(rankOf(card)) ?? [];
    group.push(card);
    byRankGroup.set(rankOf(card), group);
  }
  const found: ShowCombo[] = [];
  let rank = 1;
  while (rank <= 13) {
    if (!byRankGroup.has(rank)) {
      rank++;
      continue;
    }
    const start = rank;
    while (byRankGroup.has(rank + 1)) rank++;
    const length = rank - start + 1;
    if (length >= 3) {
      let instances: CardId[][] = [[]];
      for (let r = start; r <= rank; r++) {
        const group = byRankGroup.get(r)!;
        instances = instances.flatMap((partial) => group.map((card) => [...partial, card]));
      }
      for (const run of instances) found.push({ kind: 'run', cards: run, points: length });
    }
    rank++;
  }
  return found;
}

function pairs(cards: readonly CardId[]): ShowCombo[] {
  const found: ShowCombo[] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const group = cards.filter((card) => rankOf(card) === rank);
    if (group.length >= 2) {
      found.push({ kind: 'pair', cards: group, points: group.length * (group.length - 1) });
    }
  }
  return found;
}

/**
 * Four of a suit in the hand score 4, and 5 when the starter matches; the crib scores a flush
 * only when all five share the suit.
 */
function flush(hand: readonly CardId[], starter: CardId, isCrib: boolean): ShowCombo[] {
  if (hand.length < 4) return [];
  const suit = suitIndexOf(hand[0]!);
  if (!hand.every((card) => suitIndexOf(card) === suit)) return [];
  if (suitIndexOf(starter) === suit) {
    return [{ kind: 'flush', cards: [...hand, starter].sort(byRank), points: 5 }];
  }
  return isCrib ? [] : [{ kind: 'flush', cards: [...hand].sort(byRank), points: 4 }];
}

function nobs(hand: readonly CardId[], starter: CardId): ShowCombo[] {
  const jack = hand.find(
    (card) => rankOf(card) === JACK && suitIndexOf(card) === suitIndexOf(starter),
  );
  return jack === undefined ? [] : [{ kind: 'nobs', cards: [jack], points: 1 }];
}

export function countHand(hand: readonly CardId[], starter: CardId, isCrib = false): HandCount {
  const five = [...hand, starter].sort(byRank);
  const combos = [
    ...fifteens(five),
    ...runs(five),
    ...pairs(five),
    ...flush(hand, starter, isCrib),
    ...nobs(hand, starter),
  ];
  return {
    hand: [...hand],
    starter,
    isCrib,
    combos,
    total: combos.reduce((sum, combo) => sum + combo.points, 0),
  };
}

const rankCounts = new Int8Array(15);
const waysToSum = new Int32Array(16);

/** The total of `countHand` without building anything: the computer players' inner loop. */
export function scoreHand(hand: readonly CardId[], starter: CardId, isCrib = false): number {
  rankCounts.fill(0);
  waysToSum.fill(0);
  waysToSum[0] = 1;
  const starterSuit = suitIndexOf(starter);
  const firstSuit = hand.length > 0 ? suitIndexOf(hand[0]!) : -1;
  let flushSuit = hand.length >= 4;
  let score = 0;
  for (let i = 0; i <= hand.length; i++) {
    const card = i < hand.length ? hand[i]! : starter;
    const rank = (card % 13) + 1;
    rankCounts[rank]!++;
    const value = rank > 10 ? 10 : rank;
    for (let sum = 15; sum >= value; sum--) waysToSum[sum]! += waysToSum[sum - value]!;
    if (i < hand.length) {
      const suit = Math.floor(card / 13);
      if (suit !== firstSuit) flushSuit = false;
      if (rank === JACK && suit === starterSuit) score += 1;
    }
  }
  score += 2 * waysToSum[15]!;
  let runLength = 0;
  let runWays = 1;
  for (let rank = 1; rank <= 14; rank++) {
    const count = rankCounts[rank]!;
    score += count * (count - 1);
    if (count > 0) {
      runLength++;
      runWays *= count;
    } else {
      if (runLength >= 3) score += runLength * runWays;
      runLength = 0;
      runWays = 1;
    }
  }
  if (flushSuit) {
    if (firstSuit === starterSuit) score += 5;
    else if (!isCrib) score += 4;
  }
  return score;
}

/**
 * The scores no hand can make. Old players say "nineteen" for a hand worth nothing, because a
 * nineteen cannot be counted.
 */
export const IMPOSSIBLE_SCORES: readonly number[] = [19, 25, 26, 27];
export const MAX_HAND = 29;
