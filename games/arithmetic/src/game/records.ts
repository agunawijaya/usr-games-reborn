import type { Album } from '../engine/album';
import { summarize } from '../engine/album';
import type { EventResult } from '../engine/events';
import type { Tempo } from '../engine/sums';
import type { PackageId } from './packages';

/**
 * What the player has done, kept for good: bests per rung, chapter stars, Daily results and a
 * few counters. Every update is a pure function that also says which packages it earned and
 * whether it set a personal best, so the screens only show what these decide.
 */

export interface Best {
  readonly score: number;
  /** Fastest finish in Rush, in milliseconds; null until one is played in Rush. */
  readonly ms: number | null;
}

export interface SumsBest extends Best {
  /** Cumulative milliseconds at each solved problem of the fastest block: the ghost's pace. */
  readonly pace: readonly number[];
}

export interface ChapterBest {
  readonly rush: number;
  readonly calm: number;
  readonly score: number;
}

export interface DailyEntry {
  readonly score: number;
  readonly line: string;
}

export interface Counters {
  readonly sumsSolved: number;
  readonly numbersSplit: number;
  readonly boardsCleared: number;
  readonly wordsDone: number;
  readonly fractionsClean: number;
  readonly forgiven: number;
}

export interface Records {
  readonly sums: Readonly<Record<string, SumsBest>>;
  readonly split: Readonly<Record<string, Best>>;
  readonly sieve: Readonly<Record<string, Best>>;
  readonly spell: Readonly<Record<string, Best>>;
  readonly chapters: Readonly<Record<string, ChapterBest>>;
  readonly daily: {
    readonly days: Readonly<Record<string, DailyEntry>>;
    readonly played: number;
    readonly best: DailyEntry | null;
  };
  readonly counters: Counters;
}

export function emptyRecords(): Records {
  return {
    sums: {},
    split: {},
    sieve: {},
    spell: {},
    chapters: {},
    daily: { days: {}, played: 0, best: null },
    counters: {
      sumsSolved: 0,
      numbersSplit: 0,
      boardsCleared: 0,
      wordsDone: 0,
      fractionsClean: 0,
      forgiven: 0,
    },
  };
}

/** Saved data from older or damaged saves is filled in rather than thrown away. */
export function sanitizeRecords(value: unknown): Records {
  const base = emptyRecords();
  if (typeof value !== 'object' || value === null) return base;
  const v = value as Partial<Records>;
  const record = <T>(x: unknown): Record<string, T> =>
    typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, T>) : {};
  const daily = record<unknown>(v.daily);
  return {
    sums: record(v.sums),
    split: record(v.split),
    sieve: record(v.sieve),
    spell: record(v.spell),
    chapters: record(v.chapters),
    daily: {
      days: record(daily.days),
      played: typeof daily.played === 'number' ? daily.played : 0,
      best: (daily.best as DailyEntry | null) ?? null,
    },
    counters: { ...base.counters, ...record<number>(v.counters) },
  };
}

/** What one finished event adds, beyond its EventResult. */
export type EventDetail =
  | {
      readonly mode: 'sums';
      /** Milliseconds per solved problem, in order. */
      readonly splits: readonly number[];
      readonly firstTries: number;
    }
  | { readonly mode: 'split'; readonly starts: readonly number[] }
  | { readonly mode: 'sieve'; readonly wrongClicks: number }
  | {
      readonly mode: 'spell';
      readonly items: readonly { readonly numeral: string; readonly misses: number }[];
    };

export interface Noted {
  readonly records: Records;
  readonly earned: PackageId[];
  readonly personalBest: boolean;
}

/** A finished event: bests, counters and the packages it earned. */
export function noteEvent(
  records: Records,
  result: EventResult,
  detail: EventDetail,
  rungKey: string,
): Noted {
  const earned: PackageId[] = [];
  const rush = result.tempo === 'rush';
  switch (detail.mode) {
    case 'sums': {
      const previous = records.sums[rungKey];
      const ms = detail.splits.reduce((sum, value) => sum + value, 0);
      const bestMs = previous?.ms ?? null;
      const faster = rush && (bestMs === null || ms < bestMs);
      const pace = faster ? cumulative(detail.splits) : (previous?.pace ?? []);
      const best: SumsBest = {
        score: Math.max(previous?.score ?? 0, result.score),
        ms: faster ? ms : (previous?.ms ?? null),
        pace,
      };
      if (detail.firstTries === detail.splits.length && detail.splits.length >= 20) {
        earned.push('perfect-block');
      }
      if (rush && detail.splits.length >= 20 && ms / detail.splits.length <= 1500) {
        earned.push('lightning');
      }
      return {
        records: {
          ...records,
          sums: { ...records.sums, [rungKey]: best },
          counters: {
            ...records.counters,
            sumsSolved: records.counters.sumsSolved + detail.splits.length,
          },
        },
        earned,
        personalBest: faster && bestMs !== null,
      };
    }
    case 'split': {
      const { best, personalBest } = improve(records.split[rungKey], result, rush);
      if (detail.starts.length > 0) earned.push('first-split');
      if (detail.starts.some((n) => n >= 100_000 && n < 1_000_000)) earned.push('big-split');
      if (rungKey === 'split:most-wanted' && detail.starts.length > 0) earned.push('most-wanted');
      return {
        records: {
          ...records,
          split: { ...records.split, [rungKey]: best },
          counters: {
            ...records.counters,
            numbersSplit: records.counters.numbersSplit + detail.starts.length,
          },
        },
        earned,
        personalBest,
      };
    }
    case 'sieve': {
      const { best, personalBest } = improve(records.sieve[rungKey], result, rush);
      if (detail.wrongClicks === 0) earned.push('clean-sweep');
      return {
        records: {
          ...records,
          sieve: { ...records.sieve, [rungKey]: best },
          counters: { ...records.counters, boardsCleared: records.counters.boardsCleared + 1 },
        },
        earned,
        personalBest,
      };
    }
    case 'spell': {
      const { best, personalBest } = improve(records.spell[rungKey], result, rush);
      const fractions = detail.items.filter(
        (item) => item.numeral.includes('.') && item.misses === 0,
      ).length;
      const fractionsClean = records.counters.fractionsClean + fractions;
      if (fractionsClean >= 5) earned.push('fraction-fluent');
      if (detail.items.some((item) => item.numeral.split('.')[0]!.length >= 9)) {
        earned.push('wordsmith');
      }
      return {
        records: {
          ...records,
          spell: { ...records.spell, [rungKey]: best },
          counters: {
            ...records.counters,
            wordsDone: records.counters.wordsDone + detail.items.length,
            fractionsClean,
          },
        },
        earned,
        personalBest,
      };
    }
  }
}

function improve(previous: Best | undefined, result: EventResult, rush: boolean) {
  const bestMs = previous?.ms ?? null;
  const faster = rush && (bestMs === null || result.ms < bestMs);
  return {
    best: {
      score: Math.max(previous?.score ?? 0, result.score),
      ms: faster ? result.ms : (previous?.ms ?? null),
    },
    personalBest: faster && bestMs !== null,
  };
}

function cumulative(splits: readonly number[]): number[] {
  let total = 0;
  return splits.map((ms) => (total += ms));
}

/**
 * How far ahead the best pace is, in problems, after `elapsed` milliseconds with `solved` done:
 * positive when the ghost leads. Null without a best.
 */
export function ghostGap(pace: readonly number[], elapsed: number, solved: number): number | null {
  if (pace.length === 0) return null;
  let done = 0;
  while (done < pace.length && pace[done]! <= elapsed) done++;
  const before = done === 0 ? 0 : pace[done - 1]!;
  const after = pace[done];
  const partial = after === undefined ? 0 : (elapsed - before) / Math.max(1, after - before);
  return done + Math.min(1, partial) - solved;
}

/** A finished chapter: its best stars per tempo, and calm-and-collected. */
export function noteChapter(
  records: Records,
  chapterId: string,
  stars: number,
  tempo: Tempo,
  score: number,
): Noted {
  const previous = records.chapters[chapterId] ?? { rush: 0, calm: 0, score: 0 };
  const next: ChapterBest = {
    rush: tempo === 'rush' ? Math.max(previous.rush, stars) : previous.rush,
    calm: tempo === 'calm' ? Math.max(previous.calm, stars) : previous.calm,
    score: Math.max(previous.score, score),
  };
  return {
    records: { ...records, chapters: { ...records.chapters, [chapterId]: next } },
    earned: tempo === 'calm' && stars === 3 ? ['calm-and-collected'] : [],
    personalBest: score > previous.score && previous.score > 0,
  };
}

/** The Daily: only the first play of a day is scored. */
export function noteDaily(records: Records, dateKey: string, entry: DailyEntry): Noted {
  if (records.daily.days[dateKey]) return { records, earned: [], personalBest: false };
  const played = records.daily.played + 1;
  const best =
    records.daily.best && records.daily.best.score >= entry.score ? records.daily.best : entry;
  return {
    records: {
      ...records,
      daily: { days: { ...records.daily.days, [dateKey]: entry }, played, best },
    },
    earned: played >= 7 ? ['daily-regular'] : [],
    personalBest: best === entry && records.daily.best !== null,
  };
}

/** Packages the album has earned. */
export function albumPackages(album: Album): PackageId[] {
  return summarize(album).twins >= 10 ? ['twin-primes'] : [];
}

/** The tutor let a number go. */
export function noteForgiven(records: Records, count: number): Noted {
  if (count <= 0) return { records, earned: [], personalBest: false };
  return {
    records: {
      ...records,
      counters: { ...records.counters, forgiven: records.counters.forgiven + count },
    },
    earned: ['forgiven'],
    personalBest: false,
  };
}

/** Stars across the campaign: the better of Rush and Calm for each chapter. */
export function totalStars(records: Records): number {
  return Object.values(records.chapters).reduce(
    (sum, chapter) => sum + Math.max(chapter.rush, chapter.calm),
    0,
  );
}
