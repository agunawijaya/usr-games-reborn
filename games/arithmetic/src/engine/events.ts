import {
  DAILY_SPLIT,
  DAILY_SUMS,
  type ModeId,
  SIEVE_LEVELS,
  type SieveLevel,
  SPELL_LEVELS,
  type SpellLevel,
  SPLIT_LEVELS,
  type SplitLevel,
  SUMS_LEVELS,
  type SumsLevel,
} from './levels';
import { parChoices } from './sieve-board';
import type { Tempo } from './sums';

/**
 * An event is one mode played once at one rung: a block of sums, a handful of splits, one sieve
 * board or a few numbers in words. Chapters and the Daily are lists of events; every event ends
 * in an EventResult that the stars, the score and the share line are made from.
 */

export type EventSpec =
  | { readonly mode: 'sums'; readonly level: string }
  | { readonly mode: 'split'; readonly level: string; readonly count?: number }
  | { readonly mode: 'sieve'; readonly level: string }
  | { readonly mode: 'spell'; readonly level: string; readonly count?: number };

function find<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`unknown level ${id}`);
  return found;
}

export const sumsLevel = (id: string): SumsLevel => find([...SUMS_LEVELS, DAILY_SUMS], id);
export const splitLevel = (id: string): SplitLevel => find([...SPLIT_LEVELS, DAILY_SPLIT], id);
export const sieveLevel = (id: string): SieveLevel => find(SIEVE_LEVELS, id);
export const spellLevel = (id: string): SpellLevel => find(SPELL_LEVELS, id);

export function eventCount(spec: EventSpec): number {
  switch (spec.mode) {
    case 'sums':
      return 20;
    case 'split':
      return spec.count ?? splitLevel(spec.level).count;
    case 'sieve':
      return 1;
    case 'spell':
      return spec.count ?? spellLevel(spec.level).count;
  }
}

export function eventName(spec: EventSpec): string {
  switch (spec.mode) {
    case 'sums':
      return sumsLevel(spec.level).name;
    case 'split':
      return splitLevel(spec.level).name;
    case 'sieve':
      return sieveLevel(spec.level).name;
    case 'spell':
      return spellLevel(spec.level).name;
  }
}

export const MODE_NAMES: Record<ModeId, string> = {
  sums: 'Quick Sums',
  split: 'Split',
  sieve: 'Sieve',
  spell: 'Spell It',
};

/**
 * Seconds per item at each rung for the speed star: about the median of the steady bot
 * (`scripts/balance.ts rungs`), so a sure, practised player makes par about half the time.
 */
const SUMS_PAR: Record<string, number> = {
  'plus-10': 2.2,
  'minus-10': 2.7,
  'plus-minus-10': 2.5,
  'times-10': 3.8,
  'share-10': 4.6,
  'all-10': 3.3,
  'plus-minus-20': 2.9,
  'times-12': 4,
  remainders: 5.5,
  'all-20': 4.2,
  'big-plus-minus': 4.3,
  'all-25': 4.4,
  'daily-mix': 3.5,
};
const SPLIT_PAR: Record<string, number> = {
  small: 6,
  hundreds: 11,
  thousands: 16.5,
  'six-digits': 29,
  'most-wanted': 43,
  'daily-mix': 9,
};
const SIEVE_PAR: Record<string, number> = {
  hundred: 16,
  'two-hundred': 25,
  'four-hundred': 33,
  thousand: 43,
  'ten-thousand': 70,
};
const SPELL_PAR: Record<string, number> = {
  'to-99': 3.5,
  thousands: 9.5,
  'six-figures': 14,
  millions: 22.5,
  fractions: 10.5,
};

/** Par time for the whole event, in seconds. */
export function eventPar(spec: EventSpec): number {
  const per =
    spec.mode === 'sums'
      ? SUMS_PAR[spec.level]
      : spec.mode === 'split'
        ? SPLIT_PAR[spec.level]
        : spec.mode === 'sieve'
          ? SIEVE_PAR[spec.level]
          : SPELL_PAR[spec.level];
  if (per === undefined) throw new Error(`no par for ${spec.mode} ${spec.level}`);
  return spec.mode === 'sieve' ? per : per * eventCount(spec);
}

export interface EventResult {
  readonly spec: EventSpec;
  readonly tempo: Tempo;
  readonly score: number;
  /** Items finished (problems, numbers, boards, words). */
  readonly items: number;
  /** Items finished with no mistake at all. */
  readonly clean: number;
  /** Correct moves and mistaken ones, for accuracy. */
  readonly rights: number;
  readonly wrongs: number;
  readonly hints: number;
  readonly ms: number;
  /** Sieve only: choices made and par choices. */
  readonly clicks?: number;
  readonly parClicks?: number;
}

export function accuracy(results: readonly EventResult[]): number {
  const rights = results.reduce((sum, r) => sum + r.rights, 0);
  const wrongs = results.reduce((sum, r) => sum + r.wrongs, 0);
  return rights + wrongs === 0 ? 1 : rights / (rights + wrongs);
}

/** Split points for one number: the base less bounces, and in Rush a bonus against par. */
export function splitPoints(bounces: number, ms: number, parSeconds: number, tempo: Tempo): number {
  const base = Math.max(60, 200 - 40 * bounces);
  if (tempo === 'calm') return base;
  const speed = Math.min(1, Math.max(0, (2 * parSeconds * 1000 - ms) / (parSeconds * 1000)));
  return base + Math.round(150 * speed);
}

/** Sieve points: a board, fewer choices than par is not possible, so par choices score full. */
export function sievePoints(
  clicks: number,
  parClicks: number,
  wrongClicks: number,
  ms: number,
  parSeconds: number,
  tempo: Tempo,
): number {
  const economy = clicks === 0 ? 0 : Math.min(1, parClicks / clicks);
  const base = Math.max(100, Math.round(300 + 200 * economy) - 60 * wrongClicks);
  if (tempo === 'calm') return base;
  const speed = Math.min(1, Math.max(0, (2 * parSeconds * 1000 - ms) / (parSeconds * 1000)));
  return base + Math.round(300 * speed);
}

/** Spell points for one number: first time right is worth most; Rush adds speed. */
export function spellPoints(misses: number, ms: number, parSeconds: number, tempo: Tempo): number {
  const base = misses === 0 ? 150 : 60;
  if (tempo === 'calm') return base;
  const speed = Math.min(1, Math.max(0, (2 * parSeconds * 1000 - ms) / (parSeconds * 1000)));
  return base + Math.round(100 * speed);
}

/** How many picks the sieve's par allows: Eratosthenes's own. */
export function parChoicesFor(spec: EventSpec): number {
  return spec.mode === 'sieve' ? parChoices(sieveLevel(spec.level)).length : 0;
}
