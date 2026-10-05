import {
  ACE,
  type CardId,
  DECK_SIZE,
  isRed,
  KING,
  type Rank,
  rankOf,
  suitIndexOf,
} from '@usr-games/kit/cards';

/**
 * The rules of Canfield as the 1983 Berkeley program plays them, without any notion of score,
 * money or time: those live in the ledger. Every function is pure; a move returns a new layout
 * and the events that happened on the way (automatic moves included), in order, so the table
 * can animate them and the ledger can bill them.
 *
 * Verified against canfield.c (NetBSD 1.20): see docs/NOTES.md for line references.
 */

export type RuleSet = 'standard' | 'relaxed';

/**
 * The original sells a deal in three parts: the deal itself, an inspection (moves, but no cards
 * from the hand) and the rest of the game. Points games start fully bought.
 */
export type Stage = 'dealt' | 'inspection' | 'full';

export type TableauIndex = 0 | 1 | 2 | 3;
export const TABLEAU: readonly TableauIndex[] = [0, 1, 2, 3];

/** Where a move takes its cards from. */
export type From = 'stock' | 'talon' | TableauIndex;

export type Move =
  | { kind: 'deal' }
  | { kind: 'home'; from: From }
  /** `count` is how many cards leave a tableau pile; stock and talon always give one. */
  | { kind: 'build'; from: From; to: TableauIndex; count: number };

export type Outcome = 'won' | 'stalled';

export interface Layout {
  readonly rules: RuleSet;
  readonly baseRank: Rank;
  /** The reserve of thirteen, bottom first; the top card is last. */
  readonly stock: readonly CardId[];
  /** Four piles, bottom first. */
  readonly tableau: readonly (readonly CardId[])[];
  /** Foundations in the order they were founded, bottom (a base card) first. */
  readonly foundations: readonly (readonly CardId[])[];
  /** Face-down cards still to deal; the next card dealt is last. */
  readonly hand: readonly CardId[];
  /** Dealt cards, bottom first; only the top (last) one can be played. */
  readonly talon: readonly CardId[];
  /** Which run through the hand this is; the deal starts the first. */
  readonly run: number;
  /** Turn-overs since a card last moved (the original's `timesthru`). */
  readonly idleTurns: number;
  readonly stage: Stage;
  readonly outcome: Outcome | null;
}

export type RuleEvent =
  /** Cards from the hand to the talon; `auto` when the talon ran dry and three came free. */
  | { kind: 'dealt'; cards: CardId[]; auto: boolean }
  /** The talon turned over to become the hand again. */
  | { kind: 'turned-over'; run: number }
  /** A card showing on top of the talon (it may have shown before). */
  | { kind: 'exposed'; card: CardId }
  | {
      kind: 'home';
      card: CardId;
      from: From;
      foundation: number;
      /** A base card starting a new foundation. */
      founded: boolean;
      auto: boolean;
    }
  | { kind: 'built'; cards: CardId[]; from: From; to: TableauIndex }
  | { kind: 'stalled' }
  | { kind: 'won' };

export interface Step {
  layout: Layout;
  events: RuleEvent[];
}

/** canfield.c: `if (timesthru != 4)`, the fourth idle turn-over ends the deal. */
export const STALL_TURNS = 4;
export const CARDS_PER_DEAL = 3;
export const STOCK_SIZE = 13;

/** One rank down, wrapping: a king goes on an ace in the tableau (canfield.c `ranklower`). */
export function goesDownOn(card: CardId, onto: CardId): boolean {
  return rankOf(onto) === (rankOf(card) % 13) + 1 && isRed(card) !== isRed(onto);
}

/** One rank up in suit, wrapping from king to ace (canfield.c `rankhigher`, `samesuit`). */
export function goesUpOn(card: CardId, top: CardId): boolean {
  return suitIndexOf(card) === suitIndexOf(top) && rankOf(card) === (rankOf(top) % 13) + 1;
}

export function topOf(pile: readonly CardId[]): CardId | undefined {
  return pile[pile.length - 1];
}

export function homeCount(layout: Layout): number {
  return layout.foundations.reduce((sum, pile) => sum + pile.length, 0);
}

/** The founded foundation that takes this card next, or -1. */
export function foundationFor(layout: Layout, card: CardId): number {
  return layout.foundations.findIndex((pile) => {
    const top = topOf(pile);
    return top !== undefined && goesUpOn(card, top);
  });
}

/** The cards a move would lift, bottom first, without checking where they go. */
export function cardsAt(layout: Layout, from: From, count = 1): readonly CardId[] {
  if (from === 'stock') return layout.stock.slice(-1);
  if (from === 'talon') return layout.talon.slice(-1);
  const pile = layout.tableau[from]!;
  return count > 0 ? pile.slice(-count) : [];
}

function canPlay(layout: Layout): boolean {
  return layout.outcome === null && layout.stage !== 'dealt';
}

export function canHome(layout: Layout, from: From): boolean {
  if (!canPlay(layout)) return false;
  const card = cardsAt(layout, from)[0];
  return card !== undefined && foundationFor(layout, card) >= 0;
}

/** Counts of cards that may leave a tableau pile together under these rules. */
export function liftCounts(layout: Layout, pile: TableauIndex): number[] {
  const length = layout.tableau[pile]!.length;
  if (length === 0) return [];
  if (layout.rules === 'standard') return [length];
  return Array.from({ length }, (_, i) => i + 1);
}

export function canBuild(layout: Layout, from: From, to: TableauIndex, count = 1): boolean {
  if (!canPlay(layout) || from === to) return false;
  const target = layout.tableau[to]!;
  if (from === 'stock' || from === 'talon') {
    if (count !== 1) return false;
    const card = cardsAt(layout, from)[0];
    if (card === undefined) return false;
    // Spaces take the reserve's top card; the talon only once the reserve is gone (`tabok`).
    if (target.length === 0) return from === 'stock' || layout.stock.length === 0;
    return goesDownOn(card, topOf(target)!);
  }
  if (!liftCounts(layout, from).includes(count)) return false;
  // Piles never move into spaces, whole or in part.
  if (target.length === 0) return false;
  const moving = cardsAt(layout, from, count);
  return goesDownOn(moving[0]!, topOf(target)!);
}

export function canDeal(layout: Layout): boolean {
  return (
    layout.outcome === null &&
    layout.stage === 'full' &&
    (layout.hand.length > 0 || layout.talon.length > 0)
  );
}

export function isLegal(layout: Layout, move: Move): boolean {
  switch (move.kind) {
    case 'deal':
      return canDeal(layout);
    case 'home':
      return canHome(layout, move.from);
    case 'build':
      return canBuild(layout, move.from, move.to, move.count);
  }
}

const SOURCES: readonly From[] = ['stock', 'talon', 0, 1, 2, 3];

/** Every legal move, foundation moves first, the deal last. */
export function legalMoves(layout: Layout): Move[] {
  const moves: Move[] = [];
  for (const from of SOURCES) if (canHome(layout, from)) moves.push({ kind: 'home', from });
  for (const from of SOURCES) {
    const counts = from === 'stock' || from === 'talon' ? [1] : liftCounts(layout, from);
    for (const count of counts)
      for (const to of TABLEAU)
        if (canBuild(layout, from, to, count)) moves.push({ kind: 'build', from, to, count });
  }
  if (canDeal(layout)) moves.push({ kind: 'deal' });
  return moves;
}

/** True when nothing but dealing is possible: no card can move anywhere right now. */
export function hasCardMove(layout: Layout): boolean {
  return legalMoves(layout).some((move) => move.kind !== 'deal');
}

// —— applying moves ——

interface Draft {
  rules: RuleSet;
  baseRank: Rank;
  stock: CardId[];
  tableau: CardId[][];
  foundations: CardId[][];
  hand: CardId[];
  talon: CardId[];
  run: number;
  idleTurns: number;
  stage: Stage;
  outcome: Outcome | null;
  events: RuleEvent[];
}

function draftOf(layout: Layout): Draft {
  return {
    rules: layout.rules,
    baseRank: layout.baseRank,
    stock: [...layout.stock],
    tableau: layout.tableau.map((pile) => [...pile]),
    foundations: layout.foundations.map((pile) => [...pile]),
    hand: [...layout.hand],
    talon: [...layout.talon],
    run: layout.run,
    idleTurns: layout.idleTurns,
    stage: layout.stage,
    outcome: layout.outcome,
    events: [],
  };
}

function stepOf(draft: Draft): Step {
  const { events, ...layout } = draft;
  return { layout, events };
}

function exposeTalonTop(draft: Draft): void {
  const top = topOf(draft.talon);
  if (top !== undefined) draft.events.push({ kind: 'exposed', card: top });
}

function take(draft: Draft, from: From, count: number): CardId[] {
  if (from === 'stock') return [draft.stock.pop()!];
  if (from === 'talon') {
    const card = draft.talon.pop()!;
    exposeTalonTop(draft);
    return [card];
  }
  return draft.tableau[from]!.splice(-count, count);
}

function sendHome(draft: Draft, card: CardId, from: From, auto: boolean): void {
  let foundation = draft.foundations.findIndex((pile) => goesUpOn(card, topOf(pile)!));
  const founded = foundation < 0;
  if (founded) {
    draft.foundations.push([]);
    foundation = draft.foundations.length - 1;
  }
  draft.foundations[foundation]!.push(card);
  draft.events.push({ kind: 'home', card, from, foundation, founded, auto });
}

/** canfield.c `fndbase`: base-rank cards on top of a pile go home on their own, one after another. */
function sweepBases(draft: Draft, from: 'stock' | 'talon' | TableauIndex): void {
  for (;;) {
    const pile =
      from === 'stock' ? draft.stock : from === 'talon' ? draft.talon : draft.tableau[from]!;
    const top = topOf(pile);
    if (top === undefined || rankOf(top) !== draft.baseRank) return;
    sendHome(draft, take(draft, from, 1)[0]!, from, true);
  }
}

function dealThree(draft: Draft, auto: boolean): void {
  const cards: CardId[] = [];
  for (let i = 0; i < CARDS_PER_DEAL && draft.hand.length > 0; i++) {
    const card = draft.hand.pop()!;
    draft.talon.push(card);
    cards.push(card);
  }
  draft.events.push({ kind: 'dealt', cards, auto });
  exposeTalonTop(draft);
  sweepBases(draft, 'talon');
}

/** canfield.c `movetotalon`, for the player's own deal. */
function dealOrTurnOver(draft: Draft): void {
  if (draft.hand.length > 0) {
    dealThree(draft, false);
    return;
  }
  draft.idleTurns += 1;
  if (draft.rules === 'standard' && draft.idleTurns >= STALL_TURNS) {
    draft.outcome = 'stalled';
    draft.events.push({ kind: 'stalled' });
    return;
  }
  while (draft.talon.length > 0) draft.hand.push(draft.talon.pop()!);
  draft.run += 1;
  draft.events.push({ kind: 'turned-over', run: draft.run });
  dealThree(draft, false);
}

/**
 * What the original does after every command: base cards on the reserve and talon go home,
 * and an empty talon gets three fresh cards from the hand. The original refills only once per
 * command; refilling until something shows saves the player a wasted command.
 */
function settle(draft: Draft): void {
  if (draft.outcome !== null) return;
  sweepBases(draft, 'stock');
  sweepBases(draft, 'talon');
  while (draft.talon.length === 0 && draft.hand.length > 0) dealThree(draft, true);
  if (draft.foundations.reduce((sum, pile) => sum + pile.length, 0) === DECK_SIZE) {
    draft.outcome = 'won';
    draft.events.push({ kind: 'won' });
  }
}

/** Applies a legal move and everything that follows from it; null if the move is not legal. */
export function applyMove(layout: Layout, move: Move): Step | null {
  if (!isLegal(layout, move)) return null;
  const draft = draftOf(layout);
  if (move.kind === 'deal') {
    dealOrTurnOver(draft);
  } else {
    const count = move.kind === 'build' ? move.count : 1;
    const cards = take(draft, move.from, count);
    if (move.kind === 'home') sendHome(draft, cards[0]!, move.from, false);
    else {
      draft.tableau[move.to]!.push(...cards);
      draft.events.push({ kind: 'built', cards, from: move.from, to: move.to });
    }
    // Any card that moves restarts the count of idle turn-overs (`timesthru = 0`).
    draft.idleTurns = 0;
  }
  settle(draft);
  return stepOf(draft);
}

/**
 * Lays out a deal in the original's order: cards 0–12 the reserve (12 on top), 13 the first
 * foundation and so the base rank, 14–17 the tableau, 18–51 the hand (18 dealt first). Base
 * cards in the tableau and on the reserve go home, then the first three cards are dealt.
 */
export function openDeal(deal: readonly CardId[], rules: RuleSet, stage: Stage = 'full'): Step {
  if (deal.length !== DECK_SIZE) throw new Error(`a deal needs ${DECK_SIZE} cards`);
  const base = deal[13]!;
  const draft: Draft = {
    rules,
    baseRank: rankOf(base),
    stock: deal.slice(0, STOCK_SIZE),
    tableau: [[deal[14]!], [deal[15]!], [deal[16]!], [deal[17]!]],
    foundations: [[base]],
    hand: deal.slice(18).reverse(),
    talon: [],
    run: 1,
    idleTurns: 0,
    stage,
    outcome: null,
    events: [],
  };
  for (const pile of TABLEAU) sweepBases(draft, pile);
  sweepBases(draft, 'stock');
  dealThree(draft, true);
  settle(draft);
  return stepOf(draft);
}

/** Moves the deal on to a later stage the player has paid for. */
export function advanceStage(layout: Layout, stage: Stage): Layout {
  const order: Stage[] = ['dealt', 'inspection', 'full'];
  return order.indexOf(stage) > order.indexOf(layout.stage) ? { ...layout, stage } : layout;
}

/** The base card that set the deal's base rank. */
export function baseCard(layout: Layout): CardId {
  return layout.foundations[0]![0]!;
}

/** Foundation ranks in building order: the base rank first, wrapping past the king. */
export function foundationOrder(baseRank: Rank): Rank[] {
  return Array.from({ length: 13 }, (_, i) => (((baseRank - 1 + i) % 13) + 1) as Rank);
}

export function isKingToAceWrap(previous: CardId, next: CardId): boolean {
  return rankOf(previous) === KING && rankOf(next) === ACE;
}
