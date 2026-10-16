import { createRng, restoreRng, type Rng } from '@usr-games/kit';
import {
  LAYOUT,
  LOCKUP_INDEX,
  SPACE_COUNT,
  TRANSIT_SPACES,
  UTILITY_SPACES,
  isDeed,
  type DeckId,
} from '../boards/layout';
import type { BoardId } from '../boards/themes';
import { DECK_SIZE, EFFECTS } from './cards';
import { ECONOMY_PARAMS, type EconomyParams } from './economy';
import { makeRules } from './rules';
import {
  GROUPS,
  actor,
  deedOf,
  groupOf,
  holdings,
  nearestAhead,
  netWorth,
  rentFor,
  saleValue,
  seatsIn,
  taxableWorth,
  unmortgageCost,
  whyNotBuild,
  whyNotMortgage,
  whyNotOffer,
  whyNotSell,
  whyNotUnmortgage,
} from './state';
import type {
  Action,
  DeckState,
  GameEvent,
  GameState,
  Phase,
  Rules,
  SeatSetup,
  TradeBundle,
  TradeOffer,
} from './types';

/**
 * The rules of play as one state machine. `apply` checks a move, carries it out and returns what
 * happened as events, which the interface animates and the rivals learn from. The state is
 * changed in place (simulations play thousands of games) and stays plain data throughout.
 */

export interface GameSetup {
  readonly board: BoardId;
  readonly seats: readonly SeatSetup[];
  readonly seed: string;
  readonly rules?: Rules;
  readonly economy?: EconomyParams;
}

export class IllegalMove extends Error {}

export function newGame(setup: GameSetup): GameState {
  if (setup.seats.length < 2 || setup.seats.length > 6)
    throw new RangeError('A game needs two to six seats.');
  const rng = createRng(setup.seed);
  const economy = setup.economy ?? ECONOMY_PARAMS;
  const deck = (): DeckState => ({
    order: rng.shuffle([...Array(DECK_SIZE).keys()]),
    next: 0,
    held: false,
  });
  const state: GameState = {
    board: setup.board,
    rules: setup.rules ?? makeRules('standard'),
    economy,
    seed: setup.seed,
    seats: setup.seats.map((seat, index) => ({
      ...seat,
      coins: economy.startCoins + index * economy.seatBonus,
      position: 0,
      inLockup: false,
      lockupTries: 0,
      freeCards: [],
      out: false,
      creditor: null,
    })),
    deeds: LAYOUT.map((slot) =>
      isDeed(slot.index) ? { owner: null, level: 0, mortgaged: false } : null,
    ),
    decks: { a: deck(), b: deck() },
    current: 0,
    phase: { kind: 'turn' },
    doubles: 0,
    lastRoll: null,
    round: 0,
    turns: 0,
    pot: 0,
    supply: { storeys: economy.storeySupply, landmarks: economy.landmarkSupply },
    rng: rng.state(),
    history: [],
    winner: null,
  };
  state.history.push(state.seats.map((_, seat) => netWorth(state, seat)));
  return state;
}

/** Why a move is not allowed right now, in words a player can act on; null when it is. */
export function whyNot(state: GameState, action: Action): string | null {
  const phase = state.phase;
  if (phase.kind === 'over') return 'The game is over.';
  const me = actor(state);
  const seat = state.seats[me]!;
  const between = phase.kind === 'turn' || phase.kind === 'after';
  switch (action.type) {
    case 'roll':
      return phase.kind === 'turn' || (phase.kind === 'after' && phase.rollAgain)
        ? null
        : 'It is not time to roll.';
    case 'payFine':
      if (phase.kind !== 'turn' || !seat.inLockup) return 'You are not in the lock-up.';
      return !state.rules.bankLends && seat.coins < state.economy.fine
        ? `You need ${state.economy.fine - seat.coins} more coins.`
        : null;
    case 'useCard':
      if (phase.kind !== 'turn' || !seat.inLockup) return 'You are not in the lock-up.';
      return seat.freeCards.length === 0 ? 'You hold no pardon card.' : null;
    case 'buy': {
      if (phase.kind !== 'buy') return 'There is nothing to buy.';
      const price = deedOf(state, phase.space).price;
      return !state.rules.bankLends && seat.coins < price
        ? `You need ${price - seat.coins} more coins.`
        : null;
    }
    case 'decline':
      return phase.kind === 'buy' ? null : 'There is nothing to decline.';
    case 'bid': {
      if (phase.kind !== 'auction') return 'There is no auction.';
      if (action.seat !== me) return 'It is not your call.';
      const high = phase.auction.high?.amount ?? 0;
      if (!Number.isInteger(action.amount) || action.amount <= high)
        return `Bid more than ${high}.`;
      return !state.rules.bankLends && action.amount > seat.coins
        ? 'You cannot bid more than you have.'
        : null;
    }
    case 'pass':
      if (phase.kind !== 'auction') return 'There is no auction.';
      return action.seat === me ? null : 'It is not your call.';
    case 'build':
      return between
        ? whyNotBuild(state, me, action.space)
        : 'Build before you roll or after you land.';
    case 'unmortgage':
      return between ? whyNotUnmortgage(state, me, action.space) : 'Not right now.';
    case 'sell':
      return between || phase.kind === 'buy' || phase.kind === 'debt'
        ? whyNotSell(state, me, action.space)
        : 'Not right now.';
    case 'mortgage':
      return between || phase.kind === 'buy' || phase.kind === 'debt'
        ? whyNotMortgage(state, me, action.space)
        : 'Not right now.';
    case 'taxChoice':
      return phase.kind === 'taxChoice' ? null : 'There is no tax to settle.';
    case 'propose':
      if (!between && phase.kind !== 'debt') return 'Trade before you roll or after you land.';
      if (action.offer.from !== me) return 'Offers come from the player whose move it is.';
      return whyNotOffer(state, action.offer);
    case 'answer':
      if (phase.kind !== 'trade') return 'There is no offer to answer.';
      if (!action.counter) return null;
      if (action.counter.from !== phase.offer.to || action.counter.to !== phase.offer.from)
        return 'A counter-offer goes back to whoever offered.';
      return whyNotOffer(state, action.counter);
    case 'endTurn':
      if (phase.kind !== 'after') return 'Finish your move first.';
      return phase.rollAgain ? 'Doubles: roll again.' : null;
    case 'resign':
      return between || phase.kind === 'debt' ? null : 'Not right now.';
  }
}

export function isLegal(state: GameState, action: Action): boolean {
  return whyNot(state, action) === null;
}

/** Carries out a move and returns what happened. Throws `IllegalMove` with the reason if it is not allowed. */
export function apply(state: GameState, action: Action): GameEvent[] {
  const reason = whyNot(state, action);
  if (reason !== null) throw new IllegalMove(reason);
  const play: Play = { s: state, rng: restoreRng(state.rng), events: [] };
  perform(play, action);
  settle(play);
  state.rng = play.rng.state();
  return play.events;
}

interface Play {
  readonly s: GameState;
  readonly rng: Rng;
  readonly events: GameEvent[];
}

function perform(play: Play, action: Action): void {
  const { s } = play;
  const me = actor(s);
  switch (action.type) {
    case 'roll':
      return roll(play);
    case 'payFine':
      toBank(play, me, s.economy.fine, 'fine');
      return release(play, me, 'fine');
    case 'useCard': {
      const deck = s.seats[me]!.freeCards.shift()!;
      s.decks[deck].held = false;
      return release(play, me, 'card');
    }
    case 'buy':
      return buy(play, me);
    case 'decline':
      return decline(play);
    case 'bid':
      return bid(play, action.seat, action.amount);
    case 'pass':
      return pass(play);
    case 'build':
      return build(play, me, action.space);
    case 'sell':
      return sell(play, me, action.space);
    case 'mortgage': {
      s.deeds[action.space]!.mortgaged = true;
      s.seats[me]!.coins += deedOf(s, action.space).mortgage;
      play.events.push({ type: 'mortgaged', seat: me, space: action.space, unmortgaged: false });
      return;
    }
    case 'unmortgage': {
      debit(play, me, unmortgageCost(s, action.space), null);
      s.deeds[action.space]!.mortgaged = false;
      play.events.push({ type: 'mortgaged', seat: me, space: action.space, unmortgaged: true });
      return;
    }
    case 'taxChoice': {
      const amount =
        action.choice === 'tenth' ? Math.floor(taxableWorth(s, me) / 10) : s.economy.taxes[0];
      toBank(play, me, amount, 'tax');
      s.phase = afterPhase(s);
      return;
    }
    case 'propose':
      s.phase = { kind: 'trade', offer: action.offer, then: s.phase };
      return;
    case 'answer':
      return answer(play, action.accept, action.counter);
    case 'endTurn':
      return nextTurn(play);
    case 'resign':
      return resign(play, me);
  }
}

/** After a landing is settled: roll again on doubles, otherwise the seat may build, trade or end. */
function afterPhase(s: GameState): Phase {
  const seat = s.seats[s.current]!;
  return { kind: 'after', rollAgain: s.doubles > 0 && !seat.inLockup && !seat.out };
}

function rollDice(play: Play): readonly [number, number] {
  return [play.rng.int(1, 6), play.rng.int(1, 6)];
}

function roll(play: Play): void {
  const { s } = play;
  const me = s.current;
  const seat = s.seats[me]!;
  const dice = rollDice(play);
  const total = dice[0] + dice[1];
  const double = dice[0] === dice[1];
  s.lastRoll = dice;
  play.events.push({ type: 'rolled', seat: me, dice });

  if (seat.inLockup) {
    if (double) {
      // Doubles open the door, but this roll does not earn another.
      release(play, me, 'doubles');
      s.doubles = 0;
    } else if (++seat.lockupTries >= 3) {
      toBank(play, me, s.economy.fine, 'fine');
      release(play, me, 'third');
    } else {
      s.phase = { kind: 'after', rollAgain: false };
      return;
    }
  } else if (double && ++s.doubles === 3) {
    sendToLockup(play, me, 'doubles');
    s.phase = { kind: 'after', rollAgain: false };
    return;
  } else if (!double) {
    s.doubles = 0;
  }

  s.phase = afterPhase(s);
  walk(play, me, total);
  land(play, me);
}

/** Walks a token forward, paying the salary on passing or landing on the start. */
function walk(play: Play, me: number, steps: number): void {
  const { s } = play;
  const seat = s.seats[me]!;
  const from = seat.position;
  const to = (from + steps) % SPACE_COUNT;
  const passedStart = from + steps >= SPACE_COUNT;
  seat.position = to;
  play.events.push({ type: 'moved', seat: me, from, to, steps, passedStart });
  if (passedStart) {
    const amount = s.economy.salary * (to === 0 && s.rules.house.doubleSalaryOnStart ? 2 : 1);
    seat.coins += amount;
    play.events.push({ type: 'salary', seat: me, amount });
  }
}

function walkTo(play: Play, me: number, to: number): void {
  const from = play.s.seats[me]!.position;
  walk(play, me, (to - from + SPACE_COUNT) % SPACE_COUNT || SPACE_COUNT);
}

function sendToLockup(play: Play, me: number, reason: 'space' | 'card' | 'doubles'): void {
  const seat = play.s.seats[me]!;
  play.events.push({
    type: 'moved',
    seat: me,
    from: seat.position,
    to: LOCKUP_INDEX,
    steps: 0,
    passedStart: false,
  });
  seat.position = LOCKUP_INDEX;
  seat.inLockup = true;
  seat.lockupTries = 0;
  play.s.doubles = 0;
  play.events.push({ type: 'lockup', seat: me, reason });
}

function release(play: Play, me: number, how: 'fine' | 'card' | 'doubles' | 'third'): void {
  const seat = play.s.seats[me]!;
  seat.inLockup = false;
  seat.lockupTries = 0;
  play.events.push({ type: 'free', seat: me, how });
}

/** Takes coins from a seat. The first payment that takes it below zero names who it owes. */
function debit(play: Play, seat: number, amount: number, creditor: number | null): void {
  const payer = play.s.seats[seat]!;
  if (payer.coins >= 0 && payer.coins - amount < 0) payer.creditor = creditor;
  payer.coins -= amount;
}

function toBank(
  play: Play,
  seat: number,
  amount: number,
  reason: 'tax' | 'card' | 'fine' | 'repairs',
): void {
  debit(play, seat, amount, null);
  if (play.s.rules.house.restPot) play.s.pot += amount;
  play.events.push({ type: 'paid', seat, amount, reason });
}

function transfer(play: Play, from: number, to: number, amount: number): void {
  debit(play, from, amount, to);
  play.s.seats[to]!.coins += amount;
  play.events.push({ type: 'transfer', from, to, amount });
}

/** Whatever the space a token stopped on asks of it. `card` marks the two movement cards' rent rules. */
function land(play: Play, me: number, card = false): void {
  const { s } = play;
  const space = s.seats[me]!.position;
  const slot = LAYOUT[space]!;
  switch (slot.kind) {
    case 'start':
    case 'lockup':
      return;
    case 'rest':
      if (s.rules.house.restPot && s.pot > 0) {
        s.seats[me]!.coins += s.pot;
        play.events.push({ type: 'collected', seat: me, amount: s.pot, reason: 'pot' });
        s.pot = 0;
      }
      return;
    case 'toLockup':
      sendToLockup(play, me, 'space');
      s.phase = afterPhase(s);
      return;
    case 'tax':
      if (slot.tax === 0 && s.rules.taxChoice) s.phase = { kind: 'taxChoice' };
      else toBank(play, me, s.economy.taxes[slot.tax!]!, 'tax');
      return;
    case 'card':
      return draw(play, me, slot.deck!);
    default:
      return landOnDeed(play, me, space, card);
  }
}

function landOnDeed(play: Play, me: number, space: number, card: boolean): void {
  const { s } = play;
  const deed = s.deeds[space]!;
  if (deed.owner === null) {
    s.phase = { kind: 'buy', space };
    return;
  }
  if (deed.owner === me) return;
  const utility = LAYOUT[space]!.kind === 'utility';
  const fresh = utility && (card || s.rules.utilityFreshRoll) ? rollDice(play) : null;
  const dice = fresh ?? s.lastRoll ?? [0, 0];
  const amount = rentFor(s, space, dice[0] + dice[1], card);
  if (amount === 0) return;
  debit(play, me, amount, deed.owner);
  s.seats[deed.owner]!.coins += amount;
  play.events.push({
    type: 'rent',
    from: me,
    to: deed.owner,
    space,
    amount,
    ...(fresh ? { dice: fresh } : {}),
  });
}

function draw(play: Play, me: number, deckId: DeckId): void {
  const deck = play.s.decks[deckId];
  let card = deck.order[deck.next]!;
  deck.next = (deck.next + 1) % DECK_SIZE;
  // The pardon card stays out of the deck while someone holds it.
  if (EFFECTS[deckId][card]!.kind === 'free' && deck.held) {
    card = deck.order[deck.next]!;
    deck.next = (deck.next + 1) % DECK_SIZE;
  }
  play.events.push({ type: 'card', seat: me, deck: deckId, card });
  playCard(play, me, deckId, card);
}

function playCard(play: Play, me: number, deckId: DeckId, card: number): void {
  const { s } = play;
  const seat = s.seats[me]!;
  const effect = EFFECTS[deckId][card]!;
  const others = seatsIn(s).filter((other) => other !== me);
  switch (effect.kind) {
    case 'free':
      s.decks[deckId].held = true;
      seat.freeCards.push(deckId);
      return;
    case 'collect':
      seat.coins += effect.amount;
      play.events.push({ type: 'collected', seat: me, amount: effect.amount, reason: 'card' });
      return;
    case 'collectEach':
      for (const other of others) transfer(play, other, me, effect.amount);
      return;
    case 'pay':
      return toBank(play, me, effect.amount, 'card');
    case 'payEach':
      for (const other of others) transfer(play, me, other, effect.amount);
      return;
    case 'advance':
      walkTo(play, me, effect.to);
      return land(play, me);
    case 'back': {
      const from = seat.position;
      seat.position = (from - effect.spaces + SPACE_COUNT) % SPACE_COUNT;
      play.events.push({
        type: 'moved',
        seat: me,
        from,
        to: seat.position,
        steps: -effect.spaces,
        passedStart: false,
      });
      return land(play, me);
    }
    case 'lockup':
      sendToLockup(play, me, 'card');
      s.phase = afterPhase(s);
      return;
    case 'nearestTransit':
      walkTo(play, me, nearestAhead(seat.position, TRANSIT_SPACES));
      return land(play, me, true);
    case 'nearestUtility':
      walkTo(play, me, nearestAhead(seat.position, UTILITY_SPACES));
      return land(play, me, true);
    case 'repairs': {
      let amount = 0;
      for (const space of holdings(s, me)) {
        const level = s.deeds[space]!.level;
        amount += level === 5 ? effect.landmark : level * effect.storey;
      }
      if (amount > 0) toBank(play, me, amount, 'repairs');
      return;
    }
  }
}

function buy(play: Play, me: number): void {
  const { s } = play;
  if (s.phase.kind !== 'buy') return;
  const space = s.phase.space;
  const price = deedOf(s, space).price;
  debit(play, me, price, null);
  s.deeds[space]!.owner = me;
  play.events.push({ type: 'bought', seat: me, space, price });
  s.phase = afterPhase(s);
}

function decline(play: Play): void {
  const { s } = play;
  if (s.phase.kind !== 'buy') return;
  const space = s.phase.space;
  const players = seatsIn(s);
  // Berkeley 1980 holds no auction once only two players remain (execute.c, `num_play > 2`).
  if (!s.rules.auctions || (s.rules.noAuctionWithTwo && players.length <= 2)) {
    s.phase = afterPhase(s);
    return;
  }
  // Bidding starts with the next player round the table; whoever declined calls last.
  const first = players.findIndex((seat) => seat > s.current);
  const bidders = first < 0 ? players : [...players.slice(first), ...players.slice(0, first)];
  s.phase = { kind: 'auction', auction: { space, high: null, bidders, at: 0 } };
  play.events.push({ type: 'auctionOpened', space });
}

function bid(play: Play, seat: number, amount: number): void {
  const { s } = play;
  if (s.phase.kind !== 'auction') return;
  const auction = s.phase.auction;
  auction.high = { seat, amount };
  play.events.push({ type: 'bid', seat, amount });
  auction.at = (auction.at + 1) % auction.bidders.length;
  closeAuctionIfDone(play);
}

function pass(play: Play): void {
  const { s } = play;
  if (s.phase.kind !== 'auction') return;
  const auction = s.phase.auction;
  auction.bidders.splice(auction.at, 1);
  if (auction.at >= auction.bidders.length) auction.at = 0;
  closeAuctionIfDone(play);
}

function closeAuctionIfDone(play: Play): void {
  const { s } = play;
  if (s.phase.kind !== 'auction') return;
  const { space, high, bidders } = s.phase.auction;
  const won = high !== null && bidders.length === 1 && bidders[0] === high.seat;
  if (bidders.length > 0 && !won) return;
  if (high) {
    debit(play, high.seat, high.amount, null);
    s.deeds[space]!.owner = high.seat;
  }
  play.events.push({
    type: 'auctionWon',
    seat: high?.seat ?? null,
    space,
    amount: high?.amount ?? 0,
  });
  s.phase = afterPhase(s);
}

function build(play: Play, me: number, space: number): void {
  const { s } = play;
  const deed = s.deeds[space]!;
  debit(play, me, deedOf(s, space).buildCost, null);
  deed.level += 1;
  if (deed.level === 5) {
    s.supply.landmarks -= 1;
    s.supply.storeys += 4;
  } else {
    s.supply.storeys -= 1;
  }
  play.events.push({ type: 'built', seat: me, space, level: deed.level });
}

/**
 * Sells one level back to the bank at half its cost, rounded down to whole coins. A landmark comes down to four storeys,
 * which the builders must have in stock; when they do not, the whole district is cleared at once
 * so its lots stay even.
 */
function sell(play: Play, me: number, space: number): void {
  const { s } = play;
  const deed = s.deeds[space]!;
  const short = deed.level === 5 && s.rules.buildingSupply && s.supply.storeys < 4;
  const lots = short ? GROUPS[groupOf(space)!]! : [space];
  for (const lot of lots) {
    const target = s.deeds[lot]!;
    const levels = short ? target.level : 1;
    if (levels === 0) continue;
    s.seats[me]!.coins += levels * saleValue(s, lot);
    returnToSupply(s, target.level, target.level - levels);
    target.level -= levels;
    play.events.push({ type: 'sold', seat: me, space: lot, level: target.level });
  }
}

/** Puts buildings back in the builders' stock as a lot comes down from one level to another. */
function returnToSupply(s: GameState, from: number, to: number): void {
  if (from === 5) {
    s.supply.landmarks += 1;
    s.supply.storeys += to - 4;
  } else {
    s.supply.storeys += from - to;
  }
}

function answer(play: Play, accept: boolean, counter: TradeOffer | undefined): void {
  const { s } = play;
  if (s.phase.kind !== 'trade') return;
  const { offer, then } = s.phase;
  if (accept) {
    exchange(play, offer.from, offer.to, offer.give);
    exchange(play, offer.to, offer.from, offer.get);
    play.events.push({ type: 'traded', offer });
    s.phase = then;
    return;
  }
  play.events.push({ type: 'declinedTrade', offer });
  s.phase = counter ? { kind: 'trade', offer: counter, then } : then;
}

/** Hands over one side of a trade. Mortgaged deeds move as they are, with no fee. */
function exchange(play: Play, from: number, to: number, bundle: TradeBundle): void {
  const { s } = play;
  for (const space of bundle.deeds) s.deeds[space]!.owner = to;
  s.seats[from]!.coins -= bundle.coins;
  s.seats[to]!.coins += bundle.coins;
  const cards = s.seats[from]!.freeCards.splice(0, bundle.cards);
  s.seats[to]!.freeCards.push(...cards);
}

/**
 * A player leaves. In debt to another player, everything they own goes to that player; otherwise
 * it goes back to the bank, every lot as it was at the start: unowned, unmortgaged and bare.
 */
function resign(play: Play, me: number): void {
  const { s } = play;
  const seat = s.seats[me]!;
  const owed =
    seat.coins < 0 && seat.creditor !== null && !s.seats[seat.creditor]!.out ? seat.creditor : null;
  for (const space of holdings(s, me)) {
    const deed = s.deeds[space]!;
    if (owed !== null) {
      deed.owner = owed;
      continue;
    }
    returnToSupply(s, deed.level, 0);
    deed.owner = null;
    deed.level = 0;
    deed.mortgaged = false;
  }
  if (owed !== null) {
    const heir = s.seats[owed]!;
    heir.freeCards.push(...seat.freeCards);
    // Berkeley hands over only cash in hand. Standard also takes back the rent that could not be
    // paid, so the creditor ends up with what the debtor really had.
    heir.coins +=
      s.rules.preset === 'berkeley'
        ? Math.max(0, seat.coins)
        : -Math.min(-seat.coins, Math.max(0, heir.coins));
  } else {
    for (const deck of seat.freeCards) s.decks[deck].held = false;
  }
  seat.freeCards = [];
  seat.coins = 0;
  seat.out = true;
  seat.inLockup = false;
  play.events.push({ type: 'resigned', seat: me, to: owed });

  if (seatsIn(s).length <= 1) return finish(play);
  if (me === s.current) return nextTurn(play);
  if (s.phase.kind === 'debt') s.phase = s.phase.then;
}

function nextTurn(play: Play): void {
  const { s } = play;
  s.doubles = 0;
  s.turns += 1;
  let next = s.current;
  do next = (next + 1) % s.seats.length;
  while (s.seats[next]!.out);
  if (next <= s.current) {
    s.round += 1;
    s.history.push(s.seats.map((_, seat) => netWorth(s, seat)));
    play.events.push({ type: 'round', round: s.round });
    if (s.round >= s.rules.rounds) return finish(play);
  }
  s.current = next;
  s.phase = { kind: 'turn' };
  play.events.push({ type: 'turn', seat: next });
}

/** Ends the game: the last player standing wins, or in a Quick game the richest by net worth. */
function finish(play: Play): void {
  const { s } = play;
  const players = seatsIn(s);
  const worth = s.seats.map((_, seat) => netWorth(s, seat));
  if (s.history.at(-1)?.join() !== worth.join()) s.history.push(worth);
  s.winner =
    players.length === 1
      ? players[0]!
      : players.reduce((best, seat) => (worth[seat]! > worth[best]! ? seat : best));
  s.phase = { kind: 'over' };
  play.events.push({ type: 'over', winner: s.winner });
}

/**
 * Anyone below zero must fix it before play goes on: the first debtor round the table from the
 * current player gets the fix-it panel, and play resumes where it stopped once they are clear.
 */
function settle(play: Play): void {
  const { s } = play;
  for (;;) {
    if (s.phase.kind === 'over') return;
    if (s.phase.kind === 'debt') {
      const debtor = s.seats[s.phase.seat]!;
      if (!debtor.out && debtor.coins < 0) return;
      debtor.creditor = null;
      s.phase = s.phase.then;
      continue;
    }
    if (s.phase.kind === 'trade' || s.phase.kind === 'auction') return;
    const order = s.seats.map((_, i) => (s.current + i) % s.seats.length);
    const debtor = order.find((seat) => !s.seats[seat]!.out && s.seats[seat]!.coins < 0);
    if (debtor === undefined) return;
    s.phase = { kind: 'debt', seat: debtor, then: s.phase };
    play.events.push({ type: 'debt', seat: debtor, amount: -s.seats[debtor]!.coins });
    return;
  }
}
