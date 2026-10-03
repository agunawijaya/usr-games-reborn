import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { Rules } from '../engine/game';
import { OPPONENTS, type OpponentId } from '../engine/opponents';

/**
 * Everything Fivefold keeps on this device, each in its own versioned slot of the kit's storage:
 * settings, the ladder, the puzzles solved, the Daily Puzzle history, and the counters the
 * packages and weekly goals need.
 */

export type LeagueSpeed = 'calm' | 'brisk' | 'swift';

export interface GameSettings {
  sound: boolean;
  /** Read the board, where it is allowed. */
  readBoard: boolean;
  size: 15 | 19;
  rules: Rules;
  /** In ladder games: take the first move (or the second, for the star). */
  moveFirst: boolean;
  /** Ladder games count, with Read the board off; practice games do not count. */
  ranked: boolean;
  leagueSpeed: LeagueSpeed;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  readBoard: true,
  size: 15,
  rules: 'freestyle',
  moveFirst: true,
  ranked: true,
  leagueSpeed: 'brisk',
};

export interface RungRecord {
  /** Ranked wins. */
  wins: number;
  /** A ranked win moving second. */
  star: boolean;
  games: number;
}

export interface Ladder {
  records: Record<OpponentId, RungRecord>;
  chosen: OpponentId;
  /** Opponents beaten at least once in any game, practice included. */
  beaten: OpponentId[];
}

export interface PuzzleRecord {
  /** Tries it took, the solving one included (or taken so far). */
  tries: number;
  solved: boolean;
}

export interface DailyRecord {
  number: number;
  solved: boolean;
  tries: number;
  /** Your moves in the solving try. */
  moves: number;
}

export interface Counters {
  games: number;
  wins: number;
  leagueMatches: number;
  tutorialDone: boolean;
}

export interface Saves {
  settings: SaveSlot<GameSettings>;
  ladder: SaveSlot<Ladder>;
  puzzles: SaveSlot<Record<string, PuzzleRecord>>;
  daily: SaveSlot<Record<string, DailyRecord>>;
  counters: SaveSlot<Counters>;
}

export function emptyLadder(): Ladder {
  return {
    records: Object.fromEntries(
      OPPONENTS.map((o) => [o.id, { wins: 0, star: false, games: 0 }]),
    ) as Record<OpponentId, RungRecord>,
    chosen: 'pebble',
    beaten: [],
  };
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
    ladder: context.save({ key: 'ladder', version: 1, defaults: emptyLadder }),
    puzzles: context.save({ key: 'puzzles', version: 1, defaults: () => ({}) }),
    daily: context.save({ key: 'daily', version: 1, defaults: () => ({}) }),
    counters: context.save({
      key: 'counters',
      version: 1,
      defaults: (): Counters => ({ games: 0, wins: 0, leagueMatches: 0, tutorialDone: false }),
    }),
  };
}

/** Settings read defensively: anything missing from an older save takes its default. */
export function settingsFrom(value: unknown): GameSettings {
  if (!isObject(value)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...value } as GameSettings;
}

/** The ladder read defensively: opponents added later start with no games. */
export function ladderFrom(value: unknown): Ladder {
  const empty = emptyLadder();
  if (!isObject(value)) return empty;
  const saved = value as Partial<Ladder>;
  return {
    records: { ...empty.records, ...(saved.records ?? {}) },
    chosen: saved.chosen ?? empty.chosen,
    beaten: saved.beaten ?? [],
  };
}
