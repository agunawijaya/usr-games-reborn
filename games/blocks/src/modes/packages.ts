import { definePackages } from '@usr-games/kit';
import type { Burst, Game } from '../engine/game';

/**
 * Sinkers' twelve packages (the collection's achievements). Descriptions invite, never demand.
 * The same list is in manifest.json; a test keeps the two in step.
 */
export const PACKAGES = definePackages('blocks', [
  {
    id: 'first-burst',
    title: 'First burst',
    description: 'Fill a row from wall to wall and watch it burst.',
    tier: 'core',
  },
  {
    id: 'four-row-burst',
    title: 'Four at once',
    description: 'Burst four rows with a single sinker.',
    tier: 'core',
  },
  {
    id: 'plunge-100',
    title: 'Hundred-row plunge',
    description: 'Plunge a hundred rows in all, in one run.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Dive seven Daily Dives.',
    tier: 'core',
  },
  {
    id: 'depth-combo-5',
    title: 'Five deep',
    description: 'Cash in a depth combo of five or more with a burst.',
    tier: 'extra',
  },
  {
    id: 'bubble-chain',
    title: 'Bubble chain',
    description: 'Burst rows with three sinkers in a row.',
    tier: 'extra',
  },
  {
    id: 'steady-hands',
    title: 'Steady hands',
    description: 'Win a dive without using the sink key once.',
    tier: 'extra',
  },
  {
    id: 'seaweed-gardener',
    title: 'Seaweed gardener',
    description: 'Clear every strand of seaweed from Kelp Forest.',
    tier: 'extra',
  },
  {
    id: 'night-diver',
    title: 'Night diver',
    description: 'Win the Night Dive by your sinkers’ own light.',
    tier: 'extra',
  },
  {
    id: 'counter-clockwise',
    title: 'Counter-clockwise',
    description: 'Earn three stars in a dive turning only to the left, as in 1992.',
    tier: 'rare',
  },
  {
    id: 'obfuscated',
    title: 'Obfuscated',
    description: 'Clear ten rows of Classic 1992 started at level 5 or higher.',
    tier: 'rare',
  },
  {
    id: 'champion',
    title: 'Champion of the tank',
    description: 'Set a Marathon record from every starting level, 1 to 9.',
    tier: 'rare',
  },
]);

/** Packages a single burst earns, the moment it happens. */
export function packagesForBurst(burst: Burst, game: Game): string[] {
  const ids = ['first-burst'];
  if (burst.rows.length >= 4) ids.push('four-row-burst');
  if (burst.combo >= 5) ids.push('depth-combo-5');
  if (game.burstChain >= 3) ids.push('bubble-chain');
  return ids;
}

/** Packages earned during play that are not about one burst. */
export function packagesForPlay(game: Game): string[] {
  return game.rowsPlunged >= 100 && game.rules === 'standard' ? ['plunge-100'] : [];
}

export interface Finish {
  game: Game;
  /** The dive played, and how it went; null outside the dives. */
  dive: { id: string; won: boolean; stars: number; seaweedLeft: number } | null;
  classicLevel: number | null;
  marathonLevelsWithRecords: number;
  dailiesPlayed: number;
}

/** Packages earned by how a run ended. */
export function packagesAtTheEnd(finish: Finish): string[] {
  const ids: string[] = [];
  const { game, dive } = finish;
  if (finish.dailiesPlayed >= 7) ids.push('daily-regular');
  if (finish.marathonLevelsWithRecords >= 9) ids.push('champion');
  if (finish.classicLevel !== null && finish.classicLevel >= 5 && game.rowsCleared >= 10)
    ids.push('obfuscated');
  if (dive?.won) {
    if (game.sinks === 0) ids.push('steady-hands');
    if (dive.id === 'night-dive') ids.push('night-diver');
    if (dive.stars === 3 && game.turnsRight === 0) ids.push('counter-clockwise');
  }
  if (dive?.id === 'kelp-forest' && dive.seaweedLeft === 0) ids.push('seaweed-gardener');
  return ids;
}
