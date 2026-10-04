import type { Rng } from '@usr-games/kit';
import type { Position } from './position';

/**
 * The fight over the last safe lines. While safe lines remain, nobody gives anything away;
 * whoever runs out of them first must open a piece. Near the end of that phase the remaining
 * safe lines are few, and every way of drawing them can be tried: drawing a line only removes
 * safe lines, so the positions to visit are at most the subsets of the ones there now.
 *
 * `judge` scores a finished phase for the player who must then open a piece. It may draw on the
 * position as long as it leaves it as it found it.
 */
export type Judge = (position: Position) => number;

export interface SafeSearch {
  /** The best safe line, or null when the search ran out of room. */
  readonly edge: number | null;
  readonly value: number;
}

export function searchSafeLines(
  position: Position,
  judge: Judge,
  rng: Rng,
  budget: number,
): SafeSearch {
  const memo = new Map<string, number>();
  let visited = 0;
  const overBudget = () => visited > budget;

  const value = (): number => {
    if (overBudget()) return 0;
    const key = position.key();
    const known = memo.get(key);
    if (known !== undefined) return known;
    visited++;
    const safe = position.safeEdges();
    let best: number;
    if (safe.length === 0) {
      best = judge(position);
    } else {
      best = -Infinity;
      for (const edge of safe) {
        position.draw(edge);
        const v = -value();
        position.undraw(edge);
        if (v > best) best = v;
      }
    }
    memo.set(key, best);
    return best;
  };

  const choices = rng.shuffle(position.safeEdges());
  let bestEdge: number | null = null;
  let bestValue = -Infinity;
  for (const edge of choices) {
    position.draw(edge);
    const v = -value();
    position.undraw(edge);
    if (overBudget()) return { edge: null, value: 0 };
    if (v > bestValue) {
      bestValue = v;
      bestEdge = edge;
    }
  }
  return { edge: bestEdge, value: bestValue };
}
