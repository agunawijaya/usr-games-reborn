import type { Rng } from '@usr-games/kit';
import { isPrime } from './factor';
import type { SieveSetup } from './sieve-board';
import type { SumsSetup } from './sums';

/**
 * The ladders of the four modes. Each rung is a setup the engines understand plus a name for the
 * menus; generators turn a rung and a seeded stream into the round's numbers.
 */

export type ModeId = 'sums' | 'split' | 'sieve' | 'spell';

export interface SumsLevel extends SumsSetup {
  readonly id: string;
  readonly name: string;
  /** A short honest note shown with the problem, e.g. how division answers are written. */
  readonly rule?: string;
}

const WHOLE_NUMBER_RULE = 'Whole-number answer: drop what is left over';
const REMAINDER_RULE = 'Answer with what is left over too: 7 r 5';

export const SUMS_LEVELS: readonly SumsLevel[] = [
  { id: 'plus-10', name: 'Plus, up to 10', ops: '+', range: 10 },
  { id: 'minus-10', name: 'Minus, up to 10', ops: '-', range: 10 },
  { id: 'plus-minus-10', name: 'Plus and minus', ops: '+-', range: 10 },
  { id: 'times-10', name: 'Times tables', ops: 'x', range: 10 },
  { id: 'share-10', name: 'Sharing', ops: '/', range: 10, rule: WHOLE_NUMBER_RULE },
  { id: 'all-10', name: 'All four', ops: '+-x/', range: 10, rule: WHOLE_NUMBER_RULE },
  { id: 'plus-minus-20', name: 'Plus and minus to 20', ops: '+-', range: 20 },
  { id: 'times-12', name: 'Times to 12', ops: 'x', range: 12 },
  {
    id: 'remainders',
    name: 'Remainders',
    ops: '/',
    range: 10,
    remainders: true,
    rule: REMAINDER_RULE,
  },
  { id: 'all-20', name: 'All four to 20', ops: '+-xx/', range: 20, rule: WHOLE_NUMBER_RULE },
  { id: 'big-plus-minus', name: 'Big plus and minus', ops: '+-', range: 99 },
  { id: 'all-25', name: 'Grand mix', ops: '+-x/', range: 25, rule: WHOLE_NUMBER_RULE },
];

/** Rungs used only by the Daily, kept off the menus' ladders. */
export const DAILY_SUMS: SumsLevel = {
  id: 'daily-mix',
  name: 'Daily mix',
  ops: '+-x/',
  range: 12,
  rule: WHOLE_NUMBER_RULE,
};

export interface SplitLevel {
  readonly id: string;
  readonly name: string;
  /** Primes the number is built from; they are also the chips offered. */
  readonly pool: readonly number[];
  readonly min: number;
  readonly max: number;
  /** One large prime that has to be recognised and declared at the end. */
  readonly boss?: readonly [number, number];
  readonly count: number;
}

export const SPLIT_LEVELS: readonly SplitLevel[] = [
  { id: 'small', name: 'Small change', pool: [2, 3, 5, 7], min: 12, max: 100, count: 5 },
  {
    id: 'hundreds',
    name: 'Three digits',
    pool: [2, 3, 5, 7, 11, 13],
    min: 100,
    max: 999,
    count: 5,
  },
  {
    id: 'thousands',
    name: 'Four digits',
    pool: [2, 3, 5, 7, 11, 13, 17, 19, 23],
    min: 1000,
    max: 9999,
    count: 5,
  },
  {
    id: 'six-digits',
    name: 'Six digits',
    pool: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47],
    min: 100_000,
    max: 999_999,
    count: 5,
  },
  {
    id: 'most-wanted',
    name: 'Most wanted',
    pool: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31],
    min: 10_000_000,
    max: 2_147_483_647,
    boss: [101, 9973],
    count: 5,
  },
];

export const DAILY_SPLIT: SplitLevel = {
  id: 'daily-mix',
  name: 'Daily splits',
  pool: [2, 3, 5, 7, 11, 13, 17, 19, 23],
  min: 60,
  max: 60_000,
  count: 5,
};

/** A number built from the level's primes, inside its bounds, never prime itself. */
export function splitNumber(level: SplitLevel, rng: Rng): number {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    let value = 1;
    if (level.boss) {
      const [low, high] = level.boss;
      do value = rng.int(low, high);
      while (!isPrime(value));
    }
    while (value < level.min) value *= rng.pick(level.pool);
    if (value <= level.max && !isPrime(value)) return value;
  }
  throw new Error(`no number fits ${level.id}`);
}

export function splitNumbers(level: SplitLevel, rng: Rng): number[] {
  const numbers: number[] = [];
  while (numbers.length < level.count) {
    const value = splitNumber(level, rng);
    if (!numbers.includes(value)) numbers.push(value);
  }
  return numbers;
}

export interface SieveLevel extends SieveSetup {
  readonly id: string;
  readonly name: string;
}

export const SIEVE_LEVELS: readonly SieveLevel[] = [
  { id: 'hundred', name: 'The first hundred', first: 1, last: 100, columns: 10 },
  { id: 'two-hundred', name: 'Two hundred', first: 1, last: 200, columns: 20 },
  { id: 'four-hundred', name: 'Four hundred', first: 1, last: 400, columns: 20 },
  { id: 'thousand', name: 'Past a thousand', first: 1000, last: 1199, columns: 20 },
  { id: 'ten-thousand', name: 'Far field', first: 10_000, last: 10_199, columns: 20 },
];

export type SpellDirection = 'spell' | 'read';

export interface SpellLevel {
  readonly id: string;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  /** Digits after the point, for the fraction rung. */
  readonly decimals?: readonly [number, number];
  readonly count: number;
}

export const SPELL_LEVELS: readonly SpellLevel[] = [
  { id: 'to-99', name: 'Up to ninety-nine', min: 11, max: 99, count: 5 },
  { id: 'thousands', name: 'Hundreds and thousands', min: 100, max: 9999, count: 5 },
  { id: 'six-figures', name: 'Six figures', min: 10_000, max: 999_999, count: 5 },
  { id: 'millions', name: 'Millions', min: 1_000_000, max: 999_999_999, count: 5 },
  { id: 'fractions', name: 'Fractions', min: 0, max: 99, decimals: [1, 3], count: 5 },
];

export interface SpellItem {
  readonly numeral: string;
  readonly direction: SpellDirection;
}

export function spellNumeral(level: SpellLevel, rng: Rng): string {
  const whole = rng.int(level.min, level.max);
  if (!level.decimals) return String(whole);
  const places = rng.int(level.decimals[0], level.decimals[1]);
  let digits = '';
  for (let i = 0; i < places - 1; i++) digits += String(rng.int(0, 9));
  digits += String(rng.int(1, 9));
  return `${whole}.${digits}`;
}

/** Five numbers, spelt and read in turn, starting with spelling. */
export function spellItems(level: SpellLevel, rng: Rng): SpellItem[] {
  const items: SpellItem[] = [];
  while (items.length < level.count) {
    const numeral = spellNumeral(level, rng);
    if (items.some((item) => item.numeral === numeral)) continue;
    items.push({ numeral, direction: items.length % 2 === 0 ? 'spell' : 'read' });
  }
  return items;
}
