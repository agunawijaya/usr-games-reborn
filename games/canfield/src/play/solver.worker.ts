/// <reference lib="webworker" />
import { answer, type SolverRequest } from './solver-jobs';

/** The solver off the page's thread, so the table never stalls while a deal is weighed. */

self.onmessage = (event: MessageEvent<SolverRequest>) => {
  self.postMessage(answer(event.data));
};
