import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { RuleSet } from '../engine/rules';

/**
 * Everything Hush the Wumpus keeps on this device, each in its own versioned slot of the kit's
 * storage: the player's in-game settings, the expeditions' stars and records, the Daily Cave
 * history, and the counters that packages need.
 */

export interface GameSettings {
  /** The rules a new expedition starts with (the Daily Cave is always Standard). */
  rules: RuleSet;
  /** The Scout marks every room the notes prove safe. */
  scout: boolean;
  /** The map draws itself as you explore (always off in the dark cave). */
  autoMap: boolean;
  /** Ride along with the dart; off plays a quick flight on the map instead. */
  cameraRide: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  rules: 'standard',
  scout: true,
  autoMap: true,
  cameraRide: true,
  sound: true,
};

export interface CaveRecord {
  stars: number;
  bestScore: number;
  fewestMoves: number | null;
  tries: number;
  hushes: number;
}

export interface Progress {
  caves: Record<string, CaveRecord>;
  tutorialDone: boolean;
}

export interface DailyRecord {
  number: number;
  hushed: boolean;
  moves: number;
  dartsThrown: number;
  batRides: number;
}

export interface CustomRecipe {
  rooms: number;
  tunnels: number;
  bats: number;
  pits: number;
  darts: number;
  hard: boolean;
}

export const DEFAULT_CUSTOM: CustomRecipe = {
  rooms: 20,
  tunnels: 3,
  bats: 3,
  pits: 3,
  darts: 5,
  hard: false,
};

export interface Counters {
  hushes: number;
  expeditions: number;
  dailies: number;
  roomsSeen: number;
}

export interface Saves {
  settings: SaveSlot<GameSettings>;
  progress: SaveSlot<Progress>;
  daily: SaveSlot<Record<string, DailyRecord>>;
  custom: SaveSlot<CustomRecipe>;
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
      defaults: (): Progress => ({ caves: {}, tutorialDone: false }),
    }),
    daily: context.save({ key: 'daily', version: 1, defaults: () => ({}) }),
    custom: context.save({ key: 'custom', version: 1, defaults: () => ({ ...DEFAULT_CUSTOM }) }),
    counters: context.save({
      key: 'counters',
      version: 1,
      defaults: (): Counters => ({ hushes: 0, expeditions: 0, dailies: 0, roomsSeen: 0 }),
    }),
  };
}

/** Settings read defensively: anything missing from an older save takes its default. */
export function settingsFrom(value: unknown): GameSettings {
  if (!isObject(value)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...value } as GameSettings;
}

export function emptyRecord(): CaveRecord {
  return { stars: 0, bestScore: 0, fewestMoves: null, tries: 0, hushes: 0 };
}
