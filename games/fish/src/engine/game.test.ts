import { createRng } from '@usr-games/kit';
import { type CardId, type Rank, rankOf, shuffledDeck } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import { type Chance, type Dice, diceFrom } from './chance';
import { seeEvent } from './events';
import { applyAsk, type FishState, isLegalAsk, legalAsks, type Seat, startGame } from './game';
import { createMind, type MindName } from './minds';
import { MAX_ASKS, type RuleSetId } from './rules';
import { Table } from './table';

/** A card by rank and suit index: clubs 0, diamonds 1, hearts 2, spades 3. */
const card = (rank: Rank, suit = 0): CardId => suit * 13 + rank - 1;
const fixed = (value: number): Chance => ({ below: (n) => Math.min(value, n - 1) });
const quietDice = (rules = 0): Dice => ({ rules: fixed(rules), golden: fixed(1) });

function stateWith(
  hands: CardId[][],
  pond: CardId[],
  options: { rules?: RuleSetId; turn?: number } = {},
): FishState {
  return {
    rules: options.rules ?? 'standard',
    seats: hands.map((hand): Seat => ({ hand, books: [] })),
    pond,
    turn: options.turn ?? 0,
    over: false,
    asks: 0,
  };
}

function playGame(seed: string, rules: RuleSetId, minds: MindName[]): Table {
  const rng = createRng(seed);
  const table = new Table({
    rules,
    minds: minds.map((name, seat) => createMind(name, seat)),
    deck: shuffledDeck(rng.split('deck')),
    dice: diceFrom(rng),
  });
  table.runComputers();
  return table;
}

describe('the deal', () => {
  it('gives seven cards each to two or three players and five each to four', () => {
    const deck = shuffledDeck(createRng('deal'));
    for (const [players, size] of [
      [2, 7],
      [3, 7],
      [4, 5],
    ] as const) {
      const { state, events } = startGame('standard', players, deck, quietDice());
      const deal = events[0]!;
      expect(deal.kind).toBe('deal');
      if (deal.kind !== 'deal') continue;
      expect(deal.hands.map((hand) => hand.length)).toEqual(new Array(players).fill(size));
      expect(state.pond.length).toBe(52 - players * size);
    }
  });

  it('deals from the end of the deck, one card each in turn, seat 0 first', () => {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    const { events } = startGame('classic', 2, deck, quietDice());
    const deal = events[0]!;
    if (deal.kind !== 'deal') throw new Error('no deal');
    expect(deal.hands[0]).toEqual([51, 49, 47, 45, 43, 41, 39]);
    expect(deal.hands[1]).toEqual([50, 48, 46, 44, 42, 40, 38]);
  });

  it('turns four of a kind dealt into a book at once', () => {
    // Seat 0 is dealt the cards at 51, 49, 47 …; put the four sevens there.
    const sevens = [card(7, 0), card(7, 1), card(7, 2), card(7, 3)];
    const others = Array.from({ length: 52 }, (_, i) => i).filter((c) => !sevens.includes(c));
    const deck = Array.from({ length: 52 }, (_, i) =>
      [45, 47, 49, 51].includes(i) ? sevens.pop()! : others.shift()!,
    );
    const { state, events } = startGame('standard', 2, deck, quietDice());
    expect(events.some((e) => e.kind === 'book' && e.seat === 0 && e.rank === 7)).toBe(true);
    expect(state.seats[0]!.books.map((b) => b.rank)).toEqual([7]);
    expect(state.seats[0]!.hand.some((c) => rankOf(c) === 7)).toBe(false);
  });

  it('seats as many players as the rule set allows: Classic two, the others up to four', () => {
    const deck = shuffledDeck(createRng('x'));
    expect(() => startGame('classic', 3, deck, quietDice())).toThrow();
    expect(() => startGame('standard', 4, deck, quietDice())).not.toThrow();
    expect(() => startGame('all-books', 5, deck, quietDice())).toThrow();
  });
});

describe('asking', () => {
  const hands = [
    [card(5), card(5, 1), card(9)],
    [card(5, 2), card(2), card(3)],
    [card(9, 1), card(11)],
  ];

  it('asks only for a rank in hand, of somebody else who holds cards', () => {
    const state = stateWith(hands, [card(4)]);
    expect(isLegalAsk(state, 0, { target: 1, rank: 5 })).toBe(true);
    expect(isLegalAsk(state, 0, { target: 1, rank: 2 })).toBe(false);
    expect(isLegalAsk(state, 0, { target: 0, rank: 5 })).toBe(false);
    expect(isLegalAsk(state, 1, { target: 0, rank: 2 })).toBe(false);
    expect(legalAsks(state, 0)).toHaveLength(4);
  });

  it('hands over every card of the rank, and the asker asks again', () => {
    const { state, events } = applyAsk(
      stateWith(hands, [card(4)]),
      0,
      { target: 1, rank: 5 },
      quietDice(),
    );
    expect(events.map((e) => e.kind)).toEqual(['ask', 'give']);
    expect(state.seats[0]!.hand.filter((c) => rankOf(c) === 5)).toHaveLength(3);
    expect(state.seats[1]!.hand).toEqual([card(2), card(3)]);
    expect(state.turn).toBe(0);
  });

  it('goes fishing on a "no", and the turn passes clockwise unless the cast is lucky', () => {
    const miss = applyAsk(stateWith(hands, [card(4)]), 0, { target: 2, rank: 5 }, quietDice());
    expect(miss.events.map((e) => e.kind)).toEqual(['ask', 'go-fish', 'draw', 'turn']);
    expect(miss.state.turn).toBe(1);
    expect(miss.state.seats[0]!.hand).toContain(card(4));

    const lucky = applyAsk(stateWith(hands, [card(5, 3)]), 0, { target: 2, rank: 5 }, quietDice());
    const draw = lucky.events.find((e) => e.kind === 'draw');
    expect(draw).toMatchObject({ lucky: true });
    expect(lucky.state.turn).toBe(0);
  });

  it('makes a book of four and sets it aside', () => {
    const { state, events } = applyAsk(
      stateWith(
        [
          [card(5), card(5, 1), card(5, 3), card(9)],
          [card(5, 2), card(2)],
        ],
        [],
      ),
      0,
      { target: 1, rank: 5 },
      quietDice(),
    );
    expect(events.map((e) => e.kind)).toEqual(['ask', 'give', 'book']);
    expect(state.seats[0]!.books).toEqual([{ rank: 5, golden: false }]);
    expect(state.seats[0]!.hand).toEqual([card(9)]);
  });

  it('passes the turn with nothing drawn when the pond is empty', () => {
    const { state, events } = applyAsk(
      stateWith(hands, []),
      0,
      { target: 2, rank: 5 },
      quietDice(),
    );
    expect(events.map((e) => e.kind)).toEqual(['ask', 'go-fish', 'turn']);
    expect(state.turn).toBe(1);
  });

  it('rolls golden fish from their own stream, never the rules stream', () => {
    const goldenDice: Dice = { rules: fixed(0), golden: fixed(0) };
    const { events } = applyAsk(
      stateWith(
        [
          [card(5), card(5, 1), card(5, 3), card(9)],
          [card(5, 2), card(2)],
        ],
        [],
      ),
      0,
      { target: 1, rank: 5 },
      goldenDice,
    );
    expect(events.find((e) => e.kind === 'book')).toMatchObject({ golden: true });
  });
});

describe('the end of a game', () => {
  it('Standard ends the moment a hand empties; most books wins', () => {
    const before = stateWith(
      [[card(5)], [card(5, 2), card(5, 1), card(5, 3), card(2)]],
      [card(9)],
      { turn: 1 },
    );
    const { state: after, events } = applyAsk(before, 1, { target: 0, rank: 5 }, quietDice());
    const end = events.at(-1)!;
    expect(after.over).toBe(true);
    expect(end).toMatchObject({ kind: 'end', reason: 'hand-empty', books: [0, 1], winners: [1] });
  });

  it('a tie names every player with the most books', () => {
    const state: FishState = {
      ...stateWith([[card(5)], [card(5, 1), card(2)]], [card(9)], { turn: 1 }),
    };
    const tied = {
      ...state,
      seats: [
        { hand: [card(5)], books: [{ rank: 1 as Rank, golden: false }] },
        { hand: [card(5, 1), card(2)], books: [{ rank: 3 as Rank, golden: false }] },
      ],
    };
    const { events } = applyAsk(tied, 1, { target: 0, rank: 5 }, quietDice());
    expect(events.at(-1)).toMatchObject({ kind: 'end', winners: [0, 1], taunt: false });
  });

  it('All 13 books refills an emptied hand with one card and plays on', () => {
    const state = stateWith([[card(5)], [card(5, 1), card(2)], [card(7)]], [card(8), card(9)], {
      rules: 'all-books',
      turn: 1,
    });
    const { state: after, events } = applyAsk(state, 1, { target: 0, rank: 5 }, quietDice());
    expect(after.over).toBe(false);
    expect(events.map((e) => e.kind)).toEqual(['ask', 'give', 'draw']);
    expect(events[2]).toMatchObject({ seat: 0, why: 'refill', card: card(9) });
    expect(after.seats[0]!.hand).toEqual([card(9)]);
  });

  it('every rule set finishes: Standard on an empty hand, All 13 books with every book made', () => {
    const lineups: MindName[][] = [
      ['miso', 'otto'],
      ['hazel', 'miso', 'otto'],
      ['otto', 'hazel', 'miso', 'reference'],
    ];
    for (let i = 0; i < 60; i++) {
      const minds = lineups[i % 3]!;
      const standard = playGame(`end/${i}`, 'standard', minds);
      expect(standard.log.at(-1)!.kind).toBe('end');
      expect(standard.state.seats.some((seat) => seat.hand.length === 0)).toBe(true);
      expect(standard.state.asks).toBeLessThan(MAX_ASKS);
      const all = playGame(`end/${i}`, 'all-books', minds);
      const allEnd = all.log.at(-1)!;
      expect(allEnd).toMatchObject({ kind: 'end', reason: 'all-books' });
      if (allEnd.kind === 'end') expect(allEnd.books.reduce((a, b) => a + b, 0)).toBe(13);
      expect(all.state.asks).toBeLessThan(MAX_ASKS);
    }
  });

  it('replays exactly from the same seed', () => {
    const a = playGame('same', 'all-books', ['miso', 'hazel', 'otto']);
    const b = playGame('same', 'all-books', ['miso', 'hazel', 'otto']);
    expect(a.log).toEqual(b.log);
  });
});

describe('what each seat sees', () => {
  it('hides other hands at the deal and other players’ draws, but not a lucky catch', () => {
    const table = playGame('sight', 'standard', ['otto', 'hazel', 'miso']);
    for (const event of table.log) {
      const seen = seeEvent(event, 0);
      if (event.kind === 'deal' && seen.kind === 'deal') {
        expect(seen.hand).toEqual(event.hands[0]);
        expect(JSON.stringify(seen)).not.toContain(JSON.stringify(event.hands[1]));
      }
      if (event.kind === 'draw' && seen.kind === 'draw') {
        const visible = event.seat === 0 || event.lucky;
        expect(seen.card).toBe(visible ? event.card : null);
      }
    }
  });
});
