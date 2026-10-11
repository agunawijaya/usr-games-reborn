import { isPrime, smallestFactor } from './factor';
import { primesUpTo } from './sieve';

/**
 * The Sieve mode: a board of numbers, where choosing a prime sweeps every one of its multiples
 * away. When only primes are left the board is clear. Fewer choices and less time are better;
 * choosing a number that is not prime costs time in Rush.
 */

export interface SieveSetup {
  /** The first and last number on the board, both shown. */
  readonly first: number;
  readonly last: number;
  readonly columns: number;
}

/** Why a cell left the board: swept by a prime, or `one`, which is not prime at all. */
export type Gone = number | 'one';

export interface SieveBoard {
  readonly setup: SieveSetup;
  /** One entry per number from `first` to `last`: null while it is still on the board. */
  readonly gone: readonly (Gone | null)[];
  /** Primes chosen so far, in order. */
  readonly chosen: readonly number[];
  /** Sieving primes the board may need that are not on it (a range like 1 000–1 200). */
  readonly strip: readonly number[];
  readonly clicks: number;
  readonly wrongClicks: number;
  readonly clear: boolean;
}

export function newBoard(setup: SieveSetup): SieveBoard {
  const gone: (Gone | null)[] = [];
  for (let n = setup.first; n <= setup.last; n++) gone.push(n === 1 ? 'one' : null);
  const strip = primesUpTo(Math.floor(Math.sqrt(setup.last))).filter((p) => p < setup.first);
  const board: SieveBoard = {
    setup,
    gone,
    chosen: [],
    strip,
    clicks: 0,
    wrongClicks: 0,
    clear: false,
  };
  return { ...board, clear: compositesLeft(board) === 0 };
}

export function onBoard(board: SieveBoard, n: number): boolean {
  const index = n - board.setup.first;
  return index >= 0 && index < board.gone.length && board.gone[index] === null;
}

export function compositesLeft(board: SieveBoard): number {
  let count = 0;
  board.gone.forEach((gone, index) => {
    const n = board.setup.first + index;
    if (gone === null && n > 1 && !isPrime(n)) count++;
  });
  return count;
}

export type SieveMove =
  | { readonly kind: 'sweep'; readonly prime: number; readonly swept: readonly number[] }
  /** A prime with nothing left to sweep: it still counts as a choice. */
  | { readonly kind: 'idle'; readonly prime: number }
  | { readonly kind: 'not-prime'; readonly value: number }
  /** Already gone, already chosen, or not offered: nothing happens. */
  | { readonly kind: 'ignored' };

/** Can this number be chosen at all: on the board, or in the strip of sieving primes? */
function offered(board: SieveBoard, n: number): boolean {
  return onBoard(board, n) || board.strip.includes(n);
}

export function choose(board: SieveBoard, n: number): { board: SieveBoard; move: SieveMove } {
  if (board.clear || !offered(board, n) || board.chosen.includes(n)) {
    return { board, move: { kind: 'ignored' } };
  }
  if (!isPrime(n)) {
    return {
      board: { ...board, clicks: board.clicks + 1, wrongClicks: board.wrongClicks + 1 },
      move: { kind: 'not-prime', value: n },
    };
  }
  const gone = [...board.gone];
  const swept: number[] = [];
  const { first, last } = board.setup;
  for (let multiple = Math.max(2 * n, Math.ceil(first / n) * n); multiple <= last; multiple += n) {
    const index = multiple - first;
    if (gone[index] === null) {
      gone[index] = n;
      swept.push(multiple);
    }
  }
  const next: SieveBoard = {
    ...board,
    gone,
    chosen: [...board.chosen, n],
    clicks: board.clicks + 1,
  };
  const cleared = { ...next, clear: compositesLeft(next) === 0 };
  return {
    board: cleared,
    move: swept.length > 0 ? { kind: 'sweep', prime: n, swept } : { kind: 'idle', prime: n },
  };
}

/** The primes still standing: what the player has uncovered. */
export function survivors(board: SieveBoard): number[] {
  const left: number[] = [];
  board.gone.forEach((gone, index) => {
    const n = board.setup.first + index;
    if (gone === null && isPrime(n)) left.push(n);
  });
  return left;
}

/**
 * Par: the choices Eratosthenes would make, one for every prime that is the smallest factor of
 * some composite on the board.
 */
export function parChoices(setup: SieveSetup): number[] {
  const needed = new Set<number>();
  for (let n = Math.max(4, setup.first); n <= setup.last; n++) {
    if (!isPrime(n)) needed.add(smallestFactor(n));
  }
  return [...needed].sort((a, b) => a - b);
}
