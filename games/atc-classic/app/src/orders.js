// Control Room 1986 — the order buttons' board. For the plane the controller selected, every order
// the panel offers, each with the exact command a player would type for it, piece by piece with
// what each piece means, and the command as the parser reads it. Pure: orderpanel.js draws the
// board, main.js types the chosen command into the command line, and the engine alone decides
// what is legal (a button is off exactly when the engine would refuse its command).

import { DIR_KEYS, executeCommand, FEATURE, isOnTrack, MAXDIR, STATUS } from './engine.js';

const KEY_FOR_DIR = Object.fromEntries(Object.entries(DIR_KEYS).map(([key, dir]) => [dir, key]));
export const DIR_WORDS = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
export const DIR_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
/** The compass as its keys sit on the keyboard: q w e / a · d / z x c. */
export const COMPASS_LAYOUT = [7, 0, 1, 6, null, 2, 5, 4, 3];

/**
 * @typedef {object} OrderButton
 * @property {string} id         stable within a board, so focus survives a redraw
 * @property {string} label      the order in plain words
 * @property {string} glyph      the short mark on the button's face
 * @property {string} typed      the whole command, plane letter first, as a player would type it
 * @property {[string, string][]} parts  the typed command piece by piece, each with its meaning
 * @property {object} cmd        the command exactly as parseCommand reads `typed`
 * @property {string} ref        the reference card's section that explains it
 * @property {boolean} enabled  off when the engine would refuse the command, or it would change
 *   nothing (an order the plane already follows)
 * @property {string} [why]      why the button is off
 * @property {boolean} [current] the plane already follows this order
 * @property {boolean} [goal]    the plane's destination, or the altitude it needs there
 */

/**
 * @typedef {object} OrderBoard
 * @property {string} letter
 * @property {number | null} atBeacon  set while the next order is to wait for that beacon
 * @property {(OrderButton | null)[]} compass  laid out as COMPASS_LAYOUT, null in the middle
 * @property {OrderButton[]} turns      hard left, hard right, circle
 * @property {OrderButton[]} altitudes  0 to 9
 * @property {OrderButton[]} steps      climb one, descend one
 * @property {OrderButton[]} beacons
 * @property {OrderButton[]} exits
 * @property {OrderButton[]} airports
 * @property {OrderButton[]} status     mark, ignore, unmark
 * @property {{ enabled: boolean, beacons: { index: number, label: string, enabled: boolean }[] }} delay
 */

/** The parts of a plane an order can change. */
const ORDERED = ['newAltitude', 'newDir', 'status', 'delayed', 'delayedBeaconNo'];

/**
 * What the engine says to a command for this plane, tried on a copy so the real plane is left
 * alone: refused (with the engine's reason), accepted, or accepted but changing nothing.
 */
function engineVerdict(plane, playfield, cmd) {
  const copy = { ...plane };
  const result = executeCommand({ playfield, air: [copy], ground: [] }, cmd);
  if (!result.ok) return result;
  return { ok: true, changes: ORDERED.some((key) => copy[key] !== plane[key]) };
}

/**
 * @param {object} plane     a plane from the engine (in the air or on the ground)
 * @param {object} playfield
 * @param {{ atBeacon?: number | null }} [options]  the beacon a delayed order is to wait for
 * @returns {OrderBoard}
 */
export function orderBoard(plane, playfield, { atBeacon = null } = {}) {
  const letter = plane.letter;
  const planeCode = letter.toUpperCase();
  const beacon = atBeacon === null ? null : playfield.beacons[atBeacon];
  const suffix = beacon ? [[`@b${atBeacon}`, `at beacon ${beacon.label}`]] : [];

  /** @returns {OrderButton} */
  function button(id, label, glyph, parts, action, arg, ref, flags = {}) {
    const allParts = [[letter, `plane ${letter}`], ...parts, ...suffix];
    const cmd = { plane: planeCode, action, ...(arg === undefined ? {} : { arg }) };
    if (beacon) cmd.delayedBeacon = atBeacon;
    const verdict = engineVerdict(plane, playfield, cmd);
    const pointless = verdict.ok ? flags.pointless ?? (verdict.changes ? null : 'Already doing that') : null;
    return {
      id,
      label,
      glyph,
      typed: allParts.map(([text]) => text).join(''),
      parts: allParts,
      cmd,
      ref: beacon ? 'delay' : ref,
      enabled: verdict.ok && !pointless,
      ...(verdict.ok ? (pointless ? { why: pointless } : {}) : { why: verdict.error }),
      ...(flags.current ? { current: true } : {}),
      ...(flags.goal ? { goal: true } : {}),
    };
  }

  const steady = !plane.delayed;
  const compass = COMPASS_LAYOUT.map((dir) =>
    dir === null
      ? null
      : button(`turn-${dir}`, DIR_WORDS[dir], DIR_ARROWS[dir], [['t', 'turn'], [KEY_FOR_DIR[dir], DIR_WORDS[dir].toLowerCase()]], 'turn', dir, 'turn', {
          current: steady && plane.newDir === dir,
        }),
  );
  const turns = [
    button('hard-left', 'Hard left', '⟲', [['t', 'turn'], ['L', 'hard left']], 'turnHardLeft', undefined, 'turn'),
    button('hard-right', 'Hard right', '⟳', [['t', 'turn'], ['R', 'hard right']], 'turnHardRight', undefined, 'turn'),
    button('circle', 'Circle', '◯', [['c', 'circle here']], 'circle', undefined, 'hold', { current: steady && plane.newDir === MAXDIR }),
  ];

  const neededAltitude = plane.destType === FEATURE.EXIT ? 9 : 0;
  const altitudes = Array.from({ length: 10 }, (_, n) =>
    button(`alt-${n}`, n === 0 ? 'Down to 0' : `${n},000 ft`, String(n), [['a', 'altitude'], [String(n), n === 0 ? 'down to 0' : `${n},000 feet`]], 'altitude', n, 'altitude', {
      current: plane.newAltitude === n,
      goal: n === neededAltitude,
    }),
  );
  const steps = [
    button('climb', 'Climb 1,000', '▲', [['a', 'altitude'], ['+1', 'climb 1,000 feet']], 'altitudeUp', 1, 'altitude'),
    button('descend', 'Descend 1,000', '▼', [['a', 'altitude'], ['-1', 'descend 1,000 feet']], 'altitudeDown', 1, 'altitude'),
  ];

  const towards = (kind, list, action, code, word, mark) =>
    list.map((feature, index) =>
      button(`${kind}-${index}`, `${word} ${feature.label}`, `${mark}${feature.label}`, [['t', 'turn'], [`t${code}${index}`, `towards ${word.toLowerCase()} ${feature.label}`]], action, index, 'towards', {
        goal: plane.destType === (kind === 'exit' ? FEATURE.EXIT : FEATURE.AIRPORT) && kind !== 'beacon' && plane.destNo === index,
        pointless: !beacon && feature.x === plane.xpos && feature.y === plane.ypos ? 'It is there already' : undefined,
      }),
    );

  const status = [
    button('mark', 'Mark', 'M', [['m', 'mark']], 'mark', undefined, 'status', { current: plane.status === STATUS.MARKED }),
    button('ignore', 'Ignore', 'I', [['i', 'ignore']], 'ignore', undefined, 'status', { current: plane.status === STATUS.IGNORED }),
    button('unmark', 'Unmark', 'U', [['u', 'unmark']], 'unmark', undefined, 'status', { current: plane.status === STATUS.UNMARKED }),
  ];

  const delayBeacons = playfield.beacons.map((feature, index) => ({
    index,
    label: feature.label,
    enabled: isOnTrack(plane, feature),
  }));

  return {
    letter,
    atBeacon: beacon ? atBeacon : null,
    compass,
    turns,
    altitudes,
    steps,
    beacons: towards('beacon', playfield.beacons, 'towardsBeacon', 'b', 'Beacon', '*'),
    exits: towards('exit', playfield.exits, 'towardsExit', 'e', 'Exit', ''),
    airports: towards('airport', playfield.airports, 'towardsAirport', 'a', 'Airport', 'A'),
    status,
    delay: { enabled: delayBeacons.some((b) => b.enabled), beacons: delayBeacons },
  };
}

/** Every button of a board, in reading order. */
export function boardButtons(board) {
  return [
    ...board.compass.filter(Boolean),
    ...board.turns,
    ...board.altitudes,
    ...board.steps,
    ...board.beacons,
    ...board.exits,
    ...board.airports,
    ...board.status,
  ];
}

/**
 * What a typed command means, piece by piece, for the "Typed as" line under the panel; the same
 * pieces whether the command came from a button or was typed by hand. Null when it is not a
 * complete command.
 * @param {string} typed
 * @param {object} cmd  the command as parseCommand read it
 * @param {object} playfield
 * @returns {[string, string][] | null}
 */
export function explainTyped(typed, cmd, playfield) {
  const letter = typed[0];
  const parts = [[letter, `plane ${letter}`]];
  let rest = typed.slice(1);
  const take = (text, meaning) => {
    parts.push([text, meaning]);
    rest = rest.slice(text.length);
  };
  switch (cmd.action) {
    case 'altitude':
      take('a', 'altitude');
      take(rest[0], cmd.arg === 0 ? 'down to 0' : `${cmd.arg},000 feet`);
      break;
    case 'altitudeUp':
    case 'altitudeDown': {
      take('a', 'altitude');
      const verb = cmd.action === 'altitudeUp' ? 'climb' : 'descend';
      take(rest.slice(0, 2), `${verb} ${cmd.arg},000 feet`);
      break;
    }
    case 'turn':
      take('t', 'turn');
      take(rest[0], DIR_WORDS[cmd.arg].toLowerCase());
      break;
    case 'turnHardLeft':
    case 'turnHardRight':
      take('t', 'turn');
      take(rest[0], cmd.action === 'turnHardLeft' ? 'hard left' : 'hard right');
      break;
    case 'towardsBeacon':
    case 'towardsAirport':
    case 'towardsExit': {
      const word = { towardsBeacon: 'beacon', towardsAirport: 'airport', towardsExit: 'exit' }[cmd.action];
      const list = { beacon: playfield.beacons, airport: playfield.airports, exit: playfield.exits }[word];
      take('t', 'turn');
      take(rest.slice(0, 3), `towards ${word} ${list[cmd.arg]?.label ?? cmd.arg}`);
      break;
    }
    case 'circle':
      take(rest[0], 'circle here');
      break;
    default:
      take(rest[0], cmd.action);
  }
  if (cmd.delayedBeacon !== undefined && rest.length) {
    take(rest, `at beacon ${playfield.beacons[cmd.delayedBeacon]?.label ?? cmd.delayedBeacon}`);
  }
  return parts;
}
