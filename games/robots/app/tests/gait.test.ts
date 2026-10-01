import { describe, expect, it } from 'vitest';
import { footPlan, stepsFor, STRIDE } from '../src/entities/gait';

const SAMPLES = 400;

describe('footPlan (the walk)', () => {
  for (const L of [1, Math.SQRT2, 0.4]) {
    for (const lead of [0, 1]) {
      it(`L=${L.toFixed(2)} lead=${lead}: starts and ends with the feet together`, () => {
        expect(footPlan(L, 0, lead).pos).toEqual([0, 0]);
        expect(footPlan(L, 1, lead).pos).toEqual([L, L]);
      });

      it(`L=${L.toFixed(2)} lead=${lead}: feet only go forward, one at a time, and a planted foot never slides`, () => {
        const n = stepsFor(L);
        for (let k = 0; k < n; k++) {
          // inside one step: one foot swings, the other stays put
          const at = (u: number) => footPlan(L, (k + u) / n, lead);
          const start = at(1e-6);
          const still = [0, 1].filter((f) => [0.2, 0.5, 0.8, 0.999].every((u) => Math.abs(at(u).pos[f] - start.pos[f]) < 1e-9));
          expect(still.length).toBeGreaterThanOrEqual(1);
          for (const f of still) for (const u of [0.2, 0.5, 0.8]) expect(at(u).lift[f]).toBe(0);
        }
        let prev = footPlan(L, 0, lead);
        for (let i = 1; i <= SAMPLES; i++) {
          const cur = footPlan(L, i / SAMPLES, lead);
          for (const f of [0, 1]) expect(cur.pos[f]).toBeGreaterThanOrEqual(prev.pos[f] - 1e-9);
          prev = cur;
        }
      });

      it(`L=${L.toFixed(2)} lead=${lead}: the feet are never further apart than a stride`, () => {
        for (let i = 0; i <= SAMPLES; i++) {
          const { pos } = footPlan(L, i / SAMPLES, lead);
          expect(Math.abs(pos[0] - pos[1])).toBeLessThanOrEqual(STRIDE + 1e-9);
        }
      });
    }
  }

  it('walks a straight square in two plants and a diagonal in three, plus the closing step', () => {
    expect(stepsFor(1)).toBe(3);
    expect(stepsFor(Math.SQRT2)).toBe(4);
  });

  it('lifts the swinging foot only mid-step, and the lead foot first', () => {
    const early = footPlan(1, 0.5 / 3, 1);
    expect(early.lift[1]).toBeGreaterThan(0.05);
    expect(early.lift[0]).toBe(0);
    expect(footPlan(1, 1 / 3 + 1e-9, 1).lift[0]).toBeLessThan(1e-6);
  });
});
