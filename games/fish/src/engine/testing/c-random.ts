import type { Chance } from '../chance';

/**
 * The GNU C library's `random()` after `srandom(seed)`: the additive feedback generator of
 * degree 31 and separation 3 that the Berkeley program drew every number from, written out so
 * the faithfulness tests can replay the original's games number for number. Test support only;
 * the game itself plays with the kit's generator.
 */
export interface CRandom extends Chance {
  random(): number;
}

export function cRandom(seed: number): CRandom {
  const state = new Int32Array(31);
  let word = seed === 0 ? 1 : seed | 0;
  state[0] = word;
  for (let i = 1; i < 31; i++) {
    // state[i] = 16807 * state[i - 1] % 2147483647, kept inside 31 bits as glibc does.
    const hi = Math.trunc(word / 127773);
    const lo = word % 127773;
    word = 16807 * lo - 2836 * hi;
    if (word < 0) word += 2147483647;
    state[i] = word;
  }
  let front = 3;
  let rear = 0;
  const random = () => {
    state[front] = (state[front]! + state[rear]!) | 0;
    const result = state[front]! >>> 1;
    front = (front + 1) % 31;
    rear = (rear + 1) % 31;
    return result;
  };
  for (let i = 0; i < 310; i++) random();
  return { random, below: (n) => random() % n };
}

/**
 * The original's deck: ranks only, shuffled by its own loop (`init` in fish.c). Returned as
 * card ids by giving the copies of each rank the four suits in the order they lie, so the
 * engine can deal it from the end exactly as the original did.
 */
export function berkeleyDeck(chance: Chance): number[] {
  const ranks = Array.from({ length: 52 }, (_, i) => i % 13);
  for (let i = 0; i < 51; i++) {
    const j = chance.below(52 - i);
    if (j === 0) continue;
    [ranks[i], ranks[i + j]] = [ranks[i + j]!, ranks[i]!];
  }
  const suitsUsed = new Array<number>(13).fill(0);
  return ranks.map((rank) => suitsUsed[rank]!++ * 13 + rank);
}
