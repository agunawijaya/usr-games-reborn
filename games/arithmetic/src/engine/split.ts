import { factorize, isPrime } from './factor';

/**
 * The Split mode, after `factor` (1989): a number is broken down one prime at a time. A prime that
 * divides it splits it; anything else bounces. When what is left is itself prime, choosing it
 * (or declaring it prime) makes the last split.
 */

export interface SplitState {
  readonly start: number;
  readonly remaining: number;
  /** Primes split off so far, in the order the player found them. */
  readonly found: readonly number[];
  readonly bounces: number;
  readonly done: boolean;
}

export function startSplit(start: number): SplitState {
  if (!Number.isInteger(start) || start < 2) throw new RangeError('a split needs 2 or more');
  return { start, remaining: start, found: [], bounces: 0, done: false };
}

export type SplitMove =
  | { readonly kind: 'split'; readonly prime: number; readonly last: boolean }
  /** Divides, but is not prime: it has to be split further first. */
  | { readonly kind: 'not-prime'; readonly value: number }
  | { readonly kind: 'no-divide'; readonly value: number }
  | { readonly kind: 'ignored' };

export function trySplit(state: SplitState, value: number): { state: SplitState; move: SplitMove } {
  if (state.done || !Number.isInteger(value) || value < 2) {
    return { state, move: { kind: 'ignored' } };
  }
  if (state.remaining % value !== 0) {
    return { state: { ...state, bounces: state.bounces + 1 }, move: { kind: 'no-divide', value } };
  }
  if (!isPrime(value)) {
    return { state: { ...state, bounces: state.bounces + 1 }, move: { kind: 'not-prime', value } };
  }
  const remaining = state.remaining / value;
  const done = remaining === 1;
  return {
    state: { ...state, remaining, found: [...state.found, value], done },
    move: { kind: 'split', prime: value, last: done },
  };
}

/** "It's prime": the last split when true, a bounce when the number still splits. */
export function declarePrime(state: SplitState): { state: SplitState; move: SplitMove } {
  if (state.done) return { state, move: { kind: 'ignored' } };
  if (isPrime(state.remaining)) return trySplit(state, state.remaining);
  return {
    state: { ...state, bounces: state.bounces + 1 },
    move: { kind: 'not-prime', value: state.remaining },
  };
}

/** The full answer, ascending: what the finished split reads as. */
export function splitAnswer(state: SplitState): number[] {
  return factorize(state.start);
}

/** Only primes up to the square root can split a number; past that, what is left is prime. */
export function rootLimit(n: number): number {
  return Math.floor(Math.sqrt(n));
}

function digitSum(n: number): number {
  return [...String(n)].reduce((sum, digit) => sum + Number(digit), 0);
}

/** Digits added and taken away in turn from the right: a multiple of 11 when 11 goes in. */
function alternatingSum(n: number): number {
  return [...String(n)]
    .reverse()
    .reduce((sum, digit, i) => sum + (i % 2 === 0 ? 1 : -1) * Number(digit), 0);
}

/**
 * A nudge for the next split: the divisibility rule that finds the smallest prime factor, or,
 * when what is left is prime, the reason no split is coming.
 */
export function splitHint(n: number): string {
  if (isPrime(n)) {
    return `No prime up to ${rootLimit(n)} goes into ${n.toLocaleString('en-US')}, so it is prime itself.`;
  }
  const smallest = factorize(n)[0]!;
  if (smallest === 2) return 'It is even, so 2 goes in.';
  if (smallest === 3) return `Its digits add up to ${digitSum(n)}, a multiple of 3, so 3 goes in.`;
  if (smallest === 5) return 'It ends in 5, so 5 goes in.';
  if (smallest === 11) {
    return `Add and take away its digits in turn: ${alternatingSum(n)}, a multiple of 11, so 11 goes in.`;
  }
  return `2, 3 and 5 do not go in. Try ${smallest}.`;
}
