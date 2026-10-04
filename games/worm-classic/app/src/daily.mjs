// Orchard Crawl — the Daily Orchard. One crawl a day in the same orchard for everyone, with its
// apples and creatures drawn from the date, numbered like the Hall's daily challenges. Only the
// first finished crawl of the day counts. Pure: the date is passed in.

import { ORCHARDS } from './orchards.mjs';

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

/** A 32-bit seed from a label (FNV-1a). */
export function seedOf(label) {
  let hash = 0x811c9dc5;
  for (const char of label) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** A small, fast generator (mulberry32). */
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

/**
 * The page's three draw streams for one day: the apples' numbers, where things appear, and the
 * creatures' comings and goings, each from its own seed so one never shifts another.
 */
export function dailyStreams(key) {
  const stream = (name) => seededRandom(seedOf(`worm-classic:daily:${key}:${name}`));
  return { value: stream('value'), place: stream('place'), creature: stream('creature') };
}

/** The day's orchard: its number and its orchard (the eight in turn). */
export function dailyOrchard(key) {
  const number = dailyNumber(key);
  return { key, number, orchard: ORCHARDS[(number - 1) % ORCHARDS.length] };
}

const starRow = (stars) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

/**
 * One line to paste anywhere, never with a link:
 * `Orchard Crawl #33 · Desert · home · 🍎18 · 312 pts · ★★☆`
 */
export function dailyShareLine({ number, orchardName, home, apples, score, stars }) {
  const how = home ? `home · 🍎${apples}` : `crashed · 🍎${apples}`;
  return `Orchard Crawl #${number} · ${orchardName} · ${how} · ${score} pts · ${starRow(stars)}`;
}
