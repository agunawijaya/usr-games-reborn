// The Rune Gates — the Daily Delve. One delve a day with the same cave for everyone: the cave,
// its hazards and the day's three tasks all come from the date, and the number matches the Hall's
// daily numbering. Only the first delve of the day counts. Pure: the date is passed in.

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

/** A 32-bit seed for the engine from the date (FNV-1a over the game's daily label). */
export function dailySeed(key) {
  let hash = 0x811c9dc5;
  for (const char of `wump-classic:daily:${key}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The cave of the day, by weekday: the old twelve-faced plan early in the week, the wandering
 * caves midweek, the hard level at the weekend.
 */
const CAVES_BY_WEEKDAY = [
  { name: 'The Twelve Pillars', options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 3, pitNum: 3 } },
  { name: 'A Wandering Deep', options: { mode: 'procedural', roomNum: 25, level: 'EASY', arrowNum: 5, batNum: 3, pitNum: 3 } },
  { name: 'The Bat Vaults', options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 5, pitNum: 2 } },
  { name: 'A Winding Deep', options: { mode: 'procedural', roomNum: 30, level: 'EASY', arrowNum: 5, batNum: 4, pitNum: 4 } },
  { name: 'The Chasm Stair', options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 2, pitNum: 5 } },
  { name: 'The Hard Gate', options: { mode: 'dodecahedron', level: 'HARD', arrowNum: 5, batNum: 3, pitNum: 3 } },
  { name: 'The Echoing Galleries', options: { mode: 'procedural', roomNum: 40, level: 'HARD', arrowNum: 6, batNum: 4, pitNum: 4 } },
];

export function weekdayIndex(key) {
  // 1970-01-01 was a Thursday, index 3 in a week that starts on Monday.
  return (((Math.floor(utcDay(key)) + 3) % 7) + 7) % 7;
}

/** The day's three tasks, drawn from this pool with the day's seed. */
const DAILY_TASKS = [
  ['swift', 16],
  ['spare', 3],
  ['no-bats'],
  ['first-arrow'],
  ['no-bumps'],
  ['quiet'],
  ['few-chambers', 10],
  ['crooked', 2],
  ['no-chart'],
];

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

/** Everything about the day's delve: its number, cave, engine options and tasks. */
export function dailyDelve(key) {
  const seed = dailySeed(key);
  const cave = CAVES_BY_WEEKDAY[weekdayIndex(key)];
  const random = seededRandom(seed ^ 0x9e3779b9);
  const pool = [...DAILY_TASKS];
  const tasks = [];
  while (tasks.length < 3) tasks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return {
    key,
    number: dailyNumber(key),
    name: cave.name,
    options: { ...cave.options, seed },
    tasks,
  };
}

/**
 * One line to paste anywhere, never with a link:
 * `The Rune Gates #32 · slain in 11 moves · 🏹2 · ◆◆◇`
 */
export function dailyShareLine({ number, slain, moves, arrowsLeft, sealsMet }) {
  const seals = sealsMet.map((met) => (met ? '◆' : '◇')).join('');
  const how = slain ? `slain in ${moves} moves` : `lost after ${moves} moves`;
  return `The Rune Gates #${number} · ${how} · 🏹${arrowsLeft} · ${seals}`;
}
