import type { CardId } from '@usr-games/kit/cards';
import type { WinnableDeal } from '../engine/deals';
import type { Layout, RuleSet } from '../engine/rules';
import type { Verdict } from '../engine/solver';
import { answer, type SolverAnswer, type SolverRequest } from './solver-jobs';

/**
 * The page's side of the solver. In a browser it runs in a worker; elsewhere (tests) in the
 * page, a tick later, through the same calls.
 */

/** Positions for a hint: quick enough to feel instant on a slow machine. */
export const HINT_BUDGET = 40_000;
/** Positions to settle whether a finished deal could have been won. */
export const VERDICT_BUDGET = 400_000;

type Body =
  | { kind: 'verdict'; layout: Layout; budget: number }
  | { kind: 'deal-verdict'; deal: readonly CardId[]; rules: RuleSet; budget: number }
  | { kind: 'winnable'; seed: string; rules: RuleSet }
  | { kind: 'daily'; dateKey: string };

export class SolverClient {
  private worker: Worker | null = null;
  private next = 0;
  private readonly waiting = new Map<number, (answer: SolverAnswer) => void>();

  constructor(inPage = typeof Worker === 'undefined') {
    if (inPage) return;
    try {
      this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<SolverAnswer>) => this.settle(event.data);
    } catch {
      this.worker = null;
    }
  }

  private settle(result: SolverAnswer): void {
    const resolve = this.waiting.get(result.id);
    this.waiting.delete(result.id);
    resolve?.(result);
  }

  private ask(body: Body): Promise<SolverAnswer> {
    const request = { ...body, id: ++this.next } as SolverRequest;
    return new Promise((resolve) => {
      this.waiting.set(request.id, resolve);
      if (this.worker) this.worker.postMessage(request);
      else setTimeout(() => this.settle(answer(request)), 0);
    });
  }

  async verdict(layout: Layout, budget = HINT_BUDGET): Promise<Verdict> {
    const result = await this.ask({ kind: 'verdict', layout, budget });
    return (result as Extract<SolverAnswer, { kind: 'verdict' }>).verdict;
  }

  async dealVerdict(
    deal: readonly CardId[],
    rules: RuleSet,
    budget = VERDICT_BUDGET,
  ): Promise<Verdict> {
    const result = await this.ask({ kind: 'deal-verdict', deal, rules, budget });
    return (result as Extract<SolverAnswer, { kind: 'verdict' }>).verdict;
  }

  async winnable(seed: string, rules: RuleSet): Promise<WinnableDeal> {
    const result = await this.ask({ kind: 'winnable', seed, rules });
    return (result as Extract<SolverAnswer, { kind: 'deal' }>).deal;
  }

  async daily(dateKey: string): Promise<WinnableDeal> {
    const result = await this.ask({ kind: 'daily', dateKey });
    return (result as Extract<SolverAnswer, { kind: 'deal' }>).deal;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiting.clear();
  }
}
