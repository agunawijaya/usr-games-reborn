import type { GameContext, SaveSlot } from '@usr-games/kit';

/** Everything Full Pockets keeps on this device, in small versioned slots. */

/** Classic's board sizes, from the original's smallest fair board up to its whole terminal. */
export const CLASSIC_SIZES: ReadonlyArray<{ readonly width: number; readonly height: number }> = [
  { width: 4, height: 4 },
  { width: 8, height: 5 },
  { width: 12, height: 7 },
  { width: 16, height: 9 },
  { width: 20, height: 11 },
  { width: 24, height: 13 },
  { width: 32, height: 16 },
  { width: 48, height: 20 },
  { width: 78, height: 22 },
];

export const DEFAULT_CLASSIC_SIZE = 5;

export interface Prefs {
  strikePreview: boolean;
  classicSize: number;
  /** Show the original's keys next to the modern ones. */
  classicKeys: boolean;
  tutorialDone: boolean;
}

export type Mode = 'run' | 'daily' | 'classic';

export interface DailyRecord {
  banked: number | null;
  chamber: number;
  luckyBreaks: number;
  winked: boolean;
}

export interface Records {
  /** The best haul banked in a run. */
  runBest: number;
  runDeepest: number;
  /** The best haul per Classic board, keyed `width×height`. */
  classicBest: Record<string, number>;
  /** The first finished Daily Run of each day: that one counts. */
  dailies: Record<string, DailyRecord>;
  banks: number;
  luckyBreaks: number;
  peeks: number;
  dailyRuns: number;
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
}

const DAYS_KEPT = 60;

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    prefs: context.save<Prefs>({
      key: 'prefs',
      version: 1,
      defaults: () => ({
        strikePreview: true,
        classicSize: DEFAULT_CLASSIC_SIZE,
        classicKeys: false,
        tutorialDone: false,
      }),
    }),
    records: context.save<Records>({
      key: 'records',
      version: 1,
      defaults: () => ({
        runBest: 0,
        runDeepest: 0,
        classicBest: {},
        dailies: {},
        banks: 0,
        luckyBreaks: 0,
        peeks: 0,
        dailyRuns: 0,
      }),
    }),
  };
}

export function sizeKey(size: { width: number; height: number }): string {
  return `${size.width}×${size.height}`;
}

/** The best haul banked in the mode being played: what the snake's wink is measured against. */
export function bestFor(
  records: Records,
  mode: Mode,
  size: { width: number; height: number } | null,
): number {
  if (mode === 'classic' && size) return records.classicBest[sizeKey(size)] ?? 0;
  if (mode === 'daily') {
    return Object.values(records.dailies).reduce((best, d) => Math.max(best, d.banked ?? 0), 0);
  }
  return records.runBest;
}

/** Keeps a day's first finished Daily Run; returns whether this one was it. */
export function recordDaily(
  records: Records,
  dateKey: string,
  record: DailyRecord,
): { records: Records; first: boolean } {
  if (records.dailies[dateKey]) return { records, first: false };
  const keys = [...Object.keys(records.dailies), dateKey].sort().slice(-DAYS_KEPT);
  const dailies = Object.fromEntries(
    keys.map((k) => [k, k === dateKey ? record : records.dailies[k]!]),
  );
  return { records: { ...records, dailies, dailyRuns: records.dailyRuns + 1 }, first: true };
}
