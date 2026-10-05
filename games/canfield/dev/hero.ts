import { suitOf } from '@usr-games/kit/cards';
import { winnableDeal } from '../src/engine/deals';
import {
  applyMove,
  homeCount,
  type Layout,
  legalMoves,
  type Move,
  openDeal,
} from '../src/engine/rules';
import { solve } from '../src/engine/solver';
import type { BloomState } from '../src/render/bloom';

/**
 * Finds real positions for the hero frames: a deal the solver wins, replayed move by move, and
 * the first moment that looks the way a frame needs. Nothing is arranged by hand; staging only
 * chooses the moment and where the dragged card is in the air.
 */

export interface Replay {
  deal: number[];
  seed: string;
  /** Every layout along the winning line, the opening first. */
  layouts: Layout[];
  moves: Move[];
}

export function replayWin(seed: string): Replay {
  const found = winnableDeal(seed, 'standard', 200_000);
  if (found.verdict.result !== 'winnable') throw new Error(`no winnable deal from ${seed}`);
  let layout = openDeal(found.deal, 'standard').layout;
  const layouts = [layout];
  for (const move of found.verdict.line) {
    layout = applyMove(layout, move)!.layout;
    layouts.push(layout);
  }
  return { deal: found.deal, seed: found.seed, layouts, moves: found.verdict.line };
}

/** Blooms as they stand in a layout, every petal long since open. */
export function bloomsOf(layout: Layout, openedLongAgo = -100): BloomState[] {
  return [0, 1, 2, 3].map((i) => {
    const pile = layout.foundations[i];
    if (!pile) return { suit: null, count: 0, openedAt: [], wrappedAt: null, fullAt: null };
    const wrapped = pile.findIndex(
      (card, k) => k > 0 && card % 13 === 0 && pile[k - 1]! % 13 === 12,
    );
    return {
      suit: suitOf(pile[0]!),
      count: pile.length,
      openedAt: pile.map(() => openedLongAgo),
      wrappedAt: wrapped > 0 ? openedLongAgo : null,
      fullAt: pile.length === 13 ? openedLongAgo : null,
    };
  });
}

/** How well a layout suits the mid-game frame: two foundations half open, a lively tableau. */
function midgameScore(layout: Layout): number {
  const counts = layout.foundations.map((f) => f.length).sort((a, b) => b - a);
  const [a = 0, b = 0, c = 0, d = 0] = counts;
  const piles = layout.tableau.map((p) => p.length);
  const tableauCards = piles.reduce((s, n) => s + n, 0);
  let score = 0;
  if (a >= 6 && a <= 8) score += 4;
  if (b >= 5 && b <= 7) score += 4;
  if (c >= 2 && c <= 4) score += 1;
  if (d >= 1) score += 1;
  if (layout.stock.length >= 4 && layout.stock.length <= 9) score += 1;
  if (tableauCards >= 8 && tableauCards <= 16) score += 2;
  if (Math.max(...piles) >= 3 && Math.max(...piles) <= 6) score += 1;
  if (piles.every((n) => n > 0)) score += 1;
  if (layout.talon.length >= 4 && layout.hand.length >= 6) score += 1;
  return score - Math.max(0, layout.run - 3) * 0.4;
}

export interface Midgame {
  replay: Replay;
  layout: Layout;
  /** A legal move of one card from the talon or reserve onto a tableau pile, to show mid-drag. */
  drag: Extract<Move, { kind: 'build' }>;
}

export function findMidgame(seeds: readonly string[]): Midgame {
  let best: { midgame: Midgame; score: number } | null = null;
  for (const seed of seeds) {
    const replay = replayWin(seed);
    replay.layouts.forEach((layout) => {
      const drag = legalMoves(layout).find(
        (m): m is Extract<Move, { kind: 'build' }> =>
          m.kind === 'build' &&
          (m.from === 'talon' || m.from === 'stock') &&
          layout.tableau[m.to]!.length > 0,
      );
      if (!drag) return;
      const score = midgameScore(layout) + (drag.from === 'talon' ? 1 : 0);
      if (!best || score > best.score) best = { midgame: { replay, layout, drag }, score };
    });
  }
  if (!best) throw new Error('no mid-game moment found');
  return (best as { midgame: Midgame }).midgame;
}

/** The last layout of a win: every card home. */
export function wonLayout(replay: Replay): Layout {
  const last = replay.layouts.at(-1)!;
  if (homeCount(last) !== 52) throw new Error('the replay did not end in a win');
  return last;
}

export function checkSolved(layout: Layout): boolean {
  return solve(layout, { nodeBudget: 50_000 }).result === 'winnable';
}
