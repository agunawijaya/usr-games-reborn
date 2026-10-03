import { definePackages } from '@usr-games/kit';
import type { OpponentId } from '../engine/opponents';

/**
 * Fivefold's twelve packages (the collection's achievements). Descriptions invite, never demand.
 * The same list is in manifest.json; a test keeps the two in step.
 */
export const PACKAGES = definePackages('gomoku', [
  {
    id: 'first-five',
    title: 'First five',
    description: 'Make five in a row against any opponent.',
    tier: 'core',
  },
  {
    id: 'white-win',
    title: 'Second to move',
    description: 'Win a game moving second.',
    tier: 'core',
  },
  {
    id: 'league-fan',
    title: 'Ringside',
    description: 'Watch a whole Bot League match to the end.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Solve seven Daily Puzzles.',
    tier: 'core',
  },
  {
    id: 'beat-each-opponent',
    title: 'Every rung',
    description: 'Beat Pebble, Reed, Heron, Koi and Campbell, each at least once.',
    tier: 'extra',
  },
  {
    id: 'beat-campbell',
    title: 'The 1994 mind',
    description: 'Beat Campbell, the full Berkeley search.',
    tier: 'extra',
  },
  {
    id: 'exactly-five-win',
    title: 'Exactly five',
    description: 'Win a game under Exactly five, where six in a row counts for nothing.',
    tier: 'extra',
  },
  {
    id: 'four-four',
    title: 'Four-four',
    description: 'Make two fours with a single stone.',
    tier: 'extra',
  },
  {
    id: 'fast-five',
    title: 'Quick five',
    description: 'Win in fewer than fifteen of your own moves.',
    tier: 'extra',
  },
  {
    id: 'referee-slayer',
    title: 'Out-read the Referee',
    description: 'Beat the Referee, who reads every threat.',
    tier: 'rare',
  },
  {
    id: 'puzzle-50',
    title: 'Fifty solved',
    description: 'Solve fifty of the puzzles.',
    tier: 'rare',
  },
  {
    id: 'no-overlay-win',
    title: 'Bare eyes',
    description: 'Beat Campbell with Read the board off the whole game.',
    tier: 'rare',
  },
]);

/** What happened in a finished game against an opponent (or a friend at the same device). */
export interface GameFacts {
  /** The opponent, or null for two players at one device. */
  opponent: OpponentId | null;
  won: boolean;
  /** You moved second. */
  second: boolean;
  rules: 'freestyle' | 'exact';
  /** Your own moves, the winning one included. */
  yourMoves: number;
  /** Read the board was on at any moment of the game. */
  readTheBoard: boolean;
  /** You made two fours with one stone at some point. */
  fourFour: boolean;
  /** Opponents beaten at least once, this game included. */
  beaten: readonly OpponentId[];
}

const LADDER: readonly OpponentId[] = ['pebble', 'reed', 'heron', 'koi', 'campbell'];

export function packagesForGame(facts: GameFacts): string[] {
  const ids: string[] = [];
  if (facts.fourFour) ids.push('four-four');
  if (!facts.won || facts.opponent === null) return ids;
  ids.push('first-five');
  if (facts.second) ids.push('white-win');
  if (facts.rules === 'exact') ids.push('exactly-five-win');
  if (facts.yourMoves < 15) ids.push('fast-five');
  if (facts.opponent === 'campbell') {
    ids.push('beat-campbell');
    if (!facts.readTheBoard) ids.push('no-overlay-win');
  }
  if (facts.opponent === 'referee') ids.push('referee-slayer');
  if (LADDER.every((id) => facts.beaten.includes(id))) ids.push('beat-each-opponent');
  return ids;
}

export function packagesForPuzzles(solved: number, dailies: number): string[] {
  const ids: string[] = [];
  if (solved >= 50) ids.push('puzzle-50');
  if (dailies >= 7) ids.push('daily-regular');
  return ids;
}
