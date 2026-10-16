import { Rival } from './ai';
import { newChronicle, record, type Chronicle } from './coach';
import { ECONOMY_PARAMS, type EconomyParams } from './economy';
import { apply, newGame } from './game';
import type { PersonalityId } from './rivals';
import { makeRules } from './rules';
import { GROUPS, actor, deedOf, groupOf } from './state';
import type { Difficulty, GameEvent, GameState, Rules } from './types';

/**
 * Plays whole games between rivals, for tuning the economy and for tests that need real games.
 * Seat 0 stands in for the human when the clock estimate is counted: its decisions take a
 * person's time, the rivals' only their animations.
 */

export interface SimSeat {
  readonly personality: PersonalityId;
  readonly difficulty: Difficulty;
}

export interface SimResult {
  readonly state: GameState;
  readonly chronicle: Chronicle;
  readonly winner: number | null;
  readonly rounds: number;
  readonly turns: number;
  /** Estimated minutes for a person in seat 0 playing against the others. */
  readonly minutes: number;
  readonly trades: number;
  readonly auctions: number;
  readonly landmarks: number;
  /** Rent each district collected over the game. */
  readonly rentByGroup: readonly number[];
  /** Rent the transit stops and utilities collected. */
  readonly rentTransit: number;
  readonly rentUtility: number;
  /** For each district, the seat that held all of it at the end, if any. */
  readonly groupOwners: readonly (number | null)[];
  /** The round each district was first completed, if it was. */
  readonly completedOnRound: readonly (number | null)[];
  /** The district completed first in the game and who completed it. */
  readonly firstDistrict: { readonly group: number; readonly seat: number } | null;
  /** Coins spent on each district's deeds and buildings, over the game. */
  readonly spentByGroup: readonly number[];
  /** How many players went out before the end. */
  readonly bankruptcies: number;
  readonly stalled: boolean;
}

/**
 * The clock. On screen, every moment takes the time its animation needs (the dice tumble, the
 * token walks a quarter-second a space, a card turns over); a person also stops to read and
 * decide. These figures are what the interface's pacing is built to, and NOTES.md lists them.
 */
const SHOWN: Partial<Record<GameEvent['type'], number>> = {
  rolled: 2.5,
  rent: 1.5,
  card: 3,
  bought: 1.5,
  auctionOpened: 5,
  bid: 0.8,
  built: 1.2,
  sold: 0.8,
  mortgaged: 0.8,
  traded: 2,
  declinedTrade: 1,
  lockup: 1.5,
  turn: 1,
};
const DECIDING: Partial<Record<GameEvent['type'], number>> = {
  rolled: 1.5,
  card: 2,
  bought: 3,
  auctionOpened: 6,
  built: 2,
  sold: 3,
  mortgaged: 3,
  traded: 20,
  declinedTrade: 15,
  debt: 10,
};
const SECONDS_PER_SPACE = 0.28;

/** Seconds an event holds the table: its animation, plus a person's thinking when it is theirs. */
function eventSeconds(event: GameEvent, person: boolean): number {
  const walk = event.type === 'moved' ? 0.4 + Math.abs(event.steps) * SECONDS_PER_SPACE : 0;
  return walk + (SHOWN[event.type] ?? 0) + (person ? (DECIDING[event.type] ?? 0) : 0);
}

export interface SimOptions {
  readonly seed: string;
  readonly seats: readonly SimSeat[];
  readonly rules?: Rules;
  readonly economy?: EconomyParams;
  readonly board?: 'harbour' | 'colony' | 'popup';
  /** A safety stop for games that never end. */
  readonly maxActions?: number;
}

export function simulate(options: SimOptions): SimResult {
  const rules = options.rules ?? makeRules('standard', 'quick');
  const state = newGame({
    board: options.board ?? 'harbour',
    seed: options.seed,
    rules,
    economy: options.economy ?? ECONOMY_PARAMS,
    seats: options.seats.map((s, i) => ({
      name: `R${i}`,
      kind: 'ai',
      token: `t${i}`,
      personality: s.personality,
      difficulty: s.difficulty,
    })),
  });
  const rivals = options.seats.map(
    (s, i) => new Rival(i, s.personality, s.difficulty, options.seed),
  );
  const chronicle = newChronicle(state);
  const rentByGroup = new Array<number>(GROUPS.length).fill(0);
  const completedOnRound = new Array<number | null>(GROUPS.length).fill(null);
  let rentTransit = 0;
  let rentUtility = 0;
  let seconds = 0;
  let trades = 0;
  let auctions = 0;
  let landmarks = 0;
  let actions = 0;
  let firstDistrict: SimResult['firstDistrict'] = null;
  let bankruptcies = 0;
  const spentByGroup = new Array<number>(GROUPS.length).fill(0);
  const limit = options.maxActions ?? 40000;

  while (state.phase.kind !== 'over' && actions < limit) {
    const acting = actor(state);
    const { action } = rivals[acting]!.decide(state);
    const events = apply(state, action);
    record(chronicle, state, events);
    actions += 1;
    for (const event of events) {
      // An offer to seat 0 or from it takes a person's time to read, whoever made it.
      const person =
        acting === 0 ||
        (event.type === 'traded' || event.type === 'declinedTrade'
          ? event.offer.to === 0 || event.offer.from === 0
          : false);
      seconds += eventSeconds(event, person);
      if (event.type === 'traded') trades += 1;
      if (event.type === 'auctionOpened') auctions += 1;
      if (event.type === 'built' && event.level === 5) landmarks += 1;
      if (event.type === 'resigned') bankruptcies += 1;
      if (event.type === 'built')
        spentByGroup[groupOf(event.space)!]! += deedOf(state, event.space).buildCost;
      if (event.type === 'bought' || (event.type === 'auctionWon' && event.seat !== null)) {
        const group = groupOf(event.space);
        if (group !== null)
          spentByGroup[group]! += event.type === 'bought' ? event.price : event.amount;
      }
      if (event.type === 'rent') {
        const group = groupOf(event.space);
        if (group !== null) rentByGroup[group]! += event.amount;
        else if (event.space % 10 === 5) rentTransit += event.amount;
        else rentUtility += event.amount;
      }
      if (event.type === 'bought' || event.type === 'auctionWon' || event.type === 'traded') {
        GROUPS.forEach((lots, group) => {
          if (completedOnRound[group] !== null) return;
          const owner = state.deeds[lots[0]!]!.owner;
          if (owner === null || !lots.every((s) => state.deeds[s]!.owner === owner)) return;
          completedOnRound[group] = state.round;
          firstDistrict ??= { group, seat: owner };
        });
      }
    }
  }

  return {
    state,
    chronicle,
    winner: state.winner,
    rounds: state.round,
    turns: state.turns,
    minutes: seconds / 60,
    trades,
    auctions,
    landmarks,
    rentByGroup,
    rentTransit,
    rentUtility,
    groupOwners: GROUPS.map((lots) => {
      const owner = state.deeds[lots[0]!]!.owner;
      return owner !== null && lots.every((s) => state.deeds[s]!.owner === owner) ? owner : null;
    }),
    completedOnRound,
    firstDistrict,
    spentByGroup,
    bankruptcies,
    stalled: state.phase.kind !== 'over',
  };
}
