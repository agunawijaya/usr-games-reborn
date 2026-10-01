import { describe, expect, it } from 'vitest';
import {
  emptyStreak,
  FREEZES_PER_WEEK,
  registerActivity,
  streakAsOf,
  type StreakState,
} from './streak';

function playOn(days: string[]): StreakState {
  return days.reduce((streak, day) => registerActivity(streak, day).streak, emptyStreak());
}

describe('registerActivity', () => {
  it('starts, ignores repeat visits the same day and continues day by day', () => {
    const first = registerActivity(emptyStreak(), '2026-09-28');
    expect(first.outcome).toBe('first');
    expect(registerActivity(first.streak, '2026-09-28').outcome).toBe('same-day');
    expect(playOn(['2026-09-28', '2026-09-29', '2026-09-30'])).toMatchObject({
      current: 3,
      best: 3,
    });
  });

  it('bridges up to two missed days per week with automatic freezes', () => {
    expect(FREEZES_PER_WEEK).toBe(2);
    const result = registerActivity(playOn(['2026-09-28']), '2026-10-01');
    expect(result.outcome).toBe('bridged');
    expect(result.bridgedDays).toEqual(['2026-09-29', '2026-09-30']);
    expect(result.streak.current).toBe(2);
  });

  it('starts fresh, keeping the best streak, when a gap is longer than the freezes', () => {
    const before = playOn(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
    const result = registerActivity(before, '2026-09-28');
    // Three missed days in one week: only two could be frozen.
    expect(result.outcome).toBe('restarted');
    expect(result.streak).toMatchObject({ current: 1, best: 4 });
  });

  it('gives each week its own two freezes', () => {
    // Sunday and Monday are in different ISO weeks, so a two-day gap there costs one each.
    let streak = playOn(['2026-09-26']);
    streak = registerActivity(streak, '2026-09-29').streak;
    expect(streak.current).toBe(2);
    expect(streak.frozen).toEqual(['2026-09-27', '2026-09-28']);
  });
});

describe('streakAsOf', () => {
  it('shows the running streak on a quiet day without counting today as missed', () => {
    const streak = playOn(['2026-09-28', '2026-09-29']);
    expect(streakAsOf(streak, '2026-09-29')).toBe(2);
    expect(streakAsOf(streak, '2026-09-30')).toBe(2);
    expect(streakAsOf(streak, '2026-10-02')).toBe(2);
    expect(streakAsOf(streak, '2026-10-03')).toBe(0);
  });
});
