import { decodeWordList } from '../dictionary/codec';
import type { Tier } from '../dictionary/tiers';

/**
 * The dictionary as a letter tree in flat typed arrays: each node keeps its first child and its
 * next sibling, so a 76 000-word list fits in a few megabytes and builds in tens of milliseconds.
 * Node 0 is the root. `NONE` marks a missing link.
 */
export const NONE = -1;
const NOT_A_WORD = 255;

export class Trie {
  private constructor(
    private readonly letter: Uint8Array,
    private readonly firstChild: Int32Array,
    private readonly nextSibling: Int32Array,
    /** The word's tier when a word ends at this node, else NOT_A_WORD. */
    private readonly ending: Uint8Array,
    readonly words: number,
  ) {}

  /** Builds the tree from the bundled front-coded text (see codec.ts). */
  static fromEncoded(text: string): Trie {
    const builder = new TrieBuilder(text.length);
    decodeWordList(text, (word, tier) => builder.add(word, tier));
    return builder.finish();
  }

  static fromWords(words: readonly { word: string; tier: Tier }[]): Trie {
    const builder = new TrieBuilder(words.length * 4);
    for (const { word, tier } of [...words].sort((a, b) => (a.word < b.word ? -1 : 1))) {
      builder.add(word, tier);
    }
    return builder.finish();
  }

  static create(
    letter: Uint8Array,
    firstChild: Int32Array,
    nextSibling: Int32Array,
    ending: Uint8Array,
    words: number,
  ): Trie {
    return new Trie(letter, firstChild, nextSibling, ending, words);
  }

  /** The child of `node` reached by `code` (0 for `a` … 25 for `z`), or NONE. */
  child(node: number, code: number): number {
    let edge = this.firstChild[node]!;
    while (edge !== NONE) {
      const letter = this.letter[edge]!;
      if (letter === code) return edge;
      // Children are kept in alphabetical order, so a larger letter ends the search.
      if (letter > code) return NONE;
      edge = this.nextSibling[edge]!;
    }
    return NONE;
  }

  /** Follows a run of letters; NONE as soon as the tree has no such prefix. */
  walk(node: number, letters: string): number {
    let at = node;
    for (let i = 0; i < letters.length && at !== NONE; i++) {
      at = this.child(at, letters.charCodeAt(i) - 97);
    }
    return at;
  }

  isWord(node: number): boolean {
    return this.ending[node] !== NOT_A_WORD;
  }

  tierAt(node: number): Tier {
    return this.ending[node] as Tier;
  }

  hasChildren(node: number): boolean {
    return this.firstChild[node] !== NONE;
  }

  has(word: string): boolean {
    const node = this.walk(0, word);
    return node !== NONE && this.isWord(node);
  }

  tierOf(word: string): Tier | null {
    const node = this.walk(0, word);
    return node !== NONE && this.isWord(node) ? this.tierAt(node) : null;
  }

  get nodes(): number {
    return this.letter.length;
  }
}

/** Grows the arrays while sorted words stream in; a sorted stream only ever appends children. */
class TrieBuilder {
  private letter: Uint8Array;
  private firstChild: Int32Array;
  private nextSibling: Int32Array;
  private ending: Uint8Array;
  private lastChild: Int32Array;
  private count = 1;
  private words = 0;

  constructor(estimate: number) {
    const capacity = Math.max(1024, estimate);
    this.letter = new Uint8Array(capacity);
    this.firstChild = new Int32Array(capacity).fill(NONE);
    this.nextSibling = new Int32Array(capacity).fill(NONE);
    this.ending = new Uint8Array(capacity).fill(NOT_A_WORD);
    this.lastChild = new Int32Array(capacity).fill(NONE);
  }

  add(word: string, tier: Tier) {
    let node = 0;
    for (let i = 0; i < word.length; i++) {
      const code = word.charCodeAt(i) - 97;
      const last = this.lastChild[node]!;
      if (last !== NONE && this.letter[last] === code) {
        node = last;
        continue;
      }
      const created = this.allocate(code);
      if (last === NONE) this.firstChild[node] = created;
      else this.nextSibling[last] = created;
      this.lastChild[node] = created;
      node = created;
    }
    if (this.ending[node] === NOT_A_WORD) this.words++;
    this.ending[node] = tier;
  }

  finish(): Trie {
    const n = this.count;
    return Trie.create(
      this.letter.slice(0, n),
      this.firstChild.slice(0, n),
      this.nextSibling.slice(0, n),
      this.ending.slice(0, n),
      this.words,
    );
  }

  private allocate(code: number): number {
    if (this.count === this.letter.length) this.grow();
    const node = this.count++;
    this.letter[node] = code;
    return node;
  }

  private grow() {
    const size = this.letter.length * 2;
    const grown = <T extends Uint8Array | Int32Array>(old: T, fill: number): T => {
      const next = new (old.constructor as new (length: number) => T)(size);
      next.fill(fill);
      next.set(old);
      return next;
    };
    this.letter = grown(this.letter, 0);
    this.firstChild = grown(this.firstChild, NONE);
    this.nextSibling = grown(this.nextSibling, NONE);
    this.ending = grown(this.ending, NOT_A_WORD);
    this.lastChild = grown(this.lastChild, NONE);
  }
}
