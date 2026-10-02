import { type Board, indexOf, isSolid, landing } from './board';
import type { PlannedDigit } from './game';
import { type Cell, DIRS, type Dir, OPPOSITE } from './geometry';

/**
 * The fill solver: proves a fill puzzle can be finished, by finding a list of moves that fills
 * the box. It searches depth first on a compact copy of the rules (the same order of a move as
 * the engine: tail, look ahead, bite, head in) with moves undone in place, and prunes hard:
 *
 * - a planned digit whose cell is under the body when it comes up ends the line (in play it
 *   would land somewhere random, and a puzzle's proof may not rely on luck);
 * - moves are capped, and positions already searched with as many moves left are skipped;
 * - a move either grows the noodle or, when it has nothing to digest, moves the tail; every free
 *   cell needs a growing move, so under the cap only so many hungry moves are left to spend, and
 *   the next digit must be reachable on the growth still to come plus those;
 * - once no hungry move is left (or more growth is coming than there are free cells), the tail
 *   will never move again, so the rest must be one path through every free cell: the free cells
 *   have to hang together, and at most one of them may be a dead end.
 *
 * Moves are tried most constrained first (Warnsdorff's rule), which finds snake-like fills
 * quickly. Budgets count positions, never time, so a run repeats exactly.
 */

/** Positions remembered at most. */
const MEMORY = 400_000;

export interface FillPuzzleSpec {
  board: Board;
  /** Head first. */
  body: readonly Cell[];
  heading: Dir;
  plan: readonly PlannedDigit[];
}

export interface SolveOptions {
  /** Give up after visiting this many positions. */
  budget: number;
  /** Never use more moves than this. */
  maxMoves: number;
}

export interface SolveResult {
  moves: Dir[] | null;
  nodes: number;
  /** True when the budget ran out before an answer was found. */
  gaveUp: boolean;
}

interface Search {
  board: Board;
  open: Uint8Array;
  occupied: Uint8Array;
  /** The body as a ring of cell indexes, from tail to head. */
  ring: Int32Array;
  tail: number;
  head: number;
  length: number;
  growing: number;
  heading: Dir;
  plan: readonly { value: number; at: number }[];
  next: number;
  openCount: number;
  path: Dir[];
  nodes: number;
  budget: number;
  maxMoves: number;
  /** Position key → the most moves that were left when it was searched. */
  seen: Map<number, number>;
}

export function solveFill(spec: FillPuzzleSpec, options: SolveOptions): SolveResult {
  const { board } = spec;
  if (board.tunnels.size > 0 || board.flow.size > 0)
    throw new Error('The fill solver handles boxes of soil and rock only');
  const cells = board.width * board.height;
  const open = new Uint8Array(cells);
  board.terrain.forEach((t, i) => (open[i] = isSolid(t) ? 0 : 1));
  const capacity = board.openCount + 1;
  const ring = new Int32Array(capacity);
  const occupied = new Uint8Array(cells);
  // Tail first in the ring.
  [...spec.body].reverse().forEach((c, i) => {
    ring[i] = indexOf(board, c);
    occupied[ring[i]!] = 1;
  });
  const search: Search = {
    board,
    open,
    occupied,
    ring,
    tail: 0,
    head: spec.body.length - 1,
    length: spec.body.length,
    growing: 0,
    heading: spec.heading,
    plan: spec.plan.map((d) => {
      if (!d.at) throw new Error('Every digit of a fill puzzle needs its cell');
      return { value: d.value, at: indexOf(board, d.at) };
    }),
    next: 0,
    openCount: board.openCount,
    path: [],
    nodes: 0,
    budget: options.budget,
    maxMoves: options.maxMoves,
    seen: new Map(),
  };
  if (search.plan.length === 0 || occupied[search.plan[0]!.at])
    return { moves: null, nodes: 0, gaveUp: false };
  const found = dfs(search);
  return {
    moves: found ? [...search.path] : null,
    nodes: search.nodes,
    gaveUp: !found && search.nodes >= search.budget,
  };
}

function headCell(s: Search): number {
  return s.ring[s.head]!;
}

function cellOf(s: Search, index: number): Cell {
  return { x: index % s.board.width, y: Math.floor(index / s.board.width) };
}

function dfs(s: Search): boolean {
  if (s.length === s.openCount) return true;
  if (++s.nodes >= s.budget) return false;
  const movesLeft = s.maxMoves - s.path.length;
  const free = s.openCount - s.length;
  // Every free cell still needs a growing move to cover it; the moves to spare are hungry ones,
  // which move the tail instead.
  const hungryLeft = movesLeft - free;
  if (hungryLeft < 0) return false;
  const digit = s.plan[s.next];
  if (!digit && s.growing === 0) return false;
  // The way to the next digit is paid for in growth still to come, then in hungry moves.
  if (digit && distance(s, headCell(s), digit.at) > s.growing + hungryLeft) return false;
  // With no hungry move left (or more growth to come than free cells) the tail never moves again.
  if ((hungryLeft === 0 || s.growing >= free) && !onePathLeft(s)) return false;
  const key = positionKey(s);
  if ((s.seen.get(key) ?? -1) >= movesLeft) return false;
  // The memory is bounded; past it the search simply stops remembering.
  if (s.seen.size < MEMORY) s.seen.set(key, movesLeft);

  for (const dir of orderedMoves(s)) {
    const undo = play(s, dir);
    if (!undo) continue;
    s.path.push(dir);
    if (dfs(s)) return true;
    s.path.pop();
    undo();
    if (s.nodes >= s.budget) return false;
  }
  return false;
}

/** Plays one move on the search state; returns how to take it back, or null if it loses. */
function play(s: Search, dir: Dir): (() => void) | null {
  if (dir === OPPOSITE[s.heading] && s.length > 1) return null;
  const from = headCell(s);
  const capacity = s.ring.length;
  const previousHeading = s.heading;
  let freedTail = -1;
  if (s.growing === 0) {
    freedTail = s.ring[s.tail]!;
    s.occupied[freedTail] = 0;
    s.tail = (s.tail + 1) % capacity;
    s.length--;
  } else s.growing--;

  const to = landing(s.board, cellOf(s, from), dir);
  const toIndex =
    to.x >= 0 && to.y >= 0 && to.x < s.board.width && to.y < s.board.height
      ? indexOf(s.board, to)
      : -1;
  const digit = s.plan[s.next];
  const eats = digit !== undefined && toIndex === digit.at;
  const blocked = toIndex < 0 || !s.open[toIndex] || s.occupied[toIndex] === 1;
  // A planned digit that would come up under the body is a dead end for the proof.
  const nextDigit = eats ? s.plan[s.next + 1] : undefined;
  const lands = !nextDigit || (s.occupied[nextDigit.at] === 0 && nextDigit.at !== toIndex);
  const restoreTail = () => {
    if (freedTail >= 0) {
      s.tail = (s.tail - 1 + capacity) % capacity;
      s.ring[s.tail] = freedTail;
      s.occupied[freedTail] = 1;
      s.length++;
    } else s.growing++;
  };
  if ((blocked && !eats) || !lands) {
    restoreTail();
    return null;
  }
  s.head = (s.head + 1) % capacity;
  s.ring[s.head] = toIndex;
  s.occupied[toIndex] = 1;
  s.length++;
  s.heading = dir;
  if (eats) {
    s.growing += digit.value;
    s.next++;
  }
  return () => {
    if (eats) {
      s.growing -= digit!.value;
      s.next--;
    }
    s.heading = previousHeading;
    s.occupied[toIndex] = 0;
    s.length--;
    s.head = (s.head - 1 + capacity) % capacity;
    restoreTail();
  };
}

function freeNeighbours(s: Search, index: number): number {
  let count = 0;
  const cell = cellOf(s, index);
  for (const dir of DIRS) {
    const n = landing(s.board, cell, dir);
    if (n.x < 0 || n.y < 0 || n.x >= s.board.width || n.y >= s.board.height) continue;
    const i = indexOf(s.board, n);
    if (s.open[i] && !s.occupied[i]) count++;
  }
  return count;
}

/** Most constrained first; between equals, the move that gets closer to the digit. */
function orderedMoves(s: Search): Dir[] {
  const from = cellOf(s, headCell(s));
  const target = s.plan[s.next];
  const goal = target ? cellOf(s, target.at) : null;
  const scored: { dir: Dir; score: number }[] = [];
  for (const dir of DIRS) {
    if (dir === OPPOSITE[s.heading]) continue;
    const to = landing(s.board, from, dir);
    if (to.x < 0 || to.y < 0 || to.x >= s.board.width || to.y >= s.board.height) continue;
    const i = indexOf(s.board, to);
    if (!s.open[i]) continue;
    const towards = goal ? Math.abs(goal.x - to.x) + Math.abs(goal.y - to.y) : 0;
    scored.push({ dir, score: freeNeighbours(s, i) * 100 + towards });
  }
  return scored.sort((a, b) => a.score - b.score).map((m) => m.dir);
}

/** Steps from one cell to another through open cells, ignoring the body: a lower bound. */
function distance(s: Search, from: number, to: number): number {
  if (from === to) return 0;
  const seen = new Uint8Array(s.open.length);
  let frontier = [from];
  seen[from] = 1;
  for (let d = 1; frontier.length > 0; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const cell = cellOf(s, i);
      for (const dir of DIRS) {
        const n = landing(s.board, cell, dir);
        if (n.x < 0 || n.y < 0 || n.x >= s.board.width || n.y >= s.board.height) continue;
        const j = indexOf(s.board, n);
        if (seen[j] || !s.open[j]) continue;
        if (j === to) return d;
        seen[j] = 1;
        next.push(j);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/**
 * With the tail fixed for good, can one path from the head still take in every free cell? The
 * free cells must all be reachable, and at most one of them (the path's end) may have a single
 * way in that is not the head.
 */
function onePathLeft(s: Search): boolean {
  const start = headCell(s);
  const free = s.openCount - s.length;
  if (free === 0) return true;
  const seen = new Uint8Array(s.open.length);
  const queue = [start];
  seen[start] = 1;
  let reached = 0;
  let deadEnds = 0;
  while (queue.length > 0) {
    const i = queue.pop()!;
    const cell = cellOf(s, i);
    let exits = 0;
    let touchesHead = false;
    for (const dir of DIRS) {
      const n = landing(s.board, cell, dir);
      if (n.x < 0 || n.y < 0 || n.x >= s.board.width || n.y >= s.board.height) continue;
      const j = indexOf(s.board, n);
      if (j === start) touchesHead = true;
      if (!s.open[j] || s.occupied[j]) continue;
      exits++;
      if (!seen[j]) {
        seen[j] = 1;
        queue.push(j);
      }
    }
    if (i === start) continue;
    reached++;
    if (exits === 0 && !touchesHead) return false;
    if (exits <= 1 && !(touchesHead && exits === 1)) deadEnds++;
    if (deadEnds > 1) return false;
  }
  return reached === free;
}

/**
 * The whole position (body in order, what is still to digest, which digit is next) folded into
 * one number by two 32-bit FNV-1a hashes. A collision could only skip a line of search, never
 * accept a wrong answer, and at these sizes it is vanishingly unlikely.
 */
function positionKey(s: Search): number {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const mix = (value: number) => {
    a = Math.imul(a ^ value, 0x01000193);
    b = Math.imul(b ^ (value + 0x9e3779b9), 0x85ebca6b);
  };
  mix(s.growing);
  mix(s.next);
  for (let k = 0, at = s.tail; k < s.length; k++, at = (at + 1) % s.ring.length) mix(s.ring[at]!);
  return (a >>> 0) * 0x200000 + ((b >>> 0) & 0x1fffff);
}
