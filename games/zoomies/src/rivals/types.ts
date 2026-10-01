import type { Action, RoomState } from '../engine/types';

export type RivalId = 'mochi' | 'pip' | 'professor' | 'glasses' | 'par';

/**
 * A rival is a way of playing. Four of them are strategies found in the original program's
 * source; each keeps its own memory for a whole run, as the C code kept it in globals.
 */
export interface Mind {
  decide(state: RoomState): Action;
  /** Called when a new wave or room begins (the original reset its run state per level). */
  newRoom?(): void;
}

export interface RivalProfile {
  readonly id: RivalId;
  readonly name: string;
  /** One line for the rival card. */
  readonly style: string;
  /** Where the strategy comes from, for the card's small print. */
  readonly origin: string;
}
