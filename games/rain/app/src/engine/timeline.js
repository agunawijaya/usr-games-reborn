// The clock between the engine and the picture (port ADR-003).
//
// The engine ticks every frameMs() milliseconds, like the original's
// sleep (rain.c:147-148). The picture runs a constant `latency` behind it,
// so that a drop created by the engine can be seen falling for that long
// and land exactly when its "." is shown. Both views (classic and modern)
// read the same queue, so split view stays frame-for-frame in step.
//
// Times are plain milliseconds supplied by the caller; nothing here reads
// a clock, so the tests drive it by hand.

import { step, frameMs, screenText } from './rain.js';

export const LATENCY_MS = 350;
const MAX_STEPS = 4000; // per advance(): a 1 ms delay at a 4 s hiccup

export function createTimeline(rain, { latency = LATENCY_MS, maxCatchUpMs = 1000 } = {}) {
  return { rain, latency, maxCatchUpMs, nextAt: null, queue: [], shown: null, skipped: 0 };
}

// Run the engine up to time `now`. Each engine frame is queued as
// { t, frame, events, text }. Returns how many frames ran.
export function advance(tl, now) {
  if (tl.nextAt === null) tl.nextAt = now;
  if (now - tl.nextAt > tl.maxCatchUpMs) {
    // The page was hidden or stalled: resume from now rather than replay
    // seconds of rain in one burst.
    tl.skipped += now - tl.nextAt;
    tl.nextAt = now;
  }
  let n = 0;
  while (tl.nextAt <= now && n < MAX_STEPS) {
    const events = step(tl.rain);
    tl.queue.push({ t: tl.nextAt, frame: tl.rain.frame, events, text: screenText(tl.rain) });
    tl.nextAt += frameMs(tl.rain);
    n++;
  }
  return n;
}

// Engine frames whose moment has come on screen (t + latency <= now),
// oldest first. The newest of them is remembered as `shown`.
export function takeDue(tl, now) {
  let k = 0;
  while (k < tl.queue.length && tl.queue[k].t + tl.latency <= now) k++;
  const due = tl.queue.splice(0, k);
  if (due.length) tl.shown = due[due.length - 1];
  return due;
}

// Frames created but not yet shown: their new drops are still falling.
export const inFlight = (tl) => tl.queue;

// Change -d while running; a shorter delay takes effect at once.
export function setDelay(tl, delay, now) {
  tl.rain.delay = delay;
  if (tl.nextAt !== null && now !== undefined) {
    const soon = now + (delay > 0 ? delay : 1);
    if (tl.nextAt > soon) tl.nextAt = soon;
  }
}
