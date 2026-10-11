import { readFileSync } from 'node:fs';
import { AA_TEXT, AA_UI, contrastRatio } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { DAY, NIGHT } from '../render/sprint/palette';

/**
 * AA contrast for every theme and look: the colour tokens in styles.css, read straight from the
 * file, checked text against the surfaces they sit on. See-through panels are composited over
 * the darkest or lightest ground they float on, whichever is worse.
 */
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function tokens(theme: string, look: string): Record<string, string> {
  const block = new RegExp(
    `\\.ns\\[data-theme='${theme}'\\]\\[data-look='${look}'\\] \\{([^}]*)\\}`,
  ).exec(css);
  if (!block) throw new Error(`no tokens for ${theme} ${look}`);
  const found: Record<string, string> = {};
  for (const match of block[1]!.matchAll(/--ns-([a-z0-9-]+):\s*([^;]+);/g))
    found[match[1]!] = match[2]!.trim();
  return found;
}

function rgba(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const parts = /rgba?\(([^)]+)\)/
    .exec(color)![1]!
    .split(',')
    .map((p) => Number(p.trim()));
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

/** A colour laid over a ground, as a hex string. */
function over(color: string, ground: string): string {
  const [r, g, b, a] = rgba(color);
  const [R, G, B] = rgba(ground);
  const mix = (top: number, bottom: number) => Math.round(top * a + bottom * (1 - a));
  return `#${[mix(r, R), mix(g, G), mix(b, B)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const LOOKS = [
  {
    theme: 'sprint',
    look: 'day',
    grounds: ['#d4ecfb', '#c95a3f', '#1f4e8c'],
    board: DAY.boardFace,
  },
  {
    theme: 'sprint',
    look: 'night',
    grounds: ['#030814', '#6e2a20', '#15284a'],
    board: NIGHT.boardFace,
  },
  {
    theme: 'atom',
    look: 'day',
    grounds: ['#eef8f4', '#cfe9df'],
    board: 'rgba(255, 255, 255, 0.82)',
  },
  {
    theme: 'atom',
    look: 'night',
    grounds: ['#0d0a2a', '#05041a'],
    board: 'rgba(18, 14, 52, 0.82)',
  },
] as const;

describe.each(LOOKS)('$theme by $look', ({ theme, look, grounds, board }) => {
  const t = tokens(theme, look);
  const worst = (fg: string, bg: string) =>
    Math.min(
      ...grounds.map((ground) => contrastRatio(over(fg, over(bg, ground)), over(bg, ground))),
    );

  it('keeps text readable on panels and keys', () => {
    for (const ink of ['ink', 'ink-2', 'accent'])
      expect(worst(t[ink]!, t.panel!)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(worst(t['key-ink']!, t.key!)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(worst(t['accent-ink']!, t['accent-fill']!)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(worst(t.ink!, t['panel-solid']!)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps the problem readable on the scoreboard or the lab display', () => {
    for (const ink of ['board-ink', 'board-ink-2', 'typed']) {
      expect(worst(t[ink]!, board)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('draws focus rings and status colours that stand out', () => {
    expect(worst(t.focus!, t.panel!)).toBeGreaterThanOrEqual(AA_UI);
    expect(worst(t.good!, t.panel!)).toBeGreaterThanOrEqual(AA_UI);
  });
});
