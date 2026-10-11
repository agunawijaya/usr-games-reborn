/**
 * The primes in [start, stop), the way Landon Curt Noll's `primes` (1989) finds them: a window of
 * odd numbers is first stamped from a repeating pattern that already has the multiples of 3, 5,
 * 7, 11 and 13 crossed out (the pattern repeats every 2 × 3 × 5 × 7 × 11 × 13 = 30 030 numbers),
 * then only primes from 17 up are sieved by hand. The original ships the pattern as a table in
 * `pattern.c`; we compute the same 15 015 entries once.
 */

export const MAX_SIEVE = 4_294_967_295;
const WHEEL = 2 * 3 * 5 * 7 * 11 * 13;
const WINDOW = 1 << 16;

let pattern: Uint8Array | null = null;

/** Entry i stands for the odd number 2i + 1: 1 when no prime from 3 to 13 divides it. */
export function wheelPattern(): Uint8Array {
  if (pattern) return pattern;
  const entries = new Uint8Array(WHEEL / 2);
  for (let i = 0; i < entries.length; i++) {
    const odd = 2 * i + 1;
    entries[i] = odd % 3 && odd % 5 && odd % 7 && odd % 11 && odd % 13 ? 1 : 0;
  }
  pattern = entries;
  return entries;
}

/** Every prime up to `limit`, by a plain sieve: the sieving primes for the windows. */
export function primesUpTo(limit: number): number[] {
  if (limit < 2) return [];
  const composite = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let n = 2; n <= limit; n++) {
    if (composite[n]) continue;
    primes.push(n);
    for (let m = n * n; m <= limit; m += n) composite[m] = 1;
  }
  return primes;
}

const SMALL = [2, 3, 5, 7, 11, 13];

/** Primes at or above `start` and below `stop`, ascending. */
export function primesBetween(start: number, stop: number): number[] {
  if (stop > MAX_SIEVE + 1 || start < 0) throw new RangeError('outside the sieve');
  const found: number[] = [];
  for (const p of SMALL) if (p >= start && p < stop) found.push(p);
  // Windows hold odd numbers only, starting on an odd base at or above 17.
  let base = Math.max(start, 17);
  if (base % 2 === 0) base++;
  if (base >= stop) return found;
  const sieving = primesUpTo(Math.floor(Math.sqrt(stop))).filter((p) => p >= 17);
  const wheel = wheelPattern();
  const table = new Uint8Array(WINDOW);
  while (base < stop) {
    const count = Math.min(WINDOW, Math.ceil((stop - base) / 2));
    // Stamp the pattern: the entry for `base` sits at (base mod 30 030) / 2.
    let from = ((base % WHEEL) - 1) / 2;
    for (let i = 0; i < count; i++) {
      table[i] = wheel[from]!;
      from = from + 1 === wheel.length ? 0 : from + 1;
    }
    const top = base + 2 * (count - 1);
    for (const p of sieving) {
      if (p * p > top) break;
      // First odd multiple of p in the window, never p itself.
      let multiple = Math.max(p * p, Math.ceil(base / p) * p);
      if (multiple % 2 === 0) multiple += p;
      for (let i = (multiple - base) / 2; i < count; i += p) table[i] = 0;
    }
    for (let i = 0; i < count; i++) if (table[i]) found.push(base + 2 * i);
    base += 2 * count;
  }
  return found;
}
