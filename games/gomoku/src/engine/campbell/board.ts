/**
 * The board of the 1994 Berkeley five-in-a-row program, as its own data: every spot, every
 * "frame" (a run of five spots in one of four directions, six when both ends are open), the value
 * of each frame for each colour, and which frames overlap where. Ported from the original's
 * `bdinit.c` and `makemove.c` (Ralph Campbell, the Regents of the University of California, BSD
 * licence; see LICENSES/ and CREDITS.md) so its player, in `pickmove.ts`, sees exactly what it saw.
 *
 * The port keeps the original's layout and arithmetic on purpose, its byte-sized counters that
 * wrap at 256 included: the reference games in the tests only match move for move that way. The
 * size is a parameter (the original was fixed at 19 × 19).
 *
 * A combo value packs two small numbers, as the original's `union comboval` does: `a`, the moves
 * still needed to make the combo unstoppable, and `b`, the moves needed to win after that.
 */

export const BLACK = 0;
export const WHITE = 1;
export const EMPTY = 2;
export const BORDER = 3;

export type Colour = typeof BLACK | typeof WHITE;

/** What `makeMove` answers. */
export const MOVE_OK = 0;
export const WIN = 3;
export const TIE = 4;
export const ILLEGAL = 2;

/** Flags of a spot, one bit per direction (shifted by the direction, 0–3). */
export const FFLAG = 0x000100; // the frame is part of a combo one move from unstoppable
export const FFLAGALL = 0x000f00;
export const MFLAG = 0x001000; // the frame has been looked at already
export const MFLAGALL = 0x00f000;
export const BFLAG = 0x010000; // the frame runs off the board or holds the other colour
export const BFLAGALL = 0x0f0000;

export const MAXA = 6;
export const MAXCOMBO = 0x600;

/** Flags of a combo. */
export const C_OPEN_0 = 0x01;
export const C_OPEN_1 = 0x02;
export const C_LOOP = 0x04;

export const comboA = (v: number): number => (v >> 8) & 0xff;
export const comboB = (v: number): number => v & 0xff;
export const comboOf = (a: number, b: number): number => ((a & 0xff) << 8) | (b & 0xff);
export const u8 = (v: number): number => v & 0xff;

/** A frame (one of five or six spots) or a combination of intersecting frames. */
export class Combo {
  next: Combo | null = null;
  prev: Combo | null = null;
  link: [Combo | null, Combo | null] = [null, null];
  linkValue: [number, number] = [0, 0];
  value = 0;
  vertex = 0;
  frameCount = 0;
  dir = 0;
  flags = 0;
  frameIndex = 0;
  framesLeft: [number, number] = [0, 0];
  emptyMask: [number, number] = [0, 0];
  vertexOffset: [number, number] = [0, 0];
  /** The frames of a combination, sorted by their place in `frames` (the original's c_sort). */
  sorted: Combo[] = [];
  /** A frame's place in `frames`; −1 for combinations. */
  constructor(readonly index: number) {}
}

/** A spot that would complete a combination (the original's `struct elist`). */
export class Completion {
  next: Completion | null = null;
  combo: Combo | null = null;
  offset = 0;
  frameIndex = 0;
  framesLeft = 0;
  emptyMask = 0;
  frameValue = 0;
}

export class Spot {
  occupant = 0;
  /** A weight: how much the frames through this spot are worth, for breaking ties. */
  weight = 0;
  flags = 0;
  frame: (Combo | null)[] = [null, null, null, null];
  /** Combo value of the frame starting here, by colour and direction. */
  frameValue: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  /** The best (lowest) combo value through this spot, and how many frames make it. */
  combo: [number, number] = [0, 0];
  level: [number, number] = [0, 0];
  /** How many combos one move from unstoppable pass through this spot. */
  forces: [number, number] = [0, 0];
  empty: Completion | null = null;
  nextEmpty: Completion | null = null;
}

/** Weights of a frame by how many of one colour's stones it holds. */
const WEIGHT = [0, 1, 7, 22, 100];

export class CampbellBoard {
  readonly size: number;
  /** Spots per row, the border column included. */
  readonly rowSpan: number;
  readonly area: number;
  readonly frameArea: number;
  /** Steps for the four directions: right, right and down, down, down and left. */
  readonly dd: readonly [number, number, number, number];
  readonly spots: Spot[];
  readonly frames: Combo[];
  readonly sortedFrames: (Combo | null)[] = [null, null];
  readonly overlap: Uint8Array;
  readonly intersect: Int16Array;
  readonly moveLog: number[] = [];
  moveNumber = 1;

  constructor(size = 19) {
    this.size = size;
    this.rowSpan = size + 1;
    this.area = (size + 2) * (size + 1) + 1;
    const runs = size - 4;
    this.frameArea = size * runs * 2 + runs * runs * 2;
    this.dd = [1, 1 - this.rowSpan, -this.rowSpan, -this.rowSpan - 1];
    this.spots = Array.from({ length: this.area }, () => new Spot());
    this.frames = Array.from({ length: this.frameArea }, (_, i) => new Combo(i));
    this.overlap = new Uint8Array(this.frameArea * this.frameArea);
    this.intersect = new Int16Array(this.frameArea * this.frameArea);
    this.init();
  }

  /** The spot number of column `x` (1 = A) and row `y` (1 = the bottom row). */
  pt(x: number, y: number): number {
    return x + this.rowSpan * y;
  }

  /** The original's `bdinit`: borders, empty spots, the starting value of every frame. */
  private init(): void {
    const size = this.size;
    const spots = this.spots;
    this.moveNumber = 1;
    let sp = 0;
    for (let i = size + 2; --i >= 0; sp++) {
      spots[sp]!.occupant = BORDER;
      spots[sp]!.flags = BFLAGALL;
    }
    let frame = 0;
    for (let j = 0; ++j < size + 1; sp++) {
      for (let i = 0; ++i < size + 1; sp++) {
        const s = spots[sp]!;
        s.occupant = EMPTY;
        s.flags = 0;
        s.weight = 0;
        const fv = s.frameValue;
        if (j < 5) {
          // Directions 1, 2 and 3 run off the bottom.
          s.flags |= (BFLAG << 1) | (BFLAG << 2) | (BFLAG << 3);
          for (const c of [0, 1]) fv[c]![1] = fv[c]![2] = fv[c]![3] = MAXCOMBO;
        } else if (j === 5) {
          // Five spaces, closed at one end.
          for (const c of [0, 1]) fv[c]![1] = fv[c]![2] = fv[c]![3] = 0x500;
        } else {
          // Six spaces, open at both ends.
          for (const c of [0, 1]) fv[c]![1] = fv[c]![2] = fv[c]![3] = 0x401;
        }
        if (i > size - 4) {
          s.flags |= BFLAG | (BFLAG << 1);
          for (const c of [0, 1]) fv[c]![0] = fv[c]![1] = MAXCOMBO;
        } else if (i === size - 4) {
          for (const c of [0, 1]) fv[c]![0] = 0x500;
          if (!(s.flags & (BFLAG << 1))) for (const c of [0, 1]) fv[c]![1] = 0x500;
        } else {
          for (const c of [0, 1]) fv[c]![0] = 0x401;
          if (i < 5) {
            s.flags |= BFLAG << 3;
            for (const c of [0, 1]) fv[c]![3] = MAXCOMBO;
          } else if (i === 5 && !(s.flags & (BFLAG << 3))) {
            for (const c of [0, 1]) fv[c]![3] = 0x500;
          }
        }
        // A frame for every direction that stays on the board.
        for (let r = 4; --r >= 0;) {
          if (s.flags & (BFLAG << r)) continue;
          const cbp = this.frames[frame++]!;
          cbp.value = fv[BLACK]![r]!;
          cbp.vertex = sp;
          cbp.frameCount = 1;
          cbp.dir = r;
          s.frame[r] = cbp;
        }
      }
      spots[sp]!.occupant = BORDER;
      spots[sp]!.flags = BFLAGALL;
    }
    for (let i = size + 1; --i >= 0; sp++) {
      spots[sp]!.occupant = BORDER;
      spots[sp]!.flags = BFLAGALL;
    }
    this.sortedFrames[BLACK] = null;
    this.sortedFrames[WHITE] = null;
    this.initOverlap();
  }

  /**
   * The original's `init_overlap`: for every pair of frames, a bit mask of whether they overlap
   * (by whether each is closed or open at its ends, and whether they share more than one spot),
   * and the spot they meet at.
   */
  private initOverlap(): void {
    const { frameArea: area, spots, dd } = this;
    this.overlap.fill(0);
    this.intersect.fill(0);
    for (let a = area; --a >= 0;) {
      const cbp = this.frames[a]!;
      const row = a * area;
      let sp1 = cbp.vertex;
      let vertex = cbp.vertex;
      const d1 = dd[cbp.dir]!;
      const length = 5 + comboB(spots[sp1]!.frameValue[BLACK]![cbp.dir]!);
      for (let i = 0; i < length; i++, sp1 += d1, vertex += d1) {
        // The sixth spot of A only overlaps when A is open.
        const mask = i === 5 ? 0xc : 0xf;
        for (let r = 4; --r >= 0;) {
          const bmask = BFLAG << r;
          let sp2 = sp1;
          const d2 = dd[r]!;
          for (let f = 0; f < 6; f++, sp2 -= d2) {
            const s2 = spots[sp2]!;
            if (s2.occupant === BORDER) break;
            if (s2.flags & bmask) continue;
            const n = s2.frame[r]!.index;
            this.intersect[row + n] = vertex;
            this.overlap[row + n]! |= f === 5 ? mask & 0xa : mask;
            if (r !== cbp.dir) continue;
            // Frames in one line can meet at more than one spot.
            switch (i) {
              case 0:
                if (f === 4) this.overlap[row + n]! |= 0xa0;
                else if (f !== 5) this.overlap[row + n]! |= 0xf0;
                break;
              case 1:
                this.overlap[row + n]! |= f === 5 ? 0xa0 : 0xf0;
                break;
              case 4:
                this.overlap[row + n]! |= f === 0 ? 0xc0 : 0xf0;
                break;
              case 5:
                if (f === 1) this.overlap[row + n]! |= 0xc0;
                else if (f !== 0) this.overlap[row + n]! |= 0xf0;
                break;
              default:
                this.overlap[row + n]! |= 0xf0;
            }
          }
        }
      }
    }
  }

  /**
   * The original's `makemove`: places a stone and brings every frame through it up to date. Five
   * of one colour inside any frame wins, which is why a line of six or more wins too. The game is
   * declared a tie as the board's second-to-last stone goes down, before that stone is checked
   * for five, exactly as in 1994.
   */
  makeMove(us: Colour, mv: number): number {
    const { spots, dd } = this;
    const placed = spots[mv]!;
    if (placed.occupant !== EMPTY) return ILLEGAL;
    placed.occupant = us;
    this.moveLog[this.moveNumber - 1] = mv;
    if (++this.moveNumber === this.size * this.size) return TIE;

    placed.weight = 0;
    for (let r = 4; --r >= 0;) {
      const d = dd[r]!;
      const bmask = BFLAG << r;
      let fsp = mv;
      let reachedBorder = false;
      for (let f = 5; --f >= 0; fsp -= d) {
        const fs = spots[fsp]!;
        if (fs.occupant === BORDER) {
          reachedBorder = true;
          break;
        }
        if (fs.flags & bmask) continue;

        // Take this frame out of the sorted list of frames.
        const cbp = fs.frame[r]!;
        if (cbp.next) {
          if (this.sortedFrames[BLACK] === cbp) this.sortedFrames[BLACK] = cbp.next;
          if (this.sortedFrames[WHITE] === cbp) this.sortedFrames[WHITE] = cbp.next;
          cbp.next.prev = cbp.prev;
          cbp.prev!.next = cbp.next;
        }

        // The frame's old weight.
        let cp = fs.frameValue[BLACK]![r]!;
        let val = cp <= 0x500 ? WEIGHT[5 - comboA(cp) - comboB(cp)]! : 0;
        cp = fs.frameValue[WHITE]![r]!;
        if (cp <= 0x500) val += WEIGHT[5 - comboA(cp) - comboB(cp)]!;

        // Its new value.
        let sp = fsp;
        const space = fs.occupant === EMPTY;
        let n = 0;
        let blocked = false;
        for (let i = 5; --i >= 0; sp += d) {
          const s = spots[sp]!;
          if (s.occupant === us) n++;
          else if (s.occupant === EMPTY) s.weight -= val;
          else {
            // The other colour is in this frame now: it is dead for both.
            fs.flags |= bmask;
            fs.frameValue[BLACK]![r] = MAXCOMBO;
            fs.frameValue[WHITE]![r] = MAXCOMBO;
            while (--i >= 0) {
              sp += d;
              if (spots[sp]!.occupant === EMPTY) spots[sp]!.weight -= val;
            }
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        if (n === 5) return WIN;

        fs.frameValue[us === BLACK ? WHITE : BLACK]![r] = MAXCOMBO;
        const value =
          space && spots[sp]!.occupant === EMPTY ? comboOf(4 - n, 1) : comboOf(5 - n, 0);
        fs.frameValue[us]![r] = value;
        val = WEIGHT[n]!;
        sp = fsp;
        for (let i = 5; --i >= 0; sp += d)
          if (spots[sp]!.occupant === EMPTY) spots[sp]!.weight += val;

        // Put the frame back in the sorted list, by its new value.
        let cbp1 = this.sortedFrames[us];
        if (!cbp1) {
          this.sortedFrames[us] = cbp;
          cbp.next = cbp.prev = cbp;
        } else {
          let cp1 = spots[cbp1.vertex]!.frameValue[us]![cbp1.dir]!;
          if (value <= cp1) this.sortedFrames[us] = cbp;
          else {
            do {
              cbp1 = cbp1.next!;
              cp1 = spots[cbp1.vertex]!.frameValue[us]![cbp1.dir]!;
              if (value <= cp1) break;
            } while (cbp1 !== this.sortedFrames[us]);
          }
          cbp.next = cbp1;
          cbp.prev = cbp1.prev;
          cbp1.prev!.next = cbp;
          cbp1.prev = cbp;
        }
      }
      if (reachedBorder) continue;

      // Both ends open? The frame starting here can no longer use its far end.
      const fs = spots[fsp]!;
      if (fs.occupant === EMPTY) {
        for (const colour of [BLACK, WHITE]) {
          const v = fs.frameValue[colour]![r]!;
          if (comboB(v)) fs.frameValue[colour]![r] = comboOf(comboA(v) + 1, 0);
        }
      }
    }
    this.updateOverlap(mv);
    return MOVE_OK;
  }

  /** The original's `update_overlap`: frames that shared an empty spot at `osp` may not now. */
  private updateOverlap(osp: number): void {
    const { spots, dd, frameArea: area } = this;
    let esp = 0;
    for (let r = 4; --r >= 0;) {
      const d = dd[r]!;
      let sp1 = osp;
      const bmask = BFLAG << r;
      for (let f = 0; f < 6; f++, sp1 -= d) {
        const s1 = spots[sp1]!;
        if (s1.occupant === BORDER) break;
        if (s1.flags & bmask) continue;
        const a = s1.frame[r]!.index;
        const row = a * area;
        let sp2 = sp1 - d;
        for (let i = f + 1; i < 6; i++, sp2 -= d) {
          const s2 = spots[sp2]!;
          if (s2.occupant === BORDER) break;
          if (s2.flags & bmask) continue;
          // Count the empty spots the two frames still share.
          let n = 0;
          let sp = sp1;
          for (let b = i - f; b < 5; b++, sp += d) {
            if (spots[sp]!.occupant === EMPTY) {
              esp = sp;
              n++;
            }
          }
          const b = s2.frame[r]!.index;
          if (n === 0) {
            if (spots[sp]!.occupant === EMPTY) {
              this.overlap[row + b]! &= 0xa;
              this.overlap[b * area + a]! &= 0xc;
              this.intersect[row + b] = sp;
              this.intersect[b * area + a] = sp;
            } else {
              this.overlap[row + b] = 0;
              this.overlap[b * area + a] = 0;
            }
          } else if (n === 1) {
            if (spots[sp]!.occupant === EMPTY) {
              this.overlap[row + b]! &= 0xaf;
              this.overlap[b * area + a]! &= 0xcf;
            } else {
              this.overlap[row + b]! &= 0xf;
              this.overlap[b * area + a]! &= 0xf;
            }
            this.intersect[row + b] = esp;
            this.intersect[b * area + a] = esp;
          }
        }
        // Frames in the other directions can only have met at osp, which is taken now.
        for (let r1 = r; --r1 >= 0;) {
          const d1 = dd[r1]!;
          const bmask1 = BFLAG << r1;
          let sp = osp;
          for (let i = 6; --i >= 0; sp -= d1) {
            const s = spots[sp]!;
            if (s.occupant === BORDER) break;
            if (s.flags & bmask1) continue;
            const b = s.frame[r1]!.index;
            this.overlap[row + b] = 0;
            this.overlap[b * area + a] = 0;
          }
        }
      }
    }
  }
}
