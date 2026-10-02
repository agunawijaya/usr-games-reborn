// The Rune Gates — quests. Every delve comes with a briefing of three tasks; each one met on a
// delve that ends with the wumpus slain earns a seal. A task reads only the run's summary (see
// run.mjs), so it can be checked anywhere, including the tests. Pure.

/**
 * @typedef {object} RunSummary
 * @property {boolean} slain
 * @property {number} moves        every step tried, a bump against a wall included
 * @property {number} bumps
 * @property {number} batRides
 * @property {number} ledges       times the delver clung to a rock outcrop over a pit
 * @property {number} arrowsFired
 * @property {number} arrowsLeft
 * @property {number} slayingPath  chambers named for the arrow that slew the wumpus (0 if none)
 * @property {boolean} woke        the wumpus stirred at least once
 * @property {number} visited      chambers entered, the first one included
 * @property {boolean} chartOpened
 */

/** The kinds of task, each with its wording and its check; `n` is the delve's own number. */
export const TASKS = {
  swift: {
    text: (n) => `Reach the lair within ${n} moves.`,
    met: (run, n) => run.moves <= n,
  },
  'no-bats': {
    text: () => 'Never ride with the super-bats.',
    met: (run) => run.batRides === 0,
  },
  'first-arrow': {
    text: () => 'Slay it with your first arrow.',
    met: (run) => run.arrowsFired === 1,
  },
  spare: {
    text: (n) => `Keep ${n} arrows in your quiver.`,
    met: (run, n) => run.arrowsLeft >= n,
  },
  'no-bumps': {
    text: () => 'Never strike a wall.',
    met: (run) => run.bumps === 0,
  },
  quiet: {
    text: () => 'Never wake the wumpus.',
    met: (run) => !run.woke,
  },
  'few-chambers': {
    text: (n) => `Enter no more than ${n} chambers.`,
    met: (run, n) => run.visited <= n,
  },
  crooked: {
    text: (n) => `Slay it with an arrow that flies through ${n} or more chambers.`,
    met: (run, n) => run.slayingPath >= n,
  },
  'no-chart': {
    text: () => 'Find it without opening the cave chart.',
    met: (run) => !run.chartOpened,
  },
};

/** @typedef {[keyof typeof TASKS, number?]} Task  a kind and, for some kinds, its number */

/** @param {Task} task */
export function taskText([kind, n]) {
  return TASKS[kind].text(n);
}

/**
 * Which of a briefing's tasks the run met. Nothing counts unless the wumpus was slain.
 * @param {Task[]} tasks
 * @param {RunSummary} run
 * @returns {boolean[]}
 */
export function tasksMet(tasks, run) {
  return tasks.map(([kind, n]) => run.slain && TASKS[kind].met(run, n));
}
