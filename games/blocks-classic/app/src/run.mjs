// Broken Well — one shift as it happens. The engine (src/engine.js) already counts everything a
// contract needs — pieces locked, hard drops, four-line clears, rubble rows survived — so this module
// only remembers how the shift began and turns the engine's own counters into the summary the
// contracts, the Hall and the logbook read. Pure: the engine's game object is only read.

/**
 * @param {{ kind: 'career'|'daily'|'free', name: string, shiftId?: string, dailyKey?: string, tasks?: unknown[] }} what
 * @param {object} options  the engine config the shift started with (preset, mode, targets)
 */
export function startRun(what, options) {
  return { ...what, tasks: what.tasks ?? [], options, startedAt: Date.now() };
}

/**
 * @param {object} run
 * @param {object} game  the engine's WellGame at the moment the shift ended
 * @param {boolean} cleared  the shift's line or flood target was reached
 */
export function summarize(run, game, cleared) {
  return {
    cleared,
    lines: game.lines,
    score: game.score,
    piecesLocked: game.piecesLocked,
    hardDrops: game.hardDrops,
    quads: game.quads,
    rubbleRowsSurvived: game.rubbleRowsSurvived,
    toppedOut: game.gameOver,
    seconds: Math.round((Date.now() - run.startedAt) / 1000),
  };
}

/** Whether a shift in progress has reached its own target, read straight from the engine and the
 * options it started with. */
export function hasReachedTarget(game, options) {
  if (options.mode === 'survival') return game.rubbleRowsSurvived >= (options.surviveRows ?? Infinity);
  return game.lines >= (options.targetLines ?? Infinity);
}
