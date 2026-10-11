import type { Tier } from '../dictionary/tiers';
import { type Board, neighbours, QU, type Rule } from './grid';
import { NONE, type Trie } from './trie';

/**
 * Finds every dictionary word on a board, the "computer's list" the 1988 program compared you
 * against. Each word keeps one path, for tracing it on the grid.
 */

export interface BoardWord {
  word: string;
  path: number[];
  tier: Tier;
}

export interface SolveOptions {
  rule: Rule;
  minLetters: number;
}

/** Trie node after reading a cube's face from `node`: `qu` faces read two letters. */
function readFace(trie: Trie, node: number, face: string): number {
  if (face === QU) {
    const q = trie.child(node, 16);
    return q === NONE ? NONE : trie.child(q, 20);
  }
  return trie.child(node, face.charCodeAt(0) - 97);
}

export function solveBoard(board: Board, trie: Trie, options: SolveOptions): BoardWord[] {
  const found = new Map<string, BoardWord>();
  const record = (node: number, word: string, path: number[]) => {
    if (word.length >= options.minLetters && trie.isWord(node) && !found.has(word)) {
      found.set(word, { word, path: [...path], tier: trie.tierAt(node) });
    }
  };
  if (options.rule === 'classic') solveWithoutReuse(board, trie, record);
  else solveWithReuse(board, trie, options.rule, record);
  return [...found.values()].sort(byLengthThenAlphabet);
}

export function byLengthThenAlphabet(a: { word: string }, b: { word: string }): number {
  return b.word.length - a.word.length || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
}

type Recorder = (node: number, word: string, path: number[]) => void;

/** Classic rules: a depth-first walk that never steps on a cube already in the word. */
function solveWithoutReuse(board: Board, trie: Trie, record: Recorder) {
  const links = neighbours(board.size);
  const used = new Uint8Array(board.faces.length);
  const path: number[] = [];
  const visit = (cube: number, node: number, word: string) => {
    const face = board.faces[cube]!;
    const next = readFace(trie, node, face);
    if (next === NONE) return;
    const spelled = word + face;
    used[cube] = 1;
    path.push(cube);
    record(next, spelled, path);
    if (trie.hasChildren(next)) {
      for (const neighbour of links[cube]!) if (!used[neighbour]) visit(neighbour, next, spelled);
    }
    path.pop();
    used[cube] = 0;
  };
  for (let cube = 0; cube < board.faces.length; cube++) visit(cube, 0, '');
}

/**
 * Echo and Mirror: whether a word can continue from a cube depends only on that cube and the
 * letters so far, never on the cubes before it. So each (prefix, cube) pair is explored once,
 * which keeps reuse from multiplying the work on a 6×6 grid.
 */
function solveWithReuse(board: Board, trie: Trie, rule: Rule, record: Recorder) {
  const links = neighbours(board.size);
  const cubes = board.faces.length;
  const explored = new Set<number>();
  const path: number[] = [];
  const visit = (cube: number, node: number, word: string) => {
    const face = board.faces[cube]!;
    const next = readFace(trie, node, face);
    if (next === NONE) return;
    const state = next * cubes + cube;
    if (explored.has(state)) return;
    explored.add(state);
    const spelled = word + face;
    path.push(cube);
    record(next, spelled, path);
    if (trie.hasChildren(next)) {
      for (const neighbour of links[cube]!) visit(neighbour, next, spelled);
      if (rule === 'mirror') visit(cube, next, spelled);
    }
    path.pop();
  };
  for (let cube = 0; cube < cubes; cube++) visit(cube, 0, '');
}

/**
 * Every path that spells `letters` on the board under the rule, ignoring the dictionary: what
 * the keyboard highlights while a word is being typed. Capped, because Mirror boards can spell
 * a run of one letter in many ways.
 */
export function pathsSpelling(board: Board, rule: Rule, letters: string, limit = 48): number[][] {
  const results: number[][] = [];
  if (!letters) return results;
  const links = neighbours(board.size);
  const path: number[] = [];
  const visit = (cube: number, offset: number) => {
    if (results.length >= limit) return;
    const face = board.faces[cube]!;
    if (!letters.startsWith(face, offset)) {
      // A typed lone `q` may still be heading for a `qu` face.
      if (!(face === QU && offset === letters.length - 1 && letters[offset] === 'q')) return;
    }
    if (rule === 'classic' && path.includes(cube)) return;
    path.push(cube);
    const reached = Math.min(letters.length, offset + face.length);
    if (reached >= letters.length) results.push([...path]);
    else {
      for (const neighbour of links[cube]!) visit(neighbour, reached);
      if (rule === 'mirror') visit(cube, reached);
    }
    path.pop();
  };
  for (let cube = 0; cube < board.faces.length; cube++) visit(cube, 0);
  return results;
}
