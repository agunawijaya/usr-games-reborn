import { loadDictionary } from '../dictionary/load';
import { type Deal, dealBoard, dealDaily, type DealRequest } from '../engine/deal';
import type { Board, Rule } from '../engine/grid';
import { type BoardWord, solveBoard } from '../engine/solver';

/** What the page may ask the solver, and what comes back. Plain data, so it crosses threads. */
export type SolverRequest = { id: number } & (
  | ({ kind: 'deal' } & DealRequest)
  | { kind: 'daily'; seed: string }
  | { kind: 'solve'; board: Board; rule: Rule; minLetters: number }
);

export type SolverAnswer = { id: number } & (
  { kind: 'deal'; deal: Deal } | { kind: 'words'; words: BoardWord[] }
);

export async function answer(request: SolverRequest): Promise<SolverAnswer> {
  const trie = await loadDictionary();
  switch (request.kind) {
    case 'deal':
      return { id: request.id, kind: 'deal', deal: dealBoard(trie, request) };
    case 'daily':
      return { id: request.id, kind: 'deal', deal: dealDaily(trie, request.seed) };
    case 'solve':
      return { id: request.id, kind: 'words', words: solveBoard(request.board, trie, request) };
  }
}
