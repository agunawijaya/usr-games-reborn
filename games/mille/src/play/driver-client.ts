import type { Driver } from '../ai/players';
import type { Action, HandState } from '../engine/hand';
import { answer, type DriverAnswer, type DriverRequest } from './driver-jobs';

/**
 * The page's side of the drivers. In a browser Sly thinks in a worker (a choice takes it about a
 * tenth of a second); elsewhere (tests) the same call runs in the page, a tick later.
 */
export class DriverClient {
  private worker: Worker | null = null;
  private next = 0;
  private readonly waiting = new Map<number, (answer: DriverAnswer) => void>();

  constructor(inPage = typeof Worker === 'undefined') {
    if (inPage) return;
    try {
      this.worker = new Worker(new URL('./driver.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<DriverAnswer>) => this.settle(event.data);
    } catch {
      this.worker = null;
    }
  }

  private settle(result: DriverAnswer): void {
    const resolve = this.waiting.get(result.id);
    this.waiting.delete(result.id);
    resolve?.(result);
  }

  /** The driver's move; `driver` is updated in place when the answer comes back. */
  decide(state: HandState, seat: number, driver: Driver): Promise<Action> {
    const request: DriverRequest = { id: ++this.next, state, seat, driver };
    return new Promise((resolve) => {
      this.waiting.set(request.id, (result) => {
        driver.rng = result.driver.rng;
        driver.memory = result.driver.memory;
        resolve(result.action);
      });
      if (this.worker) this.worker.postMessage(request);
      else setTimeout(() => this.settle(answer(structuredClone(request))), 0);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiting.clear();
  }
}
