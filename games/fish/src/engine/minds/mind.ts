import type { CardId, Rank } from '@usr-games/kit/cards';
import type { Chance } from '../chance';
import type { SeatEvent } from '../events';
import type { Ask } from '../game';

/**
 * A rival's mind. It learns only through `observe`, which receives the events as its own seat
 * sees them, and decides from `SeatView`, which holds its own hand and the public counts. Neither
 * carries another player's hidden cards. The single exception is `Peek`, which only the Classic
 * 1993 rule set hands to the original's computer, because the original really did look (rarely).
 */

export type MindName = 'otto' | 'hazel' | 'miso' | 'reference';

export interface SeatView {
  seat: number;
  hand: readonly CardId[];
  /** Cards in each seat's hand, books excluded; everyone can count these. */
  handCounts: readonly number[];
  pond: number;
  /** Books each seat has made. */
  books: readonly (readonly Rank[])[];
}

/** A look at another player's hand. Granted only to the Classic 1993 computer. */
export interface Peek {
  handOf(seat: number): readonly CardId[];
}

export interface Mind {
  readonly name: MindName;
  readonly seat: number;
  observe(event: SeatEvent): void;
  choose(view: SeatView, chance: Chance, peek?: Peek): Ask;
}

/** Counts per rank, index 0 for aces, the way the original kept its hands. */
export function rankCounts(hand: readonly CardId[]): number[] {
  const counts = new Array<number>(13).fill(0);
  for (const card of hand) counts[card % 13]!++;
  return counts;
}

/** Seats other than `seat` that still hold cards and so may be asked. */
export function askableSeats(view: SeatView): number[] {
  return view.handCounts.flatMap((count, other) =>
    other !== view.seat && count > 0 ? [other] : [],
  );
}

/** Any askable seat; with only one opponent no number is drawn, as in the two-player original. */
export function anyOpponent(view: SeatView, chance: Chance): number {
  const seats = askableSeats(view);
  if (seats.length === 0) throw new Error(`seat ${view.seat} has nobody to ask`);
  return seats.length === 1 ? seats[0]! : seats[chance.below(seats.length)]!;
}
