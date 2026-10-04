import { type Board, boxCount, boxEdges, edgeBoxes, edgeCount, type Shape } from '../engine/board';

/**
 * A fast, mutable board for the computer's searches: lines are drawn and rubbed out in place, and
 * every box keeps a count of its drawn sides. The engine's `Board` stays immutable for the game;
 * searches copy it into a `Position` once and then work by draw and undraw.
 */

/** The fixed wiring of a board shape: which boxes each edge touches, which edges each box has. */
export class Grid {
  readonly columns: number;
  readonly rows: number;
  readonly edges: number;
  readonly boxes: number;
  /** Two entries per edge: the boxes on either side, −1 for the outside. */
  readonly edgeBoxes: Int16Array;
  /** Four entries per box: top, bottom, left, right. */
  readonly boxEdges: Int16Array;

  private static readonly cache = new Map<string, Grid>();

  static of(shape: Shape): Grid {
    const key = `${shape.columns}x${shape.rows}`;
    let grid = Grid.cache.get(key);
    if (!grid) {
      grid = new Grid(shape);
      Grid.cache.set(key, grid);
    }
    return grid;
  }

  private constructor(shape: Shape) {
    this.columns = shape.columns;
    this.rows = shape.rows;
    this.edges = edgeCount(shape);
    this.boxes = boxCount(shape);
    this.edgeBoxes = new Int16Array(this.edges * 2).fill(-1);
    for (let edge = 0; edge < this.edges; edge++) {
      edgeBoxes(shape, edge).forEach((box, i) => (this.edgeBoxes[edge * 2 + i] = box));
    }
    this.boxEdges = new Int16Array(this.boxes * 4);
    for (let box = 0; box < this.boxes; box++) {
      boxEdges(shape, box).forEach((edge, i) => (this.boxEdges[box * 4 + i] = edge));
    }
  }

  /** The box across `edge` from `box`, or −1. */
  across(edge: number, box: number): number {
    const a = this.edgeBoxes[edge * 2]!;
    return a === box ? this.edgeBoxes[edge * 2 + 1]! : a;
  }
}

export class Position {
  readonly grid: Grid;
  readonly drawn: Uint8Array;
  /** Drawn sides per box; 4 means the box is taken. */
  readonly sides: Uint8Array;
  free: number;

  constructor(grid: Grid, drawn: Uint8Array) {
    this.grid = grid;
    this.drawn = drawn.slice();
    this.sides = new Uint8Array(grid.boxes);
    this.free = 0;
    for (let edge = 0; edge < grid.edges; edge++) {
      if (!this.drawn[edge]) {
        this.free++;
        continue;
      }
      for (let i = 0; i < 2; i++) {
        const box = grid.edgeBoxes[edge * 2 + i]!;
        if (box >= 0) this.sides[box]!++;
      }
    }
  }

  static from(board: Board): Position {
    return new Position(Grid.of(board), board.drawn);
  }

  copy(): Position {
    return new Position(this.grid, this.drawn);
  }

  /** Draws an edge and returns how many boxes it closed. */
  draw(edge: number): number {
    this.drawn[edge] = 1;
    this.free--;
    let closed = 0;
    for (let i = 0; i < 2; i++) {
      const box = this.grid.edgeBoxes[edge * 2 + i]!;
      if (box >= 0 && ++this.sides[box]! === 4) closed++;
    }
    return closed;
  }

  undraw(edge: number) {
    this.drawn[edge] = 0;
    this.free++;
    for (let i = 0; i < 2; i++) {
      const box = this.grid.edgeBoxes[edge * 2 + i]!;
      if (box >= 0) this.sides[box]!--;
    }
  }

  /** Drawing it leaves no box with three sides. */
  isSafe(edge: number): boolean {
    if (this.drawn[edge]) return false;
    for (let i = 0; i < 2; i++) {
      const box = this.grid.edgeBoxes[edge * 2 + i]!;
      if (box >= 0 && this.sides[box]! >= 2) return false;
    }
    return true;
  }

  safeEdges(): number[] {
    const edges: number[] = [];
    for (let edge = 0; edge < this.grid.edges; edge++) if (this.isSafe(edge)) edges.push(edge);
    return edges;
  }

  freeEdgeList(): number[] {
    const edges: number[] = [];
    for (let edge = 0; edge < this.grid.edges; edge++) if (!this.drawn[edge]) edges.push(edge);
    return edges;
  }

  /** The undrawn side of a three-sided box. */
  lastSide(box: number): number {
    for (let i = 0; i < 4; i++) {
      const edge = this.grid.boxEdges[box * 4 + i]!;
      if (!this.drawn[edge]) return edge;
    }
    return -1;
  }

  /** The free sides of a box. */
  freeSides(box: number): number[] {
    const edges: number[] = [];
    for (let i = 0; i < 4; i++) {
      const edge = this.grid.boxEdges[box * 4 + i]!;
      if (!this.drawn[edge]) edges.push(edge);
    }
    return edges;
  }

  firstCapturable(): number {
    for (let box = 0; box < this.grid.boxes; box++) if (this.sides[box] === 3) return box;
    return -1;
  }

  /** A compact key of the drawn edges, for transposition tables. */
  key(): string {
    let key = '';
    for (let start = 0; start < this.grid.edges; start += 15) {
      let chunk = 0;
      for (let bit = 0; bit < 15 && start + bit < this.grid.edges; bit++) {
        chunk |= this.drawn[start + bit]! << bit;
      }
      key += String.fromCharCode(chunk + 32);
    }
    return key;
  }
}
