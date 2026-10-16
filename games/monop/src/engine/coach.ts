import { BOARDS } from '../boards/themes';
import { DEED_SPACES, GROUPS, deedOf, groupOf, netWorth, ownsGroup } from './state';
import type { GameEvent, GameState, TradeOffer } from './types';
import { outlook, ownersOf, roundIncome, tradeGains } from './valuation';

/**
 * The coach: the same numbers the rivals think with, said plainly to the player. It is a
 * toggle, and stays off in the Daily Deal and in anything that counts for records.
 */

/** How hot each space is for landing, 0 to 1 against the hottest street or stop. */
export function landingHeat(state: GameState): number[] {
  const landing = outlook(state).landing;
  const hottest = Math.max(...DEED_SPACES.map((space) => landing[space]!));
  return landing.map((p) => p / hottest);
}

const ORDINALS = ['first', 'second', 'third', 'fourth'];

export interface BuildAdvice {
  readonly space: number;
  /** The level the next building would bring the lot to. */
  readonly level: number;
  /** Rounds of extra rent to pay back its cost, or null when it never would. */
  readonly rounds: number | null;
  readonly text: string;
}

/** What the next building on a lot would earn back, in rounds of rent. */
export function buildAdvice(state: GameState, seat: number, space: number): BuildAdvice | null {
  const deed = state.deeds[space];
  if (!deed || deed.owner !== seat || groupOf(space) === null || deed.level >= 5) return null;
  const o = outlook(state);
  const owners = ownersOf(state);
  const extra =
    roundIncome(state, o, owners, space, deed.level + 1) -
    roundIncome(state, o, owners, space, deed.level);
  const level = deed.level + 1;
  const what = level === 5 ? 'The landmark here' : `A ${ORDINALS[deed.level]} storey here`;
  if (!ownsGroup(state, seat, groupOf(space)!))
    return { space, level, rounds: null, text: 'Own the whole district before building here.' };
  if (extra <= 0) return { space, level, rounds: null, text: `${what} would not add any rent.` };
  const rounds = Math.max(1, Math.round(deedOf(state, space).buildCost / extra));
  const left = state.rules.mode === 'quick' ? state.rules.rounds - state.round : Infinity;
  const tail = rounds > left ? ', after this game ends; it still counts at cost in your worth' : '';
  return {
    space,
    level,
    rounds,
    text: `${what} pays back in about ${rounds} round${rounds === 1 ? '' : 's'}${tail}.`,
  };
}

export interface TradeMeter {
  /** What the offer is worth to whoever makes it, and to whoever receives it, in coins. */
  readonly offerer: number;
  readonly receiver: number;
  /** -1 (all the receiver's way) to 1 (all the offerer's way). */
  readonly balance: number;
  readonly text: string;
}

/** A fairness reading for the trade table: what each side gains, valued exactly. */
export function tradeMeter(state: GameState, offer: TradeOffer): TradeMeter {
  const gains = tradeGains(state, outlook(state), offer);
  const balance = (gains.from - gains.to) / (Math.abs(gains.from) + Math.abs(gains.to) + 50);
  const theirs = state.seats[offer.to]!.name;
  let text: string;
  if (Math.abs(balance) < 0.15) text = 'About even: both sides gain much the same.';
  else if (balance > 0)
    text =
      gains.to < 0 ? `Leans your way; ${theirs} loses by it and may say no.` : 'Leans your way.';
  else text = gains.from < 0 ? 'You lose by this one.' : `Leans ${theirs}'s way.`;
  return { offerer: Math.round(gains.from), receiver: Math.round(gains.to), balance, text };
}

/** A moment worth remembering when the game is told back. */
export interface Moment {
  readonly turn: number;
  readonly seat: number;
  readonly kind: 'trade' | 'district' | 'landmark' | 'auction' | 'rent' | 'resign';
  readonly space?: number;
  readonly group?: number;
  readonly amount?: number;
  readonly partner?: number;
}

/** The story of a game: its moments, and everyone's net worth at the end of every turn. */
export interface Chronicle {
  readonly moments: Moment[];
  readonly worth: number[][];
}

export function newChronicle(state: GameState): Chronicle {
  return { moments: [], worth: [state.seats.map((_, seat) => netWorth(state, seat))] };
}

/** Rent this large, against the payer's starting purse, makes a moment. */
const BIG_RENT_SHARE = 0.25;

/** Notes what a move's events mean for the story. Call it after every move. */
export function record(chronicle: Chronicle, state: GameState, events: readonly GameEvent[]): void {
  const turn = state.turns;
  for (const event of events) {
    switch (event.type) {
      case 'traded':
        chronicle.moments.push({
          turn,
          seat: event.offer.from,
          kind: 'trade',
          partner: event.offer.to,
        });
        districtsFinished(chronicle, state, turn, [
          ...event.offer.give.deeds,
          ...event.offer.get.deeds,
        ]);
        break;
      case 'bought':
        districtsFinished(chronicle, state, turn, [event.space]);
        break;
      case 'auctionWon':
        if (event.seat === null) break;
        if (event.amount < deedOf(state, event.space).price)
          chronicle.moments.push({
            turn,
            seat: event.seat,
            kind: 'auction',
            space: event.space,
            amount: event.amount,
          });
        districtsFinished(chronicle, state, turn, [event.space]);
        break;
      case 'built':
        if (event.level === 5)
          chronicle.moments.push({ turn, seat: event.seat, kind: 'landmark', space: event.space });
        break;
      case 'rent':
        if (event.amount >= state.economy.startCoins * BIG_RENT_SHARE) {
          chronicle.moments.push({
            turn,
            seat: event.to,
            kind: 'rent',
            space: event.space,
            amount: event.amount,
            partner: event.from,
          });
        }
        break;
      case 'resigned':
        chronicle.moments.push({
          turn,
          seat: event.seat,
          kind: 'resign',
          ...(event.to !== null ? { partner: event.to } : {}),
        });
        break;
      case 'turn':
      case 'over':
        chronicle.worth.push(state.seats.map((_, seat) => netWorth(state, seat)));
        break;
    }
  }
}

function districtsFinished(
  chronicle: Chronicle,
  state: GameState,
  turn: number,
  spaces: readonly number[],
): void {
  const groups = new Set(spaces.map(groupOf).filter((g): g is number => g !== null));
  for (const group of groups) {
    const owner = state.deeds[GROUPS[group]![0]!]!.owner;
    if (owner !== null && ownsGroup(state, owner, group))
      chronicle.moments.push({ turn, seat: owner, kind: 'district', group });
  }
}

/** Which kinds of moment tell the story best, when several are close together. */
const WEIGHT: Readonly<Record<Moment['kind'], number>> = {
  trade: 5,
  district: 4,
  landmark: 3,
  auction: 2,
  rent: 2,
  resign: 1,
};

/**
 * The moment the game turned: the winner's most telling move around the last time the lead
 * changed hands to them. "The trade on turn 14 decided the game."
 */
export function turningPoint(
  chronicle: Chronicle,
  state: GameState,
): { turn: number; text: string } | null {
  const winner = state.winner;
  if (winner === null || chronicle.worth.length < 2) return null;
  let tookLead = 0;
  chronicle.worth.forEach((row, index) => {
    const leader = row.indexOf(Math.max(...row));
    const before = index > 0 ? chronicle.worth[index - 1]! : null;
    const leaderBefore = before ? before.indexOf(Math.max(...before)) : -1;
    if (leader === winner && leaderBefore !== winner) tookLead = index;
  });
  const window = chronicle.moments.filter(
    (m) =>
      (m.seat === winner || m.partner === winner) &&
      m.kind !== 'resign' &&
      m.turn <= tookLead + 1 &&
      m.turn >= tookLead - 6,
  );
  const pool =
    window.length > 0
      ? window
      : chronicle.moments.filter((m) => m.seat === winner && m.kind !== 'resign');
  if (pool.length === 0)
    return {
      turn: tookLead,
      text: `Steady play took the lead on turn ${tookLead + 1} and kept it.`,
    };
  const best = pool.reduce((a, b) =>
    WEIGHT[b.kind] > WEIGHT[a.kind] || (WEIGHT[b.kind] === WEIGHT[a.kind] && b.turn > a.turn)
      ? b
      : a,
  );
  return { turn: best.turn, text: describe(best, state) };
}

function describe(moment: Moment, state: GameState): string {
  const board = BOARDS[state.board];
  // Turns are counted from 0 in the engine and from 1 for people.
  const on = `on turn ${moment.turn + 1}`;
  switch (moment.kind) {
    case 'trade':
      return `The trade ${on} decided the game.`;
    case 'district':
      return `Finishing ${board.groups[moment.group!]!.name} ${on} decided the game.`;
    case 'landmark':
      return `The landmark on ${board.spaces[moment.space!]} ${on} decided the game.`;
    case 'auction':
      return `Winning ${board.spaces[moment.space!]} at auction for ${moment.amount} ${on} decided the game.`;
    case 'rent':
      return `Collecting ${moment.amount} in rent at ${board.spaces[moment.space!]} ${on} decided the game.`;
    case 'resign':
      return `The game turned ${on}.`;
  }
}
