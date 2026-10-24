import { describe, expect, it } from 'vitest';
import { createRng } from '@usr-games/kit';
import { type CardId, parseCard, rankOf, shuffledDeck } from '@usr-games/kit/cards';
import { pegScore } from '../peg';
import { scoreHand } from '../score';
import { computeCribSums } from './crib-odds';
import { CRIB_SUMS } from './crib-sums';
import { cribAverage, rankDiscards, unseenAfter } from './expect';
import { playPoints } from './lookahead';

const cs = (text: string): CardId[] => text.split(' ').map((word) => parseCard(word)!);

/** The crib's average the slow way: all 45,540 deals of two crib cards and a starter. */
function bruteCribAverage(thrown: [CardId, CardId], hand: readonly CardId[]): number {
  const unseen = unseenAfter(hand);
  let total = 0;
  let deals = 0;
  for (let i = 0; i < unseen.length; i++)
    for (let j = i + 1; j < unseen.length; j++)
      for (let k = 0; k < unseen.length; k++) {
        if (k === i || k === j) continue;
        total += scoreHand([thrown[0], thrown[1], unseen[i]!, unseen[j]!], unseen[k]!, true);
        deals++;
      }
  expect(deals).toBe(45_540);
  return total / deals;
}

describe("Sharp's averages", () => {
  it('counts the crib exactly, flush and nobs included', () => {
    const hands = [
      '5h 5s jh qh 2h 9c',
      'jc js 4c 6c 8c kd',
      'ah 2h 3h 4h 5h 6h',
      '10d jd qd kd 9d 8d',
    ];
    for (const text of hands) {
      const hand = cs(text);
      for (const [a, b] of [
        [0, 1],
        [2, 3],
        [1, 4],
      ] as const) {
        const thrown: [CardId, CardId] = [hand[a]!, hand[b]!];
        expect(cribAverage(thrown, hand)).toBeCloseTo(bruteCribAverage(thrown, hand), 9);
      }
    }
  });

  it('picks the throw a full enumeration rates best', () => {
    const rng = createRng('sharp-discards');
    for (let n = 0; n < 6; n++) {
      const hand = shuffledDeck(rng).slice(0, 6);
      const ownCrib = n % 2 === 0;
      const unseen = unseenAfter(hand);
      let best = -Infinity;
      for (let i = 0; i < 5; i++)
        for (let j = i + 1; j < 6; j++) {
          const kept = hand.filter((_, x) => x !== i && x !== j);
          const handValue = unseen.reduce((sum, s) => sum + scoreHand(kept, s), 0) / unseen.length;
          const crib = bruteCribAverage([hand[i]!, hand[j]!], hand);
          best = Math.max(best, handValue + (ownCrib ? crib : -crib));
        }
      expect(rankDiscards(hand, ownCrib)[0]!.value).toBeCloseTo(best, 9);
    }
  });
});

describe('the crib table', () => {
  it('matches a fresh count of every pair of ranks', () => {
    const fresh = computeCribSums();
    expect(fresh.suited).toEqual(CRIB_SUMS.suited);
    expect(fresh.offsuit).toEqual(CRIB_SUMS.offsuit);
  });
});

describe("Sharp's quick pegging count", () => {
  it('agrees with the full pegging scorer', () => {
    const rng = createRng('peg-points');
    for (let n = 0; n < 20_000; n++) {
      const deck = shuffledDeck(rng);
      const pile: CardId[] = [];
      let count = 0;
      // Mostly close ranks, so pairs and runs turn up often.
      const near = rng.chance(0.75);
      const base = rng.int(1, 10);
      const fits = (x: CardId) => !near || (rankOf(x) >= base && rankOf(x) <= base + 3);
      const size = rng.int(0, 7);
      for (const card of deck) {
        if (pile.length >= size) break;
        if (!fits(card)) continue;
        const value = Math.min(10, rankOf(card));
        if (count + value > 31) continue;
        pile.push(card);
        count += value;
      }
      const card = deck.find(
        (x) => !pile.includes(x) && fits(x) && count + Math.min(10, rankOf(x)) <= 31,
      );
      if (card === undefined) continue;
      const ranks = pile.map((x) => rankOf(x) as number);
      expect(
        playPoints(ranks, ranks.length, rankOf(card), count + Math.min(10, rankOf(card))),
      ).toBe(pegScore(pile, card).points);
    }
  });
});
