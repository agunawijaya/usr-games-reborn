import type { Deal, DealRequest } from '../engine/deal';
import type { Board, Rule } from '../engine/grid';
import type { BoardWord } from '../engine/solver';
import type { SolverAnswer, SolverRequest } from './jobs';

type Body =
  | ({ kind: 'deal' } & DealRequest)
  | { kind: 'daily'; seed: string }
  | { kind: 'solve'; board: Board; rule: Rule; minLetters: number };

/**
 * The page's side of the solver. In a browser it runs in a worker; where workers are missing
 * (unit tests) the same jobs run in the page, loaded on first use.
 */
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

  async deal(request: DealRequest): Promise<Deal> {
    const result = await this.ask({ kind: 'deal', ...request });
    return (result as Extract<SolverAnswer, { kind: 'deal' }>).deal;
  }

  async daily(seed: string): Promise<Deal> {
    const result = await this.ask({ kind: 'daily', seed });
    return (result as Extract<SolverAnswer, { kind: 'deal' }>).deal;
  }

  async solve(board: Board, rule: Rule, minLetters: number): Promise<BoardWord[]> {
    const result = await this.ask({ kind: 'solve', board, rule, minLetters });
    return (result as Extract<SolverAnswer, { kind: 'words' }>).words;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiting.clear();
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
      else void import('./jobs').then(({ answer }) => answer(request)).then((r) => this.settle(r));
    });
  }
}
