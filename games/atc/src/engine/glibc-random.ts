/**
 * The C library's `random()` as GNU libc implements it (the additive feedback generator with 31
 * words of state, seeded through a Lehmer step). Skyloom plays on the kit's own generator; this
 * one exists so tests can replay a shift exactly as the original program, built on Linux, played
 * it from the same `-r` seed. On that system `rand()` draws from the same state.
 */

const DEGREE = 31;
const SEPARATION = 3;
const DISCARD = 10 * DEGREE;

export function glibcRandom(seed: number): () => number {
  const state = new Int32Array(DEGREE);
  state[0] = seed === 0 ? 1 : seed | 0;
  for (let i = 1; i < DEGREE; i++) {
    // 16807 × previous mod 2^31 − 1, by Schrage's method as the library does it.
    const previous = state[i - 1]!;
    const high = Math.trunc(previous / 127773);
    const low = previous % 127773;
    let word = 16807 * low - 2836 * high;
    if (word < 0) word += 2147483647;
    state[i] = word;
  }
  let front = SEPARATION;
  let rear = 0;
  const next = (): number => {
    const sum = (state[front]! + state[rear]!) | 0;
    state[front] = sum;
    front = (front + 1) % DEGREE;
    rear = (rear + 1) % DEGREE;
    return (sum >>> 1) & 0x7fffffff;
  };
  for (let i = 0; i < DISCARD; i++) next();
  return next;
}
