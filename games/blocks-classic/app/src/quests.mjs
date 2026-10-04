// Broken Well — contracts. Every shift comes with a briefing of three contracts; each one met on
// a shift that ends cleared earns a seal. A contract reads only the run's summary (see run.mjs),
// so it can be checked anywhere, including the tests. Pure.

/**
 * @typedef {object} RunSummary
 * @property {boolean} cleared        the shift's line or flood target was reached
 * @property {number} lines
 * @property {number} score
 * @property {number} piecesLocked
 * @property {number} hardDrops
 * @property {number} quads        four-line clears
 * @property {number} rubbleRowsSurvived
 * @property {boolean} toppedOut
 */

/** The kinds of contract, each with its wording and its check; `n` is the shift's own number. */
export const TASKS = {
  swift: {
    text: (n) => `Finish the shift in ${n} pieces or fewer.`,
    met: (run, n) => run.piecesLocked <= n,
  },
  'light-touch': {
    text: (n) => `Hard-drop no more than ${n} pieces.`,
    met: (run, n) => run.hardDrops <= n,
  },
  'no-topout': {
    text: () => 'Finish without the stack reaching the top.',
    met: (run) => !run.toppedOut,
  },
  score: {
    text: (n) => `Bank a score of ${n} or more.`,
    met: (run, n) => run.score >= n,
  },
  quad: {
    text: () => 'Clear four lines in a single drop.',
    met: (run) => run.quads >= 1,
  },
  flood: {
    text: (n) => `Hold the well through ${n} rising rubble rows.`,
    met: (run, n) => run.rubbleRowsSurvived >= n,
  },
};

/** @typedef {[keyof typeof TASKS, number?]} Task  a kind and, for some kinds, its number */

/** @param {Task} task */
export function taskText([kind, n]) {
  return TASKS[kind].text(n);
}

/**
 * Which of a briefing's contracts the run met. Nothing counts unless the shift was cleared.
 * @param {Task[]} tasks
 * @param {RunSummary} run
 * @returns {boolean[]}
 */
export function tasksMet(tasks, run) {
  return tasks.map(([kind, n]) => run.cleared && TASKS[kind].met(run, n));
}
