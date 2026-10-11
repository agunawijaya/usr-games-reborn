import { createRng } from '@usr-games/kit';
import type { EventResult, EventSpec } from './events';
import { SIEVE_LEVELS, SPELL_LEVELS } from './levels';

/**
 * The Daily: the same four events for everyone on a given day, in Rush. The sieve board and the
 * words rung turn with the day; the numbers come from the kit's daily seed.
 */

export interface DailyPlan {
  readonly seed: string;
  readonly events: readonly EventSpec[];
}

const DAILY_SIEVES = ['hundred', 'two-hundred', 'four-hundred', 'thousand'];
const DAILY_WORDS = ['thousands', 'six-figures', 'millions', 'fractions'];

export function dailyPlan(seed: string): DailyPlan {
  const rng = createRng(`${seed}:plan`);
  const sieve = DAILY_SIEVES[rng.int(0, DAILY_SIEVES.length - 1)]!;
  const words = DAILY_WORDS[rng.int(0, DAILY_WORDS.length - 1)]!;
  if (!SIEVE_LEVELS.some((l) => l.id === sieve) || !SPELL_LEVELS.some((l) => l.id === words)) {
    throw new Error('daily plan names a missing rung');
  }
  return {
    seed,
    events: [
      { mode: 'sums', level: 'daily-mix' },
      { mode: 'split', level: 'daily-mix', count: 5 },
      { mode: 'sieve', level: sieve },
      { mode: 'spell', level: words, count: 3 },
    ],
  };
}

function clock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One part of the share line for each event that was played. */
export function shareParts(results: readonly EventResult[]): string[] {
  return results.map((result) => {
    switch (result.spec.mode) {
      case 'sums':
        return `Sums ${result.clean}/${result.items}`;
      case 'split':
        return `Split ${result.clean}/${result.items}`;
      case 'sieve':
        return `Sieve ${clock(result.ms)}`;
      case 'spell':
        return result.clean === result.items ? 'Spell ✓' : `Spell ${result.clean}/${result.items}`;
    }
  });
}

/** `Number Sprint #42 · 2,840 · Sums 19/20 · Split 5/5 · Sieve 0:41 · Spell ✓` */
export function shareLine(dailyNumber: number, results: readonly EventResult[]): string {
  const score = results.reduce((sum, r) => sum + r.score, 0);
  return [
    `Number Sprint #${dailyNumber}`,
    score.toLocaleString('en-US'),
    ...shareParts(results),
  ].join(' · ');
}
