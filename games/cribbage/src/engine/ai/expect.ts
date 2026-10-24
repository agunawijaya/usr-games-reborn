import { type CardId, JACK, rankOf, suitIndexOf } from '@usr-games/kit/cards';
import { scoreHand } from '../score';
import { cribAdjust } from './classic';

/**
 * What each way of laying away two cards is worth on average, counted exactly rather than
 * sampled. The hand's average runs over the 46 cards that could be cut as the starter. The
 * crib's average runs over every way the opponent's two cards and the starter can come from
 * those 46 cards (C(46,2) × 44 = 45,540 deals), treating the opponent's throw as unknown; it is
 * worked out by rank, because fifteens, pairs and runs ignore suits, with the flush and his
 * nobs added by direct counting. The tests compare it with a full enumeration.
 */

export interface DiscardOption {
  thrown: [CardId, CardId];
  kept: CardId[];
  handAverage: number;
  cribAverage: number;
  /** Hand plus your crib, or hand minus theirs. */
  value: number;
}

const UNSEEN = 46;
const CRIB_DEALS = ((UNSEEN * (UNSEEN - 1)) / 2) * (UNSEEN - 2);

const rankCounts = new Int8Array(15);
const waysToSum = new Int32Array(16);

/** Fifteens, pairs and runs of five ranks (1–13): everything in a count that ignores suits. */
export function rankPoints(a: number, b: number, c: number, d: number, e: number): number {
  rankCounts.fill(0);
  waysToSum.fill(0);
  waysToSum[0] = 1;
  for (const rank of [a, b, c, d, e]) {
    rankCounts[rank]!++;
    const value = rank > 10 ? 10 : rank;
    for (let sum = 15; sum >= value; sum--) waysToSum[sum]! += waysToSum[sum - value]!;
  }
  let points = 2 * waysToSum[15]!;
  let runLength = 0;
  let runWays = 1;
  for (let rank = 1; rank <= 14; rank++) {
    const count = rankCounts[rank]!;
    points += count * (count - 1);
    if (count > 0) {
      runLength++;
      runWays *= count;
    } else {
      if (runLength >= 3) points += runLength * runWays;
      runLength = 0;
      runWays = 1;
    }
  }
  return points;
}

export function unseenAfter(seen: readonly CardId[]): CardId[] {
  const unseen: CardId[] = [];
  for (let card = 0; card < 52; card++) if (!seen.includes(card)) unseen.push(card);
  return unseen;
}

export function handAverage(kept: readonly CardId[], unseen: readonly CardId[]): number {
  let total = 0;
  for (const starter of unseen) total += scoreHand(kept, starter, false);
  return total / unseen.length;
}

/**
 * The average crib score when you lay away `thrown` while holding `hand` (all six cards), the
 * other two crib cards and the starter coming from the 46 cards you cannot see.
 */
export function cribAverage(thrown: readonly [CardId, CardId], hand: readonly CardId[]): number {
  const rankLeft = new Array<number>(14).fill(4);
  const suitLeft = [13, 13, 13, 13];
  for (const card of hand) {
    rankLeft[rankOf(card)]!--;
    suitLeft[suitIndexOf(card)]!--;
  }
  const [first, second] = thrown;
  const r1 = rankOf(first);
  const r2 = rankOf(second);

  let rankTotal = 0;
  for (let x = 1; x <= 13; x++) {
    for (let y = x; y <= 13; y++) {
      const pairWays =
        x === y ? (rankLeft[x]! * (rankLeft[x]! - 1)) / 2 : rankLeft[x]! * rankLeft[y]!;
      if (pairWays === 0) continue;
      for (let s = 1; s <= 13; s++) {
        const starterWays = rankLeft[s]! - (s === x ? 1 : 0) - (s === y ? 1 : 0);
        if (starterWays <= 0) continue;
        rankTotal += pairWays * starterWays * rankPoints(r1, r2, x, y, s);
      }
    }
  }

  // His nobs: a jack in the crib whose suit the starter shares. The starter is any one of the
  // 46 unseen cards with equal chance; an unseen jack must also land among the two crib cards.
  let nobs = 0;
  for (const card of thrown) {
    if (rankOf(card) === JACK) nobs += suitLeft[suitIndexOf(card)]! / UNSEEN;
  }
  for (let suit = 0; suit < 4; suit++) {
    const jack = suit * 13 + JACK - 1;
    if (!hand.includes(jack)) nobs += (2 * (suitLeft[suit]! - 1)) / (UNSEEN * (UNSEEN - 1));
  }

  // A crib flush needs all five of one suit, so only a suited throw can make one.
  let flush = 0;
  if (suitIndexOf(first) === suitIndexOf(second)) {
    const left = suitLeft[suitIndexOf(first)]!;
    flush = (5 * ((left * (left - 1)) / 2) * (left - 2)) / CRIB_DEALS;
  }
  return rankTotal / CRIB_DEALS + nobs + flush;
}

/** Every way to lay away two of six cards, best first (enumeration order breaks ties). */
export function rankDiscards(hand: readonly CardId[], ownCrib: boolean): DiscardOption[] {
  const unseen = unseenAfter(hand);
  const options: DiscardOption[] = [];
  for (let i = 0; i < hand.length - 1; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const thrown: [CardId, CardId] = [hand[i]!, hand[j]!];
      const kept = hand.filter((_, index) => index !== i && index !== j);
      const handValue = handAverage(kept, unseen);
      const cribValue = cribAverage(thrown, hand);
      options.push({
        thrown,
        kept,
        handAverage: handValue,
        cribAverage: cribValue,
        value: handValue + (ownCrib ? cribValue : -cribValue),
      });
    }
  }
  return options
    .map((option, order) => ({ option, order }))
    .sort((a, b) => b.option.value - a.option.value || a.order - b.order)
    .map(({ option }) => option);
}

/**
 * A quick, sensible discard for imagining what an opponent kept: the kept four's average by
 * starter rank (suits ignored) plus or minus the crib table's rounded value. Far cheaper than
 * the exact reckoning and close enough to tell which cards a real player holds on to.
 */
export function quickDiscard(hand: readonly CardId[], ownCrib: boolean): [CardId, CardId] {
  const left = new Array<number>(14).fill(4);
  for (const card of hand) left[rankOf(card)]!--;
  let best: [CardId, CardId] = [hand[0]!, hand[1]!];
  let bestValue = -Infinity;
  for (let i = 0; i < hand.length - 1; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const kept = hand.filter((_, index) => index !== i && index !== j).map(rankOf);
      let total = 0;
      for (let s = 1; s <= 13; s++) {
        if (left[s]! > 0) total += left[s]! * rankPoints(kept[0]!, kept[1]!, kept[2]!, kept[3]!, s);
      }
      const crib = cribAdjust(hand[i]!, hand[j]!);
      const value = total / 46 + (ownCrib ? crib : -crib);
      if (value > bestValue) {
        bestValue = value;
        best = [hand[i]!, hand[j]!];
      }
    }
  }
  return best;
}
