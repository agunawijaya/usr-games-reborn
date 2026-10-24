import { describe, expect, it } from 'vitest';
import { type CardId, parseCard } from '@usr-games/kit/cards';
import { countHand, IMPOSSIBLE_SCORES, MAX_HAND, scoreHand } from './score';

const card = (text: string): CardId => {
  const parsed = parseCard(text);
  if (parsed === null) throw new Error(`not a card: ${text}`);
  return parsed;
};
const cards = (text: string): CardId[] => text.split(' ').map(card);

/**
 * An independent counter written straight from the rules, sharing nothing with `score.ts`:
 * every subset of the five cards is looked at. Fifteens are subsets worth fifteen; pairs are
 * two-card subsets of one rank; runs are the subsets of the longest length whose ranks are all
 * different and consecutive. It allocates nothing, so it can check all thirteen million hands.
 */
const ranks = new Int32Array(5);
const values = new Int32Array(5);
const suits = new Int32Array(5);
function bruteForce(hand: readonly CardId[], starter: CardId, isCrib: boolean): number {
  for (let i = 0; i < 5; i++) {
    const c = i < 4 ? hand[i]! : starter;
    ranks[i] = (c % 13) + 1;
    values[i] = Math.min(10, ranks[i]!);
    suits[i] = Math.floor(c / 13);
  }
  let score = 0;
  const runsOfSize = [0, 0, 0, 0, 0, 0];
  for (let mask = 1; mask < 32; mask++) {
    let sum = 0;
    let size = 0;
    let low = 99;
    let high = 0;
    let seen = 0;
    let distinct = true;
    for (let i = 0; i < 5; i++) {
      if (!(mask & (1 << i))) continue;
      const r = ranks[i]!;
      sum += values[i]!;
      size++;
      if (seen & (1 << r)) distinct = false;
      seen |= 1 << r;
      low = Math.min(low, r);
      high = Math.max(high, r);
    }
    if (sum === 15) score += 2;
    if (size === 2 && !distinct) score += 2;
    if (size >= 3 && distinct && high - low === size - 1) runsOfSize[size]!++;
  }
  for (let size = 5; size >= 3; size--) {
    if (runsOfSize[size]! > 0) {
      score += size * runsOfSize[size]!;
      break;
    }
  }
  if (suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3]) {
    if (suits[4] === suits[0]) score += 5;
    else if (!isCrib) score += 4;
  }
  for (let i = 0; i < 4; i++) if (ranks[i] === 11 && suits[i] === suits[4]) score += 1;
  return score;
}

describe('known hands', () => {
  const cases: [string, string, boolean, number][] = [
    // The perfect hand: a jack and three fives with the fourth five of the jack's suit cut.
    ['5c 5d 5h js', '5s', false, 29],
    ['5c 5d 5h 5s', 'js', false, 28],
    ['5c 5d 5s js', '5h', false, 28],
    ['4h 5h 6h 4c', '6d', false, 24],
    ['3h 3c 3d 3s', '9d', false, 24],
    ['9c 6d 5h 4s', '4d', false, 14],
    ['ah 2h 3h 4h', '5h', false, 12],
    ['ah 2h 3h 4h', '5h', true, 12],
    ['2h 4h 6h 8h', 'kc', false, 4],
    ['2h 4h 6h 8h', 'kc', true, 0],
    ['2h 4h 6h 8h', 'kh', true, 5],
    ['jh 2c 4d 6s', '8h', false, 1],
    ['7c 8d 7h 8s', '9c', false, 24],
    ['kc qd jh 5s', '5c', false, 17],
    ['ac 2d 3h 4s', 'ks', false, 8],
  ];
  for (const [hand, starter, isCrib, total] of cases) {
    it(`${hand} | ${starter}${isCrib ? ' (crib)' : ''} → ${total}`, () => {
      expect(countHand(cards(hand), card(starter), isCrib).total).toBe(total);
      expect(scoreHand(cards(hand), card(starter), isCrib)).toBe(total);
    });
  }

  it('lists the 29 hand the way it is counted aloud', () => {
    const count = countHand(cards('5c 5d 5h js'), card('5s'));
    const tally = (kind: string) =>
      count.combos.filter((c) => c.kind === kind).reduce((s, c) => s + c.points, 0);
    expect(count.combos.filter((c) => c.kind === 'fifteen')).toHaveLength(8);
    expect(tally('fifteen')).toBe(16);
    expect(tally('pair')).toBe(12);
    expect(tally('run')).toBe(0);
    expect(tally('nobs')).toBe(1);
  });

  it('lists a double run as two runs and a pair', () => {
    const count = countHand(cards('3c 3d 4h 5s'), card('kd'));
    expect(count.combos.map((c) => `${c.kind}:${c.points}`)).toEqual([
      'fifteen:2',
      'fifteen:2',
      'run:3',
      'run:3',
      'pair:2',
    ]);
    expect(count.total).toBe(12);
  });
});

describe('every hand and starter (exhaustive)', () => {
  it('matches the brute-force counter and the published score distribution', () => {
    // Out of C(52,4) × 48 = 12,994,800 hands with a starter, the long-known counts per score.
    const published: Record<number, number> = {
      0: 1009008,
      1: 99792,
      2: 2813796,
      3: 505008,
      4: 2855676,
      5: 697508,
      6: 1800268,
      7: 751324,
      8: 1137236,
      9: 361224,
      10: 388740,
      11: 51680,
      12: 317340,
      13: 19656,
      14: 90100,
      15: 9168,
      16: 58248,
      17: 11196,
      18: 2708,
      20: 8068,
      21: 2496,
      22: 444,
      23: 356,
      24: 3680,
      28: 76,
      29: 4,
    };
    const tally = new Map<number, number>();
    let mismatches = 0;
    let checked = 0;
    const hand: CardId[] = [0, 0, 0, 0];
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++) {
            hand[0] = a;
            hand[1] = b;
            hand[2] = c;
            hand[3] = d;
            for (let s = 0; s < 52; s++) {
              if (s === a || s === b || s === c || s === d) continue;
              const fast = scoreHand(hand, s, false);
              tally.set(fast, (tally.get(fast) ?? 0) + 1);
              checked++;
              if (fast !== bruteForce(hand, s, false)) mismatches++;
              if (scoreHand(hand, s, true) !== bruteForce(hand, s, true)) mismatches++;
            }
          }
    expect(mismatches).toBe(0);
    expect(checked).toBe(12_994_800);
    expect([...tally.values()].reduce((s, n) => s + n, 0)).toBe(12_994_800);
    for (const score of IMPOSSIBLE_SCORES) expect(tally.get(score) ?? 0).toBe(0);
    expect(Math.max(...tally.keys())).toBe(MAX_HAND);
    expect(Object.fromEntries(tally)).toEqual(published);
  });

  it('agrees with the itemised count on a broad sample', () => {
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let i = 0; i < 40_000; i++) {
      const pool = new Set<number>();
      while (pool.size < 5) pool.add(next() % 52);
      const [s, ...hand] = [...pool] as [number, ...number[]];
      const isCrib = i % 2 === 0;
      const counted = countHand(hand, s, isCrib);
      expect(counted.total).toBe(scoreHand(hand, s, isCrib));
      expect(counted.total).toBe(bruteForce(hand, s, isCrib));
    }
  });
});
