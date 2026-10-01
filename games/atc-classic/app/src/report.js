// Control Room 1986 — the shift report, as the room's dot-matrix printer types it after every
// shift. Pure: it turns a summary of the shift into fixed-width lines; desk.js prints them.

/** Characters on a line of the report. */
export const REPORT_WIDTH = 44;

/**
 * @typedef {object} ShiftSummary
 * @property {'career' | 'open' | 'daily'} mode
 * @property {string} dateKey
 * @property {string} sectorName
 * @property {{ number: number, total: number, title: string, target: number } | null} assignment
 * @property {{ number: number } | null} daily
 * @property {number} safe
 * @property {number} landings
 * @property {number} exits
 * @property {number} takeoffs
 * @property {number} orders     orders the engine accepted
 * @property {number} refused    orders the parser or the engine refused
 * @property {number} seconds    time on position, pauses left out
 * @property {'relieved' | 'lost' | 'quit'} ended
 * @property {string | null} lostPlane
 * @property {string | null} lostReason
 * @property {{ text: string, done: boolean }[]} tasks  the target first on an assignment
 * @property {{ title: string, promoted: boolean, next: string | null }} rank
 */

/** @typedef {{ text: string, style: 'title' | 'rule' | 'row' | 'task' | 'result' | 'blank' }} ReportLine */

const line = (text, style = 'row') => ({ text, style });

/** `LABEL ........ VALUE`, right-aligned to the width. */
export function leader(label, value) {
  const right = String(value);
  const dots = Math.max(2, REPORT_WIDTH - label.length - right.length - 2);
  return `${label} ${'.'.repeat(dots)} ${right}`;
}

function minutesAndSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Orders a minute on position, one decimal; 0.0 for a shift too short to say. */
export function ordersPerMinute(orders, seconds) {
  if (seconds < 20) return '0.0';
  return (orders / (seconds / 60)).toFixed(1);
}

function heading(summary) {
  if (summary.mode === 'career' && summary.assignment) {
    const { number, total, title } = summary.assignment;
    return `ASSIGNMENT ${number}/${total} · ${title.toUpperCase()}`;
  }
  if (summary.mode === 'daily' && summary.daily) return `DAILY TRAFFIC #${summary.daily.number}`;
  return 'OPEN SHIFT';
}

function result(summary) {
  if (summary.ended === 'relieved') return 'RESULT: RELIEVED ON SCHEDULE';
  if (summary.ended === 'quit') return 'RESULT: LEFT THE POSITION';
  const who = summary.lostPlane ? `${summary.lostPlane}: ` : '';
  return `RESULT: SHIFT ENDED · ${who}${summary.lostReason ?? 'plane lost'}`.toUpperCase();
}

/** Splits a long result over lines at spaces, so nothing runs off the paper. */
function wrap(text, width = REPORT_WIDTH) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = `  ${word}`;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * @param {ShiftSummary} summary
 * @returns {ReportLine[]}
 */
export function reportLines(summary) {
  const rule = line('-'.repeat(REPORT_WIDTH), 'rule');
  const stamps = summary.tasks.filter((task) => task.done).length;
  const lines = [
    line('CONTROL ROOM 1986 · SHIFT REPORT', 'title'),
    line(`${summary.dateKey} · SECTOR ${summary.sectorName.toUpperCase()}`),
    line(heading(summary)),
    rule,
  ];
  const home =
    summary.mode === 'career' && summary.assignment
      ? `${summary.safe} · TARGET ${summary.assignment.target}`
      : String(summary.safe);
  lines.push(
    line(leader('PLANES HOME', home)),
    line(leader('  LANDED', summary.landings)),
    line(leader('  HANDED OFF', summary.exits)),
    line(leader('DEPARTURES CLEARED', summary.takeoffs)),
    line(leader('ORDERS GIVEN', summary.orders)),
    line(leader('ORDERS REFUSED', summary.refused)),
    line(leader('ORDERS A MINUTE', ordersPerMinute(summary.orders, summary.seconds))),
    line(leader('TIME ON POSITION', minutesAndSeconds(summary.seconds))),
    rule,
    line('BRIEFING'),
  );
  for (const task of summary.tasks) {
    const mark = task.done ? '[X]' : '[ ]';
    for (const [i, text] of wrap(`${mark} ${task.text.toUpperCase()}`, REPORT_WIDTH - 2).entries()) {
      lines.push(line(`  ${i === 0 ? text : `    ${text.trim()}`}`, 'task'));
    }
  }
  lines.push(line(leader('COMMENDATION STAMPS', `${stamps} OF ${summary.tasks.length}`)), rule);
  for (const text of wrap(result(summary))) lines.push(line(text, 'result'));
  lines.push(line(`RANK: ${summary.rank.title.toUpperCase()}${summary.rank.promoted ? ' · PROMOTED' : ''}`, 'result'));
  if (summary.rank.next) lines.push(line(`NEXT: ${summary.rank.next.toUpperCase()}`));
  return lines;
}
