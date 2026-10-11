import { isPrime } from './factor';

/**
 * The prime album: every prime the player uncovers in Split or Sieve, kept for good. Some primes
 * earn a special card: twins (both of p and p + 2 collected), primes above a thousand, and
 * primes that read the same backwards.
 */

export type Special = 'twin' | 'big' | 'palindrome';

export interface Album {
  /** Collected primes, ascending, no repeats. */
  readonly primes: readonly number[];
}

export function emptyAlbum(): Album {
  return { primes: [] };
}

/** Adds what was uncovered; returns the new album and the primes that were new. */
export function collect(album: Album, found: Iterable<number>): { album: Album; added: number[] } {
  const owned = new Set(album.primes);
  const added: number[] = [];
  for (const p of found) {
    if (!owned.has(p) && isPrime(p)) {
      owned.add(p);
      added.push(p);
    }
  }
  if (added.length === 0) return { album, added };
  return {
    album: { primes: [...owned].sort((a, b) => a - b) },
    added: added.sort((a, b) => a - b),
  };
}

export function isPalindrome(n: number): boolean {
  const text = String(n);
  return text === [...text].reverse().join('');
}

/** Twin pairs whose both members are in the album, as their smaller member. */
export function twinPairs(album: Album): number[] {
  const owned = new Set(album.primes);
  return album.primes.filter((p) => owned.has(p + 2));
}

export function specialsOf(album: Album, p: number): Special[] {
  const owned = new Set(album.primes);
  const specials: Special[] = [];
  if (owned.has(p + 2) || owned.has(p - 2)) specials.push('twin');
  if (p > 1000) specials.push('big');
  if (p > 10 && isPalindrome(p)) specials.push('palindrome');
  return specials;
}

export interface AlbumSummary {
  readonly count: number;
  readonly twins: number;
  readonly big: number;
  readonly palindromes: number;
  readonly largest: number;
}

export function summarize(album: Album): AlbumSummary {
  return {
    count: album.primes.length,
    twins: twinPairs(album).length,
    big: album.primes.filter((p) => p > 1000).length,
    palindromes: album.primes.filter((p) => p > 10 && isPalindrome(p)).length,
    largest: album.primes[album.primes.length - 1] ?? 0,
  };
}

export function isAlbum(value: unknown): value is Album {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Album).primes) &&
    (value as Album).primes.every((p) => Number.isInteger(p) && p > 1)
  );
}
