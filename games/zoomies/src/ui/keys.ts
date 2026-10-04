import { type ActionMap, mergeBindings } from '@usr-games/kit';
import type { Step } from '../engine/types';

/**
 * Keyboard actions. The defaults cover the arrow keys, the number pad and the QWE/ASD/ZXC
 * block for diagonals on laptops; players can remap any of them in the Hall's settings.
 */

export type MoveAction =
  'up-left' | 'up' | 'up-right' | 'left' | 'stay' | 'right' | 'down-left' | 'down' | 'down-right';

export type KeyAction = MoveAction | 'loaf' | 'zoom' | 'undo' | 'nap' | 'whiskers' | 'whole-room';

export const MOVES: Record<MoveAction, readonly [Step, Step]> = {
  'up-left': [-1, -1],
  up: [0, -1],
  'up-right': [1, -1],
  left: [-1, 0],
  stay: [0, 0],
  right: [1, 0],
  'down-left': [-1, 1],
  down: [0, 1],
  'down-right': [1, 1],
};

export const DEFAULT_KEYS: Record<KeyAction, readonly string[]> = {
  'up-left': ['KeyQ', 'Numpad7'],
  up: ['KeyW', 'ArrowUp', 'Numpad8'],
  'up-right': ['KeyE', 'Numpad9'],
  left: ['KeyA', 'ArrowLeft', 'Numpad4'],
  stay: ['KeyS', 'Numpad5', 'Period', 'Space'],
  right: ['KeyD', 'ArrowRight', 'Numpad6'],
  'down-left': ['KeyZ', 'Numpad1'],
  down: ['KeyX', 'ArrowDown', 'Numpad2'],
  'down-right': ['KeyC', 'Numpad3'],
  loaf: ['KeyL'],
  zoom: ['KeyT'],
  undo: ['KeyU', 'Backspace'],
  nap: ['KeyN'],
  whiskers: ['KeyV'],
  'whole-room': ['KeyO'],
};

export const KEY_LABELS: Record<KeyAction, string> = {
  'up-left': 'Step up and left',
  up: 'Step up',
  'up-right': 'Step up and right',
  left: 'Step left',
  stay: 'Stay put for a turn',
  right: 'Step right',
  'down-left': 'Step down and left',
  down: 'Step down',
  'down-right': 'Step down and right',
  loaf: 'Loaf (wait while it is safe)',
  zoom: 'Zoom (dash to a random square)',
  undo: 'Undo a turn',
  nap: 'Nap until the wave is over (Long Night)',
  whiskers: 'Whiskers (danger hints) on or off',
  'whole-room': 'Whole room or follow the cat (big rooms)',
};

export interface KeyMap {
  actionFor(event: KeyboardEvent): KeyAction | null;
  first(action: KeyAction): string;
}

export function describeKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const named: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Space',
    Period: '.',
    Backspace: '⌫',
    Enter: '⏎',
  };
  return named[code] ?? code;
}

export function createKeyMap(overrides: Record<string, string[]> | undefined): KeyMap {
  const bindings: ActionMap = mergeBindings(DEFAULT_KEYS, overrides ?? {});
  const byCode = new Map<string, KeyAction>();
  for (const [action, codes] of Object.entries(bindings))
    for (const code of codes) byCode.set(code, action as KeyAction);
  return {
    actionFor(event) {
      // Ctrl or ⌘ with Z is undo, as everywhere else; other modified keys belong to the browser.
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') return 'undo';
      if (event.ctrlKey || event.metaKey || event.altKey) return null;
      return byCode.get(event.code) ?? null;
    },
    first(action) {
      return describeKey(bindings[action]?.[0] ?? '');
    },
  };
}
