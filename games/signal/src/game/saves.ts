import type { GameContext, SaveSlot } from '@usr-games/kit';
import { emptyRecords, isRecords, type Records } from './records';

/** The player's own settings for the desk, kept between visits. */
export interface Prefs {
  /** Character speed of the sounder, words a minute. */
  wpm: number;
  /** Overall speed with Farnsworth gaps; equal to `wpm` for none. */
  spacingWpm: number;
  /** The sounder's 600 Hz tone as well as its clicks. */
  tone: boolean;
  /** Charts (code tables, pose chart, hole values) open by default where help is free. */
  charts: boolean;
  /** Where the free desk's ladders have reached. */
  morseLesson: number;
  flagLesson: number;
  /** Free desk printer width. */
  squint: number;
  /** Free desk sending pace in seconds per flag letter. */
  flagLimit: number;
}

export const DEFAULT_PREFS: Prefs = {
  wpm: 15,
  spacingWpm: 8,
  tone: true,
  charts: true,
  morseLesson: 0,
  flagLesson: 0,
  squint: 132,
  flagLimit: 5,
};

function isPrefs(value: unknown): value is Prefs {
  return typeof value === 'object' && value !== null && typeof (value as Prefs).wpm === 'number';
}

export interface Saves {
  records: SaveSlot<Records>;
  prefs: SaveSlot<Prefs>;
}

export function openSaves(context: GameContext): Saves {
  const records = context.save<Records>({ key: 'records', version: 1, defaults: emptyRecords });
  const prefs = context.save<Prefs>({
    key: 'prefs',
    version: 1,
    defaults: () => ({ ...DEFAULT_PREFS }),
  });
  return {
    records: guard(records, isRecords, emptyRecords),
    prefs: guard(prefs, isPrefs, () => ({ ...DEFAULT_PREFS })),
  };
}

/** Falls back to defaults when a save is somehow the wrong shape, and fills in new fields. */
function guard<T extends object>(
  slot: SaveSlot<T>,
  valid: (v: unknown) => v is T,
  defaults: () => T,
): SaveSlot<T> {
  const load = () => {
    const value = slot.load();
    return valid(value) ? { ...defaults(), ...value } : defaults();
  };
  return {
    load,
    save: (value) => slot.save(value),
    update: (change) => {
      const next = change(load());
      slot.save(next);
      return next;
    },
    clear: () => slot.clear(),
    storageKey: slot.storageKey,
  };
}
