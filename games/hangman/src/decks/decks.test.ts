import { describe, expect, it } from 'vitest';
import { isPlainWord } from '../engine/letters';
import { ALL_DECKS, CORE_DECK, THEMED_DECKS, WORD_MAX_LENGTH, WORD_MIN_LENGTH } from './decks';
import { isUnsuitable, unsuitableWordsIn } from './screen';

/**
 * The build-time deck validator: every deck file is checked here, so a bad word fails
 * `pnpm test` (and with it `pnpm check`) before it can reach a player.
 */
describe.each(ALL_DECKS.map((deck) => [deck.id, deck] as const))('deck %s', (_id, deck) => {
  it('has a title and a blurb', () => {
    expect(deck.title.length).toBeGreaterThan(2);
    expect(deck.blurb.length).toBeGreaterThan(10);
    expect(unsuitableWordsIn(`${deck.title} ${deck.blurb}`)).toEqual([]);
  });

  it('holds only lower-case words of 4 to 12 letters', () => {
    const misshapen = deck.words.filter(
      (word) =>
        !isPlainWord(word) || word.length < WORD_MIN_LENGTH || word.length > WORD_MAX_LENGTH,
    );
    expect(misshapen).toEqual([]);
  });

  it('never repeats a word', () => {
    const seen = new Set<string>();
    const repeats = deck.words.filter((word) => (seen.has(word) ? true : (seen.add(word), false)));
    expect(repeats).toEqual([]);
  });

  it('passes the all-ages word screen', () => {
    expect(deck.words.filter(isUnsuitable)).toEqual([]);
  });
});

describe('deck sizes', () => {
  it('the core deck has about three thousand words', () => {
    expect(CORE_DECK.words.length).toBeGreaterThanOrEqual(2800);
    expect(CORE_DECK.words.length).toBeLessThanOrEqual(3300);
  });

  it.each(THEMED_DECKS.map((deck) => [deck.id, deck.words.length] as const))(
    'themed deck %s has about 150 words',
    (_id, size) => {
      expect(size).toBeGreaterThanOrEqual(135);
      expect(size).toBeLessThanOrEqual(170);
    },
  );
});

describe('themed decks', () => {
  it('give every word one theme only', () => {
    const owner = new Map<string, string>();
    const shared: string[] = [];
    for (const deck of THEMED_DECKS) {
      for (const word of deck.words) {
        const other = owner.get(word);
        if (other) shared.push(`${word} (${other}, ${deck.id})`);
        else owner.set(word, deck.id);
      }
    }
    expect(shared).toEqual([]);
  });

  it('computing history has a short, suitable note for every word and no stray notes', () => {
    const deck = THEMED_DECKS.find((candidate) => candidate.id === 'computing')!;
    const notes = deck.notes ?? {};
    expect(deck.words.filter((word) => !notes[word])).toEqual([]);
    expect(Object.keys(notes).filter((word) => !deck.words.includes(word))).toEqual([]);
    const tooLong = Object.entries(notes).filter(([, note]) => note.length > 140);
    expect(tooLong).toEqual([]);
    const unsuitable = Object.values(notes).flatMap(unsuitableWordsIn);
    expect(unsuitable).toEqual([]);
  });

  it('only computing history carries notes', () => {
    const others = ALL_DECKS.filter((deck) => deck.id !== 'computing' && deck.notes);
    expect(others.map((deck) => deck.id)).toEqual([]);
  });
});

describe('the word screen', () => {
  it('turns away the original gallows words and passes ordinary beach words', () => {
    expect(isUnsuitable('noose')).toBe(true);
    expect(isUnsuitable('Hangman')).toBe(true);
    expect(isUnsuitable('sandcastle')).toBe(false);
    expect(isUnsuitable('change')).toBe(false);
    expect(isUnsuitable('class')).toBe(false);
  });
});
