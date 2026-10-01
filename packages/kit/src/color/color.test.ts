import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ensureContrast,
  hexToOklch,
  isHexColor,
  meetsContrast,
  mixHex,
  oklchToHex,
  parseHex,
  relativeLuminance,
  toHex,
  withAlpha,
} from './color';

describe('hex parsing', () => {
  it('reads short and long forms', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('0a7f3c')).toEqual({ r: 10, g: 127, b: 60 });
    expect(toHex({ r: 10, g: 127, b: 60 })).toBe('#0a7f3c');
    expect(isHexColor('#12345')).toBe(false);
    expect(() => parseHex('green')).toThrow(TypeError);
  });
});

describe('WCAG contrast', () => {
  it('matches the reference values', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(meetsContrast('#777777', '#ffffff')).toBe(false);
  });
});

describe('OKLCH round trip', () => {
  it('returns the same colour within a rounding step', () => {
    for (const hex of ['#d9822b', '#1f7a74', '#5dff9a', '#0f1a2e', '#b3261e']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });
});

describe('ensureContrast', () => {
  it('leaves passing colours alone', () => {
    expect(ensureContrast('#111111', '#ffffff')).toBe('#111111');
  });

  it('darkens on light backgrounds and lightens on dark ones, keeping the hue', () => {
    const onPaper = ensureContrast('#e8a23c', '#f6f1e7');
    expect(contrastRatio(onPaper, '#f6f1e7')).toBeGreaterThanOrEqual(4.5);
    expect(relativeLuminance(onPaper)).toBeLessThan(relativeLuminance('#e8a23c'));

    const onNight = ensureContrast('#6b3fa0', '#0b0f14');
    expect(contrastRatio(onNight, '#0b0f14')).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(hexToOklch(onNight).h - hexToOklch('#6b3fa0').h)).toBeLessThan(12);
  });
});

describe('mixing', () => {
  it('interpolates and formats alpha', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(withAlpha('#ff0000', 0.25)).toBe('rgba(255, 0, 0, 0.25)');
  });
});
