// One visual clock for every animation in the scene. It advances with the
// frame delta times `scale`, so a chain of crashes can play in slow motion
// (scale < 1) without touching game state. Screenshot scripts can also
// freeze it (`manual`) and step it for reproducible frames.
// Moments tied to the animation (a crash landing when the robots meet) are
// scheduled on this clock with `after`, so they stay in sync in slow motion.

export const vclock = {
  /** Visual time in seconds. */
  t: 0,
  /** Current speed; eased toward `target`. */
  scale: 1,
  target: 1,
  /** Until this visual time, stay in slow motion. */
  slowUntil: 0,
  manual: false,
};

export function advanceClock(delta: number): void {
  if (vclock.manual) return;
  stepClock(delta);
}

export function stepClock(delta: number): void {
  const d = Math.min(delta, 0.1);
  if (vclock.t > vclock.slowUntil) vclock.target = 1;
  // brake hard, recover gently
  const rate = vclock.target < vclock.scale ? 16 : 5;
  vclock.scale += (vclock.target - vclock.scale) * Math.min(1, d * rate);
  vclock.t += d * vclock.scale;
  flush();
}

const queue: Array<{ at: number; fn: () => void }> = [];

/** Run `fn` once `seconds` of visual time have passed. */
export function after(seconds: number, fn: () => void): void {
  queue.push({ at: vclock.t + seconds, fn });
}

/** Drop everything scheduled (new game). */
export function clearScheduled(): void {
  queue.length = 0;
}

function flush(): void {
  if (!queue.length) return;
  const due = queue.filter((q) => q.at <= vclock.t);
  if (!due.length) return;
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= vclock.t) queue.splice(i, 1);
  due.sort((a, b) => a.at - b.at).forEach((q) => q.fn());
}

/** Slow the scene down for `seconds` of visual time. */
export function slowMotion(scale: number, seconds: number): void {
  vclock.target = Math.min(vclock.target, scale);
  vclock.slowUntil = Math.max(vclock.slowUntil, vclock.t + seconds);
}

export const nowMs = (): number => vclock.t * 1000;
