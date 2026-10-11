import { Trie } from '../engine/trie';
import { inflateWordList } from './codec';
import { WORDS_DEFLATED } from './words.data';

let loading: Promise<Trie> | null = null;

/** The playable dictionary, inflated and built once per thread (the solver worker, or a test). */
export function loadDictionary(): Promise<Trie> {
  loading ??= inflateWordList(WORDS_DEFLATED).then((text) => Trie.fromEncoded(text));
  return loading;
}
