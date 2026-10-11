import { accuracy, type EventResult, type EventSpec, eventPar } from './events';
import type { Tempo } from './sums';

/**
 * The campaign: twelve chapters that climb all four ladders together. Each chapter is a short
 * meet of two to four events and earns up to three stars. In Rush the stars are accuracy, speed
 * and no hints; in Calm, with no clock, speed gives way to a clean run.
 */

export interface Chapter {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly blurb: string;
  readonly events: readonly EventSpec[];
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'warm-up',
    number: 1,
    title: 'Warm-up',
    blurb: 'Adding up to ten, then a few numbers in words.',
    events: [
      { mode: 'sums', level: 'plus-10' },
      { mode: 'spell', level: 'to-99', count: 3 },
    ],
  },
  {
    id: 'take-away',
    number: 2,
    title: 'Take it back',
    blurb: 'Minus, and your first numbers split into primes.',
    events: [
      { mode: 'sums', level: 'minus-10' },
      { mode: 'split', level: 'small', count: 3 },
    ],
  },
  {
    id: 'both-ways',
    number: 3,
    title: 'Both ways',
    blurb: 'Plus and minus mixed, and the first sieve of a hundred.',
    events: [
      { mode: 'sums', level: 'plus-minus-10' },
      { mode: 'sieve', level: 'hundred' },
    ],
  },
  {
    id: 'tables',
    number: 4,
    title: 'Tables',
    blurb: 'Times tables, then five small splits.',
    events: [
      { mode: 'sums', level: 'times-10' },
      { mode: 'split', level: 'small' },
    ],
  },
  {
    id: 'fair-shares',
    number: 5,
    title: 'Fair shares',
    blurb: 'Sharing with whole-number answers, and bigger numbers in words.',
    events: [
      { mode: 'sums', level: 'share-10' },
      { mode: 'spell', level: 'thousands', count: 4 },
    ],
  },
  {
    id: 'all-four',
    number: 6,
    title: 'All four',
    blurb: 'Every sign at once, a two-hundred sieve and three-digit splits.',
    events: [
      { mode: 'sums', level: 'all-10' },
      { mode: 'sieve', level: 'two-hundred' },
      { mode: 'split', level: 'hundreds', count: 3 },
    ],
  },
  {
    id: 'twenty',
    number: 7,
    title: 'Up to twenty',
    blurb: 'Plus and minus to twenty, six-figure words and more splits.',
    events: [
      { mode: 'sums', level: 'plus-minus-20' },
      { mode: 'spell', level: 'six-figures', count: 3 },
      { mode: 'split', level: 'hundreds' },
    ],
  },
  {
    id: 'twelve-times',
    number: 8,
    title: 'Twelve times',
    blurb: 'The twelve times table and a sieve of four hundred.',
    events: [
      { mode: 'sums', level: 'times-12' },
      { mode: 'sieve', level: 'four-hundred' },
    ],
  },
  {
    id: 'leftovers',
    number: 9,
    title: 'Leftovers',
    blurb: 'Remainders out in the open, four-digit splits and decimal words.',
    events: [
      { mode: 'sums', level: 'remainders' },
      { mode: 'split', level: 'thousands', count: 4 },
      { mode: 'spell', level: 'fractions', count: 3 },
    ],
  },
  {
    id: 'long-distance',
    number: 10,
    title: 'Long distance',
    blurb: 'All four to twenty, a sieve past a thousand and numbers in the millions.',
    events: [
      { mode: 'sums', level: 'all-20' },
      { mode: 'sieve', level: 'thousand' },
      { mode: 'spell', level: 'millions', count: 3 },
    ],
  },
  {
    id: 'big-numbers',
    number: 11,
    title: 'Big numbers',
    blurb: 'Two-digit plus and minus, six-digit splits and nine-digit words.',
    events: [
      { mode: 'sums', level: 'big-plus-minus' },
      { mode: 'split', level: 'six-digits', count: 4 },
      { mode: 'spell', level: 'millions', count: 3 },
    ],
  },
  {
    id: 'most-wanted',
    number: 12,
    title: 'Most wanted',
    blurb: 'The grand mix, the far-field sieve and the hardest splits in the game.',
    events: [
      { mode: 'sums', level: 'all-25' },
      { mode: 'sieve', level: 'ten-thousand' },
      { mode: 'split', level: 'most-wanted', count: 3 },
    ],
  },
];

export function chapterPar(chapter: Chapter): number {
  return chapter.events.reduce((sum, spec) => sum + eventPar(spec), 0);
}

export const ACCURACY_STAR = 0.9;

export interface StarCheck {
  readonly accurate: boolean;
  /** Rush: inside par time. Calm: at most one mistake in the whole chapter. */
  readonly second: boolean;
  readonly noHints: boolean;
}

export function chapterStars(
  chapter: Chapter,
  results: readonly EventResult[],
  tempo: Tempo,
): StarCheck {
  const ms = results.reduce((sum, r) => sum + r.ms, 0);
  const wrongs = results.reduce((sum, r) => sum + r.wrongs, 0);
  return {
    accurate: accuracy(results) >= ACCURACY_STAR,
    second: tempo === 'rush' ? ms <= chapterPar(chapter) * 1000 : wrongs <= 1,
    noHints: results.every((r) => r.hints === 0),
  };
}

export function starCount(check: StarCheck): number {
  return Number(check.accurate) + Number(check.second) + Number(check.noHints);
}

export const SECOND_STAR_NAME: Record<Tempo, string> = { rush: 'Under par', calm: 'Clean run' };
