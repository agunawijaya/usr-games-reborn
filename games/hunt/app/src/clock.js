// Fixed-step clock (port ADR 005): turns real time into engine steps and
// tells the renderer how far it is between two steps (for interpolation).

export const SPEEDS = { relaxed: 8, standard: 10, frantic: 14 };

export function createClock(hz = 10) {
  return { hz, acc: 0, slow: 1, paused: false, alpha: 0 };
}

// Advance by dt seconds; returns how many steps to run now (capped so a
// long stall does not fast-forward the match).
export function advance(clock, dt, maxSteps = 4) {
  if (clock.paused) return 0;
  const period = 1 / (clock.hz * clock.slow);
  clock.acc += Math.min(dt, 0.25);
  let n = 0;
  while (clock.acc >= period && n < maxSteps) {
    clock.acc -= period;
    n++;
  }
  if (n === maxSteps) clock.acc = Math.min(clock.acc, period);
  clock.alpha = Math.min(1, clock.acc / period);
  return n;
}

export const stepSeconds = (clock) => 1 / (clock.hz * clock.slow);
