import { createRng } from '@usr-games/kit';
import { choosePlacement, playSteps } from '../engine/bot';
import { createGame, type Game } from '../engine/game';
import { KINDS } from '../engine/forms';
import { TANK_HEIGHT, TANK_WIDTH } from '../dives/dives';

/**
 * The Daily Dive: the same hundred sinkers, in the same order, for everyone on the day, made from
 * the kit's daily seed, in a plain tank at level 3. The house diver plays the day first; its score
 * is the day's par, and a dive earns a bubble for half of par, two for three quarters, three for
 * reaching it. Only the first dive of the day counts.
 */

export const DAILY_SINKERS = 100;
export const DAILY_LEVEL = 3;

const FIRST = [
  'Lantern',
  'Pearl',
  'Kelp',
  'Glass',
  'Moon',
  'Amber',
  'Coral',
  'Silver',
  'Tide',
  'Opal',
];
const SECOND = ['Reef', 'Shoal', 'Lagoon', 'Grotto', 'Shelf', 'Bay', 'Trench', 'Drift', 'Cove'];

export function dailyName(seed: string): string {
  const random = createRng(`${seed}:name`);
  return `${random.pick(FIRST)} ${random.pick(SECOND)}`;
}

/** The day's sinkers: one more than are played, as the next one is always shown. */
export function dailyPlan(seed: string): number[] {
  const random = createRng(`${seed}:plan`);
  return Array.from({ length: DAILY_SINKERS + 2 }, () => random.int(0, KINDS - 1));
}

export function dailyGame(seed: string): Game {
  return createGame({
    rules: 'standard',
    width: TANK_WIDTH,
    height: TANK_HEIGHT,
    level: DAILY_LEVEL,
    random: createRng(seed),
    plan: dailyPlan(seed),
  });
}

/** The day is done once its hundred sinkers have landed, or the tank is full. */
export function dailyOver(game: Game): boolean {
  return game.over || game.landings >= DAILY_SINKERS;
}

const parCache = new Map<string, number>();

/** The house diver's score on the day: the par the bubbles are measured against. */
export function dailyPar(seed: string): number {
  const cached = parCache.get(seed);
  if (cached !== undefined) return cached;
  const game = dailyGame(seed);
  while (!dailyOver(game)) playSteps(game, choosePlacement(game)!.steps);
  parCache.set(seed, game.points);
  return game.points;
}

export function dailyBubbles(score: number, par: number): number {
  if (score >= par) return 3;
  if (score >= par * 0.75) return 2;
  return score >= par * 0.5 ? 1 : 0;
}

export interface DailyOutcome {
  score: number;
  bestCombo: number;
  rows: number;
  bubbles: number;
}

export function bubbleString(bubbles: number): string {
  return '🫧'.repeat(bubbles) + '○'.repeat(3 - bubbles);
}

/** `Sinkers #42 · 18,240 · deepest combo ×7 · 🫧🫧🫧`, with no link. */
export function dailyShareText(number: number, outcome: DailyOutcome): string {
  const combo = outcome.bestCombo >= 2 ? `deepest combo ×${outcome.bestCombo}` : 'no combo yet';
  return `Sinkers #${number} · ${outcome.score.toLocaleString('en-GB')} · ${combo} · ${bubbleString(outcome.bubbles)}`;
}

/** The day's first sinkers in the order they come: the first one drawn waits as the next. */
export function dailyFirstSinkers(seed: string, count: number): number[] {
  const plan = dailyPlan(seed);
  return [plan[1]!, plan[0]!, ...plan.slice(2)].slice(0, count);
}
