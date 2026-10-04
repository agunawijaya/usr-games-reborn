// Broken Well — the Daily Shift. One shift a day with the same well for everyone: the preset, its
// rubble and the day's three contracts all come from the date, and the number matches the Hall's
// daily numbering. Only the first shift of the day counts. Pure: the date is passed in.

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

function dailySeed(key) {
  let hash = 0x811c9dc5;
  for (const char of `blocks-classic:daily:${key}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function weekdayIndex(key) {
  // 1970-01-01 was a Thursday, index 3 in a week that starts on Monday.
  return (((Math.floor(utcDay(key)) + 3) % 7) + 7) % 7;
}

/** The well of the day, by weekday: open shafts early in the week, reshaped wells midweek, a flood
 * shift at the weekend. */
const WELLS_BY_WEEKDAY = [
  { name: 'The Monday Shaft', preset: 'normal', mode: 'marathon', startLevel: 1, rubbleHeight: 2, rubbleDensity: 0.45, targetLines: 14 },
  { name: 'A Narrow Tuesday', preset: 'canyon', mode: 'marathon', startLevel: 2, rubbleHeight: 2, rubbleDensity: 0.5, targetLines: 14 },
  { name: 'The Wednesday Neck', preset: 'hourglass', mode: 'marathon', startLevel: 2, rubbleHeight: 3, rubbleDensity: 0.5, targetLines: 16 },
  { name: 'A Thursday Pillar', preset: 'donut', mode: 'marathon', startLevel: 3, rubbleHeight: 3, rubbleDensity: 0.5, targetLines: 16 },
  { name: 'The Friday Stair', preset: 'staircase', mode: 'marathon', startLevel: 3, rubbleHeight: 2, rubbleDensity: 0.5, targetLines: 18 },
  { name: 'The Saturday Flood', preset: 'normal', mode: 'survival', startLevel: 3, rubbleHeight: 0, rubbleDensity: 0, surviveRows: 8 },
  { name: 'The Sunday Deep', preset: 'tower', mode: 'survival', startLevel: 4, rubbleHeight: 0, rubbleDensity: 0, surviveRows: 10 },
];

/** The day's three contracts, drawn from this pool with the day's seed. */
const DAILY_TASKS = [
  ['swift', 70],
  ['light-touch', 35],
  ['no-topout'],
  ['score', 1800],
  ['quad'],
];
const FLOOD_TASKS = [['flood', 8], ['no-topout'], ['score', 1600], ['quad']];

/** Everything about the day's shift: its number, well, engine options and contracts. */
export function dailyShift(key) {
  const seed = dailySeed(key);
  const well = WELLS_BY_WEEKDAY[weekdayIndex(key)];
  const random = seededRandom(seed ^ 0x9e3779b9);
  const pool = [...(well.mode === 'survival' ? FLOOD_TASKS : DAILY_TASKS)];
  const tasks = [];
  while (tasks.length < 3 && pool.length > 0) tasks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return {
    key,
    number: dailyNumber(key),
    name: well.name,
    options: { ...well, seed },
    tasks,
  };
}

/**
 * One line to paste anywhere, never with a link:
 * `Broken Well #32 · shift cleared in 64 pieces · 1840 pts · ◆◆◇`
 */
export function dailyShareLine({ number, cleared, piecesLocked, score, sealsMet }) {
  const seals = sealsMet.map((met) => (met ? '◆' : '◇')).join('');
  const how = cleared ? `shift cleared in ${piecesLocked} pieces` : `shaft lost after ${piecesLocked} pieces`;
  return `Broken Well #${number} · ${how} · ${score} pts · ${seals}`;
}
