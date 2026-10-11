import { describe, expect, it } from 'vitest';
import {
  canonicalNumeral,
  groupDigits,
  numberLines,
  sameNumeral,
  saysNumeral,
  spell,
  TILE_WORDS,
  wordTokens,
} from './words';

describe('number: the original line for line', () => {
  // The three cases in the bsd-games test suite (tests/number.*).
  it('reads -0.1 as minus, one, tenth', () => {
    expect(numberLines('-0.1')).toEqual(['minus', 'one.', 'tenth.']);
  });

  it('puts each magnitude on its own line', () => {
    expect(numberLines('123456')).toEqual([
      'one hundred twenty-three thousand.',
      'four hundred fifty-six.',
    ]);
    expect(numberLines('987654321')).toEqual([
      'nine hundred eighty-seven million.',
      'six hundred fifty-four thousand.',
      'three hundred twenty-one.',
    ]);
  });

  it('joins a whole number and a fraction with "and" on a line of its own', () => {
    expect(numberLines('1.5')).toEqual(['one.', 'and', 'five.', 'tenths.']);
  });

  it('refuses what the original refuses', () => {
    expect(numberLines('1,000')).toBeNull();
    expect(numberLines('1e5')).toBeNull();
    expect(numberLines('1.2.3')).toBeNull();
    expect(numberLines('9'.repeat(66))).toBeNull();
  });

  it('keeps its odd corners: a lone minus is minus zero', () => {
    expect(numberLines('-')).toEqual(['minus', 'zero.']);
    expect(numberLines('0')).toEqual(['zero.']);
    expect(numberLines('5.000')).toEqual(['five.']);
  });
});

describe('spell', () => {
  it.each([
    [4215, 'four thousand two hundred fifteen'],
    [21, 'twenty-one'],
    [100, 'one hundred'],
    [1001, 'one thousand one'],
    [1_000_000, 'one million'],
    [
      999_999_999,
      'nine hundred ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine',
    ],
  ])('%i is "%s"', (value, words) => {
    expect(spell(value)).toBe(words);
  });

  it.each([
    ['0.1', 'one tenth'],
    ['0.01', 'one hundredth'],
    ['3.25', 'three and twenty-five hundredths'],
    ['0.1001', 'one thousand one ten-thousandths'],
    ['12.007', 'twelve and seven thousandths'],
    ['0.000001', 'one millionth'],
  ])('reads the fraction %s as "%s"', (numeral, words) => {
    expect(spell(numeral)).toBe(words);
  });

  it('accepts answers however they are spaced, hyphenated or capitalised', () => {
    expect(saysNumeral('Four thousand two hundred fifteen', '4215')).toBe(true);
    expect(saysNumeral('twenty one', '21')).toBe(true);
    expect(saysNumeral('two hundred and fifteen', '215')).toBe(true);
    expect(saysNumeral('two hundred fifty', '215')).toBe(false);
    // In a fraction, "and" means the point, so it may not be added anywhere else.
    expect(saysNumeral('three and twenty-five hundredths', '3.25')).toBe(true);
    expect(saysNumeral('three twenty-five hundredths', '3.25')).toBe(false);
  });

  it('reads typed numerals with or without grouping', () => {
    expect(sameNumeral('4,215', '4215')).toBe(true);
    expect(sameNumeral('03.250', '3.25')).toBe(true);
    expect(sameNumeral('4216', '4215')).toBe(false);
    expect(canonicalNumeral('abc')).toBeNull();
    expect(groupDigits('987654321')).toBe('987,654,321');
    expect(groupDigits('1234.5')).toBe('1,234.5');
  });

  it('has a tile for every word a game number needs', () => {
    for (const numeral of ['987654321', '3.25', '0.001', '17', '12.5', '40', '1000000']) {
      for (const word of wordTokens(spell(numeral))) expect(TILE_WORDS).toContain(word);
    }
  });
});
