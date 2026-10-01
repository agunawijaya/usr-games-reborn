import { describe, expect, it } from 'vitest';
import { createRoom, type RoomSpec } from '../engine/room';
import type { RoomState } from '../engine/types';
import { createGlasses } from './glasses';
import { createMochi } from './mochi';
import { createPatternMind, isPattern } from './pip';
import { autobotMove, professorSafeMoves } from './professor';
import { playNight, playRoom } from './run';
import type { Mind } from './types';

function classicRoom(overrides: Partial<RoomSpec>): RoomState {
  return createRoom({
    width: 59,
    height: 22,
    rules: 'classic',
    cat: { x: 5, y: 0 },
    vacuums: [],
    seed: 'r',
    ...overrides,
  });
}

describe('Mochi (the stand-still experiment)', () => {
  it('loafs while nothing is next to her and zooms the moment something is', () => {
    const mochi = createMochi();
    const calm = classicRoom({ vacuums: [{ kind: 'basic', x: 30, y: 10 }] });
    expect(mochi.decide(calm)).toEqual({ type: 'wait', mode: 'loaf' });
    const close = classicRoom({ vacuums: [{ kind: 'basic', x: 6, y: 1 }] });
    expect(mochi.decide(close)).toEqual({ type: 'zoom' });
  });
});

describe('Pip (the pattern-roll experiment)', () => {
  it('runs the first letter of the pattern as far as it is safe', () => {
    const pip = createPatternMind('LJ');
    const room = classicRoom({ cat: { x: 10, y: 10 }, vacuums: [{ kind: 'basic', x: 50, y: 20 }] });
    expect(pip.decide(room)).toEqual({ type: 'step', dx: 1, dy: 0 });
  });

  it('accepts only patterns of one to eight direction letters', () => {
    expect(isPattern('YHBJNLUK')).toBe(true);
    expect(isPattern('')).toBe(false);
    expect(isPattern('YHBJNLUKY')).toBe(false);
    expect(isPattern('XQ')).toBe(false);
  });
});

describe('the Professor (the 1999 automatic player)', () => {
  it('runs from the ghost of a scrapped vacuum near the top edge', () => {
    const haunted = classicRoom({
      vacuums: [
        { kind: 'basic', x: 6, y: 0 },
        { kind: 'basic', x: 40, y: 15 },
      ],
    });
    // A wreck right beside the cat on the top row: the scrapped vacuum still sits in its slot.
    const wrecked: RoomState = {
      ...haunted,
      vacuums: haunted.vacuums.map((v) => (v.id === 0 ? { ...v, alive: false } : v)),
      tangles: [{ x: 6, y: 0, kind: 'wreck', size: 1 }],
    };
    expect(autobotMove(wrecked)).not.toBe('.');
    // The same tangle with no scrapped vacuum behind it (a sock): she sits tight.
    const sock: RoomState = {
      ...haunted,
      vacuums: haunted.vacuums.filter((v) => v.id === 1).map((v) => ({ ...v, id: 0 })),
      tangles: [{ x: 6, y: 0, kind: 'sock', size: 0 }],
    };
    expect(autobotMove(sock)).toBe('.');
  });

  it('takes the corner marks of the border for robots', () => {
    const corner = classicRoom({ cat: { x: 1, y: 1 }, vacuums: [{ kind: 'basic', x: 40, y: 15 }] });
    expect(professorSafeMoves(corner)).not.toContain('y');
    expect(professorSafeMoves(corner)).toContain('u');
  });
});

describe('the ladder', () => {
  function medianNight(make: () => Mind): number {
    const scores = Array.from({ length: 15 }, (_, i) => playNight(`ladder-${i}`, make()).score);
    return scores.sort((a, b) => a - b)[7]!;
  }

  it('puts the patched Professor above the napping strategy over a set of Long Nights', () => {
    expect(medianNight(createGlasses)).toBeGreaterThan(medianNight(createMochi));
  });

  it('stops a strategy that circles forever', () => {
    const lone = createRoom({
      width: 9,
      height: 7,
      rules: 'house',
      cat: { x: 8, y: 6 },
      vacuums: [{ kind: 'basic', x: 0, y: 0 }],
      seed: 'lone',
    });
    expect(playRoom(lone, createMochi(), 50).outcome).not.toBe('cleared');
  });
});
