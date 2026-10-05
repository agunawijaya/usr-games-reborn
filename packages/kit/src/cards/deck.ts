import type { Rng } from '../rng/rng';

/**
 * A standard 52-card deck. Cards are small integers, `suitIndex * 13 + (rank - 1)`, so piles,
 * saves and solvers can hold them in plain or typed arrays and compare them with `===`.
 */

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const ACE: Rank = 1;
export const JACK: Rank = 11;
export const QUEEN: Rank = 12;
export const KING: Rank = 13;

/** 0–51. */
export type CardId = number;
export const DECK_SIZE = 52;

export type CardColor = 'red' | 'black';

export function cardId(suit: Suit, rank: Rank): CardId {
  return SUITS.indexOf(suit) * 13 + rank - 1;
}

export function isCardId(value: unknown): value is CardId {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < DECK_SIZE;
}

export function suitIndexOf(card: CardId): number {
  return Math.floor(card / 13);
}

export function suitOf(card: CardId): Suit {
  return SUITS[suitIndexOf(card)]!;
}

export function rankOf(card: CardId): Rank {
  return ((card % 13) + 1) as Rank;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function isRed(card: CardId): boolean {
  return isRedSuit(suitOf(card));
}

export function colorOf(card: CardId): CardColor {
  return isRed(card) ? 'red' : 'black';
}

export function isCourt(card: CardId): boolean {
  return rankOf(card) >= JACK;
}

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const RANK_NAMES = [
  'ace',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'jack',
  'queen',
  'king',
] as const;
const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

/** `A`, `2` … `10`, `J`, `Q`, `K`. */
export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank - 1]!;
}

/** `ace` … `king`, for screen readers and sentences. */
export function rankName(rank: Rank): string {
  return RANK_NAMES[rank - 1]!;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

/** `10♥`, `Q♠`. */
export function cardLabel(card: CardId): string {
  return `${rankLabel(rankOf(card))}${suitSymbol(suitOf(card))}`;
}

/** `ten of hearts`. */
export function cardName(card: CardId): string {
  return `${rankName(rankOf(card))} of ${suitOf(card)}`;
}

const SUIT_LETTERS: Record<string, Suit> = {
  c: 'clubs',
  d: 'diamonds',
  h: 'hearts',
  s: 'spades',
  '♣': 'clubs',
  '♦': 'diamonds',
  '♥': 'hearts',
  '♠': 'spades',
};

/**
 * Reads a short card name: `qh`, `QH`, `10s`, `ts`, `Q♥`, `a♣`. Returns null for anything else.
 */
export function parseCard(text: string): CardId | null {
  const match = /^\s*(10|[2-9]|[atjqk])\s*([cdhs♣♦♥♠])\s*$/i.exec(text);
  if (!match) return null;
  const rankText = match[1]!.toUpperCase();
  const rank =
    rankText === 'T'
      ? 10
      : RANK_LABELS.indexOf(rankText as (typeof RANK_LABELS)[number]) + 1 || null;
  const suit = SUIT_LETTERS[match[2]!.toLowerCase()];
  if (!rank || !suit) return null;
  return cardId(suit, rank as Rank);
}

/** The 52 cards in suit order, clubs ace first. */
export function newDeck(): CardId[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i);
}

/** A fresh deck shuffled by the seeded generator (Fisher–Yates, every order equally likely). */
export function shuffledDeck(rng: Rng): CardId[] {
  return rng.shuffle(newDeck());
}

/** True when `cards` holds each of the 52 cards exactly once. */
export function isFullDeck(cards: readonly CardId[]): boolean {
  if (cards.length !== DECK_SIZE) return false;
  const seen = new Set<CardId>();
  for (const card of cards) {
    if (!isCardId(card) || seen.has(card)) return false;
    seen.add(card);
  }
  return true;
}
