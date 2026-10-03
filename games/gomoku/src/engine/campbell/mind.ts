import {
  BLACK,
  BORDER,
  CampbellBoard,
  type Colour,
  comboA,
  comboB,
  EMPTY,
  MAXCOMBO,
  WHITE,
} from './board';
import type { CRandom } from './glibc-random';
import { CampbellPlayer, type PickOptions, type Thinking } from './pickmove';

/**
 * What the 1994 player weighed before a move, in Fivefold's point numbers: how strong each point
 * looked for each side, the frames it found forcing, its best point for each side and the one it
 * chose. The replay draws this.
 */
export interface Weighing {
  /**
   * Per point, per side (first player, second): 1 for "one move from unstoppable", about 0.6 for
   * two, a trace for three, 0 for nothing nearer.
   */
  strength: [Float32Array, Float32Array];
  /** Frames (their five points) found part of a forcing combination, per side. */
  forcing: [number[][], number[][]];
  best: [number, number];
  chosen: number;
  /** True when it chose to block rather than press its own attack. */
  blocking: boolean;
}

/** How strong a combination value <a, b> looks: a = moves still needed to make it unstoppable. */
function strengthOf(value: number): number {
  if (value > MAXCOMBO) return 0;
  const a = comboA(value);
  const open = comboB(value) ? 0.08 : 0;
  if (a <= 1) return 1;
  if (a === 2) return 0.6 + open;
  // Three moves away and more is every quiet frame on the board: shown faintly, if at all.
  return a === 3 ? 0.2 + open : 0;
}

/**
 * The 1994 player attached to a Fivefold game: it keeps its own board in step with every move and
 * answers in Fivefold's point numbers (row by row from the top left), translating to the
 * original's (column from the left, row from the bottom, a border all round).
 */
export class CampbellMind {
  readonly board: CampbellBoard;
  private readonly player: CampbellPlayer;

  constructor(
    readonly size: number,
    random: CRandom,
  ) {
    this.board = new CampbellBoard(size);
    this.player = new CampbellPlayer(this.board, random);
  }

  toSpot(p: number): number {
    const x = p % this.size;
    const y = Math.floor(p / this.size);
    return this.board.pt(x + 1, this.size - y);
  }

  fromSpot(spot: number): number {
    const x = (spot % this.board.rowSpan) - 1;
    const y = this.size - Math.floor(spot / this.board.rowSpan);
    return y * this.size + x;
  }

  /** How much combination work the last choice took (see `PickOptions.maxWork`). */
  get lastWork(): number {
    return this.player.lastWork;
  }

  /** Tells the mind a stone was played. */
  played(p: number, black: boolean): void {
    this.board.makeMove(black ? BLACK : WHITE, this.toSpot(p));
  }

  private isEmpty(p: number): boolean {
    return this.board.spots[this.toSpot(p)]!.occupant === EMPTY;
  }

  /**
   * The point the 1994 player would play for `black` or white, and what it weighed. When every
   * point left is dead, the original can name a taken corner (its search starts from one); then
   * the best empty point is played instead.
   */
  choose(black: boolean, options: PickOptions = {}): { point: number; thinking: Thinking | null } {
    const colour: Colour = black ? BLACK : WHITE;
    const spot = this.player.pick(colour, options);
    let point = this.fromSpot(spot);
    if (!this.isEmpty(point)) point = this.ranked(black)[0] ?? point;
    return { point, thinking: this.player.thinking };
  }

  /** Empty points, best first for `black`'s side by the last search: its own threats, then the other side's. */
  ranked(black: boolean): number[] {
    const thinking = this.player.thinking;
    const us = black ? BLACK : WHITE;
    const them = black ? WHITE : BLACK;
    const points: { p: number; key: number; weight: number }[] = [];
    for (let p = 0; p < this.size * this.size; p++) {
      const spot = this.toSpot(p);
      const sp = this.board.spots[spot]!;
      if (sp.occupant !== EMPTY) continue;
      const own = thinking ? thinking.combo[us][spot]! : MAXCOMBO + 1;
      const theirs = thinking ? thinking.combo[them][spot]! : MAXCOMBO + 1;
      // Blocking a threat is worth a little less than making one as strong.
      points.push({ p, key: Math.min(own, theirs + 0x80), weight: sp.weight });
    }
    points.sort((a, b) => a.key - b.key || b.weight - a.weight || a.p - b.p);
    return points.map((e) => e.p);
  }

  /** The last search, translated for the replay. */
  weighing(): Weighing | null {
    const thinking = this.player.thinking;
    if (!thinking) return null;
    const n = this.size * this.size;
    const strength: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
    for (let p = 0; p < n; p++) {
      const spot = this.toSpot(p);
      if (this.board.spots[spot]!.occupant !== EMPTY) continue;
      strength[0][p] = strengthOf(thinking.combo[BLACK][spot]!);
      strength[1][p] = strengthOf(thinking.combo[WHITE][spot]!);
    }
    const forcing: [number[][], number[][]] = [[], []];
    for (const c of [BLACK, WHITE] as const)
      for (const [vertex, dir] of thinking.forcing[c]!) {
        const frame: number[] = [];
        for (let k = 0, s = vertex; k < 5; k++, s += this.board.dd[dir]!) {
          if (this.board.spots[s]!.occupant === BORDER) break;
          frame.push(this.fromSpot(s));
        }
        if (frame.length === 5) forcing[c].push(frame);
      }
    return {
      strength,
      forcing,
      best: [this.fromSpot(thinking.best[0]), this.fromSpot(thinking.best[1])],
      chosen: this.fromSpot(thinking.chosen),
      blocking: thinking.blocking,
    };
  }
}
