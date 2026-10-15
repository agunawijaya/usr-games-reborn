import { definePackages } from '@usr-games/kit';
import type { HandRecord } from '../engine/match';
import type { Level } from '../ai/players';

/**
 * Detour's twelve packages. Descriptions invite; none demands. They are checked when a hand is
 * scored and when a game ends.
 */
export const PACKAGES = definePackages('mille', [
  {
    id: 'first-coup',
    title: 'Counter-thrust',
    description: 'Parry a hazard the moment it lands: your first coup fourré.',
    tier: 'core',
  },
  {
    id: 'safe-trip',
    title: 'Safe trip',
    description: 'Win a hand without a single 200.',
    tier: 'core',
  },
  {
    id: 'shut-out',
    title: 'Left at the lights',
    description: 'Finish the trip before your rival has moved a mile.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily driver',
    description: 'Drive the Daily Road on seven different days.',
    tier: 'core',
  },
  {
    id: 'all-four-safeties',
    title: 'Fully covered',
    description: 'Lay all four safeties in one hand.',
    tier: 'extra',
  },
  {
    id: 'extension',
    title: 'The long way',
    description: 'Extend a trip to 1000 and finish it.',
    tier: 'extra',
  },
  {
    id: 'delayed-action',
    title: 'Last of the deck',
    description: 'Finish the trip after the deck has run out.',
    tier: 'extra',
  },
  {
    id: 'team-player',
    title: 'Co-driver',
    description: 'Win a team game with your partner.',
    tier: 'extra',
  },
  {
    id: 'double-coup',
    title: 'Twice parried',
    description: 'Two coups fourrés in a single hand.',
    tier: 'extra',
  },
  {
    id: 'full-game',
    title: 'Five thousand',
    description: 'Win a full game to 5000.',
    tier: 'extra',
  },
  {
    id: 'beat-sly',
    title: 'Outfoxed',
    description: 'Beat Sly in a game to 2500 or 5000.',
    tier: 'rare',
  },
  {
    id: 'world-tour',
    title: 'World tour',
    description: 'Drive every route in the journal.',
    tier: 'rare',
  },
]);

/** Packages a scored hand earns the player's side. */
export function packagesForHand(record: HandRecord, mySide: 0 | 1): string[] {
  const mine = record.scores[mySide];
  const won = mine.total > record.scores[mySide === 0 ? 1 : 0].total;
  const ids: string[] = [];
  if (mine.coups > 0) ids.push('first-coup');
  if (mine.coups >= 600) ids.push('double-coup');
  if (mine.allSafeties > 0) ids.push('all-four-safeties');
  if (mine.trip > 0 && won && mine.safeTrip > 0) ids.push('safe-trip');
  if (mine.shutOut > 0) ids.push('shut-out');
  if (mine.extension > 0) ids.push('extension');
  if (mine.delayedAction > 0) ids.push('delayed-action');
  return ids;
}

export interface GameFacts {
  won: boolean;
  teams: boolean;
  length: 'single' | 'short' | 'full';
  rival: Level;
  routesDriven: number;
  routesTotal: number;
  dailiesPlayed: number;
}

/** Packages for the end of a game. */
export function packagesForGame(facts: GameFacts): string[] {
  const ids: string[] = [];
  if (facts.won && facts.teams) ids.push('team-player');
  if (facts.won && facts.length === 'full') ids.push('full-game');
  if (facts.won && facts.rival === 'sly' && facts.length !== 'single') ids.push('beat-sly');
  if (facts.routesDriven >= facts.routesTotal) ids.push('world-tour');
  if (facts.dailiesPlayed >= 7) ids.push('daily-regular');
  return ids;
}
