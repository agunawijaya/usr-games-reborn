import { addDays, daysBetween, type DateKey, isoWeekKey } from '../daily/daily';

/**
 * The streak ("uptime") counts consecutive days with at least one session. Two missed days per
 * week are covered automatically by freezes, so a busy day never costs anything. If a gap is
 * longer than the freezes cover, a new streak simply starts; the best streak is kept forever.
 */

export const FREEZES_PER_WEEK = 2;
/** Frozen days older than this are pruned; they only matter within their own week. */
const FROZEN_MEMORY_DAYS = 21;

export interface StreakState {
  current: number;
  best: number;
  lastActive: DateKey | null;
  /** Missed days that a freeze covered, shown as such in the streak calendar. */
  frozen: DateKey[];
}

export type StreakOutcome = 'first' | 'same-day' | 'continued' | 'bridged' | 'restarted';

export function emptyStreak(): StreakState {
  return { current: 0, best: 0, lastActive: null, frozen: [] };
}

export function freezesUsedInWeek(streak: StreakState, day: DateKey): number {
  const week = isoWeekKey(day);
  return streak.frozen.filter((frozenDay) => isoWeekKey(frozenDay) === week).length;
}

export function registerActivity(
  streak: StreakState,
  today: DateKey,
): { streak: StreakState; outcome: StreakOutcome; bridgedDays: DateKey[] } {
  if (streak.lastActive === null) {
    return {
      streak: { ...streak, current: 1, best: Math.max(1, streak.best), lastActive: today },
      outcome: 'first',
      bridgedDays: [],
    };
  }
  const gap = daysBetween(streak.lastActive, today);
  if (gap <= 0) return { streak, outcome: 'same-day', bridgedDays: [] };

  const missed = Array.from({ length: gap - 1 }, (_, i) =>
    addDays(streak.lastActive as DateKey, i + 1),
  );
  const bridged: DateKey[] = [];
  let working: StreakState = streak;
  for (const day of missed) {
    if (freezesUsedInWeek(working, day) >= FREEZES_PER_WEEK) break;
    bridged.push(day);
    working = { ...working, frozen: [...working.frozen, day] };
  }

  const cutoff = addDays(today, -FROZEN_MEMORY_DAYS);
  if (bridged.length === missed.length) {
    const current = streak.current + 1;
    return {
      streak: {
        current,
        best: Math.max(streak.best, current),
        lastActive: today,
        frozen: working.frozen.filter((day) => day >= cutoff),
      },
      outcome: missed.length === 0 ? 'continued' : 'bridged',
      bridgedDays: bridged,
    };
  }
  return {
    // Freezes spent on a gap that could not be bridged are handed back.
    streak: {
      current: 1,
      best: streak.best,
      lastActive: today,
      frozen: streak.frozen.filter((day) => day >= cutoff),
    },
    outcome: 'restarted',
    bridgedDays: [],
  };
}

/** The streak as it stands today, without recording activity (for display on a quiet day). */
export function streakAsOf(streak: StreakState, today: DateKey): number {
  if (streak.lastActive === null) return 0;
  const gap = daysBetween(streak.lastActive, today);
  if (gap <= 1) return streak.current;
  const missed = Array.from({ length: gap - 1 }, (_, i) =>
    addDays(streak.lastActive as DateKey, i + 1),
  );
  // Today does not count as missed yet: the player still has all of it to show up.
  let working = streak;
  for (const day of missed) {
    if (freezesUsedInWeek(working, day) >= FREEZES_PER_WEEK) return 0;
    working = { ...working, frozen: [...working.frozen, day] };
  }
  return streak.current;
}
