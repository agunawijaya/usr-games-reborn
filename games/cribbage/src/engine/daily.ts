import { composeShare, createRng } from '@usr-games/kit';
import { type CardId, rankOf, shuffledDeck } from '@usr-games/kit/cards';
import { type DiscardOption, rankDiscards } from './ai/expect';
import { sortByRank } from './cards';

/**
 * The Daily Discard: the same six cards for everyone, and whose crib it is. You lay away two;
 * the game then shows how every one of the fifteen choices averages over all 46 possible
 * starters (hand plus your crib, or hand minus theirs) and where yours stands. The score starts
 * at 100 % for the best throw and every point of average given away costs ten, so it means the
 * same whichever crib it is; the share line shows it and up to three cards.
 */

export interface DailyPuzzle {
  hand: CardId[];
  ownCrib: boolean;
}

export interface DailyVerdict {
  /** All fifteen choices, best first. */
  options: DiscardOption[];
  chosen: DiscardOption;
  /** 1 for the best choice. */
  place: number;
  percent: number;
}

/** Percentage points the score loses for each point of average given away. */
export const POINTS_TO_PERCENT = 10;

/** How many deals are tried before the most interesting one is chosen. */
const CANDIDATE_DEALS = 16;

/**
 * How good a puzzle a deal makes; lower is better. The best throw should beat the next best
 * throw of different ranks by a clear but modest margin (a real decision, not a giveaway), and
 * it is better still when the crib changes the answer: the throw that keeps the best hand is not
 * the best throw.
 */
function puzzleScore(hand: readonly CardId[], ownCrib: boolean): number {
  const options = rankDiscards(hand, ownCrib);
  const best = options[0]!;
  const ranks = (thrown: readonly CardId[]) =>
    thrown
      .map(rankOf)
      .sort((a, b) => a - b)
      .join(',');
  const rival = options.find((option) => ranks(option.thrown) !== ranks(best.thrown));
  const gap = rival ? best.value - rival.value : 9;
  const bestHand = [...options].sort((a, b) => b.handAverage - a.handAverage)[0]!;
  const cribMatters = ranks(bestHand.thrown) !== ranks(best.thrown);
  return (gap >= 0.15 && gap <= 1.2 ? 0 : 10) + (cribMatters ? 0 : 1) + Math.abs(gap - 0.5);
}

export function dailyPuzzle(seed: string): DailyPuzzle {
  const rng = createRng(`${seed}:discard`);
  let best: { puzzle: DailyPuzzle; score: number } | null = null;
  for (let i = 0; i < CANDIDATE_DEALS; i++) {
    const hand = sortByRank(shuffledDeck(rng).slice(0, 6));
    const ownCrib = rng.chance(0.5);
    const score = puzzleScore(hand, ownCrib);
    if (!best || score < best.score) best = { puzzle: { hand, ownCrib }, score };
  }
  return best!.puzzle;
}

function sameThrow(a: readonly CardId[], b: readonly CardId[]): boolean {
  return a.length === b.length && a.every((card) => b.includes(card));
}

export function judgeDiscard(puzzle: DailyPuzzle, thrown: readonly CardId[]): DailyVerdict {
  const options = rankDiscards(puzzle.hand, puzzle.ownCrib);
  const index = options.findIndex((option) => sameThrow(option.thrown, thrown));
  if (index < 0) throw new Error('lay away two of the six cards');
  const chosen = options[index]!;
  const lost = options[0]!.value - chosen.value;
  const percent =
    index === 0 ? 100 : Math.min(99, Math.max(0, Math.round(100 - POINTS_TO_PERCENT * lost)));
  return { options, chosen, place: index + 1, percent };
}

/** Three cards for the best throw, two from 90 %, one otherwise. */
export function shareCards(percent: number): string {
  return '🃏'.repeat(percent >= 100 ? 3 : percent >= 90 ? 2 : 1);
}

export function dailyShareText(dateKey: string, percent: number): string {
  return composeShare({
    title: 'Fifteen-Two',
    daily: dateKey,
    headline: `discard ${percent}% of best · ${shareCards(percent)}`,
  });
}
