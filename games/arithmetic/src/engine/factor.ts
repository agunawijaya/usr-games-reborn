/**
 * Prime factors of whole numbers up to 2^32 − 1, the range of Landon Curt Noll's `factor`
 * (1989). The original divided by every prime in a table up to 65 537; we divide by the small
 * primes and hand anything bigger to Pollard's rho, with a Miller–Rabin test that is exact in
 * this range. Plain doubles are enough: products are split so nothing passes 2^53.
 */

export const MAX_FACTORABLE = 4_294_967_295;

/** `a × b mod m` for a, b < m ≤ 2^32 without losing precision. */
export function mulMod(a: number, b: number, m: number): number {
  const high = Math.floor(b / 65536);
  const low = b % 65536;
  return (((a * high) % m) * 65536 + a * low) % m;
}

export function powMod(base: number, exponent: number, m: number): number {
  let result = 1 % m;
  let square = base % m;
  let e = exponent;
  while (e > 0) {
    if (e % 2 === 1) result = mulMod(result, square, m);
    square = mulMod(square, square, m);
    e = Math.floor(e / 2);
  }
  return result;
}

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

/** Bases 2, 7 and 61 decide every n below 4 759 123 141 (Jaeschke, 1993). */
const WITNESSES = [2, 7, 61];

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0) return false;
  }
  let d = n - 1;
  let twos = 0;
  while (d % 2 === 0) {
    d /= 2;
    twos++;
  }
  for (const a of WITNESSES) {
    if (a % n === 0) continue;
    let x = powMod(a, d, n);
    if (x === 1 || x === n - 1) continue;
    let composite = true;
    for (let r = 1; r < twos; r++) {
      x = mulMod(x, x, n);
      if (x === n - 1) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/**
 * One non-trivial divisor of an odd composite n (Brent's variant of Pollard's rho). The walk's
 * constant steps through 1, 2, 3… so the result is the same on every machine.
 */
export function rhoDivisor(n: number): number {
  for (let c = 1; ; c++) {
    const step = (x: number) => (mulMod(x, x, n) + c) % n;
    let y = 2;
    let power = 1;
    let length = 1;
    let product = 1;
    let saved = y;
    let x = y;
    let divisor = 1;
    while (divisor === 1) {
      x = y;
      for (let i = 0; i < length; i++) y = step(y);
      let k = 0;
      while (k < length && divisor === 1) {
        saved = y;
        const batch = Math.min(64, length - k);
        for (let i = 0; i < batch; i++) {
          y = step(y);
          product = mulMod(product, Math.abs(x - y), n);
        }
        divisor = gcd(product, n);
        k += batch;
      }
      length *= 2;
      power++;
      if (power > 40) break;
    }
    if (divisor === n) {
      // The batch overshot; walk back one step at a time from the saved point.
      do {
        saved = step(saved);
        divisor = gcd(Math.abs(x - saved), n);
      } while (divisor === 1);
    }
    if (divisor !== n && divisor !== 1) return divisor;
  }
}

/** Prime factors in ascending order, repeated as often as they divide, like `factor` prints. */
export function factorize(value: number): number[] {
  if (!Number.isInteger(value) || value < 1 || value > MAX_FACTORABLE) {
    throw new RangeError(`cannot factor ${value}`);
  }
  const factors: number[] = [];
  let n = value;
  for (const p of SMALL_PRIMES) {
    while (n % p === 0) {
      factors.push(p);
      n /= p;
    }
  }
  const pending = n > 1 ? [n] : [];
  while (pending.length > 0) {
    const m = pending.pop()!;
    if (isPrime(m)) {
      factors.push(m);
      continue;
    }
    const d = rhoDivisor(m);
    pending.push(d, m / d);
  }
  return factors.sort((a, b) => a - b);
}

export interface PrimePower {
  readonly prime: number;
  readonly exponent: number;
}

/** `[2, 2, 2, 3, 3, 5]` → 2³ × 3² × 5 as prime and exponent pairs. */
export function primePowers(factors: readonly number[]): PrimePower[] {
  const powers: PrimePower[] = [];
  for (const prime of factors) {
    const last = powers[powers.length - 1];
    if (last && last.prime === prime)
      powers[powers.length - 1] = { prime, exponent: last.exponent + 1 };
    else powers.push({ prime, exponent: 1 });
  }
  return powers;
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function superscript(n: number): string {
  return [...String(n)].map((digit) => SUPERSCRIPTS[Number(digit)]).join('');
}

/** `2 × 2 × 2 × 3 × 3 × 5` */
export function productText(factors: readonly number[]): string {
  return factors.join(' × ');
}

/** `2³ × 3² × 5` */
export function powerText(factors: readonly number[]): string {
  return primePowers(factors)
    .map(({ prime, exponent }) => (exponent > 1 ? `${prime}${superscript(exponent)}` : `${prime}`))
    .join(' × ');
}

/** The smallest prime factor, or the number itself when it is prime (1 for 1). */
export function smallestFactor(n: number): number {
  return n < 2 ? n : factorize(n)[0]!;
}
