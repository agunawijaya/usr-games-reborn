import { describe, expect, it } from 'vitest';
import {
  addDays,
  DAILY_EPOCH,
  dailyNumber,
  dailySeed,
  daysBetween,
  isDateKey,
  isoWeekKey,
  localDateKey,
  weekdayIndex,
  weekSeed,
  weekStartKey,
} from './daily';

describe('local date keys', () => {
  it('formats the local calendar date, not the UTC one', () => {
    expect(localDateKey(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(localDateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(isDateKey('2026-09-28')).toBe(true);
    expect(isDateKey('2026-9-28')).toBe(false);
  });

  it('counts days across month, year and daylight-saving boundaries', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('daily numbering', () => {
  it('starts at #1 on the epoch and never goes below it', () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber(addDays(DAILY_EPOCH, 27))).toBe(28);
    expect(dailyNumber('2020-01-01')).toBe(1);
  });

  it('gives each game its own daily seed', () => {
    expect(dailySeed('atc', '2026-09-28')).not.toBe(dailySeed('wump', '2026-09-28'));
    expect(dailySeed('atc', '2026-09-28')).toBe(dailySeed('atc', '2026-09-28'));
  });
});

describe('ISO weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekdayIndex('2026-09-28')).toBe(0);
    expect(weekdayIndex('2026-10-04')).toBe(6);
    expect(weekStartKey('2026-10-01')).toBe('2026-09-28');
  });

  it('matches the ISO calendar at year edges', () => {
    expect(isoWeekKey('2026-09-28')).toBe('2026-W40');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
  });

  it('shares one seed across a whole week', () => {
    expect(weekSeed('2026-09-28')).toBe(weekSeed('2026-10-04'));
    expect(weekSeed('2026-10-05')).not.toBe(weekSeed('2026-10-04'));
  });
});
