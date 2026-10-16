import {
  GROUP_COUNT,
  LAYOUT,
  TRANSIT_SPACES,
  UTILITY_SPACES,
  groupSpaces,
  isDeed,
} from '../boards/layout';
import { makeEconomy, type DeedEconomy, type Economy, type EconomyParams } from './economy';
import type { GameState, Phase, TradeBundle, TradeOffer } from './types';

/**
 * Questions about a game in progress: who owns what, what a landing costs, what a seat is
 * worth and whether a building move is allowed. Nothing here changes the state, so the rules,
 * the rivals and the interface all ask the same questions and get the same answers.
 */

const economies = new WeakMap<EconomyParams, Economy>();

/** The full price table for a game's parameters, built once per parameter set. */
export function economyOf(state: GameState): Economy {
  let economy = economies.get(state.economy);
  if (!economy) {
    economy = makeEconomy(state.economy);
    economies.set(state.economy, economy);
  }
  return economy;
}

export function deedOf(state: GameState, space: number): DeedEconomy {
  const deed = economyOf(state).deeds[space];
  if (!deed) throw new RangeError(`space ${space} cannot be owned`);
  return deed;
}

export const GROUPS: readonly (readonly number[])[] = Array.from({ length: GROUP_COUNT }, (_, g) =>
  groupSpaces(g),
);
export const DEED_SPACES: readonly number[] = LAYOUT.filter((s) => isDeed(s.index)).map(
  (s) => s.index,
);

export function ownerOf(state: GameState, space: number): number | null {
  return state.deeds[space]?.owner ?? null;
}

export function groupOf(space: number): number | null {
  return LAYOUT[space]!.group ?? null;
}

export function ownsGroup(state: GameState, seat: number, group: number): boolean {
  return GROUPS[group]!.every((space) => ownerOf(state, space) === seat);
}

/** Every deed a seat owns, in loop order. */
export function holdings(state: GameState, seat: number): number[] {
  return DEED_SPACES.filter((space) => ownerOf(state, space) === seat);
}

export function seatsIn(state: GameState): number[] {
  return state.seats.flatMap((seat, index) => (seat.out ? [] : [index]));
}

function countOwned(state: GameState, seat: number, spaces: readonly number[]): number {
  return spaces.filter((space) => ownerOf(state, space) === seat).length;
}

/**
 * The rent for landing on a space, or 0 when nothing is owed. `dice` is the total used for a
 * utility; `card` marks the two movement cards that double a transit's fare or charge ten
 * times the dice for a utility.
 */
export function rentFor(state: GameState, space: number, dice: number, card = false): number {
  const deed = state.deeds[space];
  if (!deed || deed.owner === null || deed.mortgaged) return 0;
  const owner = state.seats[deed.owner]!;
  if (state.rules.house.noRentInLockup && owner.inLockup) return 0;
  const economy = deedOf(state, space);
  const kind = LAYOUT[space]!.kind;
  if (kind === 'transit')
    return economy.rents[countOwned(state, deed.owner, TRANSIT_SPACES) - 1]! * (card ? 2 : 1);
  if (kind === 'utility') {
    const times = card
      ? economy.rents[1]!
      : economy.rents[countOwned(state, deed.owner, UTILITY_SPACES) - 1]!;
    return times * dice;
  }
  // A complete group doubles the bare rent, even when another of its lots is mortgaged. Buildings
  // left on a lot traded out of its district (Berkeley allows it) earn only the bare rent.
  if (!ownsGroup(state, deed.owner, groupOf(space)!)) return economy.rents[0]!;
  return deed.level > 0 ? economy.rents[deed.level]! : economy.rents[0]! * 2;
}

/** What a deed is worth on paper: its price (half when mortgaged) and its buildings at cost. */
export function deedWorth(state: GameState, space: number): number {
  const deed = state.deeds[space]!;
  const economy = deedOf(state, space);
  return (deed.mortgaged ? economy.mortgage : economy.price) + deed.level * economy.buildCost;
}

/** Coins plus everything owned. Quick games are won on this, and the recap charts it. */
export function netWorth(state: GameState, seat: number): number {
  if (state.seats[seat]!.out) return 0;
  return (
    state.seats[seat]!.coins +
    holdings(state, seat).reduce((sum, space) => sum + deedWorth(state, space), 0)
  );
}

/**
 * The worth the Berkeley income tax takes a tenth of: coins, every deed at full price
 * (mortgaged or not) and buildings at cost (spec.c, prop.c in the original).
 */
export function taxableWorth(state: GameState, seat: number): number {
  return (
    state.seats[seat]!.coins +
    holdings(state, seat).reduce((sum, space) => {
      const economy = deedOf(state, space);
      return sum + economy.price + state.deeds[space]!.level * economy.buildCost;
    }, 0)
  );
}

/** What the bank pays back for one storey sold: half its cost, in whole coins. */
export function saleValue(state: GameState, space: number): number {
  return Math.floor(deedOf(state, space).buildCost / 2);
}

/** What raising money could bring in: buildings sold at half, then every deed mortgaged. */
export function liquidValue(state: GameState, seat: number): number {
  return holdings(state, seat).reduce((sum, space) => {
    const deed = state.deeds[space]!;
    const economy = deedOf(state, space);
    return sum + deed.level * saleValue(state, space) + (deed.mortgaged ? 0 : economy.mortgage);
  }, 0);
}

export function unmortgageCost(state: GameState, space: number): number {
  return Math.floor(deedOf(state, space).mortgage * 1.1);
}

export function groupHasBuildings(state: GameState, group: number): boolean {
  return GROUPS[group]!.some((space) => state.deeds[space]!.level > 0);
}

/** The seat whose move it is: the one who rolls, bids, answers an offer or owes money. */
export function actor(state: GameState): number {
  return actorIn(state, state.phase);
}

function actorIn(state: GameState, phase: Phase): number {
  switch (phase.kind) {
    case 'auction':
      return phase.auction.bidders[phase.auction.at]!;
    case 'debt':
      return phase.seat;
    case 'trade':
      return phase.offer.to;
    default:
      return state.current;
  }
}

/** Why a seat cannot add a storey (or the landmark) to a lot, or null when it can. */
export function whyNotBuild(state: GameState, seat: number, space: number): string | null {
  const deed = state.deeds[space];
  const group = groupOf(space);
  if (!deed || group === null) return 'Only streets take buildings.';
  if (deed.owner !== seat) return 'You do not own this lot.';
  if (!ownsGroup(state, seat, group)) return 'Own the whole district first.';
  if (GROUPS[group]!.some((s) => state.deeds[s]!.mortgaged))
    return 'Pay off the district’s mortgages first.';
  if (deed.level >= 5) return 'This lot already has its landmark.';
  const lowest = Math.min(...GROUPS[group]!.map((s) => state.deeds[s]!.level));
  if (deed.level > lowest) return 'Build evenly: the other lots in the district come first.';
  const cost = deedOf(state, space).buildCost;
  if (!state.rules.bankLends && state.seats[seat]!.coins < cost)
    return `You need ${cost - state.seats[seat]!.coins} more coins.`;
  if (state.rules.buildingSupply) {
    if (deed.level < 4 && state.supply.storeys < 1) return 'The builders have no storeys left.';
    if (deed.level === 4 && state.supply.landmarks < 1)
      return 'The builders have no landmarks left.';
  }
  return null;
}

export function whyNotSell(state: GameState, seat: number, space: number): string | null {
  const deed = state.deeds[space];
  const group = groupOf(space);
  if (!deed || group === null || deed.level === 0) return 'There is nothing built here.';
  if (deed.owner !== seat) return 'You do not own this lot.';
  const highest = Math.max(...GROUPS[group]!.map((s) => state.deeds[s]!.level));
  if (deed.level < highest) return 'Sell evenly: the taller lots in the district come first.';
  return null;
}

export function whyNotMortgage(state: GameState, seat: number, space: number): string | null {
  const deed = state.deeds[space];
  if (!deed) return 'This space cannot be mortgaged.';
  if (deed.owner !== seat) return 'You do not own this lot.';
  if (deed.mortgaged) return 'It is already mortgaged.';
  const group = groupOf(space);
  if (deed.level > 0) return 'Sell its buildings first.';
  // Berkeley only looks at the lot itself; Standard wants the whole district bare.
  if (group !== null && !state.rules.bankLends && groupHasBuildings(state, group))
    return 'Sell the district’s buildings first.';
  return null;
}

export function whyNotUnmortgage(state: GameState, seat: number, space: number): string | null {
  const deed = state.deeds[space];
  if (!deed || deed.owner !== seat) return 'You do not own this lot.';
  if (!deed.mortgaged) return 'It is not mortgaged.';
  const cost = unmortgageCost(state, space);
  if (!state.rules.bankLends && state.seats[seat]!.coins < cost)
    return `You need ${cost - state.seats[seat]!.coins} more coins.`;
  return null;
}

function whyNotGive(state: GameState, seat: number, bundle: TradeBundle): string | null {
  const who = state.seats[seat]!;
  if (bundle.coins < 0 || bundle.cards < 0) return 'Amounts cannot be negative.';
  if (bundle.coins > Math.max(0, who.coins))
    return `${who.name} does not have ${bundle.coins} coins.`;
  if (bundle.cards > who.freeCards.length)
    return `${who.name} does not hold that many pardon cards.`;
  for (const space of bundle.deeds) {
    if (ownerOf(state, space) !== seat) return `${who.name} does not own every deed offered.`;
    const group = groupOf(space);
    if (state.rules.tradeOnlyUnbuilt && group !== null && groupHasBuildings(state, group)) {
      return 'Lots in a district with buildings cannot change hands until they are sold.';
    }
  }
  return null;
}

export function whyNotOffer(state: GameState, offer: TradeOffer): string | null {
  if (offer.from === offer.to) return 'Trade with someone else.';
  if (state.seats[offer.to]?.out !== false || state.seats[offer.from]?.out !== false)
    return 'That player is not in the game.';
  const empty = (b: TradeBundle) => b.deeds.length === 0 && b.coins === 0 && b.cards === 0;
  if (empty(offer.give) && empty(offer.get)) return 'The offer is empty.';
  if (
    new Set([...offer.give.deeds, ...offer.get.deeds]).size !==
    offer.give.deeds.length + offer.get.deeds.length
  ) {
    return 'A deed appears twice.';
  }
  return whyNotGive(state, offer.from, offer.give) ?? whyNotGive(state, offer.to, offer.get);
}

/** The next transit stop or utility forward from a space, for the two movement cards. */
export function nearestAhead(from: number, targets: readonly number[]): number {
  return targets.find((space) => space > from) ?? targets[0]!;
}
