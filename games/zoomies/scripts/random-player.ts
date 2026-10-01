/**
 * A player who only avoids immediate danger: random safe steps, a loaf now and then, a zoom
 * when cornered. How often it clears a room is the rough measure of difficulty the room search
 * aims at. Seeded, so the same room always scores the same.
 */
import { createRng } from '@usr-games/kit';
import { applyAction, legality, STEPS } from '../src/engine/rules';
import type { Action, RoomState } from '../src/engine/types';

export function randomClearRate(initial: RoomState, tries: number, seed: string): number {
  const rng = createRng(seed);
  let cleared = 0;
  for (let t = 0; t < tries; t++) {
    let state = initial;
    while (state.status === 'playing' && state.turn < 200) {
      const safe = STEPS.map(([dx, dy]) => ({ type: 'step', dx, dy }) as Action).filter(
        (a) => legality(state, a) === 'ok',
      );
      const loaf: Action = { type: 'wait', mode: 'loaf' };
      const action: Action =
        safe.length === 0
          ? { type: 'zoom' }
          : rng.chance(0.15) && legality(state, loaf) === 'ok'
            ? loaf
            : rng.pick(safe);
      state = applyAction(state, action).state;
    }
    if (state.status === 'cleared') cleared++;
  }
  return cleared / tries;
}
