import { definePackages, type PackageDefinition } from '@usr-games/kit';
import manifest from '../../manifest.json';
import type { Game } from '../engine/game';

/** Thirteen Down's packages (achievements) and when a finished deal earns each. */

export const PACKAGES: readonly PackageDefinition[] = definePackages(
  'canfield',
  manifest.packages as PackageDefinition[],
);

export interface DealFacts {
  game: Game;
  won: boolean;
  elapsedMs: number;
  /** After this deal is counted. */
  totalWins: number;
  winRun: number;
  dailies: number;
  challengesDone: number;
  /** Bank: the sitting's net after this deal; null in Points. */
  sittingNet: number | null;
}

/** Earned the moment it happens, mid-deal: the reserve emptied before the first turn-over. */
export function reserveCleared(game: Game): boolean {
  return game.reserveClearedInRun === 1;
}

export function packagesForDeal(facts: DealFacts): string[] {
  const { game, won } = facts;
  const earned: string[] = [];
  const add = (id: string, when: boolean) => when && earned.push(id);
  add('first-bloom', won);
  add('reserve-cleared', reserveCleared(game));
  add('no-peeking', won && !game.insightUsed);
  add('speed-bloom', won && facts.elapsedMs < 3 * 60_000);
  add('full-ledger', won && game.counters.undos === 0);
  add('lucky-seven', won && game.layout.baseRank === 7);
  add('one-pass', won && game.rules === 'standard' && game.layout.run === 1);
  add('ten-wins', facts.totalWins >= 10);
  add('streak-5', facts.winRun >= 5);
  add('daily-regular', facts.dailies >= 7);
  add('challenge-12', facts.challengesDone >= 12);
  add('in-the-black', facts.sittingNet !== null && facts.sittingNet > 0);
  return earned;
}
