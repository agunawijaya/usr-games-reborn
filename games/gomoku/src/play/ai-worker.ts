/// <reference lib="webworker" />
import { Brain, type SeatSetup } from './brain';

/** The opponent thinking off the page's thread, so the board never freezes while it does. */

export type ToWorker =
  | { kind: 'start'; setup: SeatSetup }
  | { kind: 'played'; point: number }
  | { kind: 'choose'; id: number };

let brain: Brain | null = null;

self.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  if (message.kind === 'start') brain = new Brain(message.setup);
  else if (message.kind === 'played') brain?.played(message.point);
  else if (brain) self.postMessage({ id: message.id, choice: brain.choose() });
};
