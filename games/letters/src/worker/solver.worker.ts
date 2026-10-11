/// <reference lib="webworker" />
import { answer, type SolverRequest } from './jobs';

/**
 * The dictionary and the solver live off the page's thread: inflating 76 000 words and building
 * the letter tree happen here while the cubes tumble on screen.
 */
self.onmessage = (event: MessageEvent<SolverRequest>) => {
  void answer(event.data).then((result) => self.postMessage(result));
};
