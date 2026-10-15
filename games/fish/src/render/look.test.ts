import { AA_TEXT, AA_UI, contrastRatio, mixHex } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { FIREFLY, type Look, MORNING } from './look';

/** Panel text must reach AA in both ponds; see-through panels are judged at their solid colour. */

const solid = (colour: string): string => {
  const match = colour.match(/[\d.]+/g);
  if (!colour.startsWith('rgba') || !match) return colour;
  const [r, g, b] = match.map(Number);
  return `#${[r, g, b].map((v) => Math.round(v!).toString(16).padStart(2, '0')).join('')}`;
};

function pairs(look: Look): [string, string, string, number][] {
  const ui = look.ui;
  return [
    ['ink on panel', ui.ink, ui.panelSolid, AA_TEXT],
    ['soft ink on panel', ui.inkSoft, ui.panelSolid, AA_TEXT],
    ['accent text on panel', ui.accentStrong, ui.panelSolid, AA_TEXT],
    ['text on accent', ui.accentInk, ui.accent, AA_TEXT],
    ['notebook ink on paper', ui.paperInk, ui.paper, AA_TEXT],
    ['soft ink on paper', ui.inkSoft, ui.paper, AA_TEXT],
    ['good news on paper', ui.good, ui.paper, AA_TEXT],
    ['a "has" cell', ui.hasInk, ui.has, AA_TEXT],
    ['a "none" mark on paper', ui.none, ui.paper, AA_UI],
    ['words in a bubble', ui.bubbleInk, ui.bubble, AA_TEXT],
    ['a number key', ui.keyInk, ui.key, AA_TEXT],
    ['a rank button', ui.cardInk, ui.card, AA_TEXT],
    ['focus ring on panel', ui.focus, ui.panelSolid, AA_UI],
  ];
}

describe.each([MORNING, FIREFLY])('panel colours of $id', (look) => {
  it.each(pairs(look))('%s reaches AA', (_name, fore, back, needed) => {
    expect(contrastRatio(solid(fore), solid(back))).toBeGreaterThanOrEqual(needed);
  });

  it('the soft ink still reads on a panel laid over the brightest water', () => {
    // A see-through panel over the pond can only lighten or darken towards the water a little.
    const over = mixHex(look.ui.panelSolid, look.water.far, 0.08);
    expect(contrastRatio(look.ui.inkSoft, over)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
