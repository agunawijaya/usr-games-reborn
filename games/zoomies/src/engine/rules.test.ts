import { describe, expect, it } from 'vitest';
import { classicWaveSpec, createRoom, type RoomSpec, vacuumsForWave } from './room';
import { applyAction, isDangerous, legality, mustZoom, preferredSteps, whiskers } from './rules';
import type { Action, RoomState } from './types';

const stay: Action = { type: 'step', dx: 0, dy: 0 };
const loaf: Action = { type: 'wait', mode: 'loaf' };

function room(overrides: Partial<RoomSpec>): RoomState {
  return createRoom({
    width: 9,
    height: 7,
    rules: 'house',
    cat: { x: 4, y: 3 },
    vacuums: [],
    seed: 'test',
    ...overrides,
  });
}

describe('vacuum steps', () => {
  it('moves by the sign of the distance on both axes, like the original robots', () => {
    const state = room({ vacuums: [{ kind: 'basic', x: 0, y: 0 }] });
    const after = applyAction(state, stay).state;
    expect(after.vacuums[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('sends mops along one axis, the longer one first', () => {
    expect(preferredSteps('mop', 3, 1)).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(preferredSteps('mop', -1, -4)).toEqual([
      [0, -1],
      [-1, 0],
    ]);
  });

  it('slides along furniture when the diagonal is blocked', () => {
    const state = room({
      vacuums: [{ kind: 'basic', x: 1, y: 1 }],
      furniture: [{ kind: 'plant', x: 2, y: 2, w: 1, h: 1 }],
    });
    expect(applyAction(state, stay).state.vacuums[0]).toMatchObject({ x: 2, y: 1 });
  });

  it('rests slow vacuums every other turn', () => {
    let state = room({ vacuums: [{ kind: 'slow', x: 0, y: 3 }] });
    state = applyAction(state, stay).state;
    expect(state.vacuums[0]).toMatchObject({ x: 1, resting: true });
    state = applyAction(state, stay).state;
    expect(state.vacuums[0]).toMatchObject({ x: 1, resting: false });
    state = applyAction(state, stay).state;
    expect(state.vacuums[0]).toMatchObject({ x: 2 });
  });

  it('gives turbos a second step', () => {
    const state = room({ vacuums: [{ kind: 'turbo', x: 0, y: 3 }] });
    expect(applyAction(state, stay).state.vacuums[0]).toMatchObject({ x: 2, y: 3 });
  });
});

describe('bonks and tangles', () => {
  it('tangles two vacuums that arrive on the same square', () => {
    const state = room({
      vacuums: [
        { kind: 'basic', x: 2, y: 2 },
        { kind: 'basic', x: 2, y: 4 },
      ],
    });
    const { state: after, events } = applyAction(state, stay);
    expect(after.vacuums.every((v) => !v.alive)).toBe(true);
    expect(after.tangles).toEqual([{ x: 3, y: 3, kind: 'wreck', size: 2 }]);
    expect(after.tangled).toBe(2);
    expect(after.status).toBe('cleared');
    expect(events.map((e) => e.type)).toContain('bonk');
  });

  it('tangles a vacuum that rolls into a sock', () => {
    const state = room({
      vacuums: [{ kind: 'basic', x: 2, y: 3 }],
      clutter: [{ kind: 'sock', x: 3, y: 3 }],
    });
    const after = applyAction(state, stay).state;
    expect(after.tangles[0]).toMatchObject({ kind: 'sock', size: 1 });
    expect(after.status).toBe('cleared');
  });

  it('lets a hungry sweeper swallow one tangle, then tangle like any other', () => {
    let state = room({
      vacuums: [{ kind: 'sweeper', x: 0, y: 3 }],
      clutter: [
        { kind: 'sock', x: 1, y: 3 },
        { kind: 'cable', x: 2, y: 3 },
      ],
    });
    state = applyAction(state, stay).state;
    expect(state.vacuums[0]).toMatchObject({ alive: true, full: true, x: 1 });
    expect(state.tangles).toHaveLength(1);
    state = applyAction(state, stay).state;
    expect(state.vacuums[0]!.alive).toBe(false);
    expect(state.status).toBe('cleared');
  });

  it('counts a catch even when another vacuum piles onto the cat in the same turn', () => {
    const state = room({
      vacuums: [
        { kind: 'basic', x: 3, y: 3 },
        { kind: 'basic', x: 5, y: 3 },
      ],
    });
    expect(applyAction(state, stay).state.status).toBe('caught');
  });

  it('pays the classic nap bonus only for vacuums tangled after the nap began', () => {
    const state = room({
      rules: 'classic',
      vacuums: [
        { kind: 'basic', x: 3, y: 1 },
        { kind: 'basic', x: 5, y: 1 },
      ],
    });
    const after = applyAction(state, { type: 'wait', mode: 'nap' }).state;
    expect(after.napBonus).toBe(2);
  });
});

describe('the cat', () => {
  it('cannot step into a vacuum, a tangle or furniture', () => {
    const state = room({
      cat: { x: 4, y: 3 },
      vacuums: [{ kind: 'basic', x: 0, y: 0 }],
      clutter: [{ kind: 'sock', x: 5, y: 3 }],
      furniture: [{ kind: 'plant', x: 3, y: 3, w: 1, h: 1 }],
    });
    expect(legality(state, { type: 'step', dx: 1, dy: 0 })).toBe('blocked');
    expect(legality(state, { type: 'step', dx: -1, dy: 0 })).toBe('blocked');
    expect(legality(state, { type: 'step', dx: 0, dy: 1 })).toBe('ok');
  });

  it('marks steps next to a vacuum as unsafe, as the original refused them', () => {
    const state = room({ cat: { x: 4, y: 3 }, vacuums: [{ kind: 'basic', x: 6, y: 3 }] });
    expect(legality(state, { type: 'step', dx: 1, dy: 0 })).toBe('unsafe');
    expect(legality(state, { type: 'step', dx: -1, dy: 0 })).toBe('ok');
    expect(isDangerous(state, 5, 2)).toBe(true);
  });

  it('knows that a mop cannot reach a diagonal neighbour', () => {
    const state = room({ cat: { x: 4, y: 3 }, vacuums: [{ kind: 'mop', x: 6, y: 5 }] });
    expect(isDangerous(state, 5, 4)).toBe(false);
    expect(isDangerous(state, 6, 4)).toBe(true);
  });

  it('earns a safe zoom for every vacuum tangled while loafing', () => {
    const state = room({
      cat: { x: 4, y: 3 },
      vacuums: [
        { kind: 'basic', x: 3, y: 0 },
        { kind: 'basic', x: 5, y: 0 },
        { kind: 'basic', x: 8, y: 6 },
      ],
    });
    const after = applyAction(state, loaf).state;
    expect(after.tangled).toBe(2);
    expect(after.safeZooms).toBe(2);
  });

  it('spends a safe zoom on a landing nothing can reach', () => {
    let state = room({
      safeZooms: 1,
      cat: { x: 4, y: 3 },
      vacuums: [
        { kind: 'basic', x: 3, y: 2 },
        { kind: 'basic', x: 8, y: 0 },
      ],
    });
    expect(mustZoom(state)).toBe(false);
    state = applyAction(state, { type: 'zoom' }).state;
    expect(state.status).toBe('playing');
    expect(state.safeZooms).toBe(0);
    expect(state.zooms).toBe(1);
  });

  it('lands a zoom in the same place from the same state', () => {
    const state = room({ vacuums: [{ kind: 'basic', x: 0, y: 0 }] });
    const a = applyAction(state, { type: 'zoom' }).state.cat;
    const b = applyAction(state, { type: 'zoom' }).state.cat;
    expect(a).toEqual(b);
  });

  it('reports nine judged options', () => {
    const state = room({ vacuums: [{ kind: 'basic', x: 6, y: 3 }] });
    const verdicts = whiskers(state);
    expect(verdicts).toHaveLength(9);
    expect(verdicts.filter((w) => w.verdict === 'unsafe')).toHaveLength(3);
  });
});

describe('the charging dock', () => {
  it('sends a vacuum every few turns until it runs out', () => {
    let state = room({ cat: { x: 8, y: 6 }, dock: { x: 0, y: 0, every: 2, count: 2 } });
    expect(state.status).toBe('playing');
    state = applyAction(state, stay).state;
    expect(state.vacuums).toHaveLength(0);
    state = applyAction(state, stay).state;
    expect(state.vacuums).toHaveLength(1);
    expect(state.dock?.remaining).toBe(1);
  });

  it('jams for good when a tangle sits on it', () => {
    let state = room({
      cat: { x: 2, y: 5 },
      vacuums: [
        { kind: 'basic', x: 1, y: 0 },
        { kind: 'basic', x: 3, y: 0 },
      ],
      dock: { x: 2, y: 1, every: 5, count: 3 },
    });
    state = applyAction(state, stay).state;
    expect(state.dock?.jammed).toBe(true);
    expect(state.status).toBe('cleared');
  });
});

describe('classic waves', () => {
  it('follows the original count: ten more each level, at most forty', () => {
    expect([1, 2, 3, 4, 5, 9].map(vacuumsForWave)).toEqual([10, 20, 30, 40, 40, 40]);
  });

  it('lays out the same wave from the same seed', () => {
    const a = classicWaveSpec('night', 2);
    const b = classicWaveSpec('night', 2);
    expect(a).toEqual(b);
    expect(a.vacuums).toHaveLength(20);
    expect(a.width).toBe(59);
    expect(a.height).toBe(22);
  });
});
