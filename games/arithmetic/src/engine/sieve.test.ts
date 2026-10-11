import { describe, expect, it } from 'vitest';
import { isPrime } from './factor';
import { choose, compositesLeft, newBoard, parChoices, survivors } from './sieve-board';
import { primesBetween, primesUpTo, wheelPattern } from './sieve';

describe('the sieve (primes.c with its pattern table)', () => {
  it('builds the 3-to-13 pattern the original ships as a table', () => {
    const pattern = wheelPattern();
    expect(pattern.length).toBe(15_015);
    expect(pattern.reduce((sum, entry) => sum + entry, 0)).toBe(5760);
    // 1, 17 and 19 survive; 3, 5, 7, 9, 11, 13 and 15 are crossed out.
    expect([...pattern.slice(0, 10)]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
  });

  it('lists the primes below 100', () => {
    expect(primesBetween(0, 100)).toEqual(primesUpTo(99));
    expect(primesBetween(0, 100)).toHaveLength(25);
  });

  // Counts from the bsd-games test suite (tests/primes.1e6 and primes.1e9).
  it('finds the primes in [10^6, 10^6 + 300) and [10^9, 10^9 + 300)', () => {
    expect(primesBetween(1_000_000, 1_000_300)).toHaveLength(24);
    expect(primesBetween(1_000_000, 1_000_300)[0]).toBe(1_000_003);
    expect(primesBetween(1_000_000_000, 1_000_000_300)).toHaveLength(16);
    expect(primesBetween(1_000_000_000, 1_000_000_300).every(isPrime)).toBe(true);
  });

  it("passes the original's own check: 664 579 primes below 10^7", () => {
    expect(primesBetween(0, 10_000_000)).toHaveLength(664_579);
  });

  it('stops short of stop and reaches the top of 32 bits', () => {
    expect(primesBetween(17, 17)).toEqual([]);
    expect(primesBetween(13, 18)).toEqual([13, 17]);
    expect(primesBetween(4_294_967_200, 4_294_967_296)).toEqual([
      4_294_967_231, 4_294_967_279, 4_294_967_291,
    ]);
  });
});

describe('the Sieve board', () => {
  const hundred = { first: 1, last: 100, columns: 10 };

  it('starts with 1 off the board and needs 2, 3, 5 and 7', () => {
    const board = newBoard(hundred);
    expect(board.gone[0]).toBe('one');
    expect(parChoices(hundred)).toEqual([2, 3, 5, 7]);
    expect(compositesLeft(board)).toBe(74);
  });

  it('sweeps every multiple of a chosen prime and keeps the prime', () => {
    const { board, move } = choose(newBoard(hundred), 7);
    expect(move).toMatchObject({ kind: 'sweep', prime: 7 });
    if (move.kind !== 'sweep') throw new Error();
    expect(move.swept[0]).toBe(14);
    expect(move.swept).toContain(49);
    expect(board.gone[6]).toBeNull();
  });

  it('clears after par choices, leaving the 25 primes', () => {
    let board = newBoard(hundred);
    for (const p of [2, 3, 5, 7]) board = choose(board, p).board;
    expect(board.clear).toBe(true);
    expect(board.clicks).toBe(4);
    expect(survivors(board)).toHaveLength(25);
  });

  it('bounces a composite and counts it as a wrong choice', () => {
    const { board, move } = choose(newBoard(hundred), 9);
    expect(move).toEqual({ kind: 'not-prime', value: 9 });
    expect(board.wrongClicks).toBe(1);
  });

  it('ignores numbers already swept away', () => {
    const swept = choose(newBoard(hundred), 2).board;
    expect(choose(swept, 4).move).toEqual({ kind: 'ignored' });
    expect(choose(swept, 2).move).toEqual({ kind: 'ignored' });
  });

  it('offers a strip of sieving primes for a range that starts high', () => {
    const board = newBoard({ first: 1000, last: 1199, columns: 20 });
    expect(board.strip).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);
    let played = board;
    for (const p of parChoices(board.setup)) played = choose(played, p).board;
    expect(played.clear).toBe(true);
    expect(survivors(played)).toEqual(primesBetween(1000, 1200));
  });
});
