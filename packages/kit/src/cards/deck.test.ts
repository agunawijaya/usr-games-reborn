import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import {
  cardId,
  cardLabel,
  cardName,
  colorOf,
  isFullDeck,
  newDeck,
  parseCard,
  rankOf,
  shuffledDeck,
  suitOf,
} from './deck';

describe('deck', () => {
  it('numbers cards by suit then rank', () => {
    expect(cardId('clubs', 1)).toBe(0);
    expect(cardId('spades', 13)).toBe(51);
    const queen = cardId('hearts', 12);
    expect(suitOf(queen)).toBe('hearts');
    expect(rankOf(queen)).toBe(12);
    expect(colorOf(queen)).toBe('red');
    expect(colorOf(cardId('clubs', 5))).toBe('black');
  });

  it('labels and names cards', () => {
    expect(cardLabel(cardId('hearts', 10))).toBe('10♥');
    expect(cardLabel(cardId('spades', 12))).toBe('Q♠');
    expect(cardName(cardId('diamonds', 1))).toBe('ace of diamonds');
  });

  it('parses short card names in several spellings', () => {
    expect(parseCard('qh')).toBe(cardId('hearts', 12));
    expect(parseCard('10S')).toBe(cardId('spades', 10));
    expect(parseCard('ts')).toBe(cardId('spades', 10));
    expect(parseCard('A♣')).toBe(cardId('clubs', 1));
    expect(parseCard('1h')).toBeNull();
    expect(parseCard('qx')).toBeNull();
  });

  it('shuffles deterministically from a seed and keeps every card', () => {
    const a = shuffledDeck(createRng('deck-test'));
    const b = shuffledDeck(createRng('deck-test'));
    expect(a).toEqual(b);
    expect(isFullDeck(a)).toBe(true);
    expect(a).not.toEqual(newDeck());
  });

  it('spreads each card evenly over positions', () => {
    const rng = createRng('fairness');
    const counts = new Array<number>(52).fill(0);
    const trials = 5200;
    for (let i = 0; i < trials; i++) counts[shuffledDeck(rng).indexOf(0)]!++;
    // Each position expects 100; a fair shuffle stays well inside these bounds.
    expect(Math.min(...counts)).toBeGreaterThan(60);
    expect(Math.max(...counts)).toBeLessThan(145);
  });
});
