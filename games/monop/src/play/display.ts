import { deedOf, saleValue, unmortgageCost } from '../engine/state';
import type { GameEvent, GameState } from '../engine/types';

/**
 * The game as the player has seen it so far. The engine settles a whole move at once (a roll,
 * the walk, the rent, a card that moves the token again); the screen tells it event by event,
 * so the picture lags the rules on purpose and catches up as each event is shown. At the end of
 * every move it is set straight from the engine again, so it can never drift.
 */

export interface Display {
  owners: (number | null)[];
  levels: number[];
  mortgaged: boolean[];
  positions: number[];
  coins: number[];
  inLockup: boolean[];
  out: boolean[];
  round: number;
}

export function displayOf(state: GameState): Display {
  return {
    owners: state.deeds.map((d) => d?.owner ?? null),
    levels: state.deeds.map((d) => d?.level ?? 0),
    mortgaged: state.deeds.map((d) => d?.mortgaged ?? false),
    positions: state.seats.map((s) => s.position),
    coins: state.seats.map((s) => s.coins),
    inLockup: state.seats.map((s) => s.inLockup),
    out: state.seats.map((s) => s.out),
    round: state.round,
  };
}

/** Moves the picture on by one event. `state` is the engine's (already settled) state, for prices. */
export function showEvent(display: Display, event: GameEvent, state: GameState): void {
  switch (event.type) {
    case 'moved':
      display.positions[event.seat] = event.to;
      return;
    case 'salary':
    case 'collected':
      display.coins[event.seat]! += event.amount;
      return;
    case 'paid':
      display.coins[event.seat]! -= event.amount;
      return;
    case 'bought':
      display.owners[event.space] = event.seat;
      display.coins[event.seat]! -= event.price;
      return;
    case 'auctionWon':
      if (event.seat === null) return;
      display.owners[event.space] = event.seat;
      display.coins[event.seat]! -= event.amount;
      return;
    case 'rent':
      display.coins[event.from]! -= event.amount;
      display.coins[event.to]! += event.amount;
      return;
    case 'transfer':
      display.coins[event.from]! -= event.amount;
      display.coins[event.to]! += event.amount;
      return;
    case 'built': {
      const cost = deedOf(state, event.space).buildCost;
      display.levels[event.space] = event.level;
      display.coins[event.seat]! -= cost;
      return;
    }
    case 'sold': {
      const refund = saleValue(state, event.space);
      const before = display.levels[event.space]!;
      display.levels[event.space] = event.level;
      display.coins[event.seat]! += refund * (before - event.level);
      return;
    }
    case 'mortgaged':
      display.mortgaged[event.space] = !event.unmortgaged;
      display.coins[event.seat]! += event.unmortgaged
        ? -unmortgageCost(state, event.space)
        : deedOf(state, event.space).mortgage;
      return;
    case 'lockup':
      display.inLockup[event.seat] = true;
      display.positions[event.seat] = 10;
      return;
    case 'free':
      display.inLockup[event.seat] = false;
      return;
    case 'traded': {
      const { from, to, give, get } = event.offer;
      for (const space of give.deeds) display.owners[space] = to;
      for (const space of get.deeds) display.owners[space] = from;
      display.coins[from]! += get.coins - give.coins;
      display.coins[to]! += give.coins - get.coins;
      return;
    }
    case 'resigned':
      display.out[event.seat] = true;
      display.owners.forEach((owner, space) => {
        if (owner !== event.seat) return;
        display.owners[space] = event.to;
        if (event.to === null) {
          display.levels[space] = 0;
          display.mortgaged[space] = false;
        }
      });
      return;
    case 'round':
      display.round = event.round;
      return;
    default:
      return;
  }
}
