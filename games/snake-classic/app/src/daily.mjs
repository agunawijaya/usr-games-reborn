// Talon's Shadow — the Daily Flight. One flight a day in the same region for everyone, with the
// fruit and the bird's patience drawn from the date, numbered like the Hall's daily challenges.
// Only the first flight of the day counts. Pure: the date is passed in.

import { REGIONS } from './regions.mjs';

/** Daily #1 was this date: the kit's DAILY_EPOCH, so the numbers agree with the Hall. */
export const DAILY_EPOCH = '2026-09-01';

const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');

/** The player's local calendar date as YYYY-MM-DD. */
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDay(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function dailyNumber(key) {
  return Math.max(1, Math.round(utcDay(key) - utcDay(DAILY_EPOCH)) + 1);
}

/** A 32-bit seed from the date (FNV-1a over the game's daily label). */
export function dailySeed(key) {
  let hash = 0x811c9dc5;
  for (const char of `snake-classic:daily:${key}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** A small, fast generator (mulberry32) for the day's draws. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The day's flight: its number, its region (the eight in turn), and its seed. */
export function dailyFlight(key) {
  const number = dailyNumber(key);
  return { key, number, region: REGIONS[(number - 1) % REGIONS.length], seed: dailySeed(key) };
}

/**
 * One line to paste anywhere, never with a link:
 * `Talon's Shadow #32 · Midnight · escaped with 🍎9 · 🪶3`
 */
export function dailyShareLine({ number, regionName, escaped, fruit, dodges }) {
  const how = escaped ? `escaped with 🍎${fruit}` : `caught with 🍎${fruit}`;
  return `Talon's Shadow #${number} · ${regionName} · ${how} · 🪶${dodges}`;
}
