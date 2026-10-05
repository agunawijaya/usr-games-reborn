import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { originalPickerOdds, passesOriginalRule, pickFair, pickLikeTheOriginal } from './pickers';

/**
 * Classic's test harness: the original picker reproduced and measured. It is never used in
 * play; these tests pin down the bias the notes describe.
 */
const FILE = [
  'aardvark', // first line: can never be chosen
  'beach',
  'castles',
  'extraordinarily',
  'dunes',
  'Harbour', // has a capital: never chosen
  'seagulls',
  'lighthouse',
  '',
].join('\n');

function sample(pick: () => string, draws: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < draws; i++) {
    const word = pick();
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

describe('the original word rule', () => {
  it('takes only lower-case words of at least six letters by default', () => {
    expect(passesOriginalRule('castles', 6)).toBe(true);
    expect(passesOriginalRule('beach', 6)).toBe(false);
    expect(passesOriginalRule('Harbour', 6)).toBe(false);
    expect(passesOriginalRule("seagull's", 6)).toBe(false);
  });
});

describe('the original picker', () => {
  const odds = originalPickerOdds(FILE, 6);
  const rng = createRng('classic-harness');

  it('can never choose the first word of the file', () => {
    expect(odds.has('aardvark')).toBe(false);
    const counts = sample(() => pickLikeTheOriginal(FILE, rng, 6), 20_000);
    expect(counts.has('aardvark')).toBe(false);
  });

  it('never chooses a word with a capital or shorter than the minimum', () => {
    expect([...odds.keys()].sort()).toEqual(
      ['castles', 'extraordinarily', 'lighthouse', 'seagulls'].sort(),
    );
  });

  it('favours a word that follows a long line', () => {
    // A word's weight is the length of the line before it, plus its newline:
    // "extraordinarily" follows "castles" (7 + 1), "castles" follows "beach" (5 + 1),
    // "lighthouse" follows "seagulls" (8 + 1), "seagulls" follows "Harbour" (7 + 1).
    expect(odds.get('extraordinarily')! / odds.get('castles')!).toBeCloseTo(8 / 6, 5);
    expect(odds.get('lighthouse')! / odds.get('seagulls')!).toBeCloseTo(9 / 8, 5);
  });

  it('matches the exact odds when sampled', () => {
    const draws = 60_000;
    const counts = sample(() => pickLikeTheOriginal(FILE, rng, 6), draws);
    for (const [word, chance] of odds) {
      expect(Math.abs(counts.get(word)! / draws - chance)).toBeLessThan(0.01);
    }
  });

  it('eats the last letter of a final line that has no newline', () => {
    const file = 'shells\nlantern\nseaweeds';
    const odds = originalPickerOdds(file, 6);
    expect(odds.has('seaweed')).toBe(true);
    expect(odds.has('seaweeds')).toBe(false);
    const picks = sample(() => pickLikeTheOriginal(file, rng, 7), 2_000);
    expect([...picks.keys()].sort()).toEqual(['lantern', 'seaweed']);
  });

  it('is measurably unfair on a longer list, where the fair picker is not', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const words = Array.from(
      { length: 50 },
      (_, i) => `${letters[i % 26]}${letters[Math.floor(i / 26)]}${'s'.repeat(4 + (i % 9))}`,
    );
    const file = `${words.join('\n')}\n`;
    const exact = [...originalPickerOdds(file, 6).values()];
    expect(Math.max(...exact) / Math.min(...exact)).toBeGreaterThan(1.8);

    const draws = 50_000;
    const fair = [...sample(() => pickFair(words, rng), draws).values()];
    expect(fair).toHaveLength(words.length);
    expect(Math.max(...fair) / Math.min(...fair)).toBeLessThan(1.3);
  });
});
