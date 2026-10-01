// Keyboard → action mapping. Follows `bsdgames/robots/docs/spec.md`
// §Actions/Commands + adds port-only actions for help/zoom.

import type { DirectionName } from '../game/state';

export type KeyAction =
  | { kind: 'move'; direction: DirectionName }
  | { kind: 'teleport' }
  | { kind: 'wait' }
  | { kind: 'quit' }
  | { kind: 'help' }
  | { kind: 'zoom-in' }
  | { kind: 'zoom-out' }
  | { kind: 'sound' }
  | { kind: 'preview' };

// Case-insensitive by lowercase-ing before lookup.
const MOVE_KEYS: Record<string, DirectionName> = {
  // vi-style hjkl + yubn
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
  y: 'upLeft',
  u: 'upRight',
  b: 'downLeft',
  n: 'downRight',

  // Numpad / number-row convention:
  //   7 8 9
  //   4 5 6
  //   1 2 3
  // Works with numpad keys (NumLock on) and with the number row.
  '7': 'upLeft',
  '8': 'up',
  '9': 'upRight',
  '4': 'left',
  '5': 'stay',
  '6': 'right',
  '1': 'downLeft',
  '2': 'down',
  '3': 'downRight',

  // Skip-turn keys
  '.': 'stay',
  ' ': 'stay',

  // Arrow keys — cardinal only.
  arrowleft: 'left',
  arrowdown: 'down',
  arrowup: 'up',
  arrowright: 'right',
};

const SIMPLE_ACTIONS: Record<string, KeyAction> = {
  t: { kind: 'teleport' },
  w: { kind: 'wait' },   // fancy-web: safe-wait (see port ADR-002)
  '>': { kind: 'wait' }, // canonical spec alias for safe-wait
  q: { kind: 'quit' },
  '?': { kind: 'help' },
  '+': { kind: 'zoom-in' },
  '=': { kind: 'zoom-in' }, // same physical key as + on most layouts
  '-': { kind: 'zoom-out' },
  m: { kind: 'sound' },   // remaster: sound on/off
  p: { kind: 'preview' }, // remaster: next-step preview and danger squares
};

export function keyToAction(rawKey: string): KeyAction | null {
  const key = rawKey.toLowerCase();
  const direction = MOVE_KEYS[key];
  if (direction) return { kind: 'move', direction };
  const action = SIMPLE_ACTIONS[key];
  if (action) return action;
  return null;
}

// Attach a keydown handler to the window. Returns a cleanup function.
export function attachKeyboard(
  handler: (action: KeyAction) => void,
): () => void {
  const listener = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    const action = keyToAction(e.key);
    if (action) {
      e.preventDefault();
      handler(action);
    }
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
