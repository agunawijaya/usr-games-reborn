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

export const ACTION_LABEL = {
  moveLeft: 'Move left', moveDown: 'Move down', moveUp: 'Move up', moveRight: 'Move right',
  faceLeft: 'Face left', faceDown: 'Face down', faceUp: 'Face up', faceRight: 'Face right',
  shot: 'Shot (1)', grenade: 'Grenade (9)', satchel: 'Satchel (25)', bomb7: 'Bomb 7×7 (49)',
  bomb9: 'Bomb 9×9 (81)', bomb11: 'Bomb 11×11 (121)', bomb13: 'Bomb 13×13 (169)',
  bomb15: 'Bomb 15×15 (225)', bomb17: 'Bomb 17×17 (289)', bomb19: 'Bomb 19×19 (361)',
  bomb21: 'Bomb 21×21 (441)', slime: 'Slime (5)', slime2: 'Slime ×2 (10)',
  slime3: 'Slime ×3 (15)', slime4: 'Slime ×4 (20)', scan: 'Scan (1)', cloak: 'Cloak (1)',
};

// Classic: the keys ARE the commands (case-sensitive), plus hunt's digits.
export const CLASSIC = (() => {
  const m = {};
  for (const [a, k] of Object.entries(ACTIONS)) m[k] = a;
  Object.assign(m, { 1: 'shot', 2: 'grenade', 3: 'satchel', 4: 'bomb7' });
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
};
export const MOUSE = { 0: 'shot', 2: 'grenade' };

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

// The action a key event means, or null. `scheme`: 'modern' | 'classic'.
export function actionFor(e, scheme, modern = MODERN_DEFAULT) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (scheme === 'classic') return CLASSIC[e.key] ?? null;
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
