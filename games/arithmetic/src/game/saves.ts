import type { GameContext, SaveSlot } from '@usr-games/kit';
import { type Album, emptyAlbum, isAlbum } from '../engine/album';
import { emptyBook, isPenaltyBook, type PenaltyBook } from '../engine/penalties';
import { clampRange, sanitizeOps, type Tempo } from '../engine/sums';
import type { ThemeId } from '../render/look';
import { emptyRecords, type Records, sanitizeRecords } from './records';

/**
 * Number Sprint's saves, each its own versioned slot under the game's scope: preferences, the
 * tutor's penalty book, the prime album and the records. Anything damaged falls back to its
 * defaults on its own, so one bad slot never costs the others.
 */

export interface Prefs {
  /** Null until the player picks a theme on first launch. */
  readonly theme: ThemeId | null;
  readonly tempo: Tempo;
  /** The on-screen keys along the bottom. */
  readonly keys: boolean;
  /** Free play's own setup for Quick Sums: the original's -o and -r. */
  readonly custom: { readonly ops: string; readonly range: number };
  /** The rung last chosen in free play, per mode. */
  readonly rungs: Readonly<Record<string, string>>;
}

export interface Tutor {
  readonly book: PenaltyBook;
}

export function defaultPrefs(): Prefs {
  return { theme: null, tempo: 'rush', keys: true, custom: { ops: '+-', range: 10 }, rungs: {} };
}

export function sanitizePrefs(value: unknown): Prefs {
  const base = defaultPrefs();
  if (typeof value !== 'object' || value === null) return base;
  const v = value as Partial<Prefs>;
  const custom = v.custom ?? base.custom;
  return {
    theme: v.theme === 'sprint' || v.theme === 'atom' ? v.theme : null,
    tempo: v.tempo === 'calm' ? 'calm' : 'rush',
    keys: v.keys !== false,
    custom: {
      ops: sanitizeOps(String(custom.ops ?? '+-')),
      range: clampRange(Number(custom.range) || 10),
    },
    rungs: typeof v.rungs === 'object' && v.rungs !== null ? v.rungs : {},
  };
}

export interface Saves {
  readonly prefs: Slot<Prefs>;
  readonly tutor: Slot<Tutor>;
  readonly album: Slot<Album>;
  readonly records: Slot<Records>;
}

/** A save slot that always hands back clean data. */
export interface Slot<T> {
  load(): T;
  save(value: T): void;
  update(change: (current: T) => T): T;
}

function clean<T>(slot: SaveSlot<T>, sanitize: (value: unknown) => T): Slot<T> {
  return {
    load: () => sanitize(slot.load()),
    save: (value) => slot.save(value),
    update: (change) => slot.update((current) => change(sanitize(current))),
  };
}

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    prefs: clean(context.save({ key: 'prefs', version: 1, defaults: defaultPrefs }), sanitizePrefs),
    tutor: clean(
      context.save({ key: 'tutor', version: 1, defaults: () => ({ book: emptyBook() }) }),
      (value) =>
        typeof value === 'object' && value !== null && isPenaltyBook((value as Tutor).book)
          ? (value as Tutor)
          : { book: emptyBook() },
    ),
    album: clean(context.save({ key: 'album', version: 1, defaults: emptyAlbum }), (value) =>
      isAlbum(value) ? value : emptyAlbum(),
    ),
    records: clean(
      context.save({ key: 'records', version: 1, defaults: emptyRecords }),
      sanitizeRecords,
    ),
  };
}
