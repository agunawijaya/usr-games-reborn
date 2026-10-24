import type { GameContext, SaveSlot } from '@usr-games/kit';
import { isCardId } from '@usr-games/kit/cards';
import { LEVELS, type Level } from '../engine/ai/minds';
import type { CountingMode, GameLength, MatchState } from '../engine/match';
import type { AlbumEntry } from '../modes/album';

/**
 * What Fifteen-Two keeps on this device, each in its own versioned slot of the kit's storage:
 * preferences, records, the album of hands, the Daily Discard's days and the game in progress.
 * Every reader repairs what it loads, so an old or damaged save never stops the game.
 */

export type Pace = 'relaxed' | 'brisk';

export interface Prefs {
  level: Level;
  length: GameLength;
  counting: CountingMode;
  coach: boolean;
  pace: Pace;
}

export const DEFAULT_PREFS: Prefs = {
  level: 'classic',
  length: 121,
  counting: 'automatic',
  coach: true,
  pace: 'relaxed',
};

const COUNTING: readonly CountingMode[] = ['automatic', 'yourself', 'classic-1980'];

export function prefsFrom(value: unknown): Prefs {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<Prefs>;
  return {
    level: LEVELS.includes(raw.level as Level) ? (raw.level as Level) : DEFAULT_PREFS.level,
    length: raw.length === 61 || raw.length === 121 ? raw.length : DEFAULT_PREFS.length,
    counting: COUNTING.includes(raw.counting as CountingMode)
      ? (raw.counting as CountingMode)
      : DEFAULT_PREFS.counting,
    coach: typeof raw.coach === 'boolean' ? raw.coach : DEFAULT_PREFS.coach,
    pace: raw.pace === 'brisk' ? 'brisk' : 'relaxed',
  };
}

export interface LevelRecord {
  games: number;
  wins: number;
}

export interface Records {
  games: number;
  wins: number;
  byLevel: Record<Level, LevelRecord>;
  skunks: number;
  thirtyOnes: number;
  bestCount: number;
  trainerRight: number;
  trainerRounds: number;
  bestSprint: number;
}

export const DEFAULT_RECORDS = (): Records => ({
  games: 0,
  wins: 0,
  byLevel: {
    beginner: { games: 0, wins: 0 },
    classic: { games: 0, wins: 0 },
    sharp: { games: 0, wins: 0 },
  },
  skunks: 0,
  thirtyOnes: 0,
  bestCount: 0,
  trainerRight: 0,
  trainerRounds: 0,
  bestSprint: 0,
});

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export function recordsFrom(value: unknown): Records {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<Records>;
  const fresh = DEFAULT_RECORDS();
  const byLevel = { ...fresh.byLevel };
  for (const level of LEVELS) {
    const entry = raw.byLevel?.[level];
    byLevel[level] = { games: count(entry?.games), wins: count(entry?.wins) };
  }
  return {
    games: count(raw.games),
    wins: count(raw.wins),
    byLevel,
    skunks: count(raw.skunks),
    thirtyOnes: count(raw.thirtyOnes),
    bestCount: Math.min(29, count(raw.bestCount)),
    trainerRight: count(raw.trainerRight),
    trainerRounds: count(raw.trainerRounds),
    bestSprint: count(raw.bestSprint),
  };
}

/** The first Daily Discard of each day is the one that counts. */
export interface DailyDay {
  number: number;
  thrown: number[];
  percent: number;
  place: number;
}

export type DailyHistory = Record<string, DailyDay>;

export function dailyFrom(value: unknown): DailyHistory {
  if (typeof value !== 'object' || value === null) return {};
  const days: DailyHistory = {};
  for (const [key, day] of Object.entries(value as Record<string, Partial<DailyDay>>)) {
    if (
      day &&
      Array.isArray(day.thrown) &&
      day.thrown.length === 2 &&
      day.thrown.every(isCardId) &&
      typeof day.percent === 'number'
    ) {
      days[key] = {
        number: count(day.number),
        thrown: day.thrown,
        percent: Math.min(100, count(day.percent)),
        place: count(day.place),
      };
    }
  }
  return days;
}

/** A game left part-way, to continue from the game menu. */
export interface SavedGame {
  level: Level;
  state: MatchState;
  coach: boolean;
  /** Your claims so far (for "Counted true"), and other running tallies. */
  claims: number;
  rightClaims: number;
  seed: string;
  savedAt: string;
}

export function savedGameFrom(value: unknown): SavedGame | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<SavedGame>;
  const state = raw.state;
  if (
    !LEVELS.includes(raw.level as Level) ||
    !state ||
    typeof state !== 'object' ||
    !Array.isArray(state.scores) ||
    state.phase === 'game-over' ||
    typeof raw.seed !== 'string'
  ) {
    return null;
  }
  return {
    level: raw.level as Level,
    state,
    coach: raw.coach !== false,
    claims: count(raw.claims),
    rightClaims: count(raw.rightClaims),
    seed: raw.seed,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
  };
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
  album: SaveSlot<AlbumEntry[]>;
  daily: SaveSlot<DailyHistory>;
  game: SaveSlot<SavedGame | null>;
}

export function openSaves(context: GameContext): Saves {
  return {
    prefs: context.save({ key: 'prefs', version: 1, defaults: () => ({ ...DEFAULT_PREFS }) }),
    records: context.save({ key: 'records', version: 1, defaults: DEFAULT_RECORDS }),
    album: context.save<AlbumEntry[]>({ key: 'album', version: 1, defaults: () => [] }),
    daily: context.save<DailyHistory>({ key: 'daily', version: 1, defaults: () => ({}) }),
    game: context.save<SavedGame | null>({ key: 'game', version: 1, defaults: () => null }),
  };
}
