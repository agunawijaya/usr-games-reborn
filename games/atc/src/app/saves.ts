import type { GameContext, SaveSlot } from '@usr-games/kit';

/**
 * Everything Skyloom keeps on this device, each in its own versioned slot of the kit's storage:
 * the player's in-game settings, the campaign's stars, records per arena, the Daily Sky history,
 * the logbook and a few counters that packages need.
 */

export type Speed = 'relaxed' | 'classic' | 'fast';

export interface GameSettings {
  speed: Speed;
  prediction: boolean;
  /** Routes snap to beacons, gates and runways near the pointer. */
  snapping: boolean;
  /** Extra shape cues on planes and rings, for players who tell colours apart less easily. */
  shapes: boolean;
  terminalByDefault: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  speed: 'classic',
  prediction: true,
  snapping: true,
  shapes: false,
  terminalByDefault: false,
  sound: true,
};

/** How long a tick lasts at each speed, as a share of the arena's classic interval. */
export const SPEED_FACTOR: Record<Speed, number> = { relaxed: 1.5, classic: 1, fast: 0.6 };

export interface ShiftRecord {
  stars: number;
  bestSafe: number;
}

export interface Campaign {
  shifts: Record<string, ShiftRecord>;
  tutorialDone: boolean;
}

/** Best run per arena: most planes safe, then the fewest ticks. */
export interface EndlessRecord {
  safe: number;
  ticks: number;
  dateKey: string;
}

export interface DailyRecord {
  number: number;
  safe: number;
  squares: string;
  longestString: number;
}

export interface Counters {
  terminalOrders: number;
  dailiesFlown: number;
  /** All planes ever brought home, for the logbook's ratings. */
  planesSafe: number;
  landings: number;
  puzzlesSolved: number;
}

/** A finished sky, kept so its tapestry can be drawn again. */
export interface LogbookPage {
  id: string;
  dateKey: string;
  mode: 'shift' | 'endless' | 'daily' | 'puzzle';
  title: string;
  arenaId: string;
  safe: number;
  stars: number | null;
  /** One string per flight: hue, role, ending, then the cells as base-36 pairs. */
  threads: string[];
  knots: [number, number][];
}

export const LOGBOOK_PAGES = 40;

export interface Saves {
  settings: SaveSlot<GameSettings>;
  campaign: SaveSlot<Campaign>;
  endless: SaveSlot<Record<string, EndlessRecord>>;
  daily: SaveSlot<Record<string, DailyRecord>>;
  counters: SaveSlot<Counters>;
  logbook: SaveSlot<LogbookPage[]>;
  puzzles: SaveSlot<Record<string, number>>;
}

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    settings: context.save({
      key: 'settings',
      version: 1,
      defaults: () => ({ ...DEFAULT_SETTINGS }),
    }),
    campaign: context.save({
      key: 'campaign',
      version: 1,
      defaults: () => ({ shifts: {}, tutorialDone: false }),
    }),
    endless: context.save({ key: 'endless', version: 1, defaults: () => ({}) }),
    daily: context.save({ key: 'daily', version: 1, defaults: () => ({}) }),
    counters: context.save({
      key: 'counters',
      version: 1,
      defaults: () => ({
        terminalOrders: 0,
        dailiesFlown: 0,
        planesSafe: 0,
        landings: 0,
        puzzlesSolved: 0,
      }),
    }),
    logbook: context.save({ key: 'logbook', version: 1, defaults: () => [] }),
    puzzles: context.save({ key: 'puzzles', version: 1, defaults: () => ({}) }),
  };
}

/** A new best when more planes were safe, or as many in fewer ticks. */
export function beats(
  run: { safe: number; ticks: number },
  best: EndlessRecord | undefined,
): boolean {
  if (!best) return run.safe > 0;
  return run.safe > best.safe || (run.safe === best.safe && run.ticks < best.ticks);
}
