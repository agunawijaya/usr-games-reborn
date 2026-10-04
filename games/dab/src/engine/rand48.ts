// Derived from dab's random.cc, NetBSD games (2003), by Christos Zoulas.
//   Copyright (c) 2003 The NetBSD Foundation, Inc. All rights reserved.
//   Licence: LICENSES/BSD-NetBSD-Foundation.txt (four-clause BSD).
//   This product includes software developed by the NetBSD Foundation, Inc. and its contributors.

/**
 * The C library's `srand48` and `lrand48`, exactly: a 48-bit linear congruential generator,
 * x' = (0x5DEECE66D · x + 0xB) mod 2^48, seeded with the 32-bit seed above 0x330E, returning the
 * top 31 bits. The original computer seeds it from the clock, so reproducing its choices needs
 * the very same numbers.
 *
 * The 48-bit state is kept as two 24-bit halves so every product stays exact in a double.
 */
const HALF = 2 ** 24;
const MULTIPLIER_HIGH = 0x5de;
const MULTIPLIER_LOW = 0xece66d;
const INCREMENT = 0xb;

export class Rand48 {
  private high = 0;
  private low = 0;

  /** `srand48(seed)`: only the low 32 bits of the seed count. */
  seed(seed: number): void {
    const seed32 = ((seed % 2 ** 32) + 2 ** 32) % 2 ** 32;
    const state = seed32 * 2 ** 16 + 0x330e;
    this.high = Math.floor(state / HALF);
    this.low = state % HALF;
  }

  /** `lrand48()`: the next value in [0, 2^31). */
  next(): number {
    const lowProduct = this.low * MULTIPLIER_LOW + INCREMENT;
    const carry = Math.floor(lowProduct / HALF);
    const middle = this.low * MULTIPLIER_HIGH + this.high * MULTIPLIER_LOW + carry;
    this.low = lowProduct % HALF;
    this.high = middle % HALF;
    return this.high * 2 ** 7 + Math.floor(this.low / 2 ** 17);
  }
}

/**
 * The original's `RANDOM` (random.cc): hands out 0 … n − 1 in a random order, then n once they
 * are all used. Its constructor and `clear()` both reseed the one shared generator from the
 * clock, which is the original's most telling quirk: within one second every `RANDOM` starts
 * from the same numbers, so its "random" orders are the same over and over and tied together.
 */
export class Permutation {
  private used: boolean[] = [];
  private handedOut = 0;

  constructor(
    private readonly size: number,
    private readonly generator: Rand48,
    private readonly clock: number,
  ) {
    this.clear();
  }

  clear(): void {
    this.handedOut = 0;
    this.generator.seed(this.clock);
    this.used = new Array<boolean>(this.size).fill(false);
  }

  next(): number {
    if (this.handedOut === this.size) return this.size;
    for (;;) {
      const value = this.generator.next() % this.size;
      if (!this.used[value]) {
        this.used[value] = true;
        this.handedOut++;
        return value;
      }
    }
  }
}
