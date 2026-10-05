import type { CardId } from '@usr-games/kit/cards';
import { dailyDeal, winnableDeal, type WinnableDeal } from '../engine/deals';
import { type Layout, openDeal, type RuleSet } from '../engine/rules';
import { solve, type Verdict } from '../engine/solver';

/** The jobs the solver does for the table, the same in a worker or in the page. */

export type SolverRequest =
  | { id: number; kind: 'verdict'; layout: Layout; budget: number }
  | { id: number; kind: 'deal-verdict'; deal: readonly CardId[]; rules: RuleSet; budget: number }
  | { id: number; kind: 'winnable'; seed: string; rules: RuleSet }
  | { id: number; kind: 'daily'; dateKey: string };

export type SolverAnswer =
  | { id: number; kind: 'verdict'; verdict: Verdict }
  | { id: number; kind: 'deal'; deal: WinnableDeal };

export function answer(request: SolverRequest): SolverAnswer {
  switch (request.kind) {
    case 'verdict':
      return {
        id: request.id,
        kind: 'verdict',
        verdict: solve(request.layout, { nodeBudget: request.budget }),
      };
    case 'deal-verdict': {
      const layout = openDeal(request.deal, request.rules).layout;
      return {
        id: request.id,
        kind: 'verdict',
        verdict: solve(layout, { nodeBudget: request.budget }),
      };
    }
    case 'winnable':
      return { id: request.id, kind: 'deal', deal: winnableDeal(request.seed, request.rules) };
    case 'daily':
      return { id: request.id, kind: 'deal', deal: dailyDeal(request.dateKey) };
  }
}
