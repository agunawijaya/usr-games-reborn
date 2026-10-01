import { describe, expect, it } from 'vitest';
import { createRoom } from './room';
import { applyAction } from './rules';
import { lowerBound, solve, stateKey } from './solver';

const twoVacuums = createRoom({
  width: 9,
  height: 7,
  rules: 'house',
  cat: { x: 4, y: 6 },
  vacuums: [
    { kind: 'basic', x: 0, y: 0 },
    { kind: 'basic', x: 8, y: 0 },
  ],
  seed: 'solver',
});

describe('the solver', () => {
  it('finds the fewest turns and a route that really clears the room', () => {
    const solution = solve(twoVacuums);
    expect(solution?.proven).toBe(true);
    let state = twoVacuums;
    for (const action of solution!.actions) state = applyAction(state, action).state;
    expect(state.status).toBe('cleared');
    expect(state.turn).toBe(solution!.turns);
  });

  it('never claims a bound above the true answer', () => {
    expect(lowerBound(twoVacuums)).toBeLessThanOrEqual(solve(twoVacuums)!.turns);
  });

  it('knows a lone vacuum with nothing to bump into can never be cleared', () => {
    const lone = createRoom({
      width: 5,
      height: 5,
      rules: 'house',
      cat: { x: 4, y: 4 },
      vacuums: [{ kind: 'basic', x: 0, y: 0 }],
      seed: 'lone',
    });
    expect(lowerBound(lone)).toBeGreaterThan(1000);
    expect(solve(lone)).toBeNull();
  });

  it('keys states by what matters, not by vacuum order', () => {
    const swapped = createRoom({
      width: 9,
      height: 7,
      rules: 'house',
      cat: { x: 4, y: 6 },
      vacuums: [
        { kind: 'basic', x: 8, y: 0 },
        { kind: 'basic', x: 0, y: 0 },
      ],
      seed: 'other',
    });
    expect(stateKey(swapped)).toBe(stateKey(twoVacuums));
  });
});
