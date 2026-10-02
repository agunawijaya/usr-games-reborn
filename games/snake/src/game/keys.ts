import { type ActionMap, describeCode, mergeBindings } from '@usr-games/kit';

/**
 * Keyboard actions. Steps come from the arrow keys, the number pad, the Q W E / A D / Z X C
 * block and the original's own `h j k l` (with `y u b n` for diagonals). The digit row types a
 * count before a step and `.` repeats the last one, as in the original. Every action can be
 * remapped from the Hall's settings.
 */
export type StepAction =
  'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west';

export type KeyAction = StepAction | 'warp' | 'peek' | 'strikes' | 'repeat';

/** Steps in the engine's direction order: north first, then clockwise. */
export const STEP_ACTIONS: readonly StepAction[] = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

export const DEFAULT_KEYS: Readonly<Record<KeyAction, readonly string[]>> = {
  north: ['ArrowUp', 'Numpad8', 'KeyW', 'KeyK'],
  'north-east': ['Numpad9', 'KeyE', 'KeyU'],
  east: ['ArrowRight', 'Numpad6', 'KeyD', 'KeyL'],
  'south-east': ['Numpad3', 'KeyC', 'KeyN'],
  south: ['ArrowDown', 'Numpad2', 'KeyX', 'KeyJ'],
  'south-west': ['Numpad1', 'KeyZ', 'KeyB'],
  west: ['ArrowLeft', 'Numpad4', 'KeyA', 'KeyH'],
  'north-west': ['Numpad7', 'KeyQ', 'KeyY'],
  warp: ['KeyT'],
  peek: ['KeyP'],
  strikes: ['KeyS'],
  repeat: ['Period'],
};

export const KEY_LABELS: Readonly<Record<KeyAction, string>> = {
  north: 'Step north',
  'north-east': 'Step north-east',
  east: 'Step east',
  'south-east': 'Step south-east',
  south: 'Step south',
  'south-west': 'Step south-west',
  west: 'Step west',
  'north-west': 'Step north-west',
  warp: 'Warp (costs a tenth of your haul)',
  peek: 'Peek toward a glint',
  strikes: 'Strike preview on or off',
  repeat: 'Repeat the last move',
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
      if (event.ctrlKey || event.metaKey || event.altKey) return null;
      // Shift with the original's warp letter warps too; other capitals are the jumps.
      if (event.shiftKey && event.code === 'KeyW') return 'warp';
      if (event.shiftKey) return null;
      return byCode.get(event.code) ?? null;
    },
    label(action) {
      return describeCode(bindings[action]?.[0] ?? '');
    },
  };
}

/** The original's capital jumps: walk to the glint's column or row, one step at a time. */
export type Jump =
  'to-glint-column-west' | 'to-glint-column-east' | 'to-glint-row-north' | 'to-glint-row-south';

export function jumpFor(event: KeyboardEvent): Jump | null {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return null;
  switch (event.code) {
    case 'KeyH':
      return 'to-glint-column-west';
    case 'KeyL':
      return 'to-glint-column-east';
    case 'KeyK':
      return 'to-glint-row-north';
    case 'KeyJ':
      return 'to-glint-row-south';
    default:
      return null;
  }
}

/** A digit on the main row, for counts; the number pad's digits are steps. */
export function countDigit(event: KeyboardEvent): number | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  return /^Digit[0-9]$/.test(event.code) ? Number(event.code.slice(5)) : null;
}
