import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import {
  factorize,
  isPrime,
  MAX_FACTORABLE,
  mulMod,
  powerText,
  primePowers,
  productText,
} from './factor';

function trialDivision(value: number): number[] {
  const factors: number[] = [];
  let n = value;
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) {
      factors.push(p);
      n /= p;
    }
  }
  if (n > 1) factors.push(n);
  return factors;
}

describe('factor', () => {
  it('splits 360 the way the Split mode reads it', () => {
    const factors = factorize(360);
    expect(productText(factors)).toBe('2 × 2 × 2 × 3 × 3 × 5');
    expect(powerText(factors)).toBe('2³ × 3² × 5');
    expect(primePowers(factors)).toEqual([
      { prime: 2, exponent: 3 },
      { prime: 3, exponent: 2 },
      { prime: 5, exponent: 1 },
    ]);
  });

  // The 32-bit cases from the bsd-games test suite (tests/factor.*), checked by hand too.
  it.each([
    [123, [3, 41]],
    [456, [2, 2, 2, 3, 19]],
    [8_675_309, [8_675_309]],
    [123_456_789, [3, 3, 3607, 3803]],
    [987_654_321, [3, 3, 17, 17, 379_721]],
  ])('factors %i like the original', (value, expected) => {
    expect(factorize(value)).toEqual(expected);
  });

  it('reaches the edge of 32 bits', () => {
    expect(factorize(MAX_FACTORABLE)).toEqual([3, 5, 17, 257, 65_537]);
    expect(factorize(4_294_967_291)).toEqual([4_294_967_291]);
    expect(factorize(2_147_483_647)).toEqual([2_147_483_647]);
    expect(factorize(65_537 * 65_521)).toEqual([65_521, 65_537]);
    expect(factorize(65_521 * 65_521)).toEqual([65_521, 65_521]);
  });

  it('agrees with trial division on a seeded sample', () => {
    const rng = createRng('factor-sample');
    for (let i = 0; i < 400; i++) {
      const value = rng.int(2, 2_147_483_647);
      expect(factorize(value)).toEqual(trialDivision(value));
    }
  });

  it('knows its primes, including the strong pseudoprimes that fool weak tests', () => {
    expect([0, 1, 2, 3, 4, 17, 91, 97].map(isPrime)).toEqual([
      false,
      false,
      true,
      true,
      false,
      true,
      false,
      true,
    ]);
    // 3 215 031 751 is a strong pseudoprime to bases 2, 3, 5 and 7.
    expect(isPrime(3_215_031_751)).toBe(false);
    expect(isPrime(2_152_302_898_747 % 4_294_967_296)).toBe(
      trialDivision(2_152_302_898_747 % 4_294_967_296).length === 1,
    );
  });

  it('multiplies modulo without losing digits', () => {
    expect(mulMod(4_294_967_290, 4_294_967_289, 4_294_967_291)).toBe(2);
  });

  it('refuses what it cannot factor', () => {
    expect(() => factorize(0)).toThrow(RangeError);
    expect(() => factorize(MAX_FACTORABLE + 1)).toThrow(RangeError);
  });
});
