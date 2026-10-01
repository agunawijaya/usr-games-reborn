import { ensureContrast } from '../color/color';
import type { Appearance, PaletteId } from '../settings/settings';
import { PALETTES, type ThemeTokens } from './themes';

export interface TokenQuery {
  /** Any palette: a Machine Room palette or a style's signature palette. */
  theme: PaletteId;
  appearance: Appearance;
  colorBlindPalette?: boolean;
}

export function themeTokens({ theme, appearance, colorBlindPalette }: TokenQuery): ThemeTokens {
  const definition = PALETTES[theme];
  const tokens = definition.tokens[appearance];
  return colorBlindPalette ? { ...tokens, ...definition.colorBlind[appearance] } : tokens;
}

/** `fontBody` → `--ug-font-body`. */
export function tokenVariable(name: keyof ThemeTokens): string {
  return `--ug-${name.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export function tokensToCss(tokens: ThemeTokens): Record<string, string> {
  const css: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) {
    css[tokenVariable(name as keyof ThemeTokens)] = value;
  }
  return css;
}

/** Writes every token as a custom property on `element` (usually `document.documentElement`). */
export function applyTokens(element: HTMLElement, tokens: ThemeTokens): void {
  for (const [property, value] of Object.entries(tokensToCss(tokens))) {
    element.style.setProperty(property, value);
  }
}

/** Reads the live value of a token, for canvas renderers that cannot use CSS variables. */
export function readToken(element: HTMLElement, name: keyof ThemeTokens): string {
  return getComputedStyle(element).getPropertyValue(tokenVariable(name)).trim();
}

/**
 * A game's accent, adjusted to read as text on this theme's surfaces. Games keep one brand
 * accent in their manifest; the Hall and the game both call this to get a legible variant.
 */
export function accentFor(accent: string, tokens: ThemeTokens): string {
  let safe = ensureContrast(accent, tokens.surface);
  safe = ensureContrast(safe, tokens.bg);
  return ensureContrast(safe, tokens.surface2);
}
