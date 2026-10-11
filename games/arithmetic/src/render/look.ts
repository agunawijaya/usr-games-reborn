import type { AppearanceState } from '@usr-games/kit';

/**
 * The two themes the player chooses between, each designed twice: Sprint (a running track, by
 * day and under floodlights) and Atom (numbers as molecules, in a clean room and a particle
 * chamber). Same rules and screens; only art, motion and sound differ.
 */

export type ThemeId = 'sprint' | 'atom';
export const THEMES: readonly ThemeId[] = ['sprint', 'atom'];

export interface Look {
  readonly theme: ThemeId;
  readonly dark: boolean;
}

export function lookOf(theme: ThemeId, appearance: Pick<AppearanceState, 'appearance'>): Look {
  return { theme, dark: appearance.appearance === 'dark' };
}

export function lookName(look: Look): string {
  if (look.theme === 'sprint') return look.dark ? 'Night Stadium' : 'Day Stadium';
  return look.dark ? 'Particle Night' : 'Clean Room';
}

export function sameLook(a: Look, b: Look): boolean {
  return a.theme === b.theme && a.dark === b.dark;
}
