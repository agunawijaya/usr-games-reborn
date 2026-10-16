import type { RngState } from '@usr-games/kit';
import type { DeckId } from '../boards/layout';
import type { BoardId } from '../boards/themes';
import type { EconomyParams } from './economy';
import type { PersonalityId } from './rivals';

/**
 * The game's state and the moves that change it. The engine is plain data and functions: no
 * DOM, no clock, every random number from the seeded generator kept in the state, so a game
 * can be saved, replayed and simulated.
 */

export type Preset = 'standard' | 'berkeley';
export type Mode = 'quick' | 'classic' | 'scenario';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface HouseRules {
  /** Taxes and card payments to the bank go into a pot on the rest space. */
  readonly restPot: boolean;
  /** Landing exactly on the start pays the salary twice. */
  readonly doubleSalaryOnStart: boolean;
  /** An owner in the lock-up collects no rent. */
  readonly noRentInLockup: boolean;
}

export interface Rules {
  readonly preset: Preset;
  /** Buy what you cannot afford; the bank lends and you fix the debt (Berkeley 1980). */
  readonly bankLends: boolean;
  /** Declined lots go to auction. */
  readonly auctions: boolean;
  /** Berkeley 1980: no auction once only two players remain. */
  readonly noAuctionWithTwo: boolean;
  /** Storeys and landmarks come from a limited supply (Standard). */
  readonly buildingSupply: boolean;
  /** A lot from a group with buildings cannot be traded until they are sold (Standard). */
  readonly tradeOnlyUnbuilt: boolean;
  /** A utility's rent takes a fresh roll of the dice, not the one that moved you (Berkeley). */
  readonly utilityFreshRoll: boolean;
  /** Choose before you see your worth: a tenth of it, or the flat tax (Berkeley). */
  readonly taxChoice: boolean;
  readonly house: HouseRules;
  readonly mode: Mode;
  /** Rounds before the richest wins: the Quick game's length, or Classic's long stop. */
  readonly rounds: number;
}

export interface SeatSetup {
  readonly name: string;
  readonly kind: 'human' | 'ai';
  readonly token: string;
  readonly personality?: PersonalityId;
  readonly difficulty?: Difficulty;
}

export interface Seat extends SeatSetup {
  coins: number;
  position: number;
  /** In the lock-up, and how many rolls have failed to get out. */
  inLockup: boolean;
  lockupTries: number;
  /** Get-out cards held, by the deck they came from. */
  freeCards: DeckId[];
  out: boolean;
  /** Who this seat owes while in debt: a seat, or null for the bank. */
  creditor: number | null;
}

export interface DeedState {
  owner: number | null;
  /** 0 bare, 1–4 storeys, 5 the landmark. */
  level: number;
  mortgaged: boolean;
}

export interface DeckState {
  /** Card indices in the order they will be drawn, and where the next draw is. */
  order: number[];
  next: number;
  /** The get-out card is held by a seat while it is out of the deck. */
  held: boolean;
}

export interface Auction {
  readonly space: number;
  high: { seat: number; amount: number } | null;
  /** Seats still bidding, in turn order; `at` is whose call it is. */
  bidders: number[];
  at: number;
}

export interface TradeOffer {
  readonly from: number;
  readonly to: number;
  /** What `from` gives and what `from` gets. */
  readonly give: TradeBundle;
  readonly get: TradeBundle;
}

export interface TradeBundle {
  readonly deeds: readonly number[];
  readonly coins: number;
  readonly cards: number;
}

/**
 * Where a turn stands. `turn` is waiting for the seat's roll (or its lock-up choice);
 * `buy` for a decision on an unowned lot; `auction` for bids; `debt` for the seat to raise
 * money or resign; `trade` for an answer to an offer; `taxChoice` for the Berkeley income tax;
 * `after` for building, trading and ending the turn; `over` when the game has ended.
 */
export type Phase =
  | { kind: 'turn' }
  | { kind: 'buy'; space: number }
  | { kind: 'auction'; auction: Auction }
  | { kind: 'debt'; seat: number; then: Phase }
  | { kind: 'trade'; offer: TradeOffer; then: Phase }
  | { kind: 'taxChoice' }
  | { kind: 'after'; rollAgain: boolean }
  | { kind: 'over' };

export interface GameState {
  readonly board: BoardId;
  readonly rules: Rules;
  /** The prices and rents this game is played with; simulations try others. */
  readonly economy: EconomyParams;
  readonly seed: string;
  seats: Seat[];
  deeds: (DeedState | null)[];
  decks: Record<DeckId, DeckState>;
  current: number;
  phase: Phase;
  /** Doubles rolled so far this turn. */
  doubles: number;
  lastRoll: readonly [number, number] | null;
  /** Completed rounds; a round ends when play passes the first seat still in. */
  round: number;
  turns: number;
  pot: number;
  supply: { storeys: number; landmarks: number };
  rng: RngState;
  /** Net worth of every seat at the end of each round, for the recap. */
  history: number[][];
  winner: number | null;
}

export type Action =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'bid'; seat: number; amount: number }
  | { type: 'pass'; seat: number }
  | { type: 'build'; space: number }
  | { type: 'sell'; space: number }
  | { type: 'mortgage'; space: number }
  | { type: 'unmortgage'; space: number }
  | { type: 'payFine' }
  | { type: 'useCard' }
  | { type: 'taxChoice'; choice: 'tenth' | 'flat' }
  | { type: 'propose'; offer: TradeOffer }
  /** Turning an offer down may carry a counter-offer, which goes back the other way. */
  | { type: 'answer'; accept: boolean; counter?: TradeOffer }
  | { type: 'endTurn' }
  | { type: 'resign' };

export type GameEvent =
  | { type: 'rolled'; seat: number; dice: readonly [number, number] }
  /** `steps` is how far the token walks, negative going back; 0 means it jumps straight there. */
  | { type: 'moved'; seat: number; from: number; to: number; steps: number; passedStart: boolean }
  | { type: 'salary'; seat: number; amount: number }
  | { type: 'bought'; seat: number; space: number; price: number }
  /** `dice` is the fresh roll a utility's rent was counted on, when it took one. */
  | {
      type: 'rent';
      from: number;
      to: number;
      space: number;
      amount: number;
      dice?: readonly [number, number];
    }
  | { type: 'transfer'; from: number; to: number; amount: number }
  | { type: 'paid'; seat: number; amount: number; reason: 'tax' | 'card' | 'fine' | 'repairs' }
  | { type: 'collected'; seat: number; amount: number; reason: 'card' | 'pot' }
  | { type: 'card'; seat: number; deck: DeckId; card: number }
  | { type: 'auctionOpened'; space: number }
  | { type: 'bid'; seat: number; amount: number }
  | { type: 'auctionWon'; seat: number | null; space: number; amount: number }
  | { type: 'built'; seat: number; space: number; level: number }
  | { type: 'sold'; seat: number; space: number; level: number }
  | { type: 'mortgaged'; seat: number; space: number; unmortgaged: boolean }
  | { type: 'lockup'; seat: number; reason: 'space' | 'card' | 'doubles' }
  | { type: 'free'; seat: number; how: 'fine' | 'card' | 'doubles' | 'third' }
  | { type: 'debt'; seat: number; amount: number }
  | { type: 'traded'; offer: TradeOffer }
  | { type: 'declinedTrade'; offer: TradeOffer }
  | { type: 'resigned'; seat: number; to: number | null }
  | { type: 'turn'; seat: number }
  | { type: 'round'; round: number }
  | { type: 'over'; winner: number | null };
