import { netWorth } from '../src/engine/state';
import type { GameState } from '../src/engine/types';

/**
 * Staged tables for recordings and the owner's review: a game set up some rounds in, so the
 * moments worth showing (a counter-offer, a landmark, an auction) come within a minute.
 * `?stage=slice` on the workbench; seats are you, Dex and Marlowe.
 */

function own(state: GameState, seat: number, spaces: readonly number[], level = 0): void {
  for (const space of spaces) {
    state.deeds[space]!.owner = seat;
    state.deeds[space]!.level = level;
    state.supply.storeys -= level;
  }
}

/**
 * Round 10 of a Quick game. You have Lighthouse Hill nearly topped out and two thirds of the
 * Fish Market; Dex holds the third (Chowder Court). Marlowe has built on Skyline Park.
 */
export function sliceStage(state: GameState): void {
  own(state, 0, [21, 23], 4);
  own(state, 0, [24], 3);
  own(state, 0, [6, 8]);
  own(state, 1, [9, 16, 18, 25]);
  own(state, 2, [31, 32, 34], 2);
  own(state, 2, [19, 1, 3, 37]);
  const seats = state.seats;
  seats[0]!.coins = 1900;
  seats[1]!.coins = 1300;
  seats[2]!.coins = 950;
  seats[0]!.position = 0;
  seats[1]!.position = 26;
  seats[2]!.position = 12;
  state.round = 10;
  state.history = [seats.map((_, seat) => netWorth(state, seat))];
}

/** The slice's table with you 150 coins short: sale boards stand on your lots until you settle. */
export function debtStage(state: GameState): void {
  sliceStage(state);
  state.seats[0]!.coins = -150;
  state.seats[0]!.creditor = 1;
}

export const STAGES: Readonly<Record<string, (state: GameState) => void>> = {
  slice: sliceStage,
  debt: debtStage,
};
