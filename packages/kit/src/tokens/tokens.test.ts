import { describe, expect, it } from 'vitest';
import { AA_TEXT, AA_UI, contrastRatio } from '../color/color';
import { PALETTE_IDS } from '../settings/settings';
import { PALETTES, type ThemeTokens } from './themes';
import { accentFor, themeTokens, tokensToCss, tokenVariable } from './tokens';

const TEXT_TOKENS = ['ink', 'ink2', 'accent', 'accent2', 'mark', 'good', 'warn', 'bad'] as const;
const BACKGROUNDS = ['bg', 'bg2', 'surface', 'surface2'] as const;
const APPEARANCES = ['light', 'dark'] as const;

function describePair(tokens: ThemeTokens, fg: keyof ThemeTokens, bg: keyof ThemeTokens) {
  return `${fg} ${tokens[fg]} on ${bg} ${tokens[bg]}`;
}

describe('AA contrast in every palette × appearance combination', () => {
  for (const theme of PALETTE_IDS) {
    for (const appearance of APPEARANCES) {
      for (const colorBlindPalette of [false, true]) {
        const label = `${theme}/${appearance}${colorBlindPalette ? ' (colour-blind palette)' : ''}`;
        it(label, () => {
          const tokens = themeTokens({ theme, appearance, colorBlindPalette });
          const failures: string[] = [];
          for (const fg of TEXT_TOKENS) {
            for (const bg of BACKGROUNDS) {
              if (contrastRatio(tokens[fg], tokens[bg]) < AA_TEXT) {
                failures.push(describePair(tokens, fg, bg));
              }
            }
          }
          if (contrastRatio(tokens.accentInk, tokens.accent) < AA_TEXT) {
            failures.push(describePair(tokens, 'accentInk', 'accent'));
          }
          for (const ui of ['focus', 'lineStrong'] as const) {
            if (contrastRatio(tokens[ui], tokens.bg) < AA_UI) {
              failures.push(describePair(tokens, ui, 'bg'));
            }
          }
          expect(failures).toEqual([]);
        });
      }
    }
  }
});

describe('designed, not inverted', () => {
  it('gives every theme distinct light and dark palettes', () => {
    for (const theme of PALETTE_IDS) {
      const { light, dark } = PALETTES[theme].tokens;
      expect(light.bg).not.toBe(dark.bg);
      expect(light.accent).not.toBe(dark.accent);
    }
  });
});

describe('token helpers', () => {
  it('names CSS variables consistently', () => {
    expect(tokenVariable('fontBody')).toBe('--ug-font-body');
    expect(tokenVariable('surface2')).toBe('--ug-surface-2');
    const css = tokensToCss(themeTokens({ theme: 'manual', appearance: 'light' }));
    expect(css['--ug-mark']).toBe('#a8231b');
  });

  it('makes any game accent legible on every palette surface', () => {
    for (const theme of PALETTE_IDS) {
      for (const appearance of APPEARANCES) {
        const tokens = themeTokens({ theme, appearance });
        for (const accent of ['#ffe066', '#1a237e', '#7cfc00', '#ff4f9a']) {
          const safe = accentFor(accent, tokens);
          for (const bg of BACKGROUNDS.filter((b) => b !== 'bg2')) {
            expect(contrastRatio(safe, tokens[bg])).toBeGreaterThanOrEqual(AA_TEXT);
          }
        }
      }
    }
  });
});
