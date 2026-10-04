import type { GameContext, SaveSlot } from '@usr-games/kit';

/**
 * Everything Sinkers keeps on this device, each in its own versioned slot of the kit's storage:
 * the player's settings, stars and bests for the dives, Marathon and Classic records by starting
 * level (the 1992 program kept a champion for every level), the Daily Dive history, and the
 * counters the packages need.
 */

export interface GameSettings {
  /** The dotted footprint where the sinker will land. */
  sonar: boolean;
  sound: boolean;
  /** The starting levels last chosen, so the next run offers them again. */
  marathonLevel: number;
  classicLevel: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sonar: true,
  sound: true,
  marathonLevel: 1,
  // The 1992 program's own default.
  classicLevel: 2,
};

export interface DiveRecord {
  stars: number;
  bestScore: number;
  /** For coral dives: the fewest sinkers it took. */
  fewestSinkers: number | null;
  tries: number;
}

export interface Progress {
  dives: Record<string, DiveRecord>;
  tutorialDone: boolean;
}

/** A best by starting level: Marathon's and Classic's champions. */
export interface LevelRecord {
  bestScore: number;
  rows: number;
  bestCombo: number;
  runs: number;
  /** When the best was set (a date key). */
  date: string;
}

export type LevelRecords = Partial<Record<number, LevelRecord>>;

export interface DailyRecord {
  number: number;
  name: string;
  score: number;
  bestCombo: number;
  rows: number;
  bubbles: number;
  par: number;
}

export interface Counters {
  runs: number;
  rowsBurst: number;
  fourRowBursts: number;
  bestCombo: number;
}

export interface Saves {
  settings: SaveSlot<GameSettings>;
  progress: SaveSlot<Progress>;
  marathon: SaveSlot<LevelRecords>;
  classic: SaveSlot<LevelRecords>;
  daily: SaveSlot<Record<string, DailyRecord>>;
  counters: SaveSlot<Counters>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    settings: context.save({
      key: 'settings',
      version: 1,
      defaults: () => ({ ...DEFAULT_SETTINGS }),
    }),
    progress: context.save({
      key: 'progress',
      version: 1,
      defaults: (): Progress => ({ dives: {}, tutorialDone: false }),
    }),
    marathon: context.save({ key: 'marathon', version: 1, defaults: () => ({}) }),
    classic: context.save({ key: 'classic', version: 1, defaults: () => ({}) }),
    daily: context.save({ key: 'daily', version: 1, defaults: () => ({}) }),
    counters: context.save({
      key: 'counters',
      version: 1,
      defaults: (): Counters => ({ runs: 0, rowsBurst: 0, fourRowBursts: 0, bestCombo: 0 }),
    }),
  };
}

/** Settings read defensively: anything missing from an older save takes its default. */
export function settingsFrom(value: unknown): GameSettings {
  if (!isObject(value)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...value } as GameSettings;
}

export function emptyDiveRecord(): DiveRecord {
  return { stars: 0, bestScore: 0, fewestSinkers: null, tries: 0 };
}

/** A finished run folded into the records for its starting level; says whether it is a new best. */
export function withRun(
  records: LevelRecords,
  level: number,
  run: { score: number; rows: number; bestCombo: number; date: string },
): { records: LevelRecords; best: boolean } {
  const before = records[level];
  const best = !before || run.score > before.bestScore;
  const record: LevelRecord = best
    ? { bestScore: run.score, rows: run.rows, bestCombo: run.bestCombo, runs: 0, date: run.date }
    : before!;
  return { records: { ...records, [level]: { ...record, runs: (before?.runs ?? 0) + 1 } }, best };
}
