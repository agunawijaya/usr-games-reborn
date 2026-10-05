import animals from './data/animals.json';
import computing from './data/computing.json';
import core from './data/core.json';
import food from './data/food.json';
import music from './data/music.json';
import ocean from './data/ocean.json';
import space from './data/space.json';
import sports from './data/sports.json';
import weather from './data/weather.json';

/**
 * The word decks, all written for this game. Each is a plain JSON file in `data/`: an id, a
 * title, a line about it and its words. Computing history also carries a one-line note for
 * every word, shown after the round. `decks.test.ts` validates every file at build time.
 */
export interface Deck {
  id: string;
  title: string;
  blurb: string;
  words: string[];
  notes?: Record<string, string>;
}

export const CORE_DECK = core as Deck;

export const THEMED_DECKS: readonly Deck[] = [
  ocean,
  space,
  food,
  animals,
  music,
  weather,
  sports,
  computing,
] as Deck[];

export const ALL_DECKS: readonly Deck[] = [CORE_DECK, ...THEMED_DECKS];

export const WORD_MIN_LENGTH = 4;
export const WORD_MAX_LENGTH = 12;

export function deckById(id: string): Deck {
  const deck = ALL_DECKS.find((candidate) => candidate.id === id);
  if (!deck) throw new Error(`no deck called ${id}`);
  return deck;
}

/** The deck a word came from, for the explorer's tally; core counts only when nothing else does. */
export function themedDeckOf(word: string): Deck | null {
  return THEMED_DECKS.find((deck) => deck.words.includes(word)) ?? null;
}

export function noteFor(deck: Deck, word: string): string | null {
  return deck.notes?.[word] ?? null;
}
