import { type Board, boxCount, boxEdges, edgeBoxes, type Player, sidesDrawn } from './board';

/**
 * The shape of a position, the way a strong player reads it: chains and loops of boxes that
 * already have two sides drawn. Drawing any line into a chain hands its boxes over one after
 * another; a loop is a chain that closes on itself. Chains of three or more boxes are "long":
 * whoever must open the first of them usually loses the rest, unless they know the double
 * cross (taking all but two boxes of a chain and leaving the last two to keep control).
 */

export type ComponentKind = 'chain' | 'loop';

export interface Component {
  readonly kind: ComponentKind;
  /** Its boxes in order along the chain (or round the loop). */
  readonly boxes: readonly number[];
  /** Some of its boxes have three sides drawn: they can be taken right now. */
  readonly open: boolean;
}

export function isLong(component: Component): boolean {
  return component.kind === 'loop' ? component.boxes.length >= 4 : component.boxes.length >= 3;
}

/** The free edge two boxes share, or −1. */
function sharedFreeEdge(board: Board, a: number, b: number): number {
  const edges = boxEdges(board, a);
  for (const edge of boxEdges(board, b)) {
    if (edges.includes(edge) && !board.drawn[edge]) return edge;
  }
  return -1;
}

/** The unclaimed boxes across each free side of a box (a side on the border leads nowhere). */
function freeNeighbours(board: Board, box: number): number[] {
  const neighbours: number[] = [];
  for (const edge of boxEdges(board, box)) {
    if (board.drawn[edge]) continue;
    for (const other of edgeBoxes(board, edge)) if (other !== box) neighbours.push(other);
  }
  return neighbours;
}

/**
 * Every chain and loop on the board. A box belongs to one when it is unclaimed and has two or
 * three sides drawn; boxes with fewer are "joints" where several ways meet, and end chains.
 */
export function components(board: Board): Component[] {
  const inChain = (box: number) => board.owner[box] === -1 && sidesDrawn(board, box) >= 2;
  const seen = new Uint8Array(boxCount(board));
  const result: Component[] = [];
  for (let start = 0; start < boxCount(board); start++) {
    if (seen[start] || !inChain(start)) continue;
    // Gather the connected group through shared free edges.
    const group: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const box = stack.pop()!;
      group.push(box);
      for (const next of freeNeighbours(board, box)) {
        if (!seen[next] && inChain(next) && sharedFreeEdge(board, box, next) >= 0) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    result.push(describe(board, group));
  }
  return result;
}

function describe(board: Board, group: number[]): Component {
  const links = (box: number) => freeNeighbours(board, box).filter((n) => group.includes(n));
  const open = group.some((box) => sidesDrawn(board, box) === 3);
  // A loop: every box has exactly two free sides, both leading to boxes of the group.
  const closedRing =
    group.length >= 4 &&
    group.every((box) => sidesDrawn(board, box) === 2 && links(box).length === 2);
  if (closedRing) return { kind: 'loop', boxes: walk(group[0]!, links), open };
  // A chain: walk from an end (a box with at most one link inside the group).
  const end = group.find((box) => links(box).length <= 1) ?? group[0]!;
  return { kind: 'chain', boxes: walk(end, links), open };
}

function walk(start: number, links: (box: number) => number[]): number[] {
  const order = [start];
  const visited = new Set([start]);
  let current = start;
  for (;;) {
    const next = links(current).find((n) => !visited.has(n));
    if (next === undefined) return order;
    order.push(next);
    visited.add(next);
    current = next;
  }
}

/** Drawing this edge gives nothing away: no box ends up with three sides. */
export function isSafe(board: Board, edge: number): boolean {
  if (board.drawn[edge]) return false;
  return edgeBoxes(board, edge).every((box) => sidesDrawn(board, box) <= 1);
}

export function safeEdges(board: Board): number[] {
  const edges: number[] = [];
  for (let edge = 0; edge < board.drawn.length; edge++) if (isSafe(board, edge)) edges.push(edge);
  return edges;
}

export function dotCount(board: Pick<Board, 'columns' | 'rows'>): number {
  return (board.columns + 1) * (board.rows + 1);
}

/**
 * Berlekamp's long chain rule: the player who moved first wants dots plus long chains to come
 * out even; the other player wants it odd. Whoever the rule favours, on the chains as they stand,
 * is on course to keep control at the end.
 */
export function controlOnCourse(board: Board, firstPlayer: Player): Player {
  const longChains = components(board).filter((c) => isLong(c) && c.kind === 'chain').length;
  const even = (dotCount(board) + longChains) % 2 === 0;
  return even ? firstPlayer : ((1 - firstPlayer) as Player);
}
