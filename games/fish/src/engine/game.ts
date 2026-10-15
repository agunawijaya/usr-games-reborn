import { type CardId, type Rank, rankOf } from '@usr-games/kit/cards';
import type { Dice } from './chance';
import type { EndReason, GameEvent } from './events';
import {
  GOLDEN_ODDS,
  handSize,
  MAX_ASKS,
  RULE_SETS,
  type RuleSetId,
  RARE_NUMBER,
  RARE_ODDS,
} from './rules';

/**
 * The rules of Go Fish as a pure state machine. Seats are numbered clockwise from the player
 * at the bottom of the screen; seat 0 is "you" in play, but the engine treats every seat alike.
 *
 * Adapted from fish.c (Muffy Barkocy, Berkeley, 1990, 1993; BSD licence, see CREDITS.md):
 * deal from the end of the deck one card each in turn, ask only for a rank you hold, take every
 * card of that rank the other player has and ask again, otherwise draw from the pond and ask
 * again only if you drew the rank you asked for; books of four leave play.
 */

export interface Book {
  rank: Rank;
  golden: boolean;
}

export interface Seat {
  hand: readonly CardId[];
  books: readonly Book[];
}

export interface FishState {
  rules: RuleSetId;
  seats: readonly Seat[];
  /** Face-down cards; the top of the pond is the end of the array. */
  pond: readonly CardId[];
  /** The seat whose ask it is. */
  turn: number;
  over: boolean;
  asks: number;
}

export interface Ask {
  target: number;
  rank: Rank;
}

export interface Step {
  state: FishState;
  events: GameEvent[];
}

export function ranksIn(hand: readonly CardId[]): Rank[] {
  return [...new Set(hand.map(rankOf))].sort((a, b) => a - b);
}

export function countRank(hand: readonly CardId[], rank: Rank): number {
  let count = 0;
  for (const card of hand) if (rankOf(card) === rank) count++;
  return count;
}

export function booksMade(state: FishState): number {
  return state.seats.reduce((sum, seat) => sum + seat.books.length, 0);
}

/**
 * Deals `deck` (drawn from its end, one card to each seat in turn, seat 0 first) and then lets
 * chance pick who asks first, in the same order the original drew its random numbers.
 */
export function startGame(
  rules: RuleSetId,
  players: number,
  deck: readonly CardId[],
  dice: Dice,
): Step {
  const set = RULE_SETS[rules];
  if (players < set.minPlayers || players > set.maxPlayers) {
    throw new RangeError(`${rules} is for ${set.minPlayers}–${set.maxPlayers} players`);
  }
  const pond = deck.slice();
  const hands: CardId[][] = Array.from({ length: players }, () => []);
  const size = handSize(players);
  for (let round = 0; round < size; round++) {
    for (const hand of hands) hand.push(pond.pop()!);
  }
  const starter = dice.rules.below(players);
  const events: GameEvent[] = [{ kind: 'deal', hands, starter }];
  const seats = hands.map((hand): Seat => ({ hand, books: [] }));
  let state: FishState = { rules, seats, pond, turn: starter, over: false, asks: 0 };
  // Four of a kind straight from the deal is a book at once.
  for (let seat = 0; seat < players; seat++) {
    for (const rank of ranksIn(state.seats[seat]!.hand)) {
      state = takeBookIfComplete(state, seat, rank, dice, events);
    }
  }
  return { state, events };
}

export function isLegalAsk(state: FishState, asker: number, ask: Ask): boolean {
  if (state.over || asker !== state.turn) return false;
  if (ask.target === asker || ask.target < 0 || ask.target >= state.seats.length) return false;
  if (state.seats[ask.target]!.hand.length === 0) return false;
  return countRank(state.seats[asker]!.hand, ask.rank) > 0;
}

export function legalAsks(state: FishState, asker: number): Ask[] {
  if (state.over || asker !== state.turn) return [];
  const asks: Ask[] = [];
  for (const rank of ranksIn(state.seats[asker]!.hand)) {
    state.seats.forEach((seat, target) => {
      if (target !== asker && seat.hand.length > 0) asks.push({ target, rank });
    });
  }
  return asks;
}

/**
 * One ask and everything that follows from it: the cards handed over or the cast into the pond,
 * any book, the end of the game, and the turn passing on when the asker's luck runs out.
 */
export function applyAsk(state: FishState, asker: number, ask: Ask, dice: Dice): Step {
  if (!isLegalAsk(state, asker, ask)) {
    throw new Error(`seat ${asker} may not ask seat ${ask.target} for ${ask.rank}`);
  }
  const events: GameEvent[] = [{ kind: 'ask', asker, target: ask.target, rank: ask.rank }];
  let next: FishState = { ...state, asks: state.asks + 1 };
  const answer = next.seats[ask.target]!.hand.filter((card) => rankOf(card) === ask.rank);

  if (answer.length > 0) {
    next = moveCards(next, ask.target, asker, answer);
    events.push({ kind: 'give', from: ask.target, to: asker, rank: ask.rank, cards: answer });
    next = takeBookIfComplete(next, asker, ask.rank, dice, events);
    return settle(next, asker, true, dice, events);
  }

  events.push({ kind: 'go-fish', asker, target: ask.target, rank: ask.rank });
  if (next.pond.length === 0) return settle(next, asker, false, dice, events);
  const { state: afterDraw, card } = drawFromPond(next, asker);
  const lucky = rankOf(card) === ask.rank;
  events.push({ kind: 'draw', seat: asker, card, lucky, why: 'fish' });
  next = takeBookIfComplete(afterDraw, asker, rankOf(card), dice, events);
  return settle(next, asker, lucky, dice, events);
}

/**
 * After an ask: end the game if its rules say so, refill emptied hands in All 13 books, and keep
 * the turn with the asker or pass it on.
 */
function settle(
  state: FishState,
  asker: number,
  asksAgain: boolean,
  dice: Dice,
  events: GameEvent[],
): Step {
  let next = state;
  const set = RULE_SETS[next.rules];
  const reason = endReason(next);
  if (reason) return { state: finish(next, reason, dice, events), events };
  if (set.refillsEmptyHands) next = refillEmptyHands(next, asker, events);

  const canContinue = asksAgain && next.seats[asker]!.hand.length > 0 && hasTarget(next, asker);
  if (!canContinue) {
    const seat = nextSeatWithCards(next, asker);
    if (seat === null) return { state: finish(next, 'all-books', dice, events), events };
    next = { ...next, turn: seat };
    events.push({ kind: 'turn', seat });
  }
  if (!hasTarget(next, next.turn)) return fishAlone(next, dice, events);
  return { state: next, events };
}

function endReason(state: FishState): EndReason | null {
  if (booksMade(state) === 13) return 'all-books';
  if (RULE_SETS[state.rules].endsOnEmptyHand && state.seats.some((s) => s.hand.length === 0)) {
    return 'hand-empty';
  }
  if (state.asks >= MAX_ASKS) return 'stalled';
  return null;
}

function hasTarget(state: FishState, seat: number): boolean {
  return state.seats.some((other, index) => index !== seat && other.hand.length > 0);
}

function nextSeatWithCards(state: FishState, from: number): number | null {
  const players = state.seats.length;
  for (let step = 1; step <= players; step++) {
    const seat = (from + step) % players;
    if (state.seats[seat]!.hand.length > 0) return seat;
  }
  return null;
}

/**
 * The one corner the original never meets: in All 13 books the player to ask may hold the only
 * cards left in anyone's hand while the pond still has some. Nobody can be asked, so they draw
 * one card and the turn moves on.
 */
function fishAlone(state: FishState, dice: Dice, events: GameEvent[]): Step {
  if (state.pond.length === 0) return { state: finish(state, 'all-books', dice, events), events };
  const seat = state.turn;
  const { state: afterDraw, card } = drawFromPond(state, seat);
  events.push({ kind: 'draw', seat, card, lucky: false, why: 'refill' });
  const next = takeBookIfComplete(afterDraw, seat, rankOf(card), dice, events);
  return settle(next, seat, false, dice, events);
}

function refillEmptyHands(state: FishState, asker: number, events: GameEvent[]): FishState {
  let next = state;
  const players = next.seats.length;
  // The asker first, then round the table, so the order never depends on who emptied first.
  for (let step = 0; step < players; step++) {
    const seat = (asker + step) % players;
    if (next.seats[seat]!.hand.length > 0 || next.pond.length === 0) continue;
    const { state: afterDraw, card } = drawFromPond(next, seat);
    next = afterDraw;
    events.push({ kind: 'draw', seat, card, lucky: false, why: 'refill' });
  }
  return next;
}

function finish(state: FishState, reason: EndReason, dice: Dice, events: GameEvent[]): FishState {
  const books = state.seats.map((seat) => seat.books.length);
  const best = Math.max(...books);
  const winners = books.flatMap((count, seat) => (count === best ? [seat] : []));
  // The original rolled for its parting line only when somebody had won outright.
  const taunt = winners.length === 1 && dice.rules.below(RARE_ODDS) === RARE_NUMBER;
  events.push({ kind: 'end', books, winners, reason, taunt });
  return { ...state, over: true };
}

function moveCards(
  state: FishState,
  from: number,
  to: number,
  cards: readonly CardId[],
): FishState {
  const moving = new Set(cards);
  const seats = state.seats.map((seat, index): Seat => {
    if (index === from) return { ...seat, hand: seat.hand.filter((card) => !moving.has(card)) };
    if (index === to) return { ...seat, hand: [...seat.hand, ...cards] };
    return seat;
  });
  return { ...state, seats };
}

function drawFromPond(state: FishState, seat: number): { state: FishState; card: CardId } {
  const pond = state.pond.slice();
  const card = pond.pop()!;
  const seats = state.seats.map((s, index): Seat =>
    index === seat ? { ...s, hand: [...s.hand, card] } : s,
  );
  return { state: { ...state, pond, seats }, card };
}

function takeBookIfComplete(
  state: FishState,
  seat: number,
  rank: Rank,
  dice: Dice,
  events: GameEvent[],
): FishState {
  const hand = state.seats[seat]!.hand;
  const cards = hand.filter((card) => rankOf(card) === rank);
  if (cards.length < 4) return state;
  const golden = dice.golden.below(GOLDEN_ODDS) === 0;
  events.push({ kind: 'book', seat, rank, golden, cards });
  const seats = state.seats.map((s, index): Seat =>
    index === seat
      ? {
          hand: hand.filter((card) => rankOf(card) !== rank),
          books: [...s.books, { rank, golden }],
        }
      : s,
  );
  return { ...state, seats };
}
