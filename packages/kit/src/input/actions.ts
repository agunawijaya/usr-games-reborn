/**
 * Input as named actions instead of raw keys, so players can remap controls and games never
 * hard-code a layout. Keyboard bindings use `KeyboardEvent.code` (layout independent); mouse
 * buttons are `Mouse0`…`Mouse2`; gamepad buttons follow the standard mapping as `Pad0`…`Pad16`.
 */

export type ActionMap = Record<string, readonly string[]>;

export interface ActionEvent {
  action: string;
  pressed: boolean;
  source: 'keyboard' | 'mouse' | 'gamepad';
  repeat: boolean;
}

export interface InputController {
  isDown(action: string): boolean;
  on(listener: (event: ActionEvent) => void): () => void;
  bindings(): ActionMap;
  /** Replaces the codes for one action; returns the actions that lost a code to it. */
  rebind(action: string, codes: readonly string[]): string[];
  /** Reads connected gamepads; call once per frame from the game loop. */
  pollGamepads(): void;
  destroy(): void;
}

/** Applies stored overrides onto a game's defaults, ignoring actions the game no longer has. */
export function mergeBindings(
  defaults: ActionMap,
  overrides: Record<string, string[]> = {},
): ActionMap {
  const merged: Record<string, readonly string[]> = { ...defaults };
  for (const [action, codes] of Object.entries(overrides)) {
    if (action in defaults && Array.isArray(codes)) merged[action] = [...codes];
  }
  return merged;
}

/** Which actions share a code; used to warn the player before a remap steals a key. */
export function findConflicts(map: ActionMap): Map<string, string[]> {
  const byCode = new Map<string, string[]>();
  for (const [action, codes] of Object.entries(map)) {
    for (const code of codes) byCode.set(code, [...(byCode.get(code) ?? []), action]);
  }
  return new Map([...byCode].filter(([, actions]) => actions.length > 1));
}

function actionsFor(map: ActionMap, code: string): string[] {
  return Object.entries(map)
    .filter(([, codes]) => codes.includes(code))
    .map(([action]) => action);
}

/** Human label for a binding, for help screens and the remapping UI. */
export function describeCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow'))
    return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] ?? code;
  if (code.startsWith('Mouse'))
    return ['Left click', 'Middle click', 'Right click'][Number(code.slice(5))] ?? code;
  if (code.startsWith('Pad')) return `Pad ${code.slice(3)}`;
  return (
    { Space: 'Space', Escape: 'Esc', Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift' }[
      code
    ] ?? code
  );
}

export function createInput(options: {
  target: HTMLElement | Window;
  defaults: ActionMap;
  overrides?: Record<string, string[]>;
  onBindingsChange?: (overrides: Record<string, string[]>) => void;
}): InputController {
  let map = mergeBindings(options.defaults, options.overrides);
  const down = new Set<string>();
  const listeners = new Set<(event: ActionEvent) => void>();
  const padState = new Map<string, boolean>();

  function emit(code: string, pressed: boolean, source: ActionEvent['source'], repeat = false) {
    for (const action of actionsFor(map, code)) {
      if (pressed) down.add(action);
      else down.delete(action);
      for (const listener of listeners) listener({ action, pressed, source, repeat });
    }
  }

  const onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (actionsFor(map, key.code).length > 0) key.preventDefault();
    emit(key.code, true, 'keyboard', key.repeat);
  };
  const onKeyUp = (event: Event) => emit((event as KeyboardEvent).code, false, 'keyboard');
  const onMouseDown = (event: Event) => emit(`Mouse${(event as MouseEvent).button}`, true, 'mouse');
  const onMouseUp = (event: Event) => emit(`Mouse${(event as MouseEvent).button}`, false, 'mouse');
  // Releasing everything on blur stops keys from "sticking" after an alt-tab.
  const onBlur = () => {
    for (const action of [...down]) {
      down.delete(action);
      for (const listener of listeners)
        listener({ action, pressed: false, source: 'keyboard', repeat: false });
    }
  };

  const target = options.target;
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup', onMouseUp);
  target.addEventListener('blur', onBlur);

  return {
    isDown: (action) => down.has(action),
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    bindings: () => map,
    rebind(action, codes) {
      if (!(action in options.defaults)) throw new RangeError(`Unknown action: ${action}`);
      const displaced: string[] = [];
      const next: Record<string, readonly string[]> = {};
      for (const [other, otherCodes] of Object.entries(map)) {
        if (other === action) continue;
        const kept = otherCodes.filter((code) => !codes.includes(code));
        if (kept.length !== otherCodes.length) displaced.push(other);
        next[other] = kept;
      }
      next[action] = [...codes];
      map = next;
      const overrides: Record<string, string[]> = {};
      for (const [name, bound] of Object.entries(map)) {
        const original = options.defaults[name] ?? [];
        if (bound.join('|') !== original.join('|')) overrides[name] = [...bound];
      }
      options.onBindingsChange?.(overrides);
      return displaced;
    },
    pollGamepads() {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      for (const pad of navigator.getGamepads()) {
        if (!pad) continue;
        pad.buttons.forEach((button, index) => {
          const code = `Pad${index}`;
          const was = padState.get(code) ?? false;
          if (button.pressed !== was) {
            padState.set(code, button.pressed);
            emit(code, button.pressed, 'gamepad');
          }
        });
      }
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('blur', onBlur);
      listeners.clear();
      down.clear();
    },
  };
}
