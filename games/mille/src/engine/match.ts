import { type RngState, createRng, restoreRng } from '@usr-games/kit';
import {
  type Driver,
  type Level,
  driverCoup,
  driverDeal,
  driverDecide,
  driverObserve,
  newDriver,
} from '../ai/players';
import { DUEL_DECK, TEAM_DECK, deckSize } from './cards';
import {
  type Action,
  type HandEvent,
  type HandRules,
  type HandState,
  type Side,
  apply,
  dealHand,
  seatsOf,
} from './hand';
import { type HandScore, scoreHand } from './score';

/**
 * A whole game: hands dealt one after another, the first turn passing round the table, scores
 * carried forward until a side reaches the target (5000 in the original). Seats are 0 (you),
 * 1 (the rival), and in the team game 2 (your partner) and 3 (the second rival), so partners
 * sit opposite and turns alternate between the sides.
 */

export type Length = 'single' | 'short' | 'full';

export const TARGETS: Readonly<Record<Length, number | null>> = {
  single: null,
  short: 2500,
  full: 5000,
};

export interface MatchConfig {
  teams: boolean;
  length: Length;
  seed: string;
  /** A driver for every seat but the player's; `null` marks a seat a person plays. */
  drivers: (Level | null)[];
  safetyDiscard?: 'allow' | 'refuse';
  /** A stacked order for the first hand (tests and the workbench), instead of a shuffle. */
  firstDeal?: number[];
}

export interface HandRecord {
  scores: [HandScore, HandScore];
  finisher: Side | null;
  extended: boolean;
}

export interface MatchState {
  config: MatchConfig;
  handNo: number;
  totals: [number, number];
  history: HandRecord[];
  hand: HandState;
  drivers: (Driver | null)[];
  over: boolean;
  /** The winning side once the game is over; null for a tie. */
  winner: Side | null;
  shuffle: RngState;
}

export function rulesFor(config: MatchConfig): HandRules {
  return config.teams
    ? {
        trip: 1000,
        extension: false,
        teams: true,
        deck: TEAM_DECK,
        safetyDiscard: config.safetyDiscard ?? 'allow',
      }
    : {
        trip: 700,
        extension: true,
        teams: false,
        deck: DUEL_DECK,
        safetyDiscard: config.safetyDiscard ?? 'allow',
      };
}

export function shuffledOrder(
  rng: { shuffle<T>(items: readonly T[]): T[] },
  size: number,
): number[] {
  return rng.shuffle(Array.from({ length: size }, (_, i) => i));
}

export function newMatch(config: MatchConfig): MatchState {
  const seatCount = config.teams ? 4 : 2;
  const drivers = Array.from({ length: seatCount }, (_, seat) => {
    const level = config.drivers[seat] ?? null;
    return level ? newDriver(level, `${config.seed}:driver:${seat}`) : null;
  });
  const match: MatchState = {
    config,
    handNo: 0,
    totals: [0, 0],
    history: [],
    hand: null as unknown as HandState,
    drivers,
    over: false,
    winner: null,
    shuffle: createRng(`${config.seed}:deck`).state(),
  };
  dealNext(match);
  return match;
}

/** The first turn passes round the table hand by hand; the player opens the first hand. */
export function starterOf(handNo: number, seatCount: number): number {
  return handNo % seatCount;
}

function dealNext(match: MatchState): void {
  const rules = rulesFor(match.config);
  const rng = restoreRng(match.shuffle);
  const shuffled = shuffledOrder(rng, deckSize(rules.deck));
  const order = match.handNo === 0 && match.config.firstDeal ? match.config.firstDeal : shuffled;
  match.shuffle = rng.state();
  const seatCount = rules.teams ? 4 : 2;
  match.hand = dealHand(rules, order, starterOf(match.handNo, seatCount));
  match.drivers.forEach((driver, seat) => {
    if (driver) driverDeal(match.hand, seat, driver);
  });
}

/** Applies a seat's action and lets every driver watch what happened. */
export function step(match: MatchState, action: Action): HandEvent[] {
  const events = apply(match.hand, action);
  match.drivers.forEach((driver, seat) => {
    if (driver) driverObserve(match.hand, seat, events, driver);
  });
  if (match.hand.over) closeHand(match);
  return events;
}

function closeHand(match: MatchState): void {
  const hand = match.hand;
  const scores = scoreHand(hand);
  match.totals = [match.totals[0] + scores[0].total, match.totals[1] + scores[1].total];
  const finisher = ([0, 1] as const).find((side) => hand.sides[side].miles === hand.end) ?? null;
  match.history.push({ scores, finisher, extended: hand.extendedBy !== null });
  const target = TARGETS[match.config.length];
  const decided = target === null ? true : match.totals[0] >= target || match.totals[1] >= target;
  if (!decided) return;
  match.over = true;
  const [a, b] = target === null ? [scores[0].total, scores[1].total] : match.totals;
  match.winner = a === b ? null : a > b ? 0 : 1;
}

/** The game score before the hand on the table: once a hand closes, its points are already in. */
export function bankedTotals(match: MatchState): [number, number] {
  const closed = match.hand.over ? match.history.at(-1) : undefined;
  if (!closed) return [...match.totals];
  return [match.totals[0] - closed.scores[0].total, match.totals[1] - closed.scores[1].total];
}

/** Deals the next hand once the last one is scored and the game goes on. */
export function nextHand(match: MatchState): void {
  if (!match.hand.over || match.over) throw new Error('no next hand now');
  match.handNo++;
  dealNext(match);
}

/**
 * The next action a driver takes, if one is due: an out-of-turn coup fourré from a driven seat
 * on the side just hit, else the move of the seat whose turn it is, when a driver holds it.
 */
export function nextDriverAction(match: MatchState): Action | null {
  const hand = match.hand;
  if (hand.over) return null;
  const window = hand.coupWindow;
  if (window) {
    for (const seat of seatsOf(hand, window.side)) {
      if (seat === hand.turn) continue;
      const driver = match.drivers[seat];
      if (!driver) continue;
      const slot = driverCoup(hand, seat, driver);
      if (slot !== null) return { type: 'coup', seat, slot };
    }
  }
  const driver = match.drivers[hand.turn];
  return driver ? driverDecide(hand, hand.turn, driver) : null;
}

/** Plays drivers until a person must act or the hand ends; used by simulations and demos. */
export function runDrivers(match: MatchState, limit = 10_000): number {
  let moves = 0;
  while (moves < limit) {
    const action = nextDriverAction(match);
    if (!action) return moves;
    step(match, action);
    moves++;
  }
  throw new Error('drivers did not finish the hand');
}

/** Plays a whole game between drivers, every seat driven. */
export function playOut(match: MatchState): MatchState {
  for (;;) {
    runDrivers(match);
    if (match.over) return match;
    nextHand(match);
  }
}
