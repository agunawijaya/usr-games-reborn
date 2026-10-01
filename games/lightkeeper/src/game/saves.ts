import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { RankId, RuleSet, WatchLength, WatchState } from '../engine/types';

/**
 * What Lightkeeper remembers between visits: the career, the gazetteer of worlds kept, the
 * nightly watches, the last open-watch settings, a watch left half done, and two preferences.
 */

export type WatchKind =
  | { kind: 'commission'; rank: RankId }
  | { kind: 'daily'; dateKey: string; number: number }
  | { kind: 'open'; code: string; rank: RankId; length: WatchLength; ruleSet: RuleSet };

export interface Career {
  rank: RankId;
  /** Promoted from the top rank, as the original's Commodore Emeritus. */
  emeritus: boolean;
  promotions: { rank: RankId; dateKey: string }[];
  watches: number;
  wins: number;
  bestByRank: Partial<Record<RankId, number>>;
  /** Ranks whose standing orders the player has read. */
  briefed: RankId[];
}

export interface WorldRecord {
  answered: number;
  relit: number;
  lost: number;
}

export interface Gazetteer {
  worlds: Record<number, WorldRecord>;
}

export interface NightResult {
  outcome: 'won' | 'lost' | 'ended';
  score: number;
  lights: number;
  stopped: number;
  days: number;
}

export interface Nights {
  days: Record<string, NightResult>;
}

export interface OpenSettings {
  code: string;
  rank: RankId;
  length: WatchLength;
  ruleSet: RuleSet;
}

export interface ActiveWatch {
  watch: WatchKind;
  state: WatchState;
  startedAt: number;
  log: { text: string; tone: string }[];
}

export interface Prefs {
  pace: 'calm' | 'brisk';
  coach: boolean;
}

export interface Saves {
  career: SaveSlot<Career>;
  gazetteer: SaveSlot<Gazetteer>;
  nights: SaveSlot<Nights>;
  open: SaveSlot<OpenSettings>;
  active: SaveSlot<ActiveWatch | null>;
  prefs: SaveSlot<Prefs>;
}

export function openSaves(context: GameContext): Saves {
  return {
    career: context.save<Career>({
      key: 'career',
      version: 1,
      defaults: () => ({
        rank: 1,
        emeritus: false,
        promotions: [],
        watches: 0,
        wins: 0,
        bestByRank: {},
        briefed: [],
      }),
    }),
    gazetteer: context.save<Gazetteer>({
      key: 'gazetteer',
      version: 1,
      defaults: () => ({ worlds: {} }),
    }),
    nights: context.save<Nights>({ key: 'nights', version: 1, defaults: () => ({ days: {} }) }),
    open: context.save<OpenSettings>({
      key: 'open',
      version: 1,
      defaults: () => ({ code: '', rank: 1, length: 1, ruleSet: 'classic' }),
    }),
    active: context.save<ActiveWatch | null>({ key: 'active', version: 1, defaults: () => null }),
    prefs: context.save<Prefs>({
      key: 'prefs',
      version: 1,
      defaults: () => ({ pace: 'calm', coach: true }),
    }),
  };
}

/** Codes are typed by people: case, spaces and punctuation should not change the Reach. */
export function normaliseCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export function seedFor(watch: WatchKind, daySeed: string, nonce: number): string {
  switch (watch.kind) {
    case 'commission':
      return `lightkeeper:commission:${watch.rank}:${nonce}`;
    case 'daily':
      return daySeed;
    case 'open':
      return `lightkeeper:code:${normaliseCode(watch.code)}:${watch.rank}:${watch.length}:${watch.ruleSet}`;
  }
}

/** Tonight's watch: the same Reach for everyone, at a rank most keepers can hold. */
export const NIGHT_RANK: RankId = 3;
