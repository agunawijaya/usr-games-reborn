import { definePackages } from '@usr-games/kit';
import { boardsWon, scenariosWon, type Career, type GameSummary } from './career';

/**
 * Deeds & Dice's twelve packages. The descriptions invite, never demand; each is checked when a
 * game ends, against that game's ledger and the career it leaves behind.
 */
export const PACKAGES = definePackages('monop', [
  {
    id: 'first-deed',
    title: 'Keys in hand',
    description: 'Buy your first deed.',
    tier: 'core',
  },
  {
    id: 'full-set',
    title: 'The whole street',
    description: 'Hold every lot of a district.',
    tier: 'core',
  },
  {
    id: 'skyline',
    title: 'On the skyline',
    description: 'Raise a landmark.',
    tier: 'core',
  },
  {
    id: 'deal-maker',
    title: 'Shake on it',
    description: 'Make three trades in one game.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Regular at the table',
    description: 'Play the Daily Deal on seven different days.',
    tier: 'core',
  },
  {
    id: 'never-jailed',
    title: 'Clean record',
    description: 'Win a Quick or Classic game without once being locked up.',
    tier: 'extra',
  },
  {
    id: 'transit-baron',
    title: 'All lines lead home',
    description: 'Own all four transit stops at once.',
    tier: 'extra',
  },
  {
    id: 'comeback',
    title: 'Back from the brink',
    description: 'Fall into debt, climb out of it, and win.',
    tier: 'extra',
  },
  {
    id: 'auctioneer',
    title: 'Going, going, mine',
    description: 'Win a lot at auction for less than its price.',
    tier: 'extra',
  },
  {
    id: 'berkeley-rules',
    title: 'Berkeley, 1980',
    description: 'Win a game under the Berkeley 1980 rules, where the bank lends to anyone.',
    tier: 'extra',
  },
  {
    id: 'scenario-12',
    title: 'Puzzle box',
    description: 'Win twelve different scenarios.',
    tier: 'rare',
  },
  {
    id: 'all-boards',
    title: 'Three towns',
    description: 'Win on Harbour City, Ring Colony and Pop-up 1904.',
    tier: 'rare',
  },
]);

/** Packages a finished game earns, given the career it leaves behind. */
export function packagesFor(game: GameSummary, career: Career): string[] {
  const { ledger, won } = game;
  const fullGame = game.kind === 'quick' || game.kind === 'classic';
  const ids: string[] = [];
  if (ledger.deedsBought > 0) ids.push('first-deed');
  if (ledger.districts.length > 0) ids.push('full-set');
  if (ledger.landmarks > 0) ids.push('skyline');
  if (ledger.trades >= 3) ids.push('deal-maker');
  if (Object.keys(career.dailies).length >= 7) ids.push('daily-regular');
  if (won && fullGame && !ledger.lockedUp) ids.push('never-jailed');
  if (ledger.mostTransits >= 4) ids.push('transit-baron');
  if (won && ledger.wasInDebt) ids.push('comeback');
  if (ledger.bargains > 0) ids.push('auctioneer');
  if (won && game.preset === 'berkeley') ids.push('berkeley-rules');
  if (scenariosWon(career) >= 12) ids.push('scenario-12');
  if (boardsWon(career) >= 3) ids.push('all-boards');
  return ids;
}
