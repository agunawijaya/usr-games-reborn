/**
 * The collection's agreed English word list: every word that both SCOWL (sizes up to 60) and
 * ENABLE2K accept, with the smallest SCOWL size it appears at, less Chain Letter's content
 * deny-list. Word games check their hidden answer words against it at build time (in their
 * tests); nothing here is shipped to a browser. See README.md and docs/adr/0013.
 *
 * Every function takes plain lower-case words; anything else is simply not a word here.
 */
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { AGREED_HEX, SOURCE } from './agreed.data.js';
import { decodeWordList } from './codec.js';

/**
 * The largest SCOWL size whose words count as common: SCOWL's "small" (35) and "medium" (50)
 * levels and everything below them. Sizes 55 and 60 hold words most players would not know.
 */
export const COMMON_MAX_SIZE = 50;

export const WORD_SOURCE = Object.freeze({
  ...SOURCE,
  commonMaxSize: COMMON_MAX_SIZE,
  common: Object.entries(SOURCE.bySize)
    .filter(([size]) => Number(size) <= COMMON_MAX_SIZE)
    .reduce((sum, [, count]) => sum + count, 0),
});

let agreed = null;

/** Every agreed word and its smallest SCOWL size, decoded on first use. */
export function agreedWords() {
  if (!agreed) {
    const text = inflateRawSync(Buffer.from(AGREED_HEX, 'hex')).toString('latin1');
    const words = new Map();
    decodeWordList(text, (word, size) => words.set(word, size));
    agreed = words;
  }
  return agreed;
}

/** The smallest SCOWL size the word appears at, or undefined when the two lists do not agree. */
export function scowlSizeOf(word) {
  return agreedWords().get(word);
}

export function isCommonWord(word) {
  const size = scowlSizeOf(word);
  return size !== undefined && size <= COMMON_MAX_SIZE;
}

/** Why a word is not a common agreed word, in a few words for a test failure; null when it is. */
export function uncommonReason(word) {
  if (!/^[a-z]+$/.test(word)) return 'not a plain lower-case word';
  const size = scowlSizeOf(word);
  if (size === undefined) return 'not in both SCOWL and ENABLE';
  if (size > COMMON_MAX_SIZE)
    return `SCOWL size ${size}, rarer than the common sizes (up to ${COMMON_MAX_SIZE})`;
  return null;
}
