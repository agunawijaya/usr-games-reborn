/// <reference lib="webworker" />
import { answer, type DriverRequest } from './driver-jobs';

/** The drivers off the page's thread, so the table never stalls while Sly thinks. */

self.onmessage = (event: MessageEvent<DriverRequest>) => {
  self.postMessage(answer(event.data));
};
