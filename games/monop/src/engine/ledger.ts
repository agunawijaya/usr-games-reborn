import { TRANSIT_SPACES, UTILITY_SPACES } from '../boards/layout';
import { GROUPS, deedOf, ownsGroup } from './state';
import type { GameEvent, GameState } from './types';

/**
 * One seat's story in numbers, kept move by move from the engine's events: what it bought and
 * built, the rent it took, the deals it made, whether it was ever locked up or in debt. The
 * scenarios judge their goals on it, and the career and packages read it when a game ends.
 */

export interface Ledger {
  readonly seat: number;
  /** Turns this seat has started. */
  turns: number;
  deedsBought: number;
  /** Districts this seat has held whole at some point, by group. */
  districts: number[];
  landmarks: number;
  storeys: number;
  rentCollected: number;
  trades: number;
  /** Lots won at auction for less than their price. */
  bargains: number;
  lockedUp: boolean;
  wasInDebt: boolean;
  /** The most transit stops and utilities held at once. */
  mostTransits: number;
  mostUtilities: number;
  /** Rivals who have left the game. */
  knockouts: number;
}

export function newLedger(seat: number): Ledger {
  return {
    seat,
    turns: 0,
    deedsBought: 0,
    districts: [],
    landmarks: 0,
    storeys: 0,
    rentCollected: 0,
    trades: 0,
    bargains: 0,
    lockedUp: false,
    wasInDebt: false,
    mostTransits: 0,
    mostUtilities: 0,
    knockouts: 0,
  };
}

function held(state: GameState, seat: number, spaces: readonly number[]): number {
  return spaces.filter((space) => state.deeds[space]!.owner === seat).length;
}

/** A ledger for a seat at a table just set up, counting the turn already under way. */
export function openLedger(seat: number, state: GameState): Ledger {
  const ledger = newLedger(seat);
  if (state.current === seat) ledger.turns = 1;
  survey(ledger, state);
  return ledger;
}

/** Notes what a move's events mean for the seat. Call it after every move, with the state after it. */
export function keep(ledger: Ledger, state: GameState, events: readonly GameEvent[]): void {
  const me = ledger.seat;
  let holdingsChanged = false;
  for (const event of events) {
    switch (event.type) {
      case 'turn':
        if (event.seat === me) ledger.turns += 1;
        break;
      case 'bought':
        if (event.seat === me) ledger.deedsBought += 1;
        holdingsChanged = true;
        break;
      case 'auctionWon':
        if (event.seat === me) {
          ledger.deedsBought += 1;
          if (event.amount < deedOf(state, event.space).price) ledger.bargains += 1;
        }
        holdingsChanged = true;
        break;
      case 'traded':
        if (event.offer.from === me || event.offer.to === me) ledger.trades += 1;
        holdingsChanged = true;
        break;
      case 'resigned':
        if (event.seat !== me) ledger.knockouts += 1;
        holdingsChanged = true;
        break;
      case 'built':
        if (event.seat !== me) break;
        if (event.level === 5) ledger.landmarks += 1;
        else ledger.storeys += 1;
        break;
      case 'rent':
        if (event.to === me) ledger.rentCollected += event.amount;
        break;
      case 'lockup':
        if (event.seat === me) ledger.lockedUp = true;
        break;
      case 'debt':
        if (event.seat === me) ledger.wasInDebt = true;
        break;
      default:
        break;
    }
  }
  if (holdingsChanged) survey(ledger, state);
}

/** Takes note of what the seat holds now; also call it once when a table is set up. */
export function survey(ledger: Ledger, state: GameState): void {
  const me = ledger.seat;
  ledger.mostTransits = Math.max(ledger.mostTransits, held(state, me, TRANSIT_SPACES));
  ledger.mostUtilities = Math.max(ledger.mostUtilities, held(state, me, UTILITY_SPACES));
  GROUPS.forEach((_, group) => {
    if (!ledger.districts.includes(group) && ownsGroup(state, me, group))
      ledger.districts.push(group);
  });
}
