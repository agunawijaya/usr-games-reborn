import type { CardId, Rank } from '@usr-games/kit/cards';

/**
 * Everything that happens at the pond, in order. The full log knows every card; each seat sees
 * it through `seeEvent`, which hides the cards that seat could not see at a real table: other
 * players' deals and the cards they draw from the pond. Asks, answers, handed-over cards, lucky
 * catches and books are shown to everyone, as they are when people play.
 */

export type EndReason = 'hand-empty' | 'all-books' | 'stalled';

export type GameEvent =
  | { kind: 'deal'; hands: readonly (readonly CardId[])[]; starter: number }
  | { kind: 'ask'; asker: number; target: number; rank: Rank }
  | { kind: 'give'; from: number; to: number; rank: Rank; cards: readonly CardId[] }
  | { kind: 'go-fish'; asker: number; target: number; rank: Rank }
  /** `lucky` when a cast brings up the rank that was asked for. */
  | { kind: 'draw'; seat: number; card: CardId; lucky: boolean; why: 'fish' | 'refill' }
  | { kind: 'book'; seat: number; rank: Rank; golden: boolean; cards: readonly CardId[] }
  | { kind: 'turn'; seat: number }
  | {
      kind: 'end';
      books: readonly number[];
      winners: readonly number[];
      reason: EndReason;
      /** The original's one-in-1024 parting line came up. */
      taunt: boolean;
    };

/** The same events as one seat sees them: hidden cards become `null`. */
export type SeatEvent =
  | { kind: 'deal'; handCounts: readonly number[]; hand: readonly CardId[]; starter: number }
  | { kind: 'ask'; asker: number; target: number; rank: Rank }
  | { kind: 'give'; from: number; to: number; rank: Rank; cards: readonly CardId[] }
  | { kind: 'go-fish'; asker: number; target: number; rank: Rank }
  | { kind: 'draw'; seat: number; card: CardId | null; lucky: boolean; why: 'fish' | 'refill' }
  | { kind: 'book'; seat: number; rank: Rank; golden: boolean; cards: readonly CardId[] }
  | { kind: 'turn'; seat: number }
  | {
      kind: 'end';
      books: readonly number[];
      winners: readonly number[];
      reason: EndReason;
      taunt: boolean;
    };

export function seeEvent(event: GameEvent, seat: number): SeatEvent {
  switch (event.kind) {
    case 'deal':
      return {
        kind: 'deal',
        handCounts: event.hands.map((hand) => hand.length),
        hand: event.hands[seat] ?? [],
        starter: event.starter,
      };
    case 'draw':
      // A lucky catch is shown to the table to prove it; any other draw stays in the drawer's hand.
      return { ...event, card: event.seat === seat || event.lucky ? event.card : null };
    default:
      return event;
  }
}
