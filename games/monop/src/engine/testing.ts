import { createRng } from '@usr-games/kit';
import { newGame } from './game';
import { makeRules } from './rules';
import type { GameState, Preset, Rules, SeatSetup } from './types';

/** Helpers the engine's tests share: a table of seats and dice that fall as a test needs them. */

export function seats(count: number): SeatSetup[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `P${i}`,
    kind: 'human' as const,
    token: `t${i}`,
  }));
}

export function table(count = 3, rules: Rules | Preset = 'standard', seed = 'test'): GameState {
  return newGame({
    board: 'harbour',
    seats: seats(count),
    seed,
    rules: typeof rules === 'string' ? makeRules(rules) : rules,
  });
}

/** Sets the generator so the next rolls come out as listed. */
export function rig(state: GameState, ...rolls: (readonly [number, number])[]): void {
  for (let attempt = 0; ; attempt++) {
    const rng = createRng(`rig-${attempt}`);
    if (rolls.every(([a, b]) => rng.int(1, 6) === a && rng.int(1, 6) === b)) {
      state.rng = createRng(`rig-${attempt}`).state();
      return;
    }
  }
}

/** Gives a seat a set of deeds outright, as if bought earlier. */
export function own(state: GameState, seat: number, ...spaces: number[]): void {
  for (const space of spaces) state.deeds[space]!.owner = seat;
}
