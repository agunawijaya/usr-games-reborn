import type { Rng } from '@usr-games/kit';

/**
 * Every rule of the original draws `random() % n`, so the engine asks for exactly that: a
 * non-negative 31-bit integer per call, like the C library's `random()`. Play uses the kit's
 * seeded generator; tests can pass scripted streams to pin down a single decision.
 */
export type Random = () => number;

export function randomFrom(rng: Rng): Random {
  return () => rng.nextUint32() >>> 1;
}

/** `random() % n`, the original's only way of rolling a die. */
export function roll(random: Random, sides: number): number {
  return random() % sides;
}

/** A room number from 1 to `size`, as the original picked rooms: `random() % size + 1`. */
export function anyRoom(random: Random, size: number): number {
  return (random() % size) + 1;
}

/** A stream that replays the given numbers and then repeats the last one; for tests. */
export function scripted(values: readonly number[]): Random {
  let at = 0;
  return () => {
    const value = values[Math.min(at, values.length - 1)] ?? 0;
    at += 1;
    return value;
  };
}
