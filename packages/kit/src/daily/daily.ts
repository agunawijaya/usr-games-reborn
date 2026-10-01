/**
 * Calendar helpers shared by daily challenges, streaks and weekly cron jobs.
 *
 * Every key is computed from the player's local calendar date, so "today" flips at the
 * player's midnight, not at UTC midnight. Differences between keys are computed on UTC
 * dates built from those keys, which keeps daylight-saving shifts out of the arithmetic.
 */

/** A local calendar date as `YYYY-MM-DD`. */
export type DateKey = string;
/** An ISO-8601 week as `YYYY-Www` (weeks start on Monday). */
export type WeekKey = string;

/** Daily challenge #1 was this date. Change it only before launch: numbers are shared publicly. */
export const DAILY_EPOCH: DateKey = '2026-09-01';

const DAY_MS = 86_400_000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function localDateKey(date: Date = new Date()): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

function utcDayNumber(key: DateKey): number {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) throw new RangeError(`Not a date key: ${key}`);
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS;
}

/** Whole days from `from` to `to`; positive when `to` is later. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round(utcDayNumber(to) - utcDayNumber(from));
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = new Date((utcDayNumber(key) + days) * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The public daily number, `#1` on the epoch. Dates before the epoch clamp to #1. */
export function dailyNumber(key: DateKey = localDateKey()): number {
  return Math.max(1, daysBetween(DAILY_EPOCH, key) + 1);
}

/** The seed a game uses for its daily challenge; the id keeps two games from sharing a board. */
export function dailySeed(gameId: string, key: DateKey = localDateKey()): string {
  return `${gameId}:daily:${key}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DateKey): number {
  // 1970-01-01 was a Thursday, index 3 in a Monday-first week.
  return (((Math.floor(utcDayNumber(key)) + 3) % 7) + 7) % 7;
}

export function weekStartKey(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key));
}

export function isoWeekKey(key: DateKey = localDateKey()): WeekKey {
  // The ISO week belongs to the year that contains its Thursday.
  const thursday = addDays(key, 3 - weekdayIndex(key));
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1;
  return `${year}-W${pad(week)}`;
}

/** The seed for everything generated once a week, such as the cron jobs. */
export function weekSeed(key: DateKey = localDateKey()): string {
  return `week:${isoWeekKey(key)}`;
}
