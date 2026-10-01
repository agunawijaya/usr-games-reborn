import {
  accentFor,
  type Appearance,
  applyTokens,
  type PaletteId,
  type StyleId,
  themeTokens,
  type ThemeTokens,
} from '@usr-games/kit';

/** What paints the Hall right now: the style, its palette and the appearance. */
export interface ThemeState {
  style: StyleId;
  theme: PaletteId;
  appearance: Appearance;
  colorBlindPalette: boolean;
  reducedMotion: boolean;
}

const SWITCH_MS = 450;
let switchTimer: ReturnType<typeof setTimeout> | undefined;

export function tokensFor(
  state: Pick<ThemeState, 'theme' | 'appearance' | 'colorBlindPalette'>,
): ThemeTokens {
  return themeTokens({
    theme: state.theme,
    appearance: state.appearance,
    colorBlindPalette: state.colorBlindPalette,
  });
}

/**
 * Writes the palette onto an element (usually <html>, or a preview frame in the style picker):
 * tokens as custom properties, plus the data attributes each style's skins select on. A short
 * `theme-switching` window lets colours ease across instead of snapping, unless the player
 * asked for reduced motion.
 */
export function applyTheme(root: HTMLElement, state: ThemeState, previous?: ThemeState): void {
  const changed =
    previous && (previous.theme !== state.theme || previous.appearance !== state.appearance);
  if (changed && !state.reducedMotion) {
    root.classList.add('theme-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.classList.remove('theme-switching'), SWITCH_MS);
  }
  applyTokens(root, tokensFor(state));
  root.dataset.style = state.style;
  root.dataset.theme = state.theme;
  root.dataset.appearance = state.appearance;
  root.dataset.motion = state.reducedMotion ? 'reduce' : 'full';
  root.dataset.palette = state.colorBlindPalette ? 'color-blind' : 'standard';
  root.style.colorScheme = state.appearance;
  if (root === document.documentElement) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', tokensFor(state).bg);
  }
}

/** A game's accent made legible on the current palette, for tiles, pages and emblems. */
export function gameAccent(
  accent: string,
  state: Pick<ThemeState, 'theme' | 'appearance' | 'colorBlindPalette'>,
): string {
  return accentFor(accent, tokensFor(state));
}
