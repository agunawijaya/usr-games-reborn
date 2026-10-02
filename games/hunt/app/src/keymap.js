// Key bindings (port ADR 004). Every game action is a hunt keystroke: the
// engine only ever receives the original command characters.

// hunt keystroke per action (execute.c:99-187)
export const ACTIONS = {
  moveLeft: 'h', moveDown: 'j', moveUp: 'k', moveRight: 'l',
  faceLeft: 'H', faceDown: 'J', faceUp: 'K', faceRight: 'L',
  shot: 'f', grenade: 'g', satchel: 'F', bomb7: 'G',
  bomb9: '5', bomb11: '6', bomb13: '7', bomb15: '8', bomb17: '9', bomb19: '0', bomb21: '@',
  slime: 'o', slime2: 'O', slime3: 'p', slime4: 'P',
  scan: 's', cloak: 'c',
};

// Not a hunt command: under the Turn by turn pace, the world moves one step
// without the player doing anything.
export const WAIT = 'wait';

export const ACTION_LABEL = {
  moveLeft: 'Move left', moveDown: 'Move down', moveUp: 'Move up', moveRight: 'Move right',
  faceLeft: 'Face left', faceDown: 'Face down', faceUp: 'Face up', faceRight: 'Face right',
  shot: 'Shot (1)', grenade: 'Grenade (9)', satchel: 'Satchel (25)', bomb7: 'Bomb 7×7 (49)',
  bomb9: 'Bomb 9×9 (81)', bomb11: 'Bomb 11×11 (121)', bomb13: 'Bomb 13×13 (169)',
  bomb15: 'Bomb 15×15 (225)', bomb17: 'Bomb 17×17 (289)', bomb19: 'Bomb 19×19 (361)',
  bomb21: 'Bomb 21×21 (441)', slime: 'Slime (5)', slime2: 'Slime ×2 (10)',
  slime3: 'Slime ×3 (15)', slime4: 'Slime ×4 (20)', scan: 'Scan (1)', cloak: 'Cloak (1)',
  wait: 'Wait a step (Turn by turn)',
};

// Classic: the keys ARE the commands (case-sensitive), plus hunt's digits
// and '.' to wait.
export const CLASSIC = (() => {
  const m = {};
  for (const [a, k] of Object.entries(ACTIONS)) m[k] = a;
  Object.assign(m, { 1: 'shot', 2: 'grenade', 3: 'satchel', 4: 'bomb7', '.': WAIT });
  return m;
})();

// Modern (default, remappable): KeyboardEvent.code -> action.
export const MODERN_DEFAULT = {
  KeyA: 'moveLeft', KeyS: 'moveDown', KeyW: 'moveUp', KeyD: 'moveRight',
  ArrowLeft: 'faceLeft', ArrowDown: 'faceDown', ArrowUp: 'faceUp', ArrowRight: 'faceRight',
  Space: 'shot', KeyE: 'grenade', KeyR: 'satchel',
  Digit1: 'shot', Digit2: 'grenade', Digit3: 'satchel', Digit4: 'bomb7', Digit5: 'bomb9',
  Digit6: 'bomb11', Digit7: 'bomb13', Digit8: 'bomb15', Digit9: 'bomb17', Digit0: 'bomb19',
  KeyZ: 'slime', KeyX: 'slime2', KeyC: 'slime3', KeyV: 'slime4',
  KeyQ: 'scan', KeyF: 'cloak',
  Period: 'wait',
};
export const MOUSE = { 0: 'shot', 2: 'grenade' };

// The two schemes below are additions of this collection. Under them the
// engine still receives only hunt keystrokes: one action may become two of
// them, a turn and then the step or the shot (see keysFor).

// Easy: walking turns you that way first, so you always fire where you walk.
const WEAPON_CODES = {
  KeyE: 'grenade', KeyR: 'satchel',
  Digit1: 'shot', Digit2: 'grenade', Digit3: 'satchel', Digit4: 'bomb7', Digit5: 'bomb9',
  Digit6: 'bomb11', Digit7: 'bomb13', Digit8: 'bomb15', Digit9: 'bomb17', Digit0: 'bomb19',
  KeyZ: 'slime', KeyX: 'slime2', KeyC: 'slime3', KeyV: 'slime4',
  KeyQ: 'scan', KeyF: 'cloak',
};
export const EASY = {
  KeyA: 'goLeft', KeyS: 'goDown', KeyW: 'goUp', KeyD: 'goRight',
  ArrowLeft: 'goLeft', ArrowDown: 'goDown', ArrowUp: 'goUp', ArrowRight: 'goRight',
  Space: 'shot',
  ...WEAPON_CODES,
  Period: 'wait',
};

// Aim: the arrows and W A S D step without turning; with Shift an arrow
// fires a shot that way at once, with Alt it throws a grenade that way. You
// face where you last fired, the only facing hunt needs: Space fires that way
// again, and the satchel, the big bombs and slime go that way too.
export const AIM = {
  KeyA: 'moveLeft', KeyS: 'moveDown', KeyW: 'moveUp', KeyD: 'moveRight',
  ArrowLeft: 'moveLeft', ArrowDown: 'moveDown', ArrowUp: 'moveUp', ArrowRight: 'moveRight',
  Space: 'shot',
  ...WEAPON_CODES,
  Period: 'wait',
};
const AIM_ARROWS = { ArrowLeft: 'Left', ArrowDown: 'Down', ArrowUp: 'Up', ArrowRight: 'Right' };
const AIM_WEAPON = (e) => (e.altKey ? 'grenade' : e.shiftKey ? 'shot' : null);

// Compound actions: a facing, then the step or the weapon.
export const GOES = { goLeft: 'faceLeft', goDown: 'faceDown', goUp: 'faceUp', goRight: 'faceRight' };
const COMPOUND = /^(shot|grenade|satchel)(Left|Down|Up|Right)$/;
const STEP_OF_FACE = { faceLeft: 'moveLeft', faceDown: 'moveDown', faceUp: 'moveUp', faceRight: 'moveRight' };

/** The facing and the hunt action an action needs, or null for a plain one. */
export function compoundOf(action) {
  if (GOES[action]) return { face: GOES[action], then: STEP_OF_FACE[GOES[action]] };
  const m = COMPOUND.exec(action);
  return m ? { face: `face${m[2]}`, then: m[1] } : null;
}

const FACE_KEY = { faceLeft: 'H', faceDown: 'J', faceUp: 'K', faceRight: 'L' };
const FACE_OF_KEY = Object.fromEntries(Object.entries(FACE_KEY).map(([a, k]) => [k, a]));

/**
 * The hunt keystrokes for an action. `facing` is the facing action the
 * player will have once their queued keys have run (see facingAfter).
 */
export function keysFor(action, facing) {
  const compound = compoundOf(action);
  if (!compound) return ACTIONS[action] ? [ACTIONS[action]] : [];
  const turn = compound.face === facing ? [] : [FACE_KEY[compound.face]];
  return turn.concat(ACTIONS[compound.then]);
}

/** The facing action after the queued keys `queue` (hunt key codes) run, starting from `facing`. */
export function facingAfter(facing, queue) {
  let face = facing;
  for (const code of queue) face = FACE_OF_KEY[String.fromCharCode(code)] ?? face;
  return face;
}

// UI shortcuts, handled before the game sees a key. They must not be a game
// key in either scheme (tests/shortcut-conflict.test.js).
export const UI_KEYS = {
  Escape: 'pause',
  '?': 'help',
  '`': 'coach',
  '\\': 'override',
  Tab: 'scores',
};
export const UI_CODES = { F2: 'view', F3: 'camera' };

export const MOVES = new Set(['moveLeft', 'moveDown', 'moveUp', 'moveRight']);
// Actions that take a step, and so repeat while their key is held.
export const isStep = (action) => MOVES.has(action) || action in GOES;

// The action a key event means, or null.
// `scheme`: 'modern' | 'classic' | 'easy' | 'aim'.
export function actionFor(e, scheme, modern = MODERN_DEFAULT) {
  if (e.ctrlKey || e.metaKey) return null;
  if (scheme === 'aim' && AIM_ARROWS[e.code] && AIM_WEAPON(e)) return `${AIM_WEAPON(e)}${AIM_ARROWS[e.code]}`;
  if (e.altKey) return null;
  if (scheme === 'classic') return CLASSIC[e.key] ?? null;
  if (scheme === 'easy') return EASY[e.code] ?? null;
  if (scheme === 'aim') return AIM[e.code] ?? null;
  return modern[e.code] ?? null;
}

// Dominant-axis facing toward a point, with a dead band around diagonals
// so mouse jitter cannot spam turns (ADR 004).
export function facingToward(dx, dy, current, deadBandDeg = 12) {
  if (dx === 0 && dy === 0) return current;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI; // screen: y grows down
  const a = ((ang % 360) + 360) % 360;
  const pick = a < 45 || a >= 315 ? 'faceRight' : a < 135 ? 'faceDown' : a < 225 ? 'faceLeft' : 'faceUp';
  if (!current || pick === current) return pick;
  const nearest = Math.min(...[45, 135, 225, 315].map((d) => Math.abs(((a - d + 540) % 360) - 180)));
  return nearest < deadBandDeg ? current : pick;
}
