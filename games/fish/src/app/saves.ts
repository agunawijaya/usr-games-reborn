import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { RuleSetId } from '../engine/rules';
import type { RivalId } from '../modes/match';

/**
 * What Gone Fishing keeps on this device, each in its own versioned slot of the kit's storage:
 * preferences, records, the fish album, the Tournament in progress and the Daily Pond's days.
 * Every reader repairs what it loads, so an old or damaged save never stops the game.
 */

export type Speed = 'relaxed' | 'brisk';

export interface Prefs {
  rules: RuleSetId;
  /** The notebook starts open for newcomers; switching it is remembered. */
  notebook: boolean;
  /** Who you choose to play in a Quick game. */
  rivals: RivalId[];
  speed: Speed;
  sound: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  rules: 'standard',
  notebook: true,
  rivals: ['otto', 'hazel', 'miso'],
  speed: 'relaxed',
  sound: true,
};

export interface Records {
  games: number;
  wins: number;
  draws: number;
  books: number;
  goldens: number;
  /** Games won with each rival at the pond. */
  beaten: Record<RivalId, number>;
  bestBooks: number;
  tournamentsWon: number;
}

export const DEFAULT_RECORDS = (): Records => ({
  games: 0,
  wins: 0,
  draws: 0,
  books: 0,
  goldens: 0,
  beaten: { otto: 0, hazel: 0, miso: 0 },
  bestBooks: 0,
  tournamentsWon: 0,
});

/** One species in the album: when it was first caught, and how often, golden or not. */
export interface AlbumEntry {
  first: string | null;
  caught: number;
  goldenFirst: string | null;
  golden: number;
}

/** Index 0 is the ace's angelfish, 12 the king's koi. */
export type Album = AlbumEntry[];

export const EMPTY_ALBUM = (): Album =>
  Array.from({ length: 13 }, () => ({ first: null, caught: 0, goldenFirst: null, golden: 0 }));

export type RoundResult = 'win' | 'draw' | 'loss';

export interface TournamentProgress {
  seed: string;
  /** One entry per round played, in order. */
  results: RoundResult[];
}

export interface DailyDay {
  number: number;
  books: { rank: number; golden: boolean }[];
  notebookUsed: boolean;
  outcome: RoundResult;
}

export type DailyHistory = Record<string, DailyDay>;

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
  album: SaveSlot<Album>;
  tournament: SaveSlot<TournamentProgress | null>;
  daily: SaveSlot<DailyHistory>;
}

export function openSaves(context: GameContext): Saves {
  return {
    prefs: context.save({ key: 'prefs', version: 1, defaults: () => ({ ...DEFAULT_PREFS }) }),
    records: context.save({ key: 'records', version: 1, defaults: DEFAULT_RECORDS }),
    album: context.save({ key: 'album', version: 1, defaults: EMPTY_ALBUM }),
    tournament: context.save<TournamentProgress | null>({
      key: 'tournament',
      version: 1,
      defaults: () => null,
    }),
    daily: context.save<DailyHistory>({ key: 'daily', version: 1, defaults: () => ({}) }),
  };
}

const RULES: readonly RuleSetId[] = ['standard', 'all-books', 'classic'];
const RIVAL_IDS: readonly RivalId[] = ['otto', 'hazel', 'miso'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export function prefsFrom(value: unknown): Prefs {
  const v = isRecord(value) ? value : {};
  const rivals = Array.isArray(v.rivals)
    ? v.rivals.filter((id): id is RivalId => RIVAL_IDS.includes(id as RivalId))
    : [];
  return {
    rules: RULES.includes(v.rules as RuleSetId) ? (v.rules as RuleSetId) : DEFAULT_PREFS.rules,
    notebook: typeof v.notebook === 'boolean' ? v.notebook : DEFAULT_PREFS.notebook,
    rivals: rivals.length > 0 ? [...new Set(rivals)] : [...DEFAULT_PREFS.rivals],
    speed: v.speed === 'brisk' ? 'brisk' : 'relaxed',
    sound: typeof v.sound === 'boolean' ? v.sound : true,
  };
}

export function recordsFrom(value: unknown): Records {
  const v = isRecord(value) ? value : {};
  const beaten = isRecord(v.beaten) ? v.beaten : {};
  return {
    games: count(v.games),
    wins: count(v.wins),
    draws: count(v.draws),
    books: count(v.books),
    goldens: count(v.goldens),
    beaten: { otto: count(beaten.otto), hazel: count(beaten.hazel), miso: count(beaten.miso) },
    bestBooks: count(v.bestBooks),
    tournamentsWon: count(v.tournamentsWon),
  };
}

export function albumFrom(value: unknown): Album {
  const album = EMPTY_ALBUM();
  if (!Array.isArray(value)) return album;
  return album.map((empty, i) => {
    const entry = value[i];
    if (!isRecord(entry)) return empty;
    return {
      first: typeof entry.first === 'string' ? entry.first : null,
      caught: count(entry.caught),
      goldenFirst: typeof entry.goldenFirst === 'string' ? entry.goldenFirst : null,
      golden: count(entry.golden),
    };
  });
}

export function tournamentFrom(value: unknown): TournamentProgress | null {
  if (!isRecord(value) || typeof value.seed !== 'string' || !Array.isArray(value.results))
    return null;
  const results = value.results.filter(
    (r): r is RoundResult => r === 'win' || r === 'draw' || r === 'loss',
  );
  return { seed: value.seed, results: results.slice(0, 5) };
}

/** Adds a game's books to the album, dating first catches with today's date. */
export function catchInto(
  album: Album,
  books: readonly { rank: number; golden: boolean }[],
  today: string,
): {
  album: Album;
  newSpecies: number[];
  newGolden: number[];
} {
  const next = album.map((entry) => ({ ...entry }));
  const newSpecies: number[] = [];
  const newGolden: number[] = [];
  for (const book of books) {
    const entry = next[book.rank - 1];
    if (!entry) continue;
    if (!entry.first) {
      entry.first = today;
      newSpecies.push(book.rank);
    }
    entry.caught++;
    if (book.golden) {
      if (!entry.goldenFirst) {
        entry.goldenFirst = today;
        newGolden.push(book.rank);
      }
      entry.golden++;
    }
  }
  return { album: next, newSpecies, newGolden };
}
