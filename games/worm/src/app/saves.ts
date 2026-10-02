import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { Tempo } from '../engine/tempo';

/**
 * Everything Noodle Nine keeps on this device, each in its own versioned slot of the kit's
 * storage: the player's in-game settings, stars and records for gardens and fill puzzles, the
 * Daily Garden history, Endless bests, and the counters packages need.
 */

export interface GameSettings {
  /** The pace the noodle keeps when no key is pressed; holding keys speeds it up from there. */
  tempo: Tempo;
  /** Endless only: the 1980 clock, one move a second when idle, no multiplier. */
  classicTempo: boolean;
  grid: boolean;
  /** Fruit drawn with as many lobes as its value; off draws them all round. */
  shapes: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  tempo: 'creep',
  classicTempo: false,
  grid: true,
  shapes: true,
  sound: true,
};

export interface GardenRecord {
  stars: number;
  bestScore: number;
  bestChain: number;
  tries: number;
}

export interface PuzzleRecord {
  stars: number;
  fewestMoves: number | null;
  tries: number;
}

export interface Progress {
  gardens: Record<string, GardenRecord>;
  puzzles: Record<string, PuzzleRecord>;
  tutorialDone: boolean;
}

export interface DailyRecord {
  number: number;
  name: string;
  length: number;
  bestChain: number;
  dashes: number;
  score: number;
}

/** Endless bests, kept per pace: each starting tempo, and Classic. */
export type EndlessKey = Tempo | 'classic';

export interface EndlessRecord {
  bestScore: number;
  longest: number;
  bestChain: number;
  runs: number;
}

export interface Counters {
  runs: number;
  bites: number;
  dailies: number;
  longest: number;
  bestChain: number;
}

export interface Saves {
  settings: SaveSlot<GameSettings>;
  progress: SaveSlot<Progress>;
  daily: SaveSlot<Record<string, DailyRecord>>;
  endless: SaveSlot<Partial<Record<EndlessKey, EndlessRecord>>>;
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
      defaults: (): Progress => ({ gardens: {}, puzzles: {}, tutorialDone: false }),
    }),
    daily: context.save({ key: 'daily', version: 1, defaults: () => ({}) }),
    endless: context.save({ key: 'endless', version: 1, defaults: () => ({}) }),
    counters: context.save({
      key: 'counters',
      version: 1,
      defaults: (): Counters => ({ runs: 0, bites: 0, dailies: 0, longest: 0, bestChain: 0 }),
    }),
  };
}

/** Settings read defensively: anything missing from an older save takes its default. */
export function settingsFrom(value: unknown): GameSettings {
  if (!isObject(value)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...value } as GameSettings;
}

export function emptyGardenRecord(): GardenRecord {
  return { stars: 0, bestScore: 0, bestChain: 0, tries: 0 };
}

export function emptyPuzzleRecord(): PuzzleRecord {
  return { stars: 0, fewestMoves: null, tries: 0 };
}

export function emptyEndlessRecord(): EndlessRecord {
  return { bestScore: 0, longest: 0, bestChain: 0, runs: 0 };
}
