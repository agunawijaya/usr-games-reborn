// Control Room 1986 — the career. Twelve assignments across the three sectors, each with a number
// of planes to bring home before the relief controller takes over, and a briefing of two more
// tasks. Passing assignments raises the controller's rank; passing every assignment of a sector
// endorses the licence for it. Pure data and arithmetic: no DOM, no storage.

/** @typedef {import('./briefing.js').Task} Task */

/**
 * @typedef {object} Assignment
 * @property {string} id
 * @property {string} title
 * @property {'easy' | 'default' | 'killer'} sector
 * @property {number} target   planes home before the relief arrives
 * @property {Task[]} tasks     the two tasks of the briefing besides the target
 * @property {string} note      one line of context printed on the briefing
 */

/** @type {Assignment[]} */
export const ASSIGNMENTS = [
  {
    id: 'first-watch',
    title: 'First watch',
    sector: 'easy',
    target: 2,
    tasks: [{ kind: 'land', count: 1 }, { kind: 'cleanRadio' }],
    note: 'A quiet training sector. Take your time with every order.',
  },
  {
    id: 'wheels-down',
    title: 'Wheels down',
    sector: 'easy',
    target: 3,
    tasks: [{ kind: 'land', count: 2 }, { kind: 'takeoff', count: 1 }],
    note: 'The field is open both ways today: arrivals in, departures out.',
  },
  {
    id: 'morning-push',
    title: 'Morning push',
    sector: 'easy',
    target: 5,
    tasks: [{ kind: 'exit', count: 2 }, { kind: 'steadyFuel' }],
    note: 'Traffic builds through the morning. Keep the overflights moving.',
  },
  {
    id: 'reference-sector',
    title: 'The reference sector',
    sector: 'default',
    target: 3,
    tasks: [{ kind: 'landAt', airport: 0, count: 1 }, { kind: 'beacon' }],
    note: 'The sector the 1986 game was drawn around: seven exits, two fields.',
  },
  {
    id: 'two-fields',
    title: 'Two fields',
    sector: 'default',
    target: 5,
    tasks: [{ kind: 'landAt', airport: 1, count: 1 }, { kind: 'takeoff', count: 1 }],
    note: 'The regional field at A1 takes traffic too. Mind its runway arrow.',
  },
  {
    id: 'long-afternoon',
    title: 'Long afternoon',
    sector: 'easy',
    target: 8,
    tasks: [{ kind: 'hold' }, { kind: 'cleanRadio' }],
    note: 'A long watch in the training sector. Park a plane when you need room.',
  },
  {
    id: 'handoffs',
    title: 'Handoffs',
    sector: 'default',
    target: 7,
    tasks: [{ kind: 'exit', count: 4 }, { kind: 'steadyFuel' }],
    note: 'Most of today’s traffic is passing through. See it out at 9,000 feet.',
  },
  {
    id: 'fast-lane',
    title: 'Fast lane',
    sector: 'killer',
    target: 2,
    tasks: [{ kind: 'land', count: 1 }, { kind: 'cleanRadio' }],
    note: 'Three seconds a tick. Read the whole board before you type.',
  },
  {
    id: 'evening-rush',
    title: 'Evening rush',
    sector: 'default',
    target: 9,
    tasks: [{ kind: 'takeoff', count: 2 }, { kind: 'beacon' }],
    note: 'Departures queue up at both fields as the evening flights arrive.',
  },
  {
    id: 'short-fuse',
    title: 'Short fuse',
    sector: 'killer',
    target: 4,
    tasks: [{ kind: 'exit', count: 2 }, { kind: 'hold' }],
    note: 'The fast sector again, with more of it. A holding circle buys time.',
  },
  {
    id: 'double-watch',
    title: 'Double watch',
    sector: 'default',
    target: 12,
    tasks: [{ kind: 'land', count: 6 }, { kind: 'steadyFuel' }],
    note: 'Your relief is running late. Hold the reference sector until they come.',
  },
  {
    id: 'midnight-in-the-room',
    title: 'Midnight in the room',
    sector: 'killer',
    target: 7,
    tasks: [{ kind: 'takeoff', count: 2 }, { kind: 'cleanRadio' }],
    note: 'The last watch of the career, on the hardest board in the building.',
  },
];

/** Every assignment earns up to three stamps: its target and the two tasks of its briefing. */
export const STAMPS_PER_ASSIGNMENT = 3;

/**
 * Ranks follow assignments passed; the last needs most of the stamps as well.
 * @type {{ id: string, title: string, passed: number, stamps?: number }[]}
 */
export const RANKS = [
  { id: 'trainee', title: 'Trainee', passed: 0 },
  { id: 'assistant', title: 'Assistant Controller', passed: 3 },
  { id: 'controller', title: 'Controller', passed: 6 },
  { id: 'senior', title: 'Senior Controller', passed: 9 },
  { id: 'supervisor', title: 'Watch Supervisor', passed: 12 },
  { id: 'chief', title: 'Chief of the Room', passed: 12, stamps: 30 },
];

/**
 * The career as saved: the best stamps earned on each assignment passed.
 * @typedef {{ passed: Record<string, number> }} CareerRecord
 */

/** @returns {CareerRecord} */
export function newCareer() {
  return { passed: {} };
}

/** @param {CareerRecord} career */
export function passedCount(career) {
  return ASSIGNMENTS.filter((a) => career.passed[a.id] !== undefined).length;
}

/** @param {CareerRecord} career */
export function stampTotal(career) {
  return ASSIGNMENTS.reduce((sum, a) => sum + (career.passed[a.id] ?? 0), 0);
}

/** The first assignment is always open; each later one opens when the one before is passed. */
export function isUnlocked(career, index) {
  if (index <= 0) return true;
  const before = ASSIGNMENTS[index - 1];
  return before !== undefined && career.passed[before.id] !== undefined;
}

/** The assignment to offer next: the first not yet passed, or the last when all are. */
export function nextAssignmentIndex(career) {
  const open = ASSIGNMENTS.findIndex((a) => career.passed[a.id] === undefined);
  return open < 0 ? ASSIGNMENTS.length - 1 : open;
}

/** @param {CareerRecord} career */
export function rankIndex(career) {
  const passed = passedCount(career);
  const stamps = stampTotal(career);
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (passed >= rank.passed && stamps >= (rank.stamps ?? 0)) index = i;
  });
  return index;
}

/**
 * What the next rank asks for, in words for the licence card; null at the top.
 * @param {CareerRecord} career
 */
export function nextRankNeed(career) {
  const next = RANKS[rankIndex(career) + 1];
  if (!next) return null;
  const passed = passedCount(career);
  if (passed < next.passed) {
    const left = next.passed - passed;
    return { rank: next.title, text: `${left} more assignment${left === 1 ? '' : 's'}`, share: passed / next.passed };
  }
  const stamps = stampTotal(career);
  const left = (next.stamps ?? 0) - stamps;
  return { rank: next.title, text: `${left} more stamp${left === 1 ? '' : 's'}`, share: stamps / (next.stamps ?? 1) };
}

/** A sector's endorsement: every assignment in that sector passed. */
export function isEndorsed(career, sector) {
  return ASSIGNMENTS.filter((a) => a.sector === sector).every((a) => career.passed[a.id] !== undefined);
}

/**
 * The career after an assignment's shift: a pass keeps the better stamp count; a shift that did
 * not reach its target changes nothing (the stamps of a failed shift do not count).
 * @param {CareerRecord} career
 * @param {string} assignmentId
 * @param {boolean} passed
 * @param {number} stamps
 * @returns {CareerRecord}
 */
export function withShift(career, assignmentId, passed, stamps) {
  if (!passed) return career;
  const best = Math.max(career.passed[assignmentId] ?? 0, stamps);
  return { ...career, passed: { ...career.passed, [assignmentId]: best } };
}
