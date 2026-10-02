/**
 * The C library's `random()` as GNU libc implements it: an additive feedback generator over 31
 * words of state, seeded through a Lehmer step, its first 310 outputs thrown away. Classic rules
 * need it once: the hard level's extra bats and pits are drawn before the original seeds its
 * generator, so they always come from the library's default seed of 1.
 */
export function glibcRandom(seed: number): () => number {
  const state = new Int32Array(31);
  state[0] = seed === 0 ? 1 : seed | 0;
  for (let i = 1; i < 31; i++) {
    // 16807 × previous mod 2^31 − 1, by Schrage's method, as the library does it.
    const previous = state[i - 1]!;
    const high = Math.trunc(previous / 127773);
    const low = previous % 127773;
    let word = 16807 * low - 2836 * high;
    if (word < 0) word += 2147483647;
    state[i] = word;
  }
  let front = 3;
  let rear = 0;
  const next = (): number => {
    const sum = (state[front]! + state[rear]!) | 0;
    state[front] = sum;
    front = (front + 1) % 31;
    rear = (rear + 1) % 31;
    return (sum >>> 1) & 0x7fffffff;
  };
  for (let i = 0; i < 310; i++) next();
  return next;
}
