/**
 * The stored list's format. Words are sorted and front-coded: each starts with one header
 * character that packs how many leading letters it shares with the word before (0–8) and the
 * index of its SCOWL size in `SIZES`, followed by the letters that differ. Header characters sit
 * below `a`, so the letters of a word need no separator. The text is deflated (raw) and written
 * in hex, whose letters stop at `f`: no stretch of it can spell a word the content guard refuses.
 */

/** SCOWL's size levels up to 60, smallest (commonest) first. */
export const SIZES = [10, 20, 35, 40, 50, 55, 60];

const HEADER_BASE = 33;
const MAX_SHARED = 8;

/** `entries` must be sorted by word; each is [word, size]. */
export function encodeWordList(entries) {
  let previous = '';
  let out = '';
  for (const [word, size] of entries) {
    const sizeIndex = SIZES.indexOf(size);
    if (sizeIndex < 0) throw new Error(`${word}: ${size} is not a SCOWL size up to 60`);
    let shared = 0;
    while (
      shared < MAX_SHARED &&
      shared < previous.length &&
      shared < word.length - 1 &&
      previous[shared] === word[shared]
    ) {
      shared++;
    }
    out +=
      String.fromCharCode(HEADER_BASE + shared * SIZES.length + sizeIndex) + word.slice(shared);
    previous = word;
  }
  return out;
}

/** Calls `visit(word, size)` for every word in order. */
export function decodeWordList(text, visit) {
  let previous = '';
  let index = 0;
  while (index < text.length) {
    const header = text.charCodeAt(index++) - HEADER_BASE;
    const shared = Math.floor(header / SIZES.length);
    const size = SIZES[header % SIZES.length];
    let end = index;
    while (end < text.length && text.charCodeAt(end) >= 97) end++;
    const word = previous.slice(0, shared) + text.slice(index, end);
    visit(word, size);
    previous = word;
    index = end;
  }
}
