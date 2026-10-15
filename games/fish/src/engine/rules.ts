/**
 * The three rule sets. Standard is the original's rule for any number of players; All 13 books
 * keeps everyone fishing until the pond is fished out; Classic 1993 is the Berkeley game exactly,
 * one rival and seven cards.
 */

export type RuleSetId = 'standard' | 'all-books' | 'classic';

export interface RuleSet {
  id: RuleSetId;
  minPlayers: number;
  maxPlayers: number;
  /** The game ends the moment any hand runs out (the original's rule). */
  endsOnEmptyHand: boolean;
  /** An emptied hand draws one card from the pond straight away and plays on. */
  refillsEmptyHands: boolean;
}

export const RULE_SETS: Readonly<Record<RuleSetId, RuleSet>> = {
  standard: {
    id: 'standard',
    minPlayers: 2,
    maxPlayers: 4,
    endsOnEmptyHand: true,
    refillsEmptyHands: false,
  },
  'all-books': {
    id: 'all-books',
    minPlayers: 2,
    maxPlayers: 4,
    endsOnEmptyHand: false,
    refillsEmptyHands: true,
  },
  classic: {
    id: 'classic',
    minPlayers: 2,
    maxPlayers: 2,
    endsOnEmptyHand: true,
    refillsEmptyHands: false,
  },
};

export const RULE_SET_IDS: readonly RuleSetId[] = ['standard', 'all-books', 'classic'];

/** Seven cards each for two or three players, five for four: the usual table rule. */
export function handSize(players: number): number {
  return players >= 4 ? 5 : 7;
}

/** One chance in this many that a book becomes a golden fish. */
export const GOLDEN_ODDS = 16;

/**
 * The original's number for its rare moments, its parting taunt and its peek at your hand: a
 * random number below 1024 compared with octal 0723, which is 467.
 */
export const RARE_ODDS = 1024;
export const RARE_NUMBER = 0o723;

/**
 * A guard, never reached in play or in the simulations: with an empty pond and three or more
 * players a game could in principle circle, so it ends after this many asks.
 */
export const MAX_ASKS = 2000;
