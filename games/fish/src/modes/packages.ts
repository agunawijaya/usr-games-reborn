import { definePackages } from '@usr-games/kit';
import type { RivalId } from './match';
import type { MatchSetup } from './match';

/**
 * Gone Fishing's packages: twelve from the brief and a thirteenth for the Tournament cup. Some
 * arrive the moment they happen (a first book, a golden fish); the rest are judged when a game
 * ends. Descriptions invite, never demand.
 */

export const PACKAGES = definePackages('fish', [
  {
    id: 'first-book',
    title: 'First fish',
    description: 'Make a book of four and watch it leap into your bucket.',
    tier: 'core',
  },
  {
    id: 'beat-otto',
    title: 'Outfoxed an otter',
    description: 'Win a game with Otto at the pond.',
    tier: 'core',
  },
  {
    id: 'lucky-cast',
    title: 'Lucky line',
    description: 'Fish up the very rank you asked for three times in one game.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Morning regular',
    description: 'Fish the Daily Pond on seven different days.',
    tier: 'core',
  },
  {
    id: 'three-books-one-turn',
    title: 'Hat trick',
    description: 'Make three books in a single turn.',
    tier: 'extra',
  },
  {
    id: 'beat-hazel',
    title: 'Sharper than a monocle',
    description: 'Win a game with Hazel at the pond.',
    tier: 'extra',
  },
  {
    id: 'no-notebook-win',
    title: 'From memory',
    description: 'Win a game with the notebook closed the whole way through.',
    tier: 'extra',
  },
  {
    id: 'full-house',
    title: 'Every book made',
    description: 'Win a game of All 13 books.',
    tier: 'extra',
  },
  {
    id: 'classic-1993',
    title: 'Berkeley, 1993',
    description: 'Win a game of Classic 1993, the original rules.',
    tier: 'extra',
  },
  {
    id: 'golden-catch',
    title: 'Golden catch',
    description: 'Make a book that turns into a golden fish.',
    tier: 'extra',
  },
  {
    id: 'beat-miso',
    title: 'Cat’s whiskers',
    description: 'Win a game with Miso at the pond.',
    tier: 'rare',
  },
  {
    id: 'tournament-cup',
    title: 'Cup of the pond',
    description: 'Win three rounds of a Tournament.',
    tier: 'rare',
  },
  {
    id: 'rare-taunt',
    title: 'Once in a thousand',
    description: 'Hear the rare parting line the original kept for one game in 1024.',
    tier: 'rare',
    hidden: true,
  },
]);

export interface GameSummary {
  setup: MatchSetup;
  outcome: 'win' | 'draw' | 'loss';
  /** Your books, in the order made. */
  books: readonly { rank: number; golden: boolean }[];
  luckyCasts: number;
  mostBooksInATurn: number;
  /** True if the notebook was open at any moment of the game. */
  notebookUsed: boolean;
  taunt: boolean;
}

export interface PackageHistory {
  dailyDays: number;
  tournamentWon: boolean;
}

const BEAT: Readonly<Record<RivalId, string>> = {
  otto: 'beat-otto',
  hazel: 'beat-hazel',
  miso: 'beat-miso',
};

/** Every package this finished game earns (installing an earned one again does nothing). */
export function packagesForGame(summary: GameSummary, history: PackageHistory): string[] {
  const earned: string[] = [];
  const won = summary.outcome === 'win';
  if (summary.books.length > 0) earned.push('first-book');
  if (summary.books.some((book) => book.golden)) earned.push('golden-catch');
  if (summary.mostBooksInATurn >= 3) earned.push('three-books-one-turn');
  if (summary.luckyCasts >= 3) earned.push('lucky-cast');
  if (won) {
    for (const rival of summary.setup.rivals) earned.push(BEAT[rival]);
    if (!summary.notebookUsed) earned.push('no-notebook-win');
    if (summary.setup.rules === 'all-books') earned.push('full-house');
    if (summary.setup.rules === 'classic') earned.push('classic-1993');
  }
  if (summary.taunt) earned.push('rare-taunt');
  if (history.dailyDays >= 7) earned.push('daily-regular');
  if (history.tournamentWon) earned.push('tournament-cup');
  return earned;
}

/**
 * Milestones inside a game, for XP. The Hall clamps each to 25 and a game's to 30, so these
 * reward a good game a little and a great one a little more.
 */
export function xpEventsFor(summary: GameSummary): { id: string; xp: number }[] {
  const events: { id: string; xp: number }[] = [];
  if (summary.books.length > 0)
    events.push({ id: 'books', xp: Math.min(12, summary.books.length * 2) });
  if (summary.outcome === 'win') events.push({ id: 'win', xp: 10 });
  if (summary.outcome === 'win' && !summary.notebookUsed) events.push({ id: 'from-memory', xp: 8 });
  if (summary.books.some((book) => book.golden)) events.push({ id: 'golden', xp: 5 });
  return events;
}
