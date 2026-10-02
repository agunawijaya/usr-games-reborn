// The Daily Engagement: one single-ship action a day, the same for everyone. The date picks the
// action from a pool of duels and the seed; the standing order changes with the weekday. A day
// whose first seed the counsel cannot win moves on to the next seed, so every engagement is known
// to be winnable. Pure: the date is passed in.

import { SCENARIOS } from '../engine/index.js';
import { autoplay } from './autopilot.js';

/** Daily #1 was this date: the kit's DAILY_EPOCH, so the numbers agree with the Hall's. */
export const DAILY_EPOCH = '2026-09-01';

const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');

/**
 * Duels the counsel wins on at least four seeds in ten (scripts/counsel-sweep.mjs): scenario and
 * the ship the player takes.
 */
export const ENGAGEMENTS = [
  { scenarioId: 7, ship: 0 },
  { scenarioId: 11, ship: 0 },
  { scenarioId: 10, ship: 0 },
  { scenarioId: 16, ship: 0 },
  { scenarioId: 12, ship: 0 },
  { scenarioId: 8, ship: 0 },
  { scenarioId: 13, ship: 1 },
  { scenarioId: 6, ship: 0 },
  { scenarioId: 6, ship: 1 },
  { scenarioId: 4, ship: 0 },
  { scenarioId: 5, ship: 0 },
  { scenarioId: 15, ship: 0 },
];

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

/** The standing order of each weekday, Monday first: the engagement's second commendation. */
export const STANDING_ORDERS = [
  { kind: 'rakes', atLeast: 1 },
  { kind: 'hull', atLeast: 60 },
  { kind: 'turns', within: 15 },
  { kind: 'masts' },
  { kind: 'boarded' },
  { kind: 'crew', atLeast: 60 },
  { kind: 'broadsides', atMost: 8 },
];

export const standingOrder = (key) => STANDING_ORDERS[weekdayOf(key)];

/** The engagement's three commendations: the win, the day's standing order, a sound ship. */
export function engagementCommendations(key) {
  return [{ kind: 'win' }, standingOrder(key), { kind: 'hull', atLeast: 50 }];
}

function hash(text) {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const cache = new Map();

/**
 * The day's engagement: the duel and the first of the date's seeds that the counsel wins. Each
 * try takes a few milliseconds; the answer is kept for the visit.
 * @returns {{ scenarioId: number, ship: number, seed: number, name: string }}
 */
export function engagementFor(key, tries = 60) {
  if (cache.has(key)) return cache.get(key);
  const base = hash(`sail:daily:${key}`);
  const pick = ENGAGEMENTS[base % ENGAGEMENTS.length];
  let seed = (base >>> 8) % 1_000_000 || 1;
  for (let i = 0; i < tries; i++) {
    const candidate = ((base >>> 8) + i) % 1_000_000 || 1;
    if (autoplay({ scenarioId: pick.scenarioId, playerShip: pick.ship, seed: candidate }).st.result?.reason === 'victory') {
      seed = candidate;
      break;
    }
  }
  const sc = SCENARIOS[pick.scenarioId];
  const found = { ...pick, seed, name: `${sc.ships[pick.ship].name} in ${sc.name}` };
  cache.set(key, found);
  return found;
}

/**
 * The engagement rating, for the record and the share line. A win counts most; hull and crew
 * kept, a quick action and the standing order add to it, and every broadside fired costs a
 * little. An action lost is worth its prizes.
 */
export function engagementRating(st, me, log, earned) {
  if (st.result?.reason !== 'victory') return (log.struckToGuns + log.boardedPrizes) * 200;
  const ms = st.ships[me];
  const hull = Math.round((100 * ms.specs.hull) / Math.max(1, ms.max.hull));
  const crew = Math.round((100 * (ms.specs.crew1 + ms.specs.crew2 + ms.specs.crew3)) / Math.max(1, log.startCrew));
  const pace = Math.max(0, 30 - st.turn) * 20;
  const bonus = (earned[1] ? 300 : 0) + (earned[2] ? 150 : 0);
  return Math.max(0, Math.round(1000 + hull * 5 + crew * 2 + pace + bonus - log.broadsides * 5));
}

/**
 * One line to paste anywhere, never with a link:
 * `Broadside · Daily Engagement #32 · ★★☆ · 1,830`
 */
export function engagementShareLine({ number, earned, rating, won }) {
  const stars = earned.map((ok) => (ok ? '★' : '☆')).join('');
  return `Broadside · Daily Engagement #${number} · ${stars} · ${won ? rating.toLocaleString('en') : 'not won'}`;
}
