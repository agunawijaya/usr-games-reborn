// Control Room 1986 — the shift briefing. A briefing is a short list of tasks printed on the
// clipboard before a shift; each one done earns a commendation stamp. The tracker follows the
// engine's events and the orders the player types, the same way the Hall's packages do. Pure:
// no DOM, no storage, no clock of its own.

/** Minutes of a full shift, as the console's shift clock counts them down. */
export const FULL_SHIFT_MINUTES = 15;
/** A pilot calls "minimum fuel" at this much fuel or less (main.js says it on the radio). */
export const MINIMUM_FUEL = 6;

/**
 * @typedef {(
 *   | { kind: 'land', count: number }
 *   | { kind: 'landAt', airport: number, count: number }
 *   | { kind: 'exit', count: number }
 *   | { kind: 'exitVia', exit: number }
 *   | { kind: 'takeoff', count: number }
 *   | { kind: 'beacon' }
 *   | { kind: 'hold' }
 *   | { kind: 'cleanRadio' }
 *   | { kind: 'steadyFuel' }
 *   | { kind: 'fullShift' }
 * )} Task
 */

/** Tasks that hold until something breaks them, and count when the shift ends unbroken. */
const KEEPING = new Set(['cleanRadio', 'steadyFuel']);

const plural = (count, one, many) => (count === 1 ? one : `${count} ${many}`);

/**
 * The task as the clipboard prints it.
 * @param {Task} task
 * @param {{ airports: { label: string }[], exits: { label: string }[] }} playfield
 */
export function describeTask(task, playfield) {
  switch (task.kind) {
    case 'land':
      return `Land ${plural(task.count, 'a plane', 'planes')}`;
    case 'landAt':
      return `Land ${plural(task.count, 'a plane', 'planes')} at airport ${playfield.airports[task.airport]?.label ?? task.airport}`;
    case 'exit':
      return `Hand off ${plural(task.count, 'a plane', 'planes')} through the exits`;
    case 'exitVia':
      return `Hand off a plane through exit ${playfield.exits[task.exit]?.label ?? task.exit}`;
    case 'takeoff':
      return `Clear ${plural(task.count, 'a departure', 'departures')} off the ground`;
    case 'beacon':
      return 'Turn a plane toward a beacon, then bring it home';
    case 'hold':
      return 'Park a plane in a holding circle, then bring it home';
    case 'cleanRadio':
      return 'Give every order right the first time';
    case 'steadyFuel':
      return 'Keep every pilot off minimum fuel';
    case 'fullShift':
      return `Stay on position for the full ${FULL_SHIFT_MINUTES} minutes`;
    default:
      return 'Unknown task';
  }
}

/**
 * @typedef {object} Tracker
 * @property {Task[]} tasks
 * @property {number} landings
 * @property {number[]} landingsAt   by airport index
 * @property {number} exits
 * @property {Set<number>} exitsVia
 * @property {number} takeoffs
 * @property {boolean} beaconHome
 * @property {boolean} holdHome
 * @property {boolean} refused
 * @property {boolean} lowFuel
 * @property {boolean} fullShift
 * @property {Set<string>} beaconBound   radar letters sent toward a beacon
 * @property {Set<string>} circled       radar letters put in a holding circle
 */

/** @param {Task[]} tasks @returns {Tracker} */
export function createTracker(tasks) {
  return {
    tasks,
    landings: 0,
    landingsAt: [],
    exits: 0,
    exitsVia: new Set(),
    takeoffs: 0,
    beaconHome: false,
    holdHome: false,
    refused: false,
    lowFuel: false,
    fullShift: false,
    beaconBound: new Set(),
    circled: new Set(),
  };
}

/** After every order the engine accepted. */
export function trackCommand(tracker, cmd, plane) {
  if (cmd.action === 'towardsBeacon') tracker.beaconBound.add(plane.letter);
  if (cmd.action === 'circle') tracker.circled.add(plane.letter);
}

/** An order the parser or the engine refused. */
export function trackRefusal(tracker) {
  tracker.refused = true;
}

function arrived(tracker, letter) {
  if (tracker.beaconBound.has(letter)) tracker.beaconHome = true;
  if (tracker.circled.has(letter)) tracker.holdHome = true;
  forget(tracker, letter);
}

function forget(tracker, letter) {
  tracker.beaconBound.delete(letter);
  tracker.circled.delete(letter);
}

/**
 * After every tick that did not lose a plane, with the engine's events and the planes in the air.
 * @param {Tracker} tracker
 * @param {{ type: string, plane: string, airport?: number, exit?: number }[]} events
 * @param {{ fuel: number }[]} air
 */
export function trackTick(tracker, events, air) {
  for (const event of events) {
    // A radar letter comes back only after its plane is gone, so a new plane forgets the old one.
    if (event.type === 'spawn') forget(tracker, event.plane);
    if (event.type === 'takeoff') tracker.takeoffs += 1;
    if (event.type === 'land') {
      tracker.landings += 1;
      const at = event.airport ?? 0;
      tracker.landingsAt[at] = (tracker.landingsAt[at] ?? 0) + 1;
      arrived(tracker, event.plane);
    }
    if (event.type === 'exit') {
      tracker.exits += 1;
      tracker.exitsVia.add(event.exit ?? -1);
      arrived(tracker, event.plane);
    }
  }
  if (air.some((plane) => plane.fuel <= MINIMUM_FUEL)) tracker.lowFuel = true;
}

/** When the shift clock runs out with the controller still on position. */
export function trackFullShift(tracker) {
  tracker.fullShift = true;
}

/**
 * Where a task stands: done, still open, holding (a keeping task not broken yet) or broken.
 * @param {Tracker} tracker
 * @param {Task} task
 * @returns {'done' | 'open' | 'holding' | 'broken'}
 */
export function taskState(tracker, task) {
  switch (task.kind) {
    case 'land':
      return tracker.landings >= task.count ? 'done' : 'open';
    case 'landAt':
      return (tracker.landingsAt[task.airport] ?? 0) >= task.count ? 'done' : 'open';
    case 'exit':
      return tracker.exits >= task.count ? 'done' : 'open';
    case 'exitVia':
      return tracker.exitsVia.has(task.exit) ? 'done' : 'open';
    case 'takeoff':
      return tracker.takeoffs >= task.count ? 'done' : 'open';
    case 'beacon':
      return tracker.beaconHome ? 'done' : 'open';
    case 'hold':
      return tracker.holdHome ? 'done' : 'open';
    case 'cleanRadio':
      return tracker.refused ? 'broken' : 'holding';
    case 'steadyFuel':
      return tracker.lowFuel ? 'broken' : 'holding';
    case 'fullShift':
      return tracker.fullShift ? 'done' : 'open';
    default:
      return 'open';
  }
}

/** A task's progress in a few characters for the sidebar, such as `1/2`; empty when it has none. */
export function taskProgress(tracker, task) {
  const of = (have, need) => `${Math.min(have, need)}/${need}`;
  switch (task.kind) {
    case 'land':
      return of(tracker.landings, task.count);
    case 'landAt':
      return of(tracker.landingsAt[task.airport] ?? 0, task.count);
    case 'exit':
      return of(tracker.exits, task.count);
    case 'takeoff':
      return of(tracker.takeoffs, task.count);
    default:
      return '';
  }
}

/**
 * Whether each task counts when the shift is over: a keeping task counts if nothing broke it.
 * @param {Tracker} tracker
 * @returns {boolean[]}
 */
export function tasksDone(tracker) {
  return tracker.tasks.map((task) => {
    const state = taskState(tracker, task);
    return state === 'done' || (state === 'holding' && KEEPING.has(task.kind));
  });
}

/**
 * Three tasks for an open shift or the Daily, drawn from what the sector has: its airports, its
 * exits and how busy it is. `random` returns a number in [0, 1), so a seeded one gives everyone
 * the same briefing.
 * @param {{ airports: unknown[], exits: unknown[], beacons: unknown[], updateSecs: number }} playfield
 * @param {() => number} random
 * @returns {Task[]}
 */
export function generateTasks(playfield, random) {
  const fast = playfield.updateSecs <= 3;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const pool = [
    () => ({ kind: 'land', count: fast ? 1 : pick([2, 3]) }),
    () => ({ kind: 'landAt', airport: Math.floor(random() * playfield.airports.length), count: 1 }),
    () => ({ kind: 'exit', count: fast ? 1 : pick([2, 3]) }),
    () => ({ kind: 'exitVia', exit: Math.floor(random() * playfield.exits.length) }),
    () => ({ kind: 'takeoff', count: 1 }),
    ...(playfield.beacons.length > 0 ? [() => ({ kind: 'beacon' })] : []),
    () => ({ kind: 'hold' }),
    () => ({ kind: 'cleanRadio' }),
    () => ({ kind: 'steadyFuel' }),
    () => ({ kind: 'fullShift' }),
  ];
  const tasks = [];
  const kinds = new Set();
  // Three different kinds; landing at a field and landing anywhere count as the same kind.
  for (let tries = 0; tasks.length < 3 && tries < 50; tries++) {
    const task = pick(pool)();
    const family = task.kind === 'landAt' ? 'land' : task.kind === 'exitVia' ? 'exit' : task.kind;
    if (kinds.has(family)) continue;
    kinds.add(family);
    tasks.push(task);
  }
  return tasks;
}
