// Deep Space Command — the Daily Patrol. One galaxy a day, the same for everyone: the seed comes
// from the date, the number matches the Hall's daily numbering, and the standing order changes
// with the weekday. A day whose first seed the bridge computer's advice cannot win moves on to the
// next seed, so every patrol is known to be winnable. Pure: the date is passed in.

import { autoplay } from './autopilot.js';
import { PATROL_PRESET } from './missions.js';

/** Daily #1 was this date: the kit's DAILY_EPOCH, so the numbers agree with the Hall's. */
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

/** The public number, #1 on the epoch. */
export function dailyNumber(key) {
  return Math.max(1, Math.round(utcDay(key) - utcDay(DAILY_EPOCH)) + 1);
}

/** Monday is 0. */
export function weekdayOf(key) {
  // 1970-01-01 was a Thursday, index 3 in a week that starts on Monday.
  return (((Math.floor(utcDay(key)) + 3) % 7) + 7) % 7;
}

/** The standing order of each weekday, Monday first; the patrol's second commendation. */
export const STANDING_ORDERS = [
  { kind: 'noDock' },
  { kind: 'orders', under: 45 },
  { kind: 'torpedoes', atMost: 4 },
  { kind: 'hull', atLeast: 60 },
  { kind: 'spare', stardates: 8 },
  { kind: 'charted', atLeast: 32 },
  { kind: 'torpedoes', atMost: 0 },
];

export function standingOrder(key) {
  return STANDING_ORDERS[weekdayOf(key)];
}

/** The patrol's three commendations: the win, the day's standing order, a sound ship. */
export function patrolCommendations(key) {
  return [{ kind: 'win' }, standingOrder(key), { kind: 'hull', atLeast: 50 }];
}

function hashSeed(text) {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

const seedCache = new Map();

/**
 * The day's seed: the first of the date's seeds that the autopilot wins by following the advice
 * alone, without an escape. Searching takes a few milliseconds per try and is cached for the visit.
 */
export function patrolSeed(key, tries = 40) {
  if (seedCache.has(key)) return seedCache.get(key);
  const base = hashSeed(`trek:daily:${key}`);
  let chosen = base;
  for (let i = 0; i < tries; i++) {
    const seed = (base + i) >>> 0;
    const run = autoplay({ difficulty: PATROL_PRESET, seed });
    if (run.game.won && run.escapes === 0) {
      chosen = seed;
      break;
    }
  }
  seedCache.set(key, chosen);
  return chosen;
}

/**
 * The patrol rating: what a finished patrol is worth, for the record and the share line. A win
 * counts most; spare stardates, hull, torpedoes kept and the standing order add to it, and every
 * order given costs a little.
 */
export function patrolRating(game, log, earned) {
  if (!game.won) return game.kills * 40;
  const spare = Math.max(0, game.stardateEnd - game.stardate);
  return Math.max(
    0,
    Math.round(1000 + spare * 25 + game.ship.hull * 4 + game.ship.torpedoes * 15 + (earned[1] ? 300 : 0) + (earned[2] ? 150 : 0) - log.orders * 3),
  );
}

/**
 * One line to paste anywhere, never with a link:
 * `Trek — Deep Space · Daily Patrol #32 · ★★☆ · 1,830`
 */
export function patrolShareLine({ number, earned, rating, won }) {
  const stars = earned.map((ok) => (ok ? '★' : '☆')).join('');
  const result = won ? rating.toLocaleString('en') : 'not cleared';
  return `Trek — Deep Space · Daily Patrol #${number} · ${stars} · ${result}`;
}
