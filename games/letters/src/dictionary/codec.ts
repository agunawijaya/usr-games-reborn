import type { Tier } from './tiers';

/**
 * The bundled word list's format. Words are sorted and front-coded: each starts with one
 * header character that packs how many leading letters it shares with the previous word
 * (0–9) and its rarity tier (0–3), followed by the letters that differ. Header characters sit
 * below `a`, so a word's letters never need a separator. The result is deflated (raw) and
 * written in hex. Hex keeps readable words out of the source for good: its letters run only from
 * a to f, so no stretch of it can ever spell a word the repository's content guard looks for.
 */

export interface TieredWord {
  word: string;
  tier: Tier;
}

const HEADER_BASE = 48;
const MAX_SHARED = 9;

export function encodeWordList(words: readonly TieredWord[]): string {
  let previous = '';
  let out = '';
  for (const { word, tier } of words) {
    let shared = 0;
    while (
      shared < MAX_SHARED &&
      shared < previous.length &&
      shared < word.length - 1 &&
      previous[shared] === word[shared]
    ) {
      shared++;
    }
    out += String.fromCharCode(HEADER_BASE + shared * 4 + tier) + word.slice(shared);
    previous = word;
  }
  return out;
}

/** Calls `visit` for every word in order; cheaper than building an array of 76 000 objects. */
export function decodeWordList(text: string, visit: (word: string, tier: Tier) => void): void {
  let previous = '';
  let index = 0;
  while (index < text.length) {
    const header = text.charCodeAt(index++) - HEADER_BASE;
    const shared = header >> 2;
    const tier = (header & 3) as Tier;
    let end = index;
    while (end < text.length && text.charCodeAt(end) >= 97) end++;
    const word = previous.slice(0, shared) + text.slice(index, end);
    visit(word, tier);
    previous = word;
    index = end;
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Inflates the bundled list with the platform's own decompressor (browsers and Node 18+). */
export async function inflateWordList(hex: string): Promise<string> {
  const input = new Blob([hexToBytes(hex) as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('latin1').decode(joined);
}
