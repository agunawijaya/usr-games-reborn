import { type ActionMap, describeCode, mergeBindings } from '@usr-games/kit';

/**
 * The keys a player can remap in the Hall's settings, as the manifest lists them. The original's
 * own command letters (headings, digits, plane letters) stay fixed: they are the language of the
 * game, not a layout.
 */

export type SkyAction =
  'next-plane' | 'next-tick' | 'tilt' | 'terminal' | 'hold-left' | 'hold-right';

export const DEFAULT_KEYS: Readonly<Record<SkyAction, readonly string[]>> = {
  'next-plane': ['Tab'],
  'next-tick': ['Space'],
  tilt: ['KeyT'],
  terminal: ['Backquote'],
  'hold-left': ['BracketLeft'],
  'hold-right': ['BracketRight'],
};

export interface SkyKeys {
  actionFor(event: KeyboardEvent): SkyAction | null;
  /** The first key bound to an action, as a keycap reads. */
  label(action: SkyAction): string;
}

export function createSkyKeys(overrides: Record<string, string[]> | undefined): SkyKeys {
  const bindings: ActionMap = mergeBindings(DEFAULT_KEYS, overrides ?? {});
  const byCode = new Map<string, SkyAction>();
  for (const [action, codes] of Object.entries(bindings)) {
    for (const code of codes) byCode.set(code, action as SkyAction);
  }
  return {
    actionFor(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return null;
      return byCode.get(event.code) ?? null;
    },
    label(action) {
      const code = bindings[action]?.[0] ?? '';
      return code === 'Backquote'
        ? '`'
        : code.startsWith('Bracket')
          ? code === 'BracketLeft'
            ? '['
            : ']'
          : describeCode(code);
    },
  };
}
