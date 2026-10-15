import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { Level } from '../ai/players';
import type { Length, MatchState } from '../engine/match';
import type { DailyRecord } from '../modes/daily';
import { type Journal, emptyJournal } from '../modes/journal';

/**
 * What Detour keeps between visits: the player's choices, the game in progress, the records,
 * the travel journal and each day's Daily Road. Each slot is versioned through the kit.
 */

export type ModeId = 'quick' | 'game' | 'teams' | 'daily';

export interface Prefs {
  helper: boolean;
  rival: Level;
  length: Length;
  teamLength: Length;
  sound: boolean;
}

export const DEFAULT_PREFS = (): Prefs => ({
  helper: true,
  rival: 'classic',
  length: 'full',
  teamLength: 'single',
  sound: true,
});

export interface Current {
  mode: ModeId;
  match: MatchState;
  /** Where in the open routes this game's first hand starts. */
  routeOffset: number;
  /** The Daily Road's route, fixed for the day. */
  dailyRoute: string | null;
  startedAt: number;
  playedMs: number;
}

export interface Records {
  games: number;
  gamesWon: number;
  hands: number;
  handsWon: number;
  coups: number;
  miles: number;
  bestHand: number;
  wonAgainst: Record<Level, number>;
}

export const EMPTY_RECORDS = (): Records => ({
  games: 0,
  gamesWon: 0,
  hands: 0,
  handsWon: 0,
  coups: 0,
  miles: 0,
  bestHand: 0,
  wonAgainst: { rookie: 0, classic: 0, sly: 0 },
});

export interface Saves {
  prefs: SaveSlot<Prefs>;
  current: SaveSlot<Current | null>;
  records: SaveSlot<Records>;
  journal: SaveSlot<Journal>;
  daily: SaveSlot<Record<string, DailyRecord>>;
}

export function openSaves(context: GameContext): Saves {
  return {
    prefs: context.save({ key: 'prefs', version: 1, defaults: DEFAULT_PREFS }),
    current: context.save<Current | null>({ key: 'current', version: 1, defaults: () => null }),
    records: context.save({ key: 'records', version: 1, defaults: EMPTY_RECORDS }),
    journal: context.save({ key: 'journal', version: 1, defaults: emptyJournal }),
    daily: context.save<Record<string, DailyRecord>>({
      key: 'daily',
      version: 1,
      defaults: () => ({}),
    }),
  };
}

/** A saved value merged over its defaults, so a field added later never reads as missing. */
export function withDefaults<T extends object>(
  value: Partial<T> | null | undefined,
  defaults: () => T,
): T {
  return { ...defaults(), ...(value ?? {}) };
}
