import type { Rng } from '@usr-games/kit';

/**
 * The game's dice: a whole number from 0 to n − 1. The Berkeley program drew every random
 * choice (the shuffle, who starts, the computer's moods, the rare taunt) from one stream, so the
 * engine and the rivals ask for numbers through this one small interface. In play it is backed
 * by the kit's seeded generator; the faithfulness tests back it with the C library's `random()`.
 */
export interface Chance {
  below(n: number): number;
}

export function chanceFrom(rng: Rng): Chance {
  return { below: (n) => rng.int(0, n - 1) };
}

/** Two independent streams: one for the rules, one for golden fish, so a golden never shifts a deal. */
export interface Dice {
  rules: Chance;
  golden: Chance;
}

export function diceFrom(rng: Rng): Dice {
  return { rules: chanceFrom(rng.split('rules')), golden: chanceFrom(rng.split('golden')) };
}
