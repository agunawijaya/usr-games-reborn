import { createRng } from '@usr-games/kit';
import { buildEncounter, type Encounter } from './encounters';
import type { ChapterOutcome } from './life';
import type { EncounterKind, Quality } from './types';

/**
 * Today's Weather: one encounter a day, the same for every captain, sailed in the station
 * frigate with a crack crew. And Open Water: any encounter, any crew, any seed, for practice.
 */

export const DAILY_SHIP = 'Lodestar';
export const DAILY_KINDS: readonly EncounterKind[] = [
  'duel',
  'chase',
  'pair',
  'convoy',
  'storm',
  'night',
];

export function dailyEncounter(daySeed: string): Encounter {
  const rng = createRng(`figurehead:daily:${daySeed}`);
  const kind = rng.pick(DAILY_KINDS);
  return buildEncounter(kind, `daily:${daySeed}`, {
    flagship: { name: DAILY_SHIP, qual: 4, refits: [], away: 0 },
    squadron: [],
    pressure: 1,
  });
}

/**
 * The day's rating: a win, each mention, every prize by her worth and condition, and the turns
 * to spare when she wins early. Prizes count as brought home: the day ends at the battle.
 */
export function dailyRating(outcome: ChapterOutcome): number {
  const won = outcome.win === true;
  const mentions = outcome.mentions.filter((m) => m.earned).length;
  const prizes = outcome.prizes.reduce((sum, p) => sum + p.value, 0);
  const spare = won ? Math.max(0, outcome.encounter.setup.maxTurns - outcome.turns) : 0;
  return (won ? 1000 : 0) + mentions * 250 + prizes * 10 + spare * 10;
}

export const PRACTICE_KINDS: readonly EncounterKind[] = [
  'duel',
  'chase',
  'convoy',
  'pair',
  'storm',
  'night',
  'squadron',
  'line',
  'fleet',
  'passage',
];

export interface Practice {
  kind: EncounterKind;
  pressure: number;
  qual: Quality;
  code: string;
}

/** Codes are typed by people: case, spaces and punctuation should not change the sea. */
export function normaliseCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export function practiceEncounter(p: Practice): Encounter {
  return buildEncounter(p.kind, `open:${p.kind}:${p.pressure}:${normaliseCode(p.code) || 'open'}`, {
    flagship: { name: 'Lodestar', qual: p.qual, refits: [], away: 0 },
    squadron: [],
    pressure: p.pressure,
  });
}
