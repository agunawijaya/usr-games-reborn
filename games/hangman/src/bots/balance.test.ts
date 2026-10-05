import { describe, expect, it } from 'vitest';
import { ALL_DECKS, CORE_DECK } from '../decks/decks';
import { tierOf, type Tier } from '../engine/difficulty';
import { missesToSolve, playLetterOrder, playWellRead } from './solver';

/**
 * Locked simulation results (docs/NOTES.md, "Balance"): the computed tiers really do order
 * words by how hard the well-read model player finds them, and the decks stay winnable for a
 * player who knows the words while staying out of reach of blind letter-guessing.
 */
const vocabulary = [...new Set(ALL_DECKS.flatMap((deck) => deck.words))];
const wellRead = (word: string, allowed: number) => playWellRead(word, vocabulary, allowed);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('difficulty tiers', () => {
  const byTier: Record<Tier, number[]> = { easy: [], medium: [], hard: [] };
  for (const word of CORE_DECK.words) byTier[tierOf(word)].push(missesToSolve(wellRead, word));

  it('split the core deck into roughly equal thirds', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const share = byTier[tier].length / CORE_DECK.words.length;
      expect(share).toBeGreaterThan(0.28);
      expect(share).toBeLessThan(0.39);
    }
  });

  it('order words by how many waves the well-read player takes', () => {
    const easy = mean(byTier.easy);
    const medium = mean(byTier.medium);
    const hard = mean(byTier.hard);
    expect(medium - easy).toBeGreaterThan(0.25);
    expect(hard - medium).toBeGreaterThan(0.25);
  });
});

describe('the decks against the model players', () => {
  it('the well-read player averages 1.2 to 2.0 waves and keeps nearly every castle', () => {
    for (const deck of ALL_DECKS) {
      const misses = deck.words.map((word) => missesToSolve(wellRead, word));
      expect(mean(misses)).toBeGreaterThan(1.0);
      expect(mean(misses)).toBeLessThan(2.1);
      expect(misses.filter((m) => m >= 7).length / misses.length).toBeLessThan(0.02);
    }
  });

  it('blind letter-guessing loses most castles, so knowing words matters', () => {
    const misses = CORE_DECK.words.map((word) =>
      missesToSolve((w, a) => playLetterOrder(w, a), word),
    );
    expect(mean(misses)).toBeGreaterThan(10);
    expect(misses.filter((m) => m >= 7).length / misses.length).toBeGreaterThan(0.8);
  });
});
