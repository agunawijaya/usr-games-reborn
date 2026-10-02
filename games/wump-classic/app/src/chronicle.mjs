// The Rune Gates — the chronicle. Every delve is written up afterwards as a short account in the
// delvers' manner, from the events the run kept; the ledger keeps the most recent ones. The last
// line is the game's own word on how it ended, as it always printed it. Pure.

const LEDGER_SIZE = 30;

function senses(cues) {
  const felt = [];
  if (cues.draft) felt.push('a cold draft rose from one of the tunnels');
  if (cues.stench) felt.push('the stench of the wumpus hung in the air');
  if (cues.flutter) felt.push('wings stirred somewhere close');
  if (felt.length === 0) return '';
  const joined = felt.length === 1 ? felt[0] : `${felt.slice(0, -1).join(', ')} and ${felt[felt.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

function shotLine(event) {
  const path = event.path.join(' → ');
  let line = `You loosed an arrow along ${path}.`;
  if (event.slain) line += ` It found the wumpus in chamber ${event.trajectory[event.trajectory.length - 1]}.`;
  else if (event.self) line += ' It bent back round to you.';
  else if (event.decayed) line += ' It fell short before the end of its flight.';
  else line += ' It struck stone.';
  if (event.moved) line += ' Somewhere the wumpus stirred and moved.';
  return line;
}

/**
 * The account of one delve.
 * @param {ReturnType<import('./run.mjs').startRun>} run
 * @param {{ title: string, message: string }} ending  the game's own words for the ending
 * @returns {string[]}
 */
export function chronicleLines(run, ending) {
  const lines = [];
  let pending = '';
  const flush = () => {
    if (pending) lines.push(pending);
    pending = '';
  };
  for (const event of run.events) {
    switch (event.type) {
      case 'start':
        pending = `You passed through the rune gate into chamber ${event.room}.`;
        if (senses(event.cues)) pending += ` ${senses(event.cues)}`;
        flush();
        break;
      case 'walk':
        flush();
        pending = `You walked on to chamber ${event.to}.`;
        break;
      case 'magic':
        flush();
        pending = `A shimmering tunnel set you down in chamber ${event.to}.`;
        break;
      case 'bump':
        flush();
        lines.push(`Reaching for chamber ${event.to}, you met solid rock.${event.woke ? ' The thud woke the wumpus, and it shifted.' : ''}`);
        break;
      case 'bats':
        pending += ` Super-bats seized you there and carried you off to chamber ${event.to}.`;
        break;
      case 'ledge':
        pending += ` The ground gave way, but you clung to a rock outcrop and climbed back.`;
        break;
      case 'sense':
        if (senses(event.cues)) pending += ` ${senses(event.cues)}`;
        break;
      case 'shot':
        flush();
        lines.push(shotLine(event));
        break;
      default:
    }
  }
  flush();
  lines.push(`${ending.title.charAt(0)}${ending.title.slice(1).toLowerCase()} ${ending.message}`);
  return lines;
}

/** @returns {Array<object>} */
export function emptyLedger() {
  return [];
}

/** The ledger with a new chronicle first, the oldest dropped beyond its size. */
export function addToLedger(ledger, entry) {
  return [entry, ...ledger].slice(0, LEDGER_SIZE);
}
