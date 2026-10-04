import type { Position } from './position';

/**
 * The endgame as the stronger opponents read it. Once no safe line is left, the board falls
 * into pieces: chains and loops of boxes with two sides drawn. Whoever must move has to open one
 * of them, and the other player either takes it all (and must open the next) or takes all but
 * two (all but four in a loop) and hands those over, keeping control.
 *
 * This is Berlekamp's model of a "simple loony endgame": the pieces are treated as independent,
 * which is exact when no box joins three of them and close enough when one does.
 */

export interface Piece {
  readonly kind: 'chain' | 'loop';
  /** Its boxes in order along the chain or round the loop. */
  readonly boxes: readonly number[];
}

/** The unclaimed box across each free side of a box. */
function links(position: Position, box: number, member: (box: number) => boolean): number[] {
  const out: number[] = [];
  for (const edge of position.freeSides(box)) {
    const other = position.grid.across(edge, box);
    if (other >= 0 && member(other)) out.push(other);
  }
  return out;
}

/** Every chain and loop: unclaimed boxes with two or three sides, joined by free edges. */
export function pieces(position: Position): Piece[] {
  const { sides } = position;
  const member = (box: number) => sides[box] === 2 || sides[box] === 3;
  const seen = new Uint8Array(position.grid.boxes);
  const result: Piece[] = [];
  for (let start = 0; start < position.grid.boxes; start++) {
    if (seen[start] || !member(start)) continue;
    const group: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const box = stack.pop()!;
      group.push(box);
      for (const next of links(position, box, member)) {
        if (!seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    result.push(describe(position, group, member));
  }
  return result;
}

function describe(position: Position, group: number[], member: (box: number) => boolean): Piece {
  const inGroup = new Set(group);
  const inside = (box: number) => links(position, box, member).filter((n) => inGroup.has(n));
  const ring =
    group.length >= 4 &&
    group.every((box) => position.sides[box] === 2 && inside(box).length === 2);
  const start = ring ? group[0]! : (group.find((box) => inside(box).length <= 1) ?? group[0]!);
  const order = [start];
  const visited = new Set(order);
  let current = start;
  for (;;) {
    const next = inside(current).find((n) => !visited.has(n));
    if (next === undefined) break;
    order.push(next);
    visited.add(next);
    current = next;
  }
  return { kind: ring ? 'loop' : 'chain', boxes: order };
}

export function isLongPiece(piece: Piece): boolean {
  return piece.kind === 'loop' ? piece.boxes.length >= 4 : piece.boxes.length >= 3;
}

const values = new Map<string, number>();

/**
 * The value of a simple loony endgame to the player who must open the next piece: their boxes
 * minus the opponent's, from here on, with both sides playing perfectly.
 */
export function loonyValue(chains: readonly number[], loops: readonly number[]): number {
  if (chains.length === 0 && loops.length === 0) return 0;
  const c = [...chains].sort((a, b) => a - b);
  const l = [...loops].sort((a, b) => a - b);
  const key = `${c.join(',')}|${l.join(',')}`;
  const known = values.get(key);
  if (known !== undefined) return known;
  let best = -Infinity;
  for (let i = 0; i < c.length; i++) {
    if (i > 0 && c[i] === c[i - 1]) continue;
    const n = c[i]!;
    const rest = loonyValue([...c.slice(0, i), ...c.slice(i + 1)], l);
    // A chain of one or two is handed over whole (a two is opened in its middle, so it cannot
    // be declined); a longer one lets the taker choose to keep control by declining two boxes.
    const taker = n <= 2 ? n + rest : Math.max(n + rest, n - 4 - rest);
    best = Math.max(best, -taker);
  }
  for (let i = 0; i < l.length; i++) {
    if (i > 0 && l[i] === l[i - 1]) continue;
    const n = l[i]!;
    const rest = loonyValue(c, [...l.slice(0, i), ...l.slice(i + 1)]);
    const taker = Math.max(n + rest, n - 8 - rest);
    best = Math.max(best, -taker);
  }
  if (values.size > 200_000) values.clear();
  values.set(key, best);
  return best;
}

export function piecesValue(found: readonly Piece[]): number {
  const chains: number[] = [];
  const loops: number[] = [];
  for (const piece of found) (piece.kind === 'loop' ? loops : chains).push(piece.boxes.length);
  return loonyValue(chains, loops);
}

/**
 * The endgame between two players who never decline: each opens the smallest piece, the other
 * takes it all and opens the next. The mover gets the second, fourth… smallest pieces.
 */
export function greedyValue(found: readonly Piece[]): number {
  const sizes = found.map((piece) => piece.boxes.length).sort((a, b) => a - b);
  return sizes.reduce((sum, size, i) => sum + (i % 2 === 1 ? size : -size), 0);
}

/**
 * Plays the endgame out the way Greedy Gus does on both sides (take every box, then open the
 * smallest piece) and returns the mover's net boxes. Unlike `greedyValue` it sees what happens
 * where pieces meet: the last box of a chain hands a side to the joint it ends in.
 */
export function greedyPlayout(position: Position): number {
  const drawn: number[] = [];
  let net = 0;
  let sign = 1;
  for (;;) {
    let box = position.firstCapturable();
    while (box >= 0) {
      const edge = position.lastSide(box);
      net += sign * position.draw(edge);
      drawn.push(edge);
      box = position.firstCapturable();
    }
    if (position.free === 0) break;
    const found = pieces(position);
    const smallest = found.reduce<Piece | null>(
      (best, piece) => (!best || piece.boxes.length < best.boxes.length ? piece : best),
      null,
    );
    const edge = smallest ? openingEdge(position, smallest) : position.freeEdgeList()[0]!;
    position.draw(edge);
    drawn.push(edge);
    sign = -sign;
  }
  for (let i = drawn.length - 1; i >= 0; i--) position.undraw(drawn[i]!);
  return net;
}

/** The pieces model as a judge. */
export function judgeByModel(position: Position): number {
  return piecesValue(pieces(position));
}

/**
 * The long chain rule as a rule of thumb: every short piece passes the duty to open on, so the
 * player to move keeps control when the short pieces are odd in number. Without long pieces
 * there is no control to fight for, and the greedy count stands.
 */
export function controlValue(position: Position): number {
  const found = pieces(position);
  const long = found.filter(isLongPiece);
  if (long.length === 0) return greedyValue(found);
  const short = found.length - long.length;
  return short % 2 === 1 ? 100 : -100;
}

/** The line that opens a piece in the way that gives the least away. */
export function openingEdge(position: Position, piece: Piece): number {
  const boxes = piece.boxes;
  const first = boxes[0]!;
  if (piece.kind === 'loop' || boxes.length === 2) {
    // A loop is opened anywhere; a chain of two in its middle, so it cannot be declined.
    return sharedFree(position, first, boxes[1]!);
  }
  // A chain is opened at an end: the first box's free side that leads out of the chain.
  const next = boxes[1];
  for (const edge of position.freeSides(first)) {
    if (next === undefined || position.grid.across(edge, first) !== next) return edge;
  }
  return position.freeSides(first)[0] ?? -1;
}

export function sharedFree(position: Position, a: number, b: number): number {
  for (const edge of position.freeSides(a)) if (position.grid.across(edge, a) === b) return edge;
  return -1;
}

/**
 * What can be taken from a box with three sides: the run of boxes that will fall one after
 * another, and how the run ends.
 */
export interface Handout {
  readonly boxes: readonly number[];
  /** The run ends in another box with three sides: it was opened from both ends, or a loop. */
  readonly bothEnds: boolean;
}

export function handoutFrom(position: Position, start: number): Handout {
  const boxes = [start];
  let previous = -1;
  let current = start;
  for (;;) {
    let next = -1;
    for (const edge of position.freeSides(current)) {
      const other = position.grid.across(edge, current);
      if (other !== previous) next = other;
    }
    if (next < 0 || boxes.includes(next)) return { boxes, bothEnds: false };
    const sides = position.sides[next]!;
    if (sides === 3) return { boxes: [...boxes, next], bothEnds: true };
    if (sides !== 2) return { boxes, bothEnds: false };
    boxes.push(next);
    previous = current;
    current = next;
  }
}

/**
 * The line that hands the last boxes of a run back instead of taking them, when this is the
 * moment for it: two boxes left at the end of a chain, or four left of an opened loop.
 */
export function declineEdge(position: Position, run: Handout): number {
  const { boxes } = run;
  if (!run.bothEnds && boxes.length === 2) {
    const far = boxes[1]!;
    const between = sharedFree(position, boxes[0]!, far);
    return position.freeSides(far).find((edge) => edge !== between) ?? -1;
  }
  if (run.bothEnds && boxes.length === 4) return sharedFree(position, boxes[1]!, boxes[2]!);
  return -1;
}
