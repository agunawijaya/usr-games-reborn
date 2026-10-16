import { LOCKUP_INDEX } from '../boards/layout';
import type { GameState } from '../engine/types';

/**
 * The hands that set a scenario's table after the deal: deeds placed, buildings standing,
 * purses filled or emptied, tokens moved. Buildings come out of the builders' stock as if they
 * had been bought, so the rules see a table they could have reached by playing.
 */

export interface Table {
  /** Hands a seat deeds, built to `level` (5 is the landmark). */
  give(seat: number, spaces: readonly number[], level?: number): void;
  purse(seat: number, coins: number): void;
  place(seat: number, space: number): void;
  mortgage(spaces: readonly number[]): void;
  lockUp(seat: number): void;
}

export function tableFor(state: GameState): Table {
  return {
    give(seat, spaces, level = 0) {
      for (const space of spaces) {
        const deed = state.deeds[space];
        if (!deed) throw new RangeError(`space ${space} cannot be owned`);
        deed.owner = seat;
        deed.level = level;
        if (level === 5) state.supply.landmarks -= 1;
        else state.supply.storeys -= level;
      }
    },
    purse(seat, coins) {
      state.seats[seat]!.coins = coins;
    },
    place(seat, space) {
      state.seats[seat]!.position = space;
    },
    mortgage(spaces) {
      for (const space of spaces) state.deeds[space]!.mortgaged = true;
    },
    lockUp(seat) {
      const s = state.seats[seat]!;
      s.position = LOCKUP_INDEX;
      s.inLockup = true;
      s.lockupTries = 0;
    },
  };
}
