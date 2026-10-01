// atc/fancy-web — Command grammar parser
// Simplified from BSD atc grammar.y. Grammar:
//
//   plane := [A-Za-z]
//   digit := [0-9]
//   dirKey := q|w|e|d|c|x|z|a  (compass)
//   sign  := + | -
//
//   command := plane action [suffix]
//
//   action := 'a' altitude
//           | 'c'                                -- circle
//           | 't' turn                            -- turn
//           | 'm'                                 -- mark
//           | 'i'                                 -- ignore
//           | 'u'                                 -- unmark
//
//   altitude := digit                             -- absolute 0..9
//             | sign digit                        -- relative
//             | 'c' digit                         -- alias for '+ digit'
//             | 'd' digit                         -- alias for '- digit'
//
//   turn := dirKey                                -- turn to absolute direction
//         | 'l' dirKey                            -- turn left toward dirKey
//         | 'r' dirKey                            -- turn right toward dirKey
//         | 'L'                                   -- hard left (90°)
//         | 'R'                                   -- hard right (90°)
//         | 't' 'b' digit                         -- turn toward beacon N
//         | 't' 'a' digit                         -- turn toward airport N
//         | 't' 'e' digit                         -- turn toward exit N
//
//   suffix := 'ab' digit                          -- do action at beacon N (delayed)
//           | '@' 'b' digit                       -- same
//
// The parser is designed to work incrementally — parse() may return
// PARTIAL for well-formed prefixes so the UI can show completion hints.

import { DIR_KEYS } from './engine.js';

export const PARSE = {
  OK: 'OK',           // full command parsed
  PARTIAL: 'PARTIAL', // valid prefix; more tokens welcome
  ERROR: 'ERROR',
};

/** Parse a raw command string into a command object.
 *  Returns { status, cmd?, error?, next? }
 *  where cmd is { plane, action, arg, delayedBeacon? } on OK
 *  and next is a hint array of valid next tokens on PARTIAL. */
export function parseCommand(input) {
  const s = input.trim();
  if (s.length === 0) return { status: PARSE.PARTIAL, next: ['A..Z (plane letter)'] };

  const chars = [...s];
  let i = 0;

  // 1. plane letter
  const planeCh = chars[i];
  if (!/^[A-Za-z]$/.test(planeCh)) {
    return { status: PARSE.ERROR, error: `Expected plane letter, got "${planeCh}"` };
  }
  const plane = planeCh.toUpperCase();
  i++;
  if (i >= chars.length) {
    return { status: PARSE.PARTIAL, next: ['a=altitude', 't=turn', 'c=circle', 'm=mark', 'i=ignore', 'u=unmark'] };
  }

  // 2. action
  const action = chars[i]; i++;

  switch (action) {
    case 'a': return parseAltitude(chars, i, plane);
    case 't': return parseTurn(chars, i, plane);
    case 'c': return finish({ plane, action: 'circle' }, chars, i);
    case 'm': return finish({ plane, action: 'mark' }, chars, i);
    case 'i': return finish({ plane, action: 'ignore' }, chars, i);
    case 'u': return finish({ plane, action: 'unmark' }, chars, i);
    default: return { status: PARSE.ERROR, error: `Unknown action "${action}"` };
  }
}

function parseAltitude(chars, i, plane) {
  if (i >= chars.length) {
    return { status: PARSE.PARTIAL, next: ['0..9 = altitude', '+n = climb n', '-n = descend n'] };
  }
  const t = chars[i]; i++;
  if (/^[0-9]$/.test(t)) {
    return finish({ plane, action: 'altitude', arg: parseInt(t, 10) }, chars, i);
  }
  if (t === '+' || t === 'c') {
    if (i >= chars.length) return { status: PARSE.PARTIAL, next: ['1..9 = climb steps'] };
    const d = chars[i]; i++;
    if (!/^[0-9]$/.test(d)) return { status: PARSE.ERROR, error: `Expected digit after ${t}` };
    return finish({ plane, action: 'altitudeUp', arg: parseInt(d, 10) }, chars, i);
  }
  if (t === '-' || t === 'd') {
    if (i >= chars.length) return { status: PARSE.PARTIAL, next: ['1..9 = descend steps'] };
    const d = chars[i]; i++;
    if (!/^[0-9]$/.test(d)) return { status: PARSE.ERROR, error: `Expected digit after ${t}` };
    return finish({ plane, action: 'altitudeDown', arg: parseInt(d, 10) }, chars, i);
  }
  return { status: PARSE.ERROR, error: `Expected digit or +/- after 'a', got "${t}"` };
}

function parseTurn(chars, i, plane) {
  if (i >= chars.length) {
    return { status: PARSE.PARTIAL, next: ['qwedcxza = compass dir', 'L=hard left', 'R=hard right', 'tb=to beacon', 'ta=to airport', 'te=to exit'] };
  }
  const t = chars[i]; i++;

  // Absolute compass direction
  if (t in DIR_KEYS) {
    return finish({ plane, action: 'turn', arg: DIR_KEYS[t] }, chars, i);
  }
  if (t === 'L') return finish({ plane, action: 'turnHardLeft' }, chars, i);
  if (t === 'R') return finish({ plane, action: 'turnHardRight' }, chars, i);

  // 'towards' variants: tb<n>, ta<n>, te<n>
  if (t === 't') {
    if (i >= chars.length) return { status: PARSE.PARTIAL, next: ['b=beacon', 'a=airport', 'e=exit'] };
    const kind = chars[i]; i++;
    if (i >= chars.length) return { status: PARSE.PARTIAL, next: ['0..9 = index'] };
    const idx = chars[i]; i++;
    if (!/^[0-9]$/.test(idx)) return { status: PARSE.ERROR, error: 'Expected index digit' };
    const arg = parseInt(idx, 10);
    if (kind === 'b') return finish({ plane, action: 'towardsBeacon', arg }, chars, i);
    if (kind === 'a') return finish({ plane, action: 'towardsAirport', arg }, chars, i);
    if (kind === 'e') return finish({ plane, action: 'towardsExit', arg }, chars, i);
    return { status: PARSE.ERROR, error: `Unknown target "${kind}"` };
  }

  return { status: PARSE.ERROR, error: `Unknown turn target "${t}"` };
}

function finish(cmd, chars, i) {
  // Optionally parse a "@b<n>" or "ab<n>" delayed-at-beacon suffix
  if (i >= chars.length) return { status: PARSE.OK, cmd };
  const t = chars[i]; i++;
  if (t !== '@' && t !== 'a') {
    return { status: PARSE.ERROR, error: `Unexpected trailing "${t}"` };
  }
  if (i >= chars.length) return { status: PARSE.PARTIAL, next: ['b = at beacon'] };
  const b = chars[i]; i++;
  if (b !== 'b') return { status: PARSE.ERROR, error: `Expected 'b' after "${t}"` };
  if (i >= chars.length) return { status: PARSE.PARTIAL, next: ['0..9 = beacon index'] };
  const n = chars[i]; i++;
  if (!/^[0-9]$/.test(n)) return { status: PARSE.ERROR, error: 'Expected beacon index digit' };
  cmd.delayedBeacon = parseInt(n, 10);
  if (i < chars.length) return { status: PARSE.ERROR, error: 'Trailing garbage' };
  return { status: PARSE.OK, cmd };
}

/** Produce a human-readable summary of a parsed command. */
export function describeCommand(cmd) {
  const p = cmd.plane;
  switch (cmd.action) {
    case 'altitude':      return `${p} altitude ${cmd.arg}000ft`;
    case 'altitudeUp':    return `${p} climb ${cmd.arg}000ft`;
    case 'altitudeDown':  return `${p} descend ${cmd.arg}000ft`;
    case 'turn':          return `${p} turn to ${DIR_KEY_NAMES[cmd.arg]}`;
    case 'turnHardLeft':  return `${p} hard left (90°)`;
    case 'turnHardRight': return `${p} hard right (90°)`;
    case 'circle':        return `${p} circle`;
    case 'mark':          return `${p} mark`;
    case 'ignore':        return `${p} ignore`;
    case 'unmark':        return `${p} unmark`;
    case 'towardsBeacon': return `${p} steer to beacon ${cmd.arg}`;
    case 'towardsAirport':return `${p} steer to airport ${cmd.arg}`;
    case 'towardsExit':   return `${p} steer to exit ${cmd.arg}`;
    default:              return `${p} ${cmd.action}`;
  }
}

const DIR_KEY_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
