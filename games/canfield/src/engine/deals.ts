import { createRng, dailySeed, type DateKey } from '@usr-games/kit';
import { type CardId, shuffledDeck } from '@usr-games/kit/cards';
import { openDeal, type RuleSet } from './rules';
import { solve, type Verdict } from './solver';

/**
 * Where deals come from. Every deal is a seeded shuffle; "winnable" deals are the first
 * candidates in a seeded sequence that the solver proves winnable within a fixed budget of
 * positions, so the same seed gives the same deal on every machine.
 */

/** Positions the solver may explore per candidate when looking for a winnable deal. */
export const WINNABLE_BUDGET = 60_000;
/** Candidates tried before settling for the last one looked at (never reached in practice). */
export const MAX_CANDIDATES = 60;

export function shuffledDeal(seed: string): CardId[] {
  return shuffledDeck(createRng(`canfield:${seed}`));
}

export interface WinnableDeal {
  deal: CardId[];
  /** The candidate's seed: `seed/k`. */
  seed: string;
  candidates: number;
  verdict: Verdict;
}

export function winnableDeal(seed: string, rules: RuleSet, budget = WINNABLE_BUDGET): WinnableDeal {
  let last: WinnableDeal | null = null;
  for (let k = 0; k < MAX_CANDIDATES; k++) {
    const candidate = `${seed}/${k}`;
    const deal = shuffledDeal(candidate);
    const verdict = solve(openDeal(deal, rules).layout, { nodeBudget: budget });
    last = { deal, seed: candidate, candidates: k + 1, verdict };
    if (verdict.result === 'winnable') return last;
  }
  return last!;
}

/** The Daily Deal: Standard rules, proven winnable, the same for everyone on the same date. */
export function dailyDeal(dateKey: DateKey): WinnableDeal {
  return winnableDeal(dailySeed('canfield', dateKey), 'standard');
}
