// Derived from dab's algor.cc, NetBSD games (2003), by Christos Zoulas.
//   Copyright (c) 2003 The NetBSD Foundation, Inc. All rights reserved.
//   Licence: LICENSES/BSD-NetBSD-Foundation.txt (four-clause BSD).
//   This product includes software developed by the NetBSD Foundation, Inc. and its contributors.

import { BOTTOM, LEFT, RIGHT, type Board, type Side, TOP, sideEdge, boxAt } from '../engine/board';
import { Permutation, Rand48 } from '../engine/rand48';

/**
 * Greedy Gus: the original's computer (`algor.cc`, Christos Zoulas, 2003), ported line by line.
 * In order it
 *
 * 1. closes every box it can, starting from the first three-sided box its scan finds;
 * 2. otherwise draws an edge that leaves no box with three sides, trying directions in a random
 *    order "to randomise the game";
 * 3. otherwise gives away as few boxes as it can, judging each giveaway on a scratch board that
 *    keeps the earlier trial moves (so the judging depends on the order of the scan).
 *
 * It never declines boxes to keep control: it never plays the double cross.
 *
 * The scans use the original's `RANDOM`, reseeded from the clock every time one is made or
 * cleared; `clock` stands for that clock's seconds, so a given board and clock always give the
 * original's own choice.
 */

/** The original's direction steps (`box.cc`): top, bottom, left, right as (dx, dy). */
const STEP: readonly { readonly dx: number; readonly dy: number }[] = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const SIDES: readonly Side[] = [TOP, BOTTOM, LEFT, RIGHT];

export interface Place {
  readonly y: number;
  readonly x: number;
  readonly dir: Side;
}

/** The original's `BOARD`: a scratch copy the computer draws trial moves on. */
class Scratch {
  readonly drawn: Uint8Array;

  constructor(
    private readonly board: Pick<Board, 'columns' | 'rows'>,
    drawn: Uint8Array,
  ) {
    this.drawn = drawn.slice();
  }

  get nx() {
    return this.board.columns;
  }

  get ny() {
    return this.board.rows;
  }

  copy(): Scratch {
    return new Scratch(this.board, this.drawn);
  }

  bounds(y: number, x: number): boolean {
    return y >= 0 && x >= 0 && y < this.ny && x < this.nx;
  }

  edge(y: number, x: number, dir: Side): number {
    return sideEdge(this.board, boxAt(this.board, y, x), dir);
  }

  isSet(y: number, x: number, dir: Side): boolean {
    return this.drawn[this.edge(y, x, dir)] === 1;
  }

  count(y: number, x: number): number {
    let sides = 0;
    for (const dir of SIDES) sides += this.isSet(y, x, dir) ? 1 : 0;
    return sides;
  }

  /** `BOARD::domove`: −1 for an edge already there, else how many boxes it closed. */
  move(y: number, x: number, dir: Side): number {
    if (!this.bounds(y, x) || this.isSet(y, x, dir)) return -1;
    this.drawn[this.edge(y, x, dir)] = 1;
    let closed = this.count(y, x) === 4 ? 1 : 0;
    const by = y + STEP[dir]!.dy;
    const bx = x + STEP[dir]!.dx;
    if (this.bounds(by, bx) && this.count(by, bx) === 4) closed++;
    return closed;
  }
}

class InternalError extends Error {
  constructor(message: string) {
    super(`Greedy Gus lost his way: ${message}`);
  }
}

class Algorithm {
  private readonly generator = new Rand48();

  constructor(private readonly clock: number) {}

  private permutation(size: number): Permutation {
    return new Permutation(size, this.generator, this.clock);
  }

  /** `find_closure`: the first box with three sides in the scan, and its free side. */
  private findClosure(b: Scratch): Place | null {
    const rows = this.permutation(b.ny);
    const columns = this.permutation(b.nx);
    for (let y = rows.next(); y < b.ny; y = rows.next()) {
      columns.clear();
      for (let x = columns.next(); x < b.nx; x = columns.next()) {
        if (b.count(y, x) !== 3) continue;
        for (const dir of SIDES) if (!b.isSet(y, x, dir)) return { y, x, dir };
        throw new InternalError(`box ${y},${x} is ready to close but has no free side`);
      }
    }
    return null;
  }

  /** `count_closure`: closes everything closable on `b`; the boxes closed and where it began. */
  private countClosure(b: Scratch): { boxes: number; first: Place | null } {
    let boxes = 0;
    let first: Place | null = null;
    for (let place = this.findClosure(b); place; place = this.findClosure(b)) {
      if (boxes === 0) first = place;
      const closed = b.move(place.y, place.x, place.dir);
      if (closed === -1)
        throw new InternalError('a closing line could not be drawn while counting');
      boxes += closed;
    }
    return { boxes, first };
  }

  /** `find_max_closure`: in practice the first closure found, counting every box it leads to. */
  private findMaxClosure(board: Scratch): { boxes: number; place: Place | null } {
    const b = board.copy();
    let best = { boxes: 0, place: null as Place | null };
    for (let found = this.countClosure(b); found.boxes !== 0; found = this.countClosure(b)) {
      if (found.boxes > best.boxes) best = { boxes: found.boxes, place: found.first };
    }
    return best;
  }

  /** `try_good_turn`: a free side of a box with under two sides that gives nothing away. */
  private tryGoodTurn(b: Scratch, y: number, x: number): Side | null {
    if (b.count(y, x) >= 2)
      throw new InternalError(
        `box ${y},${x} was asked for a quiet line with two sides already drawn`,
      );
    const order = this.permutation(4);
    for (let dir = order.next(); dir < 4; dir = order.next()) {
      const side = dir as Side;
      if (b.isSet(y, x, side)) continue;
      const by = y + STEP[side]!.dy;
      const bx = x + STEP[side]!.dx;
      if (!b.bounds(by, bx)) return side;
      if (b.count(by, bx) < 2) return side;
    }
    return null;
  }

  /** `find_good_turn`: the first such edge in the scan. */
  private findGoodTurn(board: Scratch): Place | null {
    const b = board.copy();
    const rows = this.permutation(b.ny);
    const columns = this.permutation(b.nx);
    for (let y = rows.next(); y < b.ny; y = rows.next()) {
      columns.clear();
      for (let x = columns.next(); x < b.nx; x = columns.next()) {
        if (b.count(y, x) >= 2) continue;
        const dir = this.tryGoodTurn(b, y, x);
        if (dir !== null) return { y, x, dir };
      }
    }
    return null;
  }

  /** `try_bad_turn`: the free side numbered `last` (0, 1 or 2) of a box. */
  private tryBadTurn(b: Scratch, y: number, x: number, last: number): Side | null {
    if (4 - b.count(y, x) <= last)
      throw new InternalError(`box ${y},${x} has too few free sides to give away ${last}`);
    let skip = last;
    for (const dir of SIDES) {
      if (b.isSet(y, x, dir)) continue;
      if (skip === 0) return dir;
      skip--;
    }
    return null;
  }

  private findBadTurn(b: Scratch, last: number): Place | null {
    const rows = this.permutation(b.ny);
    const columns = this.permutation(b.nx);
    for (let y = rows.next(); y < b.ny; y = rows.next()) {
      columns.clear();
      for (let x = columns.next(); x < b.nx; x = columns.next()) {
        if (4 - b.count(y, x) <= last) continue;
        const dir = this.tryBadTurn(b, y, x, last);
        if (dir !== null) return { y, x, dir };
      }
    }
    return null;
  }

  /**
   * `find_min_closure1`: plays a giveaway on a scratch board, lets the opponent close what it
   * opened, and keeps going on that same board, remembering the giveaway that gave least (the
   * later one on a tie).
   */
  private findMinClosure1(board: Scratch, last: number): { boxes: number; place: Place | null } {
    const b = board.copy();
    let best = { boxes: b.nx * b.ny + 1, place: null as Place | null };
    for (let trial = this.findBadTurn(b, last); trial; trial = this.findBadTurn(b, last)) {
      const closed = b.move(trial.y, trial.x, trial.dir);
      if (closed !== 0)
        throw new InternalError(`a giving line closed ${closed} boxes on the scratch board`);
      const { boxes } = this.countClosure(b);
      if (boxes === 0)
        throw new InternalError('a giving line left nothing to take on the scratch board');
      if (boxes <= best.boxes) best = { boxes, place: trial };
    }
    return best;
  }

  /** `find_min_closure`: the least giveaway over the first, second and third free sides. */
  private findMinClosure(board: Scratch): Place | null {
    let fewest = board.nx * board.ny + 1;
    let place: Place | null = null;
    for (let last = 0; last < 3; last++) {
      const found = this.findMinClosure1(board, last);
      if (fewest > found.boxes) {
        fewest = found.boxes;
        place = found.place;
      }
    }
    return place;
  }

  /** `ALGOR::play`. */
  play(board: Scratch): Place | null {
    const max = this.findMaxClosure(board);
    if (max.boxes) return max.place;
    const good = this.findGoodTurn(board);
    if (good) return good;
    return this.findMinClosure(board);
  }
}

/** The original computer's choice on this board, with the clock reading `clock` seconds. */
export function greedyGusPlace(board: Board, clock: number): Place | null {
  return new Algorithm(clock).play(new Scratch(board, board.drawn));
}

/** The same choice as an edge number. */
export function greedyGusMove(board: Board, clock: number): number {
  const place = greedyGusPlace(board, clock);
  if (!place) throw new Error('The board is full.');
  return sideEdge(board, boxAt(board, place.y, place.x), place.dir);
}
