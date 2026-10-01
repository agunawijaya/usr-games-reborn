import { definePackages, type PackageDefinition } from '../achievements/packages';
import { CATEGORIES } from '../manifest/manifest';
import type { ProgressionState } from './state';

/**
 * The collection-wide packages the Hall itself ships. Titles carry the Machine Room's Unix
 * flavour; `plain` gives the same package in plain words for Console Home and Holo Collection.
 */
export const HALL_PACKAGES: readonly PackageDefinition[] = definePackages('hall', [
  {
    id: 'hello-world',
    title: 'hello, world',
    description: 'Log in to the machine for the first time.',
    tier: 'core',
    plain: { title: 'hello, world', description: 'Sign in for the first time.' },
  },
  {
    id: 'first-process',
    title: 'First process',
    description: 'Finish a session of any game.',
    tier: 'core',
    xp: 50,
    plain: { title: 'First game', description: 'Finish a game of anything.' },
  },
  {
    id: 'read-the-manual',
    title: 'Read the manual',
    description: 'Open five different man pages.',
    tier: 'core',
    plain: { title: 'Curious mind', description: 'Open the page of five different games.' },
  },
  {
    id: 'daily-driver',
    title: 'Daily driver',
    description: 'Finish a daily challenge.',
    tier: 'core',
    xp: 40,
  },
  {
    id: 'first-cron-job',
    title: 'First cron job',
    description: 'Finish one of the weekly cron jobs.',
    tier: 'core',
    xp: 50,
    plain: { title: 'First quest', description: 'Finish one of the weekly quests.' },
  },
  {
    id: 'window-shopping',
    title: 'Window shopping',
    description: 'See the Hall in all three styles.',
    tier: 'core',
    plain: { title: 'Window shopping', description: 'Try the Hall in all three styles.' },
  },
  {
    id: 'ten-processes',
    title: 'Ten processes',
    description: 'Finish sessions in ten different games.',
    tier: 'extra',
    xp: 100,
    plain: { title: 'Ten games', description: 'Finish a game in ten different titles.' },
  },
  {
    id: 'seven-days-up',
    title: 'Seven days up',
    description: 'Keep your uptime going for seven days.',
    tier: 'extra',
    xp: 100,
    plain: { title: 'Seven-day streak', description: 'Play on seven days in a row.' },
  },
  {
    id: 'clean-crontab',
    title: 'Clean crontab',
    description: 'Finish all three cron jobs in one week.',
    tier: 'extra',
    xp: 120,
    plain: { title: 'Clean sweep', description: 'Finish all three weekly quests in one week.' },
  },
  {
    id: 'ls-usr-games',
    title: 'ls -R /usr/games',
    description: 'Finish a session in every directory of /usr/games.',
    tier: 'rare',
    xp: 200,
    plain: { title: 'Explorer', description: 'Finish a game in every category.' },
  },
]);

export const MAN_PAGES_FOR_PACKAGE = 5;
export const GAMES_FOR_TEN_PROCESSES = 10;
export const STREAK_FOR_PACKAGE = 7;

function playedGames(state: ProgressionState): string[] {
  return Object.entries(state.games)
    .filter(([, stats]) => stats.completed > 0)
    .map(([id]) => id);
}

/** Whether each Hall package's condition holds; the engine installs the new ones. */
export function hallPackageConditions(state: ProgressionState): Record<string, boolean> {
  const played = playedGames(state);
  const categories = new Set(played.map((id) => state.games[id]?.category));
  return {
    'hello-world': state.hall.loggedIn,
    'first-process': played.length >= 1,
    'read-the-manual': state.hall.manPagesRead.length >= MAN_PAGES_FOR_PACKAGE,
    'daily-driver': Object.values(state.games).some((stats) => stats.dailies > 0),
    'first-cron-job': state.cron.completedTotal >= 1,
    'window-shopping': state.hall.stylesSeen.length >= 3,
    'ten-processes': played.length >= GAMES_FOR_TEN_PROCESSES,
    'seven-days-up': state.streak.best >= STREAK_FOR_PACKAGE,
    'clean-crontab': state.cron.fullWeeks >= 1,
    'ls-usr-games': CATEGORIES.every((category) => categories.has(category)),
  };
}
