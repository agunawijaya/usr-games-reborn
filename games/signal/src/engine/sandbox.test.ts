import { describe, expect, it } from 'vitest';
import {
  bannerSvg,
  cardSvg,
  CARRIERS,
  packCode,
  plainOf,
  type Recipe,
  stepsFor,
  tapeSvg,
  unpackCode,
  unsendable,
  writtenForm,
} from './sandbox';

describe('make your own', () => {
  const recipes: Recipe[] = [
    { text: 'MEET AT THE CLOCK', turn: { kind: 'none' }, carrier: 'telegraph' },
    { text: 'Tea at ten', turn: { kind: 'shift', shift: 7, secret: false }, carrier: 'punch' },
    { text: 'LAMP STILL ON', turn: { kind: 'shift', shift: 19, secret: true }, carrier: 'tape' },
    {
      text: 'LOOK UP',
      turn: { kind: 'keyword', keyword: 'DESK', secret: false },
      carrier: 'printer',
    },
    {
      text: 'WAVE BACK',
      turn: { kind: 'keyword', keyword: 'OWL', secret: true },
      carrier: 'semaphore',
    },
  ];

  it('round-trips every recipe through a desk code', () => {
    for (const recipe of recipes) {
      const code = packCode(recipe);
      expect(code).toMatch(/^DD1-[MCTBF]-(0|RS?|KS?)-[A-Z2-9]+-[A-Z2-9]{2}$/);
      const unpacked = unpackCode(` ${code.toLowerCase()} `)!;
      expect(unpacked.carrier).toBe(recipe.carrier);
      expect(plainOf(unpacked)).toBe(recipe.text.toUpperCase());
    }
  });

  it('keeps the words out of sight and refuses a damaged code', () => {
    const code = packCode(recipes[0]!);
    expect(code).not.toContain('CLOCK');
    expect(unpackCode(code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(unpackCode('hello')).toBeNull();
  });

  it('lets a friend solve it at the machines, carrier first, then the wheel', () => {
    const steps = stepsFor(unpackCode(packCode(recipes[2]!))!);
    expect(steps.map((step) => step.machine)).toEqual(['tape', 'cipher']);
    expect(steps[1]!.text).toBe('LAMP STILL ON');
  });

  it('warns about characters a carrier cannot take', () => {
    expect(unsendable('HI!', 'semaphore')).toEqual(['!']);
    expect(unsendable('A<B', 'printer')).toEqual(['<']);
    for (const carrier of CARRIERS) expect(writtenForm('SOS', carrier).length).toBeGreaterThan(0);
  });

  it('draws keepsakes as SVG with no raster in sight', () => {
    for (const svg of [cardSvg('NIGHT WIRE'), tapeSvg('HI'), bannerSvg('HI', 44)]) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/<image|data:image/);
    }
  });
});
