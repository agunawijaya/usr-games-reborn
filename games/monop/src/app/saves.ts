import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { BoardId } from '../boards/themes';
import { emptyCareer, type Career, type GameKind } from '../career/career';
import type { SavedPlay } from '../play/session';
import type { PersonalityId } from '../engine/rivals';
import { NO_HOUSE_RULES } from '../engine/rules';
import type { Difficulty, HouseRules, Preset, Rules, SeatSetup } from '../engine/types';

/**
 * What Deeds & Dice keeps between visits, each in a versioned slot through the kit: the player's
 * choices (board, coach, sound, the last table they set up), their career, and the game in
 * progress.
 */

export type SeatChoice =
  | { readonly kind: 'you' }
  | { readonly kind: 'guest'; readonly name: string }
  | {
      readonly kind: 'rival';
      readonly personality: PersonalityId;
      readonly difficulty: Difficulty;
    };

export interface TableChoices {
  readonly board: BoardId;
  readonly seats: readonly SeatChoice[];
  readonly mode: 'quick' | 'classic';
  readonly preset: Preset;
  readonly house: HouseRules;
  readonly coach: boolean;
}

export interface Prefs {
  coach: boolean;
  board: BoardId;
  table: TableChoices;
  /** Sound effects and the board's bed; the board's tune. The Hall's volume sits over both. */
  effects: boolean;
  music: boolean;
  /** Camera moves, follow shots and celebrations at full length; off keeps the overview. */
  cinematics: boolean;
  /** Play on the flat map instead of the miniature town. */
  mapView: boolean;
  /** Graphics: full, light, or auto (light if the frame rate cannot keep up). */
  quality: 'auto' | 'full' | 'light';
}

export const DEFAULT_TABLE: TableChoices = {
  board: 'harbour',
  seats: [
    { kind: 'you' },
    { kind: 'rival', personality: 'dealmaker', difficulty: 'medium' },
    { kind: 'rival', personality: 'builder', difficulty: 'medium' },
  ],
  mode: 'quick',
  preset: 'standard',
  house: NO_HOUSE_RULES,
  coach: true,
};

export const DEFAULT_PREFS = (): Prefs => ({
  coach: true,
  board: 'harbour',
  table: DEFAULT_TABLE,
  effects: true,
  music: true,
  cinematics: true,
  mapView: false,
  quality: 'auto',
});

/** A game in progress, saved whenever it waits for a person, so it survives leaving the Hall. */
export interface SavedGame {
  readonly kind: GameKind;
  readonly board: BoardId;
  readonly seed: string;
  readonly rules: Rules;
  readonly seats: readonly SeatSetup[];
  readonly coach: boolean;
  readonly scenario?: string;
  readonly daily?: { readonly number: number; readonly dateKey: string };
  readonly play: SavedPlay;
  /** One line for the menu: "Quick game on Harbour City, round 12 of 56". */
  readonly line: string;
}

export interface Saves {
  readonly prefs: SaveSlot<Prefs>;
  readonly career: SaveSlot<Career>;
  readonly game: SaveSlot<SavedGame | null>;
}

export function openSaves(context: GameContext): Saves {
  return {
    // Version 1 held only the coach switch; its value carries over.
    prefs: context.save<Prefs>({
      key: 'settings',
      version: 2,
      defaults: DEFAULT_PREFS,
      migrations: { 2: (v1) => ({ ...DEFAULT_PREFS(), ...(v1 as Partial<Prefs>) }) },
    }),
    career: context.save<Career>({ key: 'career', version: 1, defaults: emptyCareer }),
    game: context.save<SavedGame | null>({ key: 'game', version: 1, defaults: () => null }),
  };
}

/** A saved value over its defaults, so a field added later never reads as missing. */
export function withDefaults<T extends object>(
  value: Partial<T> | null | undefined,
  defaults: () => T,
): T {
  return { ...defaults(), ...(value ?? {}) };
}
