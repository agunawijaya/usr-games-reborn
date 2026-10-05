import { type CardId, cardName, rankOf } from '@usr-games/kit/cards';
import {
  applyMove,
  canBuild,
  canHome,
  cardsAt,
  foundationFor,
  type From,
  type Layout,
  legalMoves,
  liftCounts,
  type Move,
  TABLEAU,
} from './rules';

/**
 * Help for the player that changes no rule: the best place for a card that is clicked, the
 * sweep home once nothing is hidden, words for any move, and whether any card can move at all.
 */

/**
 * Where a click sends cards: home first, then onto a card in the tableau, then into a space.
 * Returns null when they can go nowhere.
 */
export function bestMove(layout: Layout, from: From, count: number): Move | null {
  if (count === 1 && canHome(layout, from)) return { kind: 'home', from };
  const counts = from === 'stock' || from === 'talon' ? [1] : [count];
  for (const n of counts)
    for (const to of TABLEAU)
      if (layout.tableau[to]!.length > 0 && canBuild(layout, from, to, n))
        return { kind: 'build', from, to, count: n };
  for (const to of TABLEAU)
    if (layout.tableau[to]!.length === 0 && canBuild(layout, from, to, 1))
      return { kind: 'build', from, to, count: 1 };
  return null;
}

/** A move home only: what a double click asks for. */
export function homeMove(layout: Layout, from: From): Move | null {
  return canHome(layout, from) ? { kind: 'home', from } : null;
}

/**
 * The cards a tableau pile can send onto `to`: the whole pile in Standard; in Relaxed the
 * longest run, up to `upTo` cards, that fits.
 */
export function countFor(layout: Layout, from: From, to: number, upTo: number): number | null {
  if (from === 'stock' || from === 'talon') return canBuild(layout, from, to as 0, 1) ? 1 : null;
  const counts = liftCounts(layout, from)
    .filter((c) => c <= upTo)
    .sort((a, b) => b - a);
  return counts.find((c) => canBuild(layout, from, to as 0, c)) ?? null;
}

/** Once the reserve, hand and talon are empty, every card left can be sent home in turn. */
export function canSweepHome(layout: Layout): boolean {
  return (
    layout.outcome === null &&
    layout.stage === 'full' &&
    layout.stock.length === 0 &&
    layout.hand.length === 0 &&
    layout.talon.length === 0 &&
    layout.tableau.some((pile) => pile.length > 0)
  );
}

/** The next move of the sweep home: the lowest card that fits, so none ever blocks another. */
export function sweepMove(layout: Layout): Move | null {
  let best: { move: Move; ordinal: number } | null = null;
  for (const pile of TABLEAU) {
    const top = layout.tableau[pile]!.at(-1);
    if (top === undefined || !canHome(layout, pile)) continue;
    const ordinal = (rankOf(top) - layout.baseRank + 13) % 13;
    if (!best || ordinal < best.ordinal) best = { move: { kind: 'home', from: pile }, ordinal };
  }
  return best?.move ?? null;
}

/**
 * Whether any card can still move, at this point of the hand or any the deal could reach,
 * turning the talon over once. False means the deal is stuck however the player deals.
 */
export function anyCardCanMove(layout: Layout): boolean {
  if (layout.outcome !== null) return false;
  let state = layout;
  const seen = new Set<string>();
  for (let step = 0; step < 60; step++) {
    if (legalMoves(state).some((m) => m.kind !== 'deal')) return true;
    const key = `${state.talon.length}/${state.hand.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    // Dealing on without moving a card: forgive the idle count so the look-ahead never stalls.
    const next = applyMove({ ...state, idleTurns: 0 }, { kind: 'deal' });
    if (!next || next.layout.outcome !== null) return false;
    state = next.layout;
  }
  return false;
}

function placeName(from: From): string {
  if (from === 'stock') return 'the reserve';
  if (from === 'talon') return 'the talon';
  return `pile ${from + 1}`;
}

/** Plain words for a move, for hints, the command bar and screen readers. */
export function describeMove(layout: Layout, move: Move): string {
  if (move.kind === 'deal')
    return layout.hand.length > 0 ? 'deal three from the hand' : 'turn the talon over';
  const cards = cardsAt(layout, move.from, move.kind === 'build' ? move.count : 1);
  const first = cards[0];
  if (first === undefined) return 'nothing to move';
  const what =
    cards.length > 1
      ? `the ${cards.length} cards from ${cardName(first)}`
      : `the ${cardName(first)}`;
  if (move.kind === 'home') return `${what} from ${placeName(move.from)} home`;
  const target = layout.tableau[move.to]!.at(-1);
  if (target === undefined)
    return `${what} from ${placeName(move.from)} into the space in pile ${move.to + 1}`;
  return `${what} from ${placeName(move.from)} onto the ${cardName(target)}`;
}

/** Which foundation a card would go to, for drawing a target; -1 if none is founded for it. */
export function foundationTarget(layout: Layout, card: CardId): number {
  return foundationFor(layout, card);
}

/**
 * A hint when the solver cannot help in time: home first, then the reserve, the talon, the
 * tableau, and the deal last.
 */
export function plainHint(layout: Layout): Move | null {
  const moves = legalMoves(layout);
  return (
    moves.find((m) => m.kind === 'home') ??
    moves.find(
      (m) => m.kind === 'build' && m.from === 'stock' && layout.tableau[m.to]!.length > 0,
    ) ??
    moves.find(
      (m) => m.kind === 'build' && m.from === 'talon' && layout.tableau[m.to]!.length > 0,
    ) ??
    moves.find((m) => m.kind === 'build' && m.from !== 'stock' && m.from !== 'talon') ??
    moves.find((m) => m.kind === 'build') ??
    moves.find((m) => m.kind === 'deal') ??
    null
  );
}
