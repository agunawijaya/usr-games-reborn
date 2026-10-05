import { ALL_DECKS } from '../decks/decks';
import { addWord, average, EMPTY_TALLY, type Tally } from '../engine/score';
import type { PackageId } from './packages';

/**
 * What the beach remembers between visits, and the pure rules that turn a finished word or
 * session into new records and earned packages. No storage and no DOM here: `saves.ts` keeps
 * these on the device, the play screen calls these rules.
 */
export type Mode = 'tutorial' | 'beach' | 'daily' | 'classic' | 'duel' | 'run';

export interface DailyEntry {
  /** Waves taken, or null when the tide won. */
  waves: number | null;
}

export interface Records {
  /** Every word ever played outside the tutorial and Duel: the all-time tide average. */
  lifetime: Tally;
  found: number;
  clean: number;
  /** Deck ids a word has been found from. */
  decksFound: string[];
  computingFound: number;
  /** Words played in a row without the Lighthouse. */
  withoutHelp: number;
  /** Classic words found in a row. */
  classicStreak: number;
  /** The lowest average over a beach of ten words or more. */
  bestBeach: number | null;
  /** The most words found in a Tide run. */
  bestRun: number;
  runsComplete: number;
  duels: number;
  /** The first finished Daily Word of each day; later plays that day are for fun. */
  dailies: Record<string, DailyEntry>;
  dailyCount: number;
  /** Recently played words, so a beach does not repeat itself too soon. */
  recent: string[];
}

export function emptyRecords(): Records {
  return {
    lifetime: EMPTY_TALLY,
    found: 0,
    clean: 0,
    decksFound: [],
    computingFound: 0,
    withoutHelp: 0,
    classicStreak: 0,
    bestBeach: null,
    bestRun: 0,
    runsComplete: 0,
    duels: 0,
    dailies: {},
    dailyCount: 0,
    recent: [],
  };
}

export interface WordPlayed {
  mode: Mode;
  deckId: string;
  word: string;
  won: boolean;
  /** Waves taken, Lighthouse included. */
  waves: number;
  wavesAllowed: number;
  lighthouseUses: number;
  /** The word's score for the tide average (nine for a lost word). */
  score: number;
}

const RECENT_KEPT = 300;
const DAYS_KEPT = 60;

export interface Update {
  records: Records;
  earned: PackageId[];
}

/** Folds one finished word into the records and lists the packages it earned. */
export function recordWord(records: Records, word: WordPlayed): Update {
  if (word.mode === 'tutorial') return { records, earned: [] };
  const earned: PackageId[] = [];
  const counts = word.mode !== 'duel';
  const next: Records = {
    ...records,
    lifetime: counts ? addWord(records.lifetime, word.score) : records.lifetime,
    recent: [...records.recent.filter((w) => w !== word.word), word.word].slice(-RECENT_KEPT),
    withoutHelp: word.lighthouseUses > 0 ? 0 : records.withoutHelp + 1,
  };
  if (word.mode === 'classic') next.classicStreak = word.won ? records.classicStreak + 1 : 0;
  if (word.won) {
    next.found = records.found + 1;
    if (word.waves === 0) next.clean = records.clean + 1;
    if (!records.decksFound.includes(word.deckId)) {
      next.decksFound = [...records.decksFound, word.deckId];
    }
    if (word.deckId === 'computing') next.computingFound = records.computingFound + 1;
    earned.push('first-castle');
    if (word.waves === 0) earned.push('clean-sweep');
    if (word.wavesAllowed === 7 && word.waves === 6) earned.push('last-wave');
    if (word.word.length >= 12) earned.push('long-word');
  }
  if (ALL_DECKS.every((deck) => next.decksFound.includes(deck.id))) earned.push('deck-explorer');
  if (next.computingFound >= 10) earned.push('historian');
  if (next.withoutHelp >= 20) earned.push('no-lighthouse');
  if (next.classicStreak >= 5) earned.push('classic-at-heart');
  return { records: next, earned };
}

/** A beach (Beach day or Classic) ends: its average may be a new best, or under par. */
export function recordBeach(records: Records, beach: Tally): Update {
  const value = average(beach);
  if (value === null || beach.words < 10) return { records, earned: [] };
  const best = records.bestBeach === null ? value : Math.min(records.bestBeach, value);
  return { records: { ...records, bestBeach: best }, earned: value < 2 ? ['par-golfer'] : [] };
}

export function recordRun(records: Records, found: number, complete: boolean): Update {
  return {
    records: {
      ...records,
      bestRun: Math.max(records.bestRun, found),
      runsComplete: records.runsComplete + (complete ? 1 : 0),
    },
    earned: complete ? ['tide-runner'] : [],
  };
}

export function recordDuel(records: Records): Update {
  return { records: { ...records, duels: records.duels + 1 }, earned: ['duelist'] };
}

/** Keeps the day's first finished Daily Word; returns whether this one was it. */
export function recordDaily(
  records: Records,
  dateKey: string,
  entry: DailyEntry,
): Update & { first: boolean } {
  if (records.dailies[dateKey]) return { records, earned: [], first: false };
  const keys = [...Object.keys(records.dailies), dateKey].sort().slice(-DAYS_KEPT);
  const dailies = Object.fromEntries(
    keys.map((key) => [key, key === dateKey ? entry : records.dailies[key]!]),
  );
  const dailyCount = records.dailyCount + 1;
  return {
    records: { ...records, dailies, dailyCount },
    earned: dailyCount >= 7 ? ['daily-regular'] : [],
    first: true,
  };
}
