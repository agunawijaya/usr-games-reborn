/**
 * The C library's `random()` as GNU libc implements it (the additive feedback generator of
 * degree 31 that `srandom()` seeds), reproduced so the 1994 player breaks its ties exactly as the
 * original does on Linux. Only the reference-game tests need that; play seeds it from the kit.
 */
export interface CRandom {
  /** A number from 0 to 2^31 − 1, as `random()` returns. */
  next(): number;
}

const DEGREE = 31;
const SEPARATION = 3;

export function glibcRandom(seed: number): CRandom {
  const state = new Int32Array(DEGREE);
  let word = seed >>> 0 || 1;
  state[0] = word;
  for (let i = 1; i < DEGREE; i++) {
    // 16807 × word mod (2^31 − 1), by Schrage's method as the library does.
    const hi = Math.trunc(word / 127773);
    const lo = word % 127773;
    word = 16807 * lo - 2836 * hi;
    if (word < 0) word += 2147483647;
    state[i] = word;
  }
  let front = SEPARATION;
  let rear = 0;
  const next = (): number => {
    const value = (state[front]! + state[rear]!) >>> 0;
    state[front] = value | 0;
    front++;
    rear++;
    if (front >= DEGREE) front = 0;
    else if (rear >= DEGREE) rear = 0;
    return value >>> 1;
  };
  // The library throws away the first 310 numbers after seeding.
  for (let i = 0; i < DEGREE * 10; i++) next();
  return { next };
}
