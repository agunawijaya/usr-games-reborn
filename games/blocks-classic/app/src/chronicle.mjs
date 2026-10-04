// Broken Well — the logbook. Every shift is written up afterwards as a short foreman's entry,
// from the events the run kept; the logbook keeps the most recent ones. The last line is the
// shift's own outcome. Pure.

const LOGBOOK_SIZE = 30;

function presetLabel(preset) {
  const labels = {
    normal: 'the open shaft',
    canyon: 'the canyon cut',
    tower: 'the tower shaft',
    wide: 'the wide cut',
    split: 'the split shaft',
    hourglass: 'the hourglass neck',
    donut: 'the donut pillar',
    staircase: 'the staircase fall',
  };
  return labels[preset] ?? 'the shaft';
}

/**
 * The account of one shift.
 * @param {ReturnType<import('./run.mjs').startRun>} run
 * @param {{ cleared: boolean, lines: number, score: number, quads: number }} summary
 * @returns {string[]}
 */
export function chronicleLines(run, summary) {
  const lines = [];
  lines.push(`You clocked in at ${presetLabel(run.options.preset)}.`);
  if (summary.quads > 0) {
    lines.push(summary.quads === 1 ? 'A clean four-line drop cleared the deck.' : `${summary.quads} four-line drops cleared the deck, one after another.`);
  }
  if (run.options.mode === 'survival') {
    lines.push(`The rubble kept rising; you held the well through ${summary.rubbleRowsSurvived} flood row${summary.rubbleRowsSurvived === 1 ? '' : 's'}.`);
  } else {
    lines.push(`${summary.lines} line${summary.lines === 1 ? '' : 's'} went out of the shaft, ${summary.piecesLocked} piece${summary.piecesLocked === 1 ? '' : 's'} at a time.`);
  }
  lines.push(
    summary.cleared
      ? `The shift ended clean: ${summary.score} points banked and the well held.`
      : `The stack reached the top before the shift was done. ${summary.score} points banked.`,
  );
  return lines;
}

/** @returns {Array<object>} */
export function emptyLogbook() {
  return [];
}

/** The logbook with a new entry first, the oldest dropped beyond its size. */
export function addToLogbook(logbook, entry) {
  return [entry, ...logbook].slice(0, LOGBOOK_SIZE);
}
