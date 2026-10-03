import type { Choice } from '../engine/ai';
import type { ToWorker } from './ai-worker';
import { Brain, type SeatSetup } from './brain';

/**
 * The page's side of an opponent's seat. In a browser the opponent thinks in a worker; elsewhere
 * (tests) it thinks in the page, a tick later, through the same calls. Disposing a seat ends a
 * search in progress.
 */

export interface AiSeat {
  played(point: number): void;
  choose(): Promise<Choice>;
  dispose(): void;
}

class WorkerSeat implements AiSeat {
  private readonly worker: Worker;
  private next = 0;
  private readonly waiting = new Map<number, (choice: Choice) => void>();

  constructor(setup: SeatSetup) {
    this.worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<{ id: number; choice: Choice }>) => {
      const resolve = this.waiting.get(event.data.id);
      this.waiting.delete(event.data.id);
      resolve?.(event.data.choice);
    };
    this.send({ kind: 'start', setup });
  }

  private send(message: ToWorker): void {
    this.worker.postMessage(message);
  }

  played(point: number): void {
    this.send({ kind: 'played', point });
  }

  choose(): Promise<Choice> {
    const id = ++this.next;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.send({ kind: 'choose', id });
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.waiting.clear();
  }
}

class PageSeat implements AiSeat {
  private brain: Brain | null;

  constructor(setup: SeatSetup) {
    this.brain = new Brain(setup);
  }

  played(point: number): void {
    this.brain?.played(point);
  }

  choose(): Promise<Choice> {
    return new Promise((resolve) =>
      setTimeout(() => {
        if (this.brain) resolve(this.brain.choose());
      }, 0),
    );
  }

  dispose(): void {
    this.brain = null;
  }
}

export function createAiSeat(setup: SeatSetup, options: { inPage?: boolean } = {}): AiSeat {
  if (!options.inPage && typeof Worker !== 'undefined') return new WorkerSeat(setup);
  return new PageSeat(setup);
}
