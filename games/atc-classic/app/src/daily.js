// Control Room 1986 — Daily Traffic. One shift a day with the same traffic for everyone: the
// sector and the seed come from the date, and the number matches the Hall's daily numbering.
// Pure: the date is passed in.

/** Daily #1 was this date. The same epoch as the kit's DAILY_EPOCH, so the numbers agree. */
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

/**
 * The sector of the day, by weekday: the training sector early in the week, the reference sector
 * most days, the fast sector on Sundays.
 */
const SECTOR_BY_WEEKDAY = ['easy', 'default', 'default', 'easy', 'default', 'default', 'killer'];

export function dailySector(key) {
  // 1970-01-01 was a Thursday, index 3 in a week that starts on Monday.
  const weekday = (((Math.floor(utcDay(key)) + 3) % 7) + 7) % 7;
  return SECTOR_BY_WEEKDAY[weekday];
}

/** A 32-bit seed for the engine from the date (FNV-1a over the game's daily label). */
export function dailySeed(key) {
  let hash = 0x811c9dc5;
  for (const char of `atc-classic:daily:${key}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The engine's own generator, for drawing the day's briefing from the same seed. */
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
 * One line to paste anywhere, never with a link:
 * `Control Room 1986 #32 · Default · 7 home · 🟩🟩⬜`
 */
export function dailyShareLine({ number, sectorName, safe, tasksDone }) {
  const stamps = tasksDone.map((done) => (done ? '🟩' : '⬜')).join('');
  return `Control Room 1986 #${number} · ${sectorName} · ${safe} home · ${stamps}`;
}
