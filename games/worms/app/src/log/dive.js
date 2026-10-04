// Abyssal Worms — the Daily Dive. One abyss a day, the same for everyone: its seed, its number of
// worms and their length come from the date, and so do the three kinds of sighting to find in it.
// Find all three and the dive is done; the first finished dive of the day is the one that counts.
// Numbered like the Hall's daily challenges. Pure: the date is passed in.

import { KIND_IDS, seeded } from './sightings.js';

/** Daily #1 was this date: the kit's DAILY_EPOCH, so the numbers agree with the Hall. */
export const DAILY_EPOCH = '2026-09-01';

const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDay(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function diveNumber(key) {
  return Math.max(1, Math.round(utcDay(key) - utcDay(DAILY_EPOCH)) + 1);
}

function dateSeed(key) {
  let hash = 0x811c9dc5;
  for (const char of `worms:daily:${key}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 1;
}

/** The day's dive: its number, the abyss to dig, and the three sightings to find. */
export function dailyDive(key) {
  const seed = dateSeed(key);
  const random = seeded(seed);
  const kinds = [...KIND_IDS];
  // Three of the four kinds, in the day's order.
  kinds.splice(Math.floor(random() * kinds.length), 1);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return {
    key,
    number: diveNumber(key),
    seed,
    worms: 6 + Math.floor(random() * 7),
    length: 12 + Math.floor(random() * 13),
    seek: kinds,
  };
}

/** `Abyssal Worms Dive #32 · found 3 of 3 · 🫧🫧🫧` — never with a link. */
export function diveShareLine(number, found) {
  const marks = found.map((yes) => (yes ? '🫧' : '·')).join('');
  return `Abyssal Worms Dive #${number} · found ${found.filter(Boolean).length} of ${found.length} · ${marks}`;
}
