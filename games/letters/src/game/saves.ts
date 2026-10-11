import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { GridSize, Rule } from '../engine/grid';
import type { Strength } from '../engine/hunter';
import { emptyBook, emptyRecords, type Records, sanitizeRecords, type WordBook } from './records';

/** Everything Chain Letter keeps on this device, in three small versioned slots. */
export interface Prefs {
  size: GridSize;
  rule: Rule;
  minLetters: number;
  strength: Strength;
  players: [string, string];
}

export function defaultPrefs(): Prefs {
  return {
    size: 4,
    rule: 'classic',
    minLetters: 3,
    strength: 2,
    players: ['Player 1', 'Player 2'],
  };
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
  book: SaveSlot<WordBook>;
  /** Records with any gaps from an older save filled in. */
  loadRecords(): Records;
  loadPrefs(): Prefs;
}

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  const prefs = context.save<Prefs>({ key: 'prefs', version: 1, defaults: defaultPrefs });
  const records = context.save<Records>({ key: 'records', version: 1, defaults: emptyRecords });
  const book = context.save<WordBook>({ key: 'book', version: 1, defaults: emptyBook });
  return {
    prefs,
    records,
    book,
    loadRecords: () => sanitizeRecords(records.load()),
    loadPrefs: () => ({ ...defaultPrefs(), ...prefs.load() }),
  };
}
