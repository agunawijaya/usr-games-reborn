// Broken Well — the quarry foreman's career. Twelve shifts dig deeper through the quarry, each one
// reshaping the well (see src/engine.js's WELL_PRESETS) or adding rubble pressure. Clearing a
// shift's line target opens the next; its stars are the most contracts ever met there in one go;
// the rank follows the shifts cleared. Pure.

/**
 * @typedef {object} Shift
 * @property {string} id
 * @property {number} number
 * @property {string} name
 * @property {string} site     the part of the quarry it lies in
 * @property {string} idea     what is new about this shift, in one line
 * @property {object} options  the engine's own config, plus a line or survival target
 * @property {import('./quests.mjs').Task[]} tasks
 */

/** @type {Shift[]} */
export const SHIFTS = [
  {
    id: 'open-shaft',
    number: 1,
    name: 'The Open Shaft',
    site: 'The Spoil Heap',
    idea: 'A plain ten-wide shaft. Learn the drop before the quarry starts reshaping it.',
    options: { preset: 'normal', mode: 'marathon', startLevel: 1, rubbleHeight: 0, rubbleDensity: 0, targetLines: 10 },
    tasks: [['swift', 60], ['light-touch', 30], ['no-topout']],
  },
  {
    id: 'canyon-cut',
    number: 2,
    name: 'The Canyon Cut',
    site: 'The Spoil Heap',
    idea: 'The rock closes in to a four-wide canyon. Every piece has to turn sideways.',
    options: { preset: 'canyon', mode: 'marathon', startLevel: 1, rubbleHeight: 0, rubbleDensity: 0, targetLines: 10 },
    tasks: [['no-topout'], ['swift', 70], ['score', 1200]],
  },
  {
    id: 'rubble-start',
    number: 3,
    name: 'A Rubble Start',
    site: 'The Spoil Heap',
    idea: 'The shift begins on a low rubble stack left by the last crew.',
    options: { preset: 'normal', mode: 'marathon', startLevel: 1, rubbleHeight: 4, rubbleDensity: 0.55, targetLines: 12 },
    tasks: [['quad'], ['no-topout'], ['light-touch', 35]],
  },
  {
    id: 'split-shaft',
    number: 4,
    name: 'The Split Shaft',
    site: 'The Low Galleries',
    idea: 'A pillar of rock splits the shaft in two; pieces must be walked around it.',
    options: { preset: 'split', mode: 'marathon', startLevel: 2, rubbleHeight: 3, rubbleDensity: 0.5, targetLines: 14 },
    tasks: [['swift', 80], ['score', 2000], ['no-topout']],
  },
  {
    id: 'hourglass-neck',
    number: 5,
    name: 'The Hourglass Neck',
    site: 'The Low Galleries',
    idea: 'The shaft narrows to a neck at its waist, then opens out again below.',
    options: { preset: 'hourglass', mode: 'marathon', startLevel: 2, rubbleHeight: 2, rubbleDensity: 0.45, targetLines: 14 },
    tasks: [['quad'], ['light-touch', 40], ['score', 2200]],
  },
  {
    id: 'donut-pillar',
    number: 6,
    name: 'The Donut Pillar',
    site: 'The Low Galleries',
    idea: 'A block of standing rock squats in the middle of the shaft.',
    options: { preset: 'donut', mode: 'marathon', startLevel: 3, rubbleHeight: 3, rubbleDensity: 0.5, targetLines: 16 },
    tasks: [['no-topout'], ['swift', 90], ['quad']],
  },
  {
    id: 'first-flood',
    number: 7,
    name: 'The First Flood',
    site: 'The Deep Cuts',
    idea: 'Rubble starts rising from below. Hold the line as long as you can.',
    options: { preset: 'normal', mode: 'survival', startLevel: 3, rubbleHeight: 0, rubbleDensity: 0, surviveRows: 6 },
    tasks: [['flood', 6], ['no-topout'], ['score', 1500]],
  },
  {
    id: 'staircase-fall',
    number: 8,
    name: 'The Staircase Fall',
    site: 'The Deep Cuts',
    idea: 'The floor rises in steps from one side of the shaft to the other.',
    options: { preset: 'staircase', mode: 'marathon', startLevel: 3, rubbleHeight: 2, rubbleDensity: 0.5, targetLines: 18 },
    tasks: [['swift', 95], ['quad'], ['score', 2600]],
  },
  {
    id: 'tower-shaft',
    number: 9,
    name: 'The Tower Shaft',
    site: 'The Deep Cuts',
    idea: 'A narrow, thirty-deep shaft. Gravity has more room to work against you.',
    options: { preset: 'tower', mode: 'marathon', startLevel: 3, rubbleHeight: 4, rubbleDensity: 0.55, targetLines: 16 },
    tasks: [['no-topout'], ['light-touch', 45], ['score', 2400]],
  },
  {
    id: 'wide-cut',
    number: 10,
    name: 'The Wide Cut',
    site: 'The Foreman’s Deep',
    idea: 'A broad, shallow cut. Lines are easy to start and hard to finish cleanly.',
    options: { preset: 'wide', mode: 'marathon', startLevel: 4, rubbleHeight: 4, rubbleDensity: 0.55, targetLines: 20 },
    tasks: [['swift', 110], ['quad'], ['score', 3200]],
  },
  {
    id: 'second-flood',
    number: 11,
    name: 'The Second Flood',
    site: 'The Foreman’s Deep',
    idea: 'The rubble rises faster now, and the canyon walls are back to narrow your options.',
    options: { preset: 'canyon', mode: 'survival', startLevel: 4, rubbleHeight: 0, rubbleDensity: 0, surviveRows: 10 },
    tasks: [['flood', 10], ['no-topout'], ['score', 2000]],
  },
  {
    id: 'broken-well',
    number: 12,
    name: 'The Broken Well',
    site: "The Foreman’s Deep",
    idea: 'Every reshaping the quarry knows, one after another, with the flood always rising.',
    options: { preset: 'donut', mode: 'survival', startLevel: 5, rubbleHeight: 2, rubbleDensity: 0.5, surviveRows: 14 },
    tasks: [['flood', 14], ['quad'], ['no-topout']],
  },
];

/** Ranks by shifts cleared. */
export const RANKS = [
  { name: 'Hand Digger', cleared: 0 },
  { name: 'Shaft Apprentice', cleared: 2 },
  { name: 'Well-Setter', cleared: 4 },
  { name: 'Foreman', cleared: 6 },
  { name: 'Quarry Warden', cleared: 9 },
  { name: 'Master of the Broken Well', cleared: 12 },
];

/**
 * @typedef {object} ShiftRecord
 * @property {number} tries
 * @property {boolean} cleared
 * @property {number} stars       the most contracts ever met on this shift in one go
 * @property {number} bestScore
 */

/** @returns {{ shifts: Record<string, ShiftRecord> }} */
export function emptyCareer() {
  return { shifts: {} };
}

export function shiftById(id) {
  return SHIFTS.find((s) => s.id === id) ?? null;
}

export function clearedCount(career) {
  return SHIFTS.filter((s) => career.shifts[s.id]?.cleared).length;
}

export function totalStars(career) {
  return SHIFTS.reduce((sum, s) => sum + (career.shifts[s.id]?.stars ?? 0), 0);
}

/** The first shift is always open; each other opens when the one before it is cleared. */
export function isOpen(career, index) {
  if (index === 0) return true;
  const before = SHIFTS[index - 1];
  return Boolean(before && career.shifts[before.id]?.cleared);
}

export function rankOf(career) {
  const cleared = clearedCount(career);
  let rank = RANKS[0];
  for (const r of RANKS) if (cleared >= r.cleared) rank = r;
  return rank;
}

/** The shift "Continue" leads to: the first not yet cleared, or the last one once all are. */
export function nextShift(career) {
  return SHIFTS.find((s, i) => isOpen(career, i) && !career.shifts[s.id]?.cleared) ?? SHIFTS[SHIFTS.length - 1];
}

/**
 * Records a finished shift. Returns the new career and what changed.
 * @param {{ shifts: Record<string, ShiftRecord> }} career
 * @param {string} shiftId
 * @param {{ cleared: boolean, contractsMet: number, score: number }} outcome
 */
export function recordShift(career, shiftId, outcome) {
  const before = career.shifts[shiftId] ?? { tries: 0, cleared: false, stars: 0, bestScore: 0 };
  const rankBefore = rankOf(career);
  const record = {
    tries: before.tries + 1,
    cleared: before.cleared || outcome.cleared,
    stars: Math.max(before.stars, outcome.cleared ? outcome.contractsMet : 0),
    bestScore: Math.max(before.bestScore, outcome.score),
  };
  const next = { ...career, shifts: { ...career.shifts, [shiftId]: record } };
  const rankAfter = rankOf(next);
  return {
    career: next,
    firstClear: outcome.cleared && !before.cleared,
    newStars: record.stars - before.stars,
    promoted: rankAfter !== rankBefore,
    rank: rankAfter,
  };
}
