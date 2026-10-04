import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { Battle } from '../engine';
import type { Practice } from '../voyage/daily';
import type { Tally } from '../voyage/tally';
import type { EncounterOption, EndingId, FigureheadId, Life } from '../voyage/types';

/**
 * What Figurehead remembers between visits: the ship's life at sea, the lives already told
 * (the harbour of memories), a battle left half fought, the days of Today's Weather, the last
 * open-water settings, lifetime counts for the packages, and the player's preferences.
 */

export type Mode =
  | { kind: 'voyage'; option: EncounterOption }
  | { kind: 'daily'; dateKey: string; number: number }
  | { kind: 'open'; practice: Practice };

export interface ActiveBattle {
  mode: Mode;
  battle: Battle;
  tally: Tally;
  startedAt: number;
  log: LogLine[];
}

export interface LogLine {
  turn: number;
  text: string;
  tone: 'ours' | 'theirs' | 'note' | 'good' | 'bad';
}

/** A life told to its end, kept for the harbour of memories. */
export interface Memory {
  id: string;
  shipName: string;
  hull: number;
  figurehead: FigureheadId;
  captain: string;
  startedOn: string;
  endedOn: string;
  ending: EndingId;
  renown: number;
  chapters: number;
  prizes: number;
  captains: number;
  quality: number;
}

export interface DayRecord {
  rating: number;
  won: boolean;
  mentions: boolean[];
  kind: string;
}

export interface Counts {
  battles: number;
  wins: number;
  prizes: number;
  wholePrizes: number;
  broadsides: number;
  rakes: number;
  mentions: number;
  lives: number;
}

export interface Prefs {
  /** Show the sailing master's advice on the orders panel. */
  advice: boolean;
  /** How long each turn's film runs. */
  pace: 'calm' | 'brisk';
  /** Show the coach's notes during the first chapters. */
  coach: boolean;
}

export interface Saves {
  life: SaveSlot<Life | null>;
  memories: SaveSlot<Memory[]>;
  active: SaveSlot<ActiveBattle | null>;
  days: SaveSlot<Record<string, DayRecord>>;
  open: SaveSlot<Practice>;
  counts: SaveSlot<Counts>;
  prefs: SaveSlot<Prefs>;
}

export const EMPTY_COUNTS: Counts = {
  battles: 0,
  wins: 0,
  prizes: 0,
  wholePrizes: 0,
  broadsides: 0,
  rakes: 0,
  mentions: 0,
  lives: 0,
};

export function openSaves(context: GameContext): Saves {
  return {
    life: context.save<Life | null>({ key: 'life', version: 1, defaults: () => null }),
    memories: context.save<Memory[]>({ key: 'memories', version: 1, defaults: () => [] }),
    active: context.save<ActiveBattle | null>({ key: 'active', version: 1, defaults: () => null }),
    days: context.save<Record<string, DayRecord>>({
      key: 'days',
      version: 1,
      defaults: () => ({}),
    }),
    open: context.save<Practice>({
      key: 'open',
      version: 1,
      defaults: () => ({ kind: 'duel', pressure: 1, qual: 3, code: '' }),
    }),
    counts: context.save<Counts>({
      key: 'counts',
      version: 1,
      defaults: () => ({ ...EMPTY_COUNTS }),
    }),
    prefs: context.save<Prefs>({
      key: 'prefs',
      version: 1,
      defaults: () => ({ advice: true, pace: 'calm', coach: true }),
    }),
  };
}
