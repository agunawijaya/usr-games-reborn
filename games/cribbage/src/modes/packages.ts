import { definePackages } from '@usr-games/kit';
import type { Level } from '../engine/ai/minds';
import type { CountingMode, GameLength, Skunk } from '../engine/match';

/**
 * Fifteen-Two's twelve packages. The ones that happen at a moment (thirty-one, his heels, a big
 * hand, the perfect hand) arrive the moment they happen; the rest are judged when a game,
 * a trainer round or a Daily Discard ends. Descriptions invite, never demand.
 */

export const PACKAGES = definePackages('cribbage', [
  {
    id: 'thirty-one',
    title: 'Thirty-one for two',
    description: 'Lay the card that brings the count to exactly 31.',
    tier: 'core',
  },
  {
    id: 'his-heels',
    title: 'His heels',
    description: 'Deal, and turn up a jack as the starter: two pegs before anyone plays.',
    tier: 'core',
  },
  {
    id: 'twenty-plus',
    title: 'Twenty and up',
    description: 'Count a hand or a crib worth 20 points or more.',
    tier: 'core',
  },
  {
    id: 'long-game',
    title: 'Twice around',
    description: 'Win a game to 121.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily dealer',
    description: 'Lay away in the Daily Discard on seven different days.',
    tier: 'core',
  },
  {
    id: 'twenty-four-plus',
    title: 'Two dozen',
    description: 'Count a hand or a crib worth 24 points or more.',
    tier: 'extra',
  },
  {
    id: 'skunk',
    title: 'Skunked',
    description: 'Win while your opponent is still behind the skunk line.',
    tier: 'extra',
  },
  {
    id: 'perfect-counter',
    title: 'Counted true',
    description:
      'Count every one of your hands exactly right through a whole game of Classic 1980.',
    tier: 'extra',
  },
  {
    id: 'trainer-50',
    title: 'Quick sums',
    description: 'Count fifty hands right in the counting trainer.',
    tier: 'extra',
  },
  {
    id: 'double-skunk',
    title: 'Double skunk',
    description: 'Win a game to 121 before your opponent has gone once around the board.',
    tier: 'rare',
  },
  {
    id: 'beat-sharp',
    title: 'Sharper still',
    description: 'Win a game against Sharp.',
    tier: 'rare',
  },
  {
    id: 'perfect-29',
    title: 'Twenty-nine',
    description: 'Hold the perfect hand: three fives and the jack, the last five cut to match.',
    tier: 'rare',
  },
]);

/** What a finished game leaves behind, for packages, XP, records and the results card. */
export interface GameSummary {
  level: Level;
  length: GameLength;
  counting: CountingMode;
  outcome: 'win' | 'loss';
  skunk: Skunk;
  scores: [number, number];
  hands: number;
  thirtyOnes: number;
  hisHeels: number;
  /** Your best hand or crib this game. */
  bestCount: number;
  /** Your claims this game (Count yourself and Classic 1980), and how many were exactly right. */
  claims: number;
  rightClaims: number;
  pegged: number;
  shown: number;
}

/** Packages earned the moment something happens at the table. */
export function packagesForMoment(moment: {
  thirtyOne?: boolean;
  hisHeels?: boolean;
  handTotal?: number;
}): string[] {
  const earned: string[] = [];
  if (moment.thirtyOne) earned.push('thirty-one');
  if (moment.hisHeels) earned.push('his-heels');
  if (moment.handTotal !== undefined) {
    if (moment.handTotal >= 20) earned.push('twenty-plus');
    if (moment.handTotal >= 24) earned.push('twenty-four-plus');
    if (moment.handTotal === 29) earned.push('perfect-29');
  }
  return earned;
}

export function packagesForGame(summary: GameSummary): string[] {
  const earned: string[] = [];
  if (summary.thirtyOnes > 0) earned.push('thirty-one');
  if (summary.hisHeels > 0) earned.push('his-heels');
  earned.push(...packagesForMoment({ handTotal: summary.bestCount }));
  if (summary.outcome === 'win') {
    if (summary.length === 121) earned.push('long-game');
    if (summary.level === 'sharp') earned.push('beat-sharp');
    if (summary.skunk !== 'none') earned.push('skunk');
    if (summary.skunk === 'double-skunk' && summary.length === 121) earned.push('double-skunk');
  }
  if (
    summary.counting === 'classic-1980' &&
    summary.claims > 0 &&
    summary.rightClaims === summary.claims &&
    summary.hands >= 3
  ) {
    earned.push('perfect-counter');
  }
  return earned;
}

/**
 * Milestones inside a game, for XP. The Hall clamps each to 25 and a game's to 30, so a good
 * game earns a little more and a great one a little more again.
 */
export function xpEventsFor(summary: GameSummary): { id: string; xp: number }[] {
  const events: { id: string; xp: number }[] = [];
  if (summary.outcome === 'win') events.push({ id: 'win', xp: summary.level === 'sharp' ? 12 : 8 });
  if (summary.outcome === 'win' && summary.skunk !== 'none') events.push({ id: 'skunk', xp: 6 });
  if (summary.thirtyOnes > 0)
    events.push({ id: 'thirty-one', xp: Math.min(6, summary.thirtyOnes * 2) });
  if (summary.bestCount >= 20)
    events.push({ id: 'big-hand', xp: summary.bestCount === 29 ? 25 : 6 });
  if (summary.claims > 0 && summary.rightClaims === summary.claims) {
    events.push({ id: 'counted-true', xp: summary.counting === 'classic-1980' ? 8 : 4 });
  }
  return events;
}
