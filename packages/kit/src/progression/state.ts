import type { PackageKey } from '../achievements/packages';
import type { DateKey, WeekKey } from '../daily/daily';
import type { Category } from '../manifest/manifest';
import type { StyleId, ThemeId } from '../settings/settings';
import type { CronJob } from './cron';
import type { RankId } from './ranks';
import { emptyStreak, type StreakState } from './streak';

/** Everything progression remembers, stored as one versioned save in the Hall. */
export interface ProgressionState {
  version: 2;
  xp: number;
  /** The highest rank whose celebration the player has seen; drives the rank-up moment. */
  celebratedRank: RankId;
  days: Record<DateKey, DayLog>;
  games: Record<string, GameStats>;
  packages: Record<PackageKey, InstalledPackage>;
  cron: CronState;
  streak: StreakState;
  hall: HallActivity;
}

export interface DayLog {
  /** Play XP earned this day, before packages and cron jobs; feeds the soft ceiling. */
  playXp: number;
  totalXp: number;
  sessions: Record<string, number>;
  wins: string[];
  dailies: string[];
}

export interface GameStats {
  category: Category;
  sessions: number;
  completed: number;
  wins: number;
  losses: number;
  draws: number;
  bestScore: number | null;
  totalSeconds: number;
  dailies: number;
  firstPlayed: DateKey;
  lastPlayed: DateKey;
  counters: Record<string, number>;
}

export interface InstalledPackage {
  installedOn: DateKey;
  xp: number;
}

export interface CronState {
  week: WeekKey | null;
  jobs: CronJob[];
  completedTotal: number;
  fullWeeks: number;
  /** Recent weeks, newest last, for the profile. */
  history: { week: WeekKey; completed: number; total: number }[];
}

export interface HallActivity {
  loggedIn: boolean;
  manPagesRead: string[];
  /** Machine Room palettes seen. */
  themesSeen: ThemeId[];
  /** Hall styles seen, for the window-shopping package. */
  stylesSeen: StyleId[];
}

export const PROGRESSION_VERSION = 2;

/**
 * Version 2 added Hall styles. Saves from before them had only ever seen the Machine Room.
 * Installed packages are permanent, so anyone who already earned window-shopping keeps it.
 */
export const PROGRESSION_MIGRATIONS = {
  2: (previous: unknown) => {
    const state = previous as Omit<ProgressionState, 'version' | 'hall'> & {
      hall: Omit<HallActivity, 'stylesSeen'>;
    };
    return {
      ...state,
      version: 2,
      hall: { ...state.hall, stylesSeen: ['machine-room'] },
    };
  },
};
/** Day logs older than this are pruned; the streak calendar shows at most a year. */
export const DAY_LOG_RETENTION = 400;
export const CRON_HISTORY_WEEKS = 12;

export function emptyProgression(): ProgressionState {
  return {
    version: 2,
    xp: 0,
    celebratedRank: 'guest',
    days: {},
    games: {},
    packages: {},
    cron: { week: null, jobs: [], completedTotal: 0, fullWeeks: 0, history: [] },
    streak: emptyStreak(),
    hall: { loggedIn: false, manPagesRead: [], themesSeen: [], stylesSeen: [] },
  };
}

export function emptyDay(): DayLog {
  return { playXp: 0, totalXp: 0, sessions: {}, wins: [], dailies: [] };
}

export function isProgressionState(value: unknown): value is ProgressionState {
  const v = value as ProgressionState;
  return (
    typeof v === 'object' &&
    v !== null &&
    v.version === PROGRESSION_VERSION &&
    typeof v.xp === 'number' &&
    typeof v.days === 'object' &&
    typeof v.games === 'object' &&
    typeof v.packages === 'object' &&
    typeof v.cron === 'object' &&
    typeof v.streak === 'object' &&
    typeof v.hall === 'object'
  );
}
