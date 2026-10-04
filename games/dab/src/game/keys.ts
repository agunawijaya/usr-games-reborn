import { type ActionMap, describeCode, mergeBindings } from '@usr-games/kit';

/**
 * Keyboard actions, remappable from the Hall's settings. The arrows aim and walk the chalk; the
 * original's `h j k l` jump and `y u b n` hop on its lattice; Enter or Space draws.
 */
export type KeyAction =
  | 'aim-up'
  | 'aim-down'
  | 'aim-left'
  | 'aim-right'
  | 'draw'
  | 'jump-left'
  | 'jump-down'
  | 'jump-up'
  | 'jump-right'
  | 'hop-up-left'
  | 'hop-up-right'
  | 'hop-down-left'
  | 'hop-down-right'
  | 'take-run'
  | 'lens';

export const DEFAULT_KEYS: Readonly<Record<KeyAction, readonly string[]>> = {
  'aim-up': ['ArrowUp', 'KeyW'],
  'aim-down': ['ArrowDown', 'KeyS'],
  'aim-left': ['ArrowLeft', 'KeyA'],
  'aim-right': ['ArrowRight', 'KeyD'],
  draw: ['Enter', 'Space', 'NumpadEnter'],
  'jump-left': ['KeyH'],
  'jump-down': ['KeyJ'],
  'jump-up': ['KeyK'],
  'jump-right': ['KeyL'],
  'hop-up-left': ['KeyY'],
  'hop-up-right': ['KeyU'],
  'hop-down-left': ['KeyB'],
  'hop-down-right': ['KeyN'],
  'take-run': ['KeyT'],
  lens: ['KeyC'],
};

export const KEY_LABELS: Readonly<Record<KeyAction, string>> = {
  'aim-up': 'Aim up, or walk up',
  'aim-down': 'Aim down, or walk down',
  'aim-left': 'Aim left, or walk left',
  'aim-right': 'Aim right, or walk right',
  draw: 'Draw the line',
  'jump-left': 'Original: parallel line to the left',
  'jump-down': 'Original: parallel line below',
  'jump-up': 'Original: parallel line above',
  'jump-right': 'Original: parallel line to the right',
  'hop-up-left': 'Original: hop up and left',
  'hop-up-right': 'Original: hop up and right',
  'hop-down-left': 'Original: hop down and left',
  'hop-down-right': 'Original: hop down and right',
  'take-run': 'Take the run of boxes',
  lens: 'Chain lens on or off',
};

export interface KeyMap {
  actionFor(event: KeyboardEvent): KeyAction | null;
  label(action: KeyAction): string;
}

export function createKeyMap(overrides: Record<string, string[]> | undefined): KeyMap {
  const bindings: ActionMap = mergeBindings(DEFAULT_KEYS, overrides ?? {});
  const byCode = new Map<string, KeyAction>();
  for (const [action, codes] of Object.entries(bindings)) {
    for (const code of codes) byCode.set(code, action as KeyAction);
  }
  return {
    actionFor(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
      return byCode.get(event.code) ?? null;
    },
    label(action) {
      return describeCode(bindings[action]?.[0] ?? '');
    },
  };
}
