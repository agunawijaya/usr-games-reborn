import { describe, expect, it } from 'vitest';
import { LOCKUP_INDEX } from '../boards/layout';
import { EFFECTS } from './cards';
import { ECONOMY } from './economy';
import { IllegalMove, apply, newGame, whyNot } from './game';
import { makeRules } from './rules';
import { netWorth, rentFor } from './state';
import { own, rig, seats, table } from './testing';
import type { GameEvent, GameState } from './types';

const price = (space: number) => ECONOMY.deeds[space]!.price;
/** Each later seat starts a little richer, to make up for rolling later. */
const purse = (seat: number) => ECONOMY.startCoins + seat * ECONOMY.seatBonus;
const rents = (space: number) => ECONOMY.deeds[space]!.rents;

function roll(state: GameState, a: number, b: number): GameEvent[] {
  rig(state, [a, b]);
  return apply(state, { type: 'roll' });
}

describe('a new game', () => {
  it('seats everyone on the start with the starting purse and shuffled decks', () => {
    const state = table(4);
    expect(state.seats.map((s) => [s.coins, s.position])).toEqual(
      [0, 1, 2, 3].map((seat) => [purse(seat), 0]),
    );
    expect(ECONOMY.seatBonus).toBeGreaterThan(0);
    expect(state.deeds.filter(Boolean).every((d) => d!.owner === null)).toBe(true);
    for (const deck of ['a', 'b'] as const)
      expect([...state.decks[deck].order].sort((x, y) => x - y)).toEqual([...Array(16).keys()]);
    expect(state.phase).toEqual({ kind: 'turn' });
  });

  it('replays identically from the same seed', () => {
    const play = (seed: string) => {
      const state = table(3, 'standard', seed);
      const log: GameEvent[] = [];
      for (let i = 0; i < 60; i++) {
        const phase = state.phase.kind;
        const action =
          phase === 'buy'
            ? { type: 'buy' as const }
            : phase === 'after' && !('rollAgain' in state.phase && state.phase.rollAgain)
              ? { type: 'endTurn' as const }
              : { type: 'roll' as const };
        if (whyNot(state, action) !== null) break;
        log.push(...apply(state, action));
      }
      return log;
    };
    expect(play('same')).toEqual(play('same'));
    expect(play('same')).not.toEqual(play('other'));
  });

  it('saves as plain data and carries on identically after restoring', () => {
    const state = table(3, 'standard', 'save');
    const step = (s: GameState) => {
      const phase = s.phase;
      const action =
        phase.kind === 'buy'
          ? { type: 'decline' as const }
          : phase.kind === 'auction'
            ? { type: 'pass' as const, seat: phase.auction.bidders[phase.auction.at]! }
            : phase.kind === 'after' && !phase.rollAgain
              ? { type: 'endTurn' as const }
              : { type: 'roll' as const };
      return whyNot(s, action) === null ? apply(s, action) : [];
    };
    for (let i = 0; i < 25; i++) step(state);
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    for (let i = 0; i < 25; i++) expect(step(restored)).toEqual(step(state));
  });

  it('needs two to six seats', () => {
    expect(() => newGame({ board: 'harbour', seats: seats(1), seed: 'x' })).toThrow(RangeError);
    expect(() => newGame({ board: 'harbour', seats: seats(7), seed: 'x' })).toThrow(RangeError);
  });
});

describe('moving', () => {
  it('pays the salary for passing the start and offers the lot it lands on', () => {
    const state = table();
    state.seats[0]!.position = 38;
    const events = roll(state, 1, 2);
    expect(state.seats[0]!.position).toBe(1);
    expect(events).toContainEqual({ type: 'salary', seat: 0, amount: ECONOMY.salary });
    expect(state.phase).toEqual({ kind: 'buy', space: 1 });
  });

  it('rolls again after doubles and ends the turn otherwise', () => {
    const state = table();
    roll(state, 3, 3);
    expect(state.phase.kind).toBe('buy');
    apply(state, { type: 'buy' });
    expect(state.phase).toEqual({ kind: 'after', rollAgain: true });
    expect(whyNot(state, { type: 'endTurn' })).toBe('Doubles: roll again.');
    roll(state, 1, 2);
    expect(state.seats[0]!.position).toBe(9);
    apply(state, { type: 'decline' });
    while (state.phase.kind === 'auction')
      apply(state, { type: 'pass', seat: state.phase.auction.bidders[state.phase.auction.at]! });
    expect(state.phase).toEqual({ kind: 'after', rollAgain: false });
    apply(state, { type: 'endTurn' });
    expect(state.current).toBe(1);
  });

  it('refuses moves out of turn with a reason', () => {
    const state = table();
    expect(whyNot(state, { type: 'endTurn' })).toBe('Finish your move first.');
    expect(() => apply(state, { type: 'buy' })).toThrow(IllegalMove);
  });
});

describe('the lock-up (Berkeley 1980 behaviours)', () => {
  it('sends the third double in a row to the lock-up without moving', () => {
    const state = table(3, 'berkeley');
    roll(state, 1, 1); // to 2, a card
    state.phase = { kind: 'after', rollAgain: true };
    state.seats[0]!.position = 5;
    state.deeds[5]!.owner = 1;
    roll(state, 2, 2);
    state.phase = { kind: 'after', rollAgain: true };
    const before = state.seats[0]!.position;
    const events = roll(state, 3, 3);
    expect(events).toContainEqual({ type: 'lockup', seat: 0, reason: 'doubles' });
    expect(events.filter((e) => e.type === 'moved')).toEqual([
      { type: 'moved', seat: 0, from: before, to: LOCKUP_INDEX, steps: 0, passedStart: false },
    ]);
    expect(state.seats[0]!.inLockup).toBe(true);
    expect(state.phase).toEqual({ kind: 'after', rollAgain: false });
  });

  it('frees on doubles and moves, with no roll again', () => {
    const state = table();
    state.seats[0]!.position = LOCKUP_INDEX;
    state.seats[0]!.inLockup = true;
    own(state, 1, 14);
    roll(state, 2, 2);
    expect(state.seats[0]!.inLockup).toBe(false);
    expect(state.seats[0]!.position).toBe(14);
    expect(state.phase).toEqual({ kind: 'after', rollAgain: false });
  });

  it('pays the fine and moves on the third failed try', () => {
    const state = table();
    const seat = state.seats[0]!;
    seat.position = LOCKUP_INDEX;
    seat.inLockup = true;
    seat.lockupTries = 2;
    own(state, 1, 15);
    roll(state, 1, 4);
    expect(seat.inLockup).toBe(false);
    expect(seat.position).toBe(15);
    expect(seat.coins).toBe(ECONOMY.startCoins - ECONOMY.fine - rentFor(state, 15, 5));
  });

  it('stays in after a failed try that is not the third', () => {
    const state = table();
    state.seats[0]!.position = LOCKUP_INDEX;
    state.seats[0]!.inLockup = true;
    roll(state, 1, 4);
    expect(state.seats[0]!.inLockup).toBe(true);
    expect(state.seats[0]!.lockupTries).toBe(1);
    expect(state.phase).toEqual({ kind: 'after', rollAgain: false });
  });

  it('lets a player pay or use a pardon card before rolling', () => {
    const state = table();
    const seat = state.seats[0]!;
    seat.inLockup = true;
    seat.position = LOCKUP_INDEX;
    seat.freeCards = ['b'];
    state.decks.b.held = true;
    apply(state, { type: 'useCard' });
    expect(seat.inLockup).toBe(false);
    expect(state.decks.b.held).toBe(false);
    expect(state.phase).toEqual({ kind: 'turn' });
  });

  it('sends a token to the lock-up from the far corner', () => {
    const state = table();
    state.seats[0]!.position = 26;
    roll(state, 1, 3);
    expect(state.seats[0]!.position).toBe(LOCKUP_INDEX);
    expect(state.seats[0]!.inLockup).toBe(true);
  });
});

describe('rent', () => {
  it('doubles a bare lot in a complete district and climbs the ladder with buildings', () => {
    const state = table();
    own(state, 1, 1);
    expect(rentFor(state, 1, 7)).toBe(rents(1)[0]);
    own(state, 1, 3);
    expect(rentFor(state, 1, 7)).toBe(rents(1)[0]! * 2);
    state.deeds[3]!.mortgaged = true;
    expect(rentFor(state, 1, 7)).toBe(rents(1)[0]! * 2);
    expect(rentFor(state, 3, 7)).toBe(0);
    state.deeds[1]!.level = 3;
    expect(rentFor(state, 1, 7)).toBe(rents(1)[3]);
  });

  it('charges transit fares by how many stops the owner has', () => {
    const state = table();
    own(state, 1, 5);
    expect(rentFor(state, 5, 7)).toBe(ECONOMY.transitRents[0]);
    own(state, 1, 15, 25, 35);
    expect(rentFor(state, 5, 7)).toBe(ECONOMY.transitRents[3]);
    expect(rentFor(state, 5, 7, true)).toBe(ECONOMY.transitRents[3]! * 2);
  });

  it('counts a utility on the dice, times more with both', () => {
    const state = table();
    own(state, 1, 12);
    expect(rentFor(state, 12, 8)).toBe(ECONOMY.utilityTimes[0]! * 8);
    own(state, 1, 28);
    expect(rentFor(state, 12, 8)).toBe(ECONOMY.utilityTimes[1]! * 8);
  });

  it('pays rent to the owner on landing', () => {
    const state = table();
    own(state, 2, 6);
    const events = roll(state, 2, 4);
    expect(events).toContainEqual({ type: 'rent', from: 0, to: 2, space: 6, amount: rents(6)[0] });
    expect(state.seats[2]!.coins).toBe(purse(2) + rents(6)[0]!);
  });

  it('takes a fresh roll for a utility under Berkeley rules', () => {
    const state = table(3, 'berkeley');
    own(state, 1, 12);
    rig(state, [6, 6], [1, 2]);
    const events = apply(state, { type: 'roll' });
    const rent = events.find((e) => e.type === 'rent');
    expect(rent).toEqual({
      type: 'rent',
      from: 0,
      to: 1,
      space: 12,
      amount: ECONOMY.utilityTimes[0]! * 3,
      dice: [1, 2],
    });
  });
});

describe('buying and auctions', () => {
  it('will not sell a lot the player cannot afford under Standard rules', () => {
    const state = table();
    state.seats[0]!.coins = 10;
    roll(state, 1, 2);
    expect(whyNot(state, { type: 'buy' })).toBe(`You need ${price(3) - 10} more coins.`);
  });

  it('lends the money to buy under Berkeley rules, and the buyer must fix the debt', () => {
    const state = table(3, 'berkeley');
    state.seats[0]!.coins = 10;
    own(state, 0, 1);
    roll(state, 1, 2);
    apply(state, { type: 'buy' });
    expect(state.seats[0]!.coins).toBe(10 - price(3));
    expect(state.phase).toMatchObject({ kind: 'debt', seat: 0 });
    apply(state, { type: 'mortgage', space: 1 });
    apply(state, { type: 'mortgage', space: 3 });
    expect(state.phase).toEqual({ kind: 'after', rollAgain: false });
  });

  it('auctions a declined lot, the decliner calling last', () => {
    const state = table(3);
    roll(state, 1, 2);
    apply(state, { type: 'decline' });
    expect(state.phase).toMatchObject({ kind: 'auction', auction: { bidders: [1, 2, 0], at: 0 } });
    apply(state, { type: 'bid', seat: 1, amount: 20 });
    expect(whyNot(state, { type: 'bid', seat: 2, amount: 20 })).toBe('Bid more than 20.');
    apply(state, { type: 'bid', seat: 2, amount: 30 });
    apply(state, { type: 'pass', seat: 0 });
    const events = apply(state, { type: 'pass', seat: 1 });
    expect(events).toContainEqual({ type: 'auctionWon', seat: 2, space: 3, amount: 30 });
    expect(state.deeds[3]!.owner).toBe(2);
    expect(state.seats[2]!.coins).toBe(purse(2) - 30);
  });

  it('holds no auction with two players left under Berkeley rules, and does under Standard', () => {
    const berkeley = table(2, 'berkeley');
    roll(berkeley, 1, 2);
    apply(berkeley, { type: 'decline' });
    expect(berkeley.phase).toEqual({ kind: 'after', rollAgain: false });
    expect(berkeley.deeds[3]!.owner).toBeNull();

    const standard = table(2, 'standard');
    roll(standard, 1, 2);
    apply(standard, { type: 'decline' });
    expect(standard.phase.kind).toBe('auction');

    const threeBerkeley = table(3, 'berkeley');
    roll(threeBerkeley, 1, 2);
    apply(threeBerkeley, { type: 'decline' });
    expect(threeBerkeley.phase.kind).toBe('auction');
  });

  it('counts a player in debt as still in the game for the auction rule', () => {
    const state = table(3, 'berkeley');
    state.seats[2]!.coins = -5;
    state.phase = { kind: 'buy', space: 3 };
    apply(state, { type: 'decline' });
    expect(state.phase.kind).toBe('auction');
  });

  it('leaves the lot unowned when everyone passes', () => {
    const state = table(2);
    roll(state, 1, 2);
    apply(state, { type: 'decline' });
    apply(state, { type: 'pass', seat: 1 });
    const events = apply(state, { type: 'pass', seat: 0 });
    expect(events).toContainEqual({ type: 'auctionWon', seat: null, space: 3, amount: 0 });
    expect(state.deeds[3]!.owner).toBeNull();
  });
});

describe('building', () => {
  function district(rules: 'standard' | 'berkeley' = 'standard') {
    const state = table(3, rules);
    own(state, 0, 6, 8, 9);
    return state;
  }

  it('needs the whole district and builds evenly', () => {
    const state = table();
    own(state, 0, 6, 8);
    expect(whyNot(state, { type: 'build', space: 6 })).toBe('Own the whole district first.');
    own(state, 0, 9);
    apply(state, { type: 'build', space: 6 });
    expect(whyNot(state, { type: 'build', space: 6 })).toBe(
      'Build evenly: the other lots in the district come first.',
    );
    apply(state, { type: 'build', space: 8 });
    apply(state, { type: 'build', space: 9 });
    apply(state, { type: 'build', space: 6 });
    expect(state.deeds[6]!.level).toBe(2);
    expect(state.seats[0]!.coins).toBe(ECONOMY.startCoins - 4 * ECONOMY.deeds[6]!.buildCost);
    expect(whyNot(state, { type: 'sell', space: 8 })).toBe(
      'Sell evenly: the taller lots in the district come first.',
    );
  });

  it('will not build on a district with a mortgage', () => {
    const state = district();
    state.deeds[8]!.mortgaged = true;
    expect(whyNot(state, { type: 'build', space: 6 })).toBe(
      'Pay off the district’s mortgages first.',
    );
  });

  it('draws storeys and landmarks from a limited supply under Standard rules', () => {
    const state = district();
    state.seats[0]!.coins = 100000;
    for (let level = 0; level < 4; level++)
      for (const space of [6, 8, 9]) apply(state, { type: 'build', space });
    expect(state.supply.storeys).toBe(ECONOMY.storeySupply - 12);
    apply(state, { type: 'build', space: 6 });
    expect(state.deeds[6]!.level).toBe(5);
    expect(state.supply).toEqual({
      storeys: ECONOMY.storeySupply - 8,
      landmarks: ECONOMY.landmarkSupply - 1,
    });
    state.supply.landmarks = 0;
    expect(whyNot(state, { type: 'build', space: 8 })).toBe('The builders have no landmarks left.');
  });

  it('clears the district when a landmark comes down and no storeys are left', () => {
    const state = district();
    for (const space of [6, 8, 9]) state.deeds[space]!.level = 5;
    state.supply.storeys = 2;
    const coins = state.seats[0]!.coins;
    apply(state, { type: 'sell', space: 6 });
    expect([6, 8, 9].map((s) => state.deeds[s]!.level)).toEqual([0, 0, 0]);
    expect(state.seats[0]!.coins).toBe(coins + 15 * Math.floor(ECONOMY.deeds[6]!.buildCost / 2));
  });

  it('has no building limit under Berkeley rules', () => {
    const state = district('berkeley');
    state.supply.storeys = 0;
    expect(whyNot(state, { type: 'build', space: 6 })).toBeNull();
  });
});

describe('mortgages', () => {
  it('pays half the price and costs a tenth more to lift', () => {
    const state = table();
    own(state, 0, 39);
    apply(state, { type: 'mortgage', space: 39 });
    expect(state.seats[0]!.coins).toBe(ECONOMY.startCoins + price(39) / 2);
    apply(state, { type: 'unmortgage', space: 39 });
    expect(state.seats[0]!.coins).toBe(
      ECONOMY.startCoins + price(39) / 2 - Math.floor((price(39) / 2) * 1.1),
    );
  });

  it('wants the whole district bare under Standard, only the lot under Berkeley', () => {
    for (const preset of ['standard', 'berkeley'] as const) {
      const state = table(3, preset);
      own(state, 0, 6, 8, 9);
      state.deeds[6]!.level = 1;
      const reason = whyNot(state, { type: 'mortgage', space: 8 });
      expect(reason).toBe(preset === 'standard' ? 'Sell the district’s buildings first.' : null);
      expect(whyNot(state, { type: 'mortgage', space: 6 })).toBe('Sell its buildings first.');
    }
  });
});

describe('debt and resigning', () => {
  it('pauses play until the debt is fixed, then picks up where it stopped', () => {
    const state = table();
    own(state, 1, 6, 8, 9);
    state.deeds[6]!.level = 2;
    own(state, 0, 39);
    state.seats[0]!.coins = 50;
    roll(state, 2, 4);
    expect(state.phase).toMatchObject({ kind: 'debt', seat: 0 });
    expect(whyNot(state, { type: 'roll' })).toBe('It is not time to roll.');
    expect(whyNot(state, { type: 'endTurn' })).toBe('Finish your move first.');
    apply(state, { type: 'mortgage', space: 39 });
    expect(state.seats[0]!.coins).toBe(50 - rents(6)[2]! + price(39) / 2);
    expect(state.phase).toEqual({ kind: 'after', rollAgain: false });
  });

  it('hands everything to the player owed when a debtor resigns', () => {
    const state = table();
    own(state, 1, 6, 8, 9);
    state.deeds[6]!.level = 5;
    own(state, 0, 39, 37);
    state.deeds[39]!.mortgaged = true;
    state.seats[0]!.coins = 10;
    state.seats[0]!.freeCards = ['a'];
    roll(state, 2, 4);
    const owed = state.seats[1]!.coins;
    const shortfall = -state.seats[0]!.coins;
    const events = apply(state, { type: 'resign' });
    expect(events).toContainEqual({ type: 'resigned', seat: 0, to: 1 });
    expect(state.deeds[39]).toEqual({ owner: 1, level: 0, mortgaged: true });
    expect(state.deeds[37]!.owner).toBe(1);
    expect(state.seats[1]!.freeCards).toEqual(['a']);
    expect(state.seats[1]!.coins).toBe(owed - shortfall);
    expect(state.current).toBe(1);
    expect(state.phase).toEqual({ kind: 'turn' });
  });

  it('under Berkeley the creditor keeps the full rent and gets no debt', () => {
    const state = table(3, 'berkeley');
    own(state, 1, 6, 8, 9);
    state.deeds[6]!.level = 5;
    state.seats[0]!.coins = 10;
    roll(state, 2, 4);
    const owed = state.seats[1]!.coins;
    apply(state, { type: 'resign' });
    expect(state.seats[1]!.coins).toBe(owed);
  });

  it('resets every lot to its first state when a player resigns to the bank', () => {
    const state = table(3, 'berkeley');
    own(state, 0, 6, 8, 9, 5);
    state.deeds[6]!.level = 5;
    state.deeds[8]!.level = 4;
    state.deeds[5]!.mortgaged = true;
    state.seats[0]!.freeCards = ['a', 'b'];
    state.decks.a.held = true;
    state.decks.b.held = true;
    const events = apply(state, { type: 'resign' });
    expect(events).toContainEqual({ type: 'resigned', seat: 0, to: null });
    for (const space of [6, 8, 9, 5])
      expect(state.deeds[space]).toEqual({ owner: null, level: 0, mortgaged: false });
    expect(state.decks.a.held || state.decks.b.held).toBe(false);
    expect(state.seats[0]!.out).toBe(true);
    expect(state.current).toBe(1);
  });

  it('ends the game when one player is left', () => {
    const state = table(2);
    const events = apply(state, { type: 'resign' });
    expect(events.at(-1)).toEqual({ type: 'over', winner: 1 });
    expect(state.phase).toEqual({ kind: 'over' });
  });

  it('makes everyone pushed below zero by a card fix it in turn', () => {
    const state = table(3);
    const collectEach = EFFECTS.a.findIndex((e) => e.kind === 'collectEach');
    state.decks.a.order[0] = collectEach;
    state.seats[1]!.coins = 5;
    state.seats[2]!.coins = 5;
    own(state, 1, 39);
    own(state, 2, 37);
    roll(state, 1, 1);
    expect(state.phase).toMatchObject({ kind: 'debt', seat: 1 });
    apply(state, { type: 'mortgage', space: 39 });
    expect(state.phase).toMatchObject({ kind: 'debt', seat: 2 });
    apply(state, { type: 'mortgage', space: 37 });
    expect(state.phase).toEqual({ kind: 'after', rollAgain: true });
  });
});

describe('cards', () => {
  function drawNext(
    state: GameState,
    deck: 'a' | 'b',
    effect: (typeof EFFECTS)['a'][number]['kind'],
  ) {
    state.decks[deck].order[state.decks[deck].next] = EFFECTS[deck].findIndex(
      (e) => e.kind === effect,
    );
  }

  it('keeps the pardon card out of the deck while it is held', () => {
    const state = table();
    drawNext(state, 'a', 'free');
    roll(state, 1, 1);
    expect(state.seats[0]!.freeCards).toEqual(['a']);
    expect(state.decks.a.held).toBe(true);
    state.decks.a.next = state.decks.a.order.indexOf(0);
    state.seats[1]!.position = 15;
    state.current = 1;
    state.phase = { kind: 'turn' };
    roll(state, 1, 1);
    const card = state.decks.a.order[(state.decks.a.order.indexOf(0) + 1) % 16];
    expect(state.seats[1]!.freeCards).toEqual([]);
    expect(state.decks.a.next).toBe((state.decks.a.order.indexOf(0) + 2) % 16);
    expect(card).not.toBe(0);
  });

  it('sends a token to the nearest transit stop and doubles the fare', () => {
    const state = table();
    own(state, 1, 15);
    state.decks.b.order[0] = 1;
    state.seats[0]!.position = 4;
    const events = roll(state, 1, 2);
    expect(state.seats[0]!.position).toBe(15);
    expect(events).toContainEqual({
      type: 'rent',
      from: 0,
      to: 1,
      space: 15,
      amount: ECONOMY.transitRents[0]! * 2,
    });
  });

  it('walks back three spaces with no salary', () => {
    const state = table();
    drawNext(state, 'b', 'back');
    state.seats[0]!.position = 4;
    const events = roll(state, 1, 2);
    expect(events).toContainEqual({
      type: 'moved',
      seat: 0,
      from: 7,
      to: 4,
      steps: -3,
      passedStart: false,
    });
  });

  it('charges repairs by storey and landmark', () => {
    const state = table();
    own(state, 0, 6, 8, 9);
    state.deeds[6]!.level = 5;
    state.deeds[8]!.level = 4;
    state.deeds[9]!.level = 4;
    drawNext(state, 'a', 'repairs');
    roll(state, 1, 1);
    const repairs = EFFECTS.a.find((e) => e.kind === 'repairs')!;
    if (repairs.kind !== 'repairs') return;
    expect(state.seats[0]!.coins).toBe(
      ECONOMY.startCoins - (repairs.landmark + 8 * repairs.storey),
    );
  });
});

describe('taxes and house rules', () => {
  it('lets Berkeley players choose a tenth of their worth or the flat tax', () => {
    const state = table(3, 'berkeley');
    roll(state, 1, 3);
    expect(state.phase).toEqual({ kind: 'taxChoice' });
    apply(state, { type: 'taxChoice', choice: 'tenth' });
    expect(state.seats[0]!.coins).toBe(ECONOMY.startCoins - ECONOMY.startCoins / 10);
  });

  it('charges the flat tax under Standard rules', () => {
    const state = table();
    roll(state, 1, 3);
    expect(state.seats[0]!.coins).toBe(ECONOMY.startCoins - ECONOMY.taxes[0]);
  });

  it('gathers taxes into a pot for the rest space', () => {
    const rules = makeRules('standard', 'classic', {
      restPot: true,
      doubleSalaryOnStart: false,
      noRentInLockup: false,
    });
    const state = table(3, rules);
    roll(state, 1, 3);
    expect(state.pot).toBe(ECONOMY.taxes[0]);
    apply(state, { type: 'endTurn' });
    state.seats[1]!.position = 14;
    roll(state, 2, 4);
    expect(state.seats[1]!.coins).toBe(purse(1) + ECONOMY.taxes[0]);
    expect(state.pot).toBe(0);
  });

  it('pays double for landing exactly on the start', () => {
    const rules = makeRules('standard', 'classic', {
      restPot: false,
      doubleSalaryOnStart: true,
      noRentInLockup: false,
    });
    const state = table(3, rules);
    state.seats[0]!.position = 36;
    roll(state, 1, 3);
    expect(state.seats[0]!.coins).toBe(ECONOMY.startCoins + 2 * ECONOMY.salary);
  });

  it('collects no rent for an owner in the lock-up', () => {
    const rules = makeRules('standard', 'classic', {
      restPot: false,
      doubleSalaryOnStart: false,
      noRentInLockup: true,
    });
    const state = table(3, rules);
    own(state, 1, 39);
    state.seats[1]!.inLockup = true;
    expect(rentFor(state, 39, 7)).toBe(0);
  });
});

describe('trading', () => {
  it('swaps deeds, coins and cards when the other side accepts', () => {
    const state = table();
    own(state, 0, 1);
    own(state, 1, 3);
    state.seats[1]!.freeCards = ['b'];
    const offer = {
      from: 0,
      to: 1,
      give: { deeds: [1], coins: 100, cards: 0 },
      get: { deeds: [3], coins: 0, cards: 1 },
    };
    apply(state, { type: 'propose', offer });
    expect(state.phase).toMatchObject({ kind: 'trade' });
    apply(state, { type: 'answer', accept: true });
    expect(state.deeds[1]!.owner).toBe(1);
    expect(state.deeds[3]!.owner).toBe(0);
    expect(state.seats[0]!.freeCards).toEqual(['b']);
    expect(state.seats[0]!.coins).toBe(ECONOMY.startCoins - 100);
    expect(state.phase).toEqual({ kind: 'turn' });
  });

  it('sends a counter-offer back to whoever offered', () => {
    const state = table();
    own(state, 1, 3);
    const offer = {
      from: 0,
      to: 1,
      give: { deeds: [], coins: 50, cards: 0 },
      get: { deeds: [3], coins: 0, cards: 0 },
    };
    apply(state, { type: 'propose', offer });
    const counter = {
      from: 1,
      to: 0,
      give: { deeds: [3], coins: 0, cards: 0 },
      get: { deeds: [], coins: 120, cards: 0 },
    };
    apply(state, { type: 'answer', accept: false, counter });
    expect(state.phase).toMatchObject({ kind: 'trade', offer: counter });
    apply(state, { type: 'answer', accept: true });
    expect(state.deeds[3]!.owner).toBe(0);
  });

  it('keeps built districts off the table under Standard rules, not under Berkeley', () => {
    for (const preset of ['standard', 'berkeley'] as const) {
      const state = table(3, preset);
      own(state, 0, 1, 3);
      state.deeds[1]!.level = 1;
      const offer = {
        from: 0,
        to: 1,
        give: { deeds: [3], coins: 0, cards: 0 },
        get: { deeds: [], coins: 10, cards: 0 },
      };
      const reason = whyNot(state, { type: 'propose', offer });
      expect(reason === null).toBe(preset === 'berkeley');
    }
  });

  it('will not trade what a player does not have', () => {
    const state = table();
    const offer = {
      from: 0,
      to: 1,
      give: { deeds: [1], coins: 0, cards: 0 },
      get: { deeds: [], coins: 5000, cards: 0 },
    };
    expect(whyNot(state, { type: 'propose', offer })).toBe('P0 does not own every deed offered.');
  });
});

describe('quick games', () => {
  it('ends after the set number of rounds with the richest player winning', () => {
    const quick = table(2, makeRules('standard', 'quick', undefined, 1));
    quick.seats[1]!.coins += 500;
    for (const seat of [0, 1]) {
      quick.seats[seat]!.position = 10;
      roll(quick, 1, 2);
      if (quick.phase.kind === 'buy') apply(quick, { type: 'buy' });
      apply(quick, { type: 'endTurn' });
    }
    expect(quick.phase).toEqual({ kind: 'over' });
    expect(quick.winner).toBe(1);
    expect(quick.history).toHaveLength(2);
    expect(quick.history[1]).toEqual([netWorth(quick, 0), netWorth(quick, 1)]);
  });
});

describe('stranded buildings (Berkeley)', () => {
  it('earn only the bare rent once their district is broken up by a trade', () => {
    const state = table(3, 'berkeley');
    own(state, 0, 6, 8, 9);
    state.deeds[6]!.level = 3;
    apply(state, {
      type: 'propose',
      offer: {
        from: 0,
        to: 1,
        give: { deeds: [8], coins: 0, cards: 0 },
        get: { deeds: [], coins: 0, cards: 0 },
      },
    });
    apply(state, { type: 'answer', accept: true });
    expect(rentFor(state, 6, 7)).toBe(rents(6)[0]);
  });
});
