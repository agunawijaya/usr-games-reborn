import {
  BFLAG,
  BORDER,
  BLACK,
  C_LOOP,
  C_OPEN_0,
  C_OPEN_1,
  type CampbellBoard,
  type Colour,
  Combo,
  comboA,
  comboB,
  comboOf,
  Completion,
  EMPTY,
  FFLAG,
  FFLAGALL,
  MAXA,
  MAXCOMBO,
  MFLAG,
  MFLAGALL,
  type Spot,
  u8,
  WHITE,
} from './board';
import type { CRandom } from './glibc-random';

/**
 * The 1994 player's move, ported from the original's `pickmove.c` (Ralph Campbell, the Regents of
 * the University of California, BSD licence; see LICENSES/ and CREDITS.md).
 *
 * How it thinks: every frame (five or six spots in a line) has a combo value <a, b> — `a` moves to
 * make it unstoppable, `b` moves to win after that. It walks the frames of each colour, best first,
 * gives every empty spot the best value of any frame through it, and combines frames that cross at
 * an empty spot into combos of two, then three and more (up to half the moves played, so it thinks
 * shallowly early on), each with its own <a, b>. The spot with the best value for the side to move
 * wins, unless the other side is one move from an unstoppable combo that ours cannot beat to the
 * finish, in which case it blocks. Ties go to the frames' weights, then to a coin.
 *
 * The port mirrors the original's structure, names in comments, to be checked against it move for
 * move (see `pickmove.test.ts`). Two things are added for Fivefold and leave its choices alone: a
 * cap on the combo depth (the gentler players think less far ahead) and a record of what it
 * weighed, for "Read the board".
 */

const MAXDEPTH = 100;

export interface Thinking {
  /** Spot values after the scan, per colour: the best combo value and how many frames make it. */
  combo: [Uint16Array, Uint16Array];
  level: [Uint8Array, Uint8Array];
  /** Frames found to be part of a combo one move from unstoppable, by colour: [vertex, dir]. */
  forcing: [number, number][][];
  /** The best spot for each colour, and the one chosen. */
  best: [number, number];
  chosen: number;
  /** True when the move blocks the other side rather than pressing its own. */
  blocking: boolean;
}

export interface PickOptions {
  /** The deepest combination looked for (the original: no cap but half the moves played). */
  maxDepth?: number;
  /**
   * How many combinations of three frames or more each side may build before the deeper search
   * stops (the original: no cap). Combinations of two are always all made: they find the forcing
   * moves.
   */
  maxWork?: number;
}

export class CampbellPlayer {
  private readonly hashCombos: (Combo | null)[];
  private sortCombos: Combo | null = null;
  private comboLength = 0;
  private nextColour: Colour = BLACK;
  private readonly forceMap: Int32Array;
  private readonly tmpMap: Int32Array;
  private forceCount = 0;
  private colour: Colour = BLACK;
  private level = 0;
  private readonly einfo = Array.from({ length: MAXDEPTH }, () => new Completion());
  private readonly ecombo: (Combo | null)[] = Array.from({ length: MAXDEPTH }, () => null);
  /** What the last call weighed. */
  thinking: Thinking | null = null;
  /** Combinations of three frames or more built in the last call, both sides together. */
  lastWork = 0;
  private work = 0;
  private budget = Number.POSITIVE_INFINITY;

  constructor(
    private readonly bd: CampbellBoard,
    private readonly random: CRandom,
  ) {
    this.hashCombos = Array.from({ length: bd.frameArea }, () => null);
    const mapSize = Math.floor(bd.area / 32);
    this.forceMap = new Int32Array(mapSize);
    this.tmpMap = new Int32Array(mapSize);
  }

  private bitSet(map: Int32Array, b: number): void {
    map[b >> 5]! |= 1 << (b & 31);
  }

  private bitTest(map: Int32Array, b: number): boolean {
    return (map[b >> 5]! & (1 << (b & 31))) !== 0;
  }

  /** The original's `pickmove`: the spot to play for `us`. */
  pick(us: Colour, options: PickOptions = {}): number {
    const bd = this.bd;
    const spots = bd.spots;
    const centre = (bd.size + 1) >> 1;
    if (bd.moveNumber === 1) return bd.pt(centre, centre);

    const top = bd.pt(bd.size, bd.size + 1);
    const first = bd.pt(1, 1);
    for (let i = top; --i >= first;) {
      const sp = spots[i]!;
      sp.combo[BLACK] = MAXCOMBO + 1;
      sp.combo[WHITE] = MAXCOMBO + 1;
      sp.level[BLACK] = 255;
      sp.level[WHITE] = 255;
      sp.forces[BLACK] = 0;
      sp.forces[WHITE] = 0;
      sp.flags &= ~(FFLAGALL | MFLAGALL);
    }
    this.forceCount = 0;
    this.forceMap.fill(0);

    this.nextColour = us;
    this.budget = options.maxWork ?? Number.POSITIVE_INFINITY;
    this.lastWork = 0;
    this.scanFrames(BLACK, options.maxDepth ?? Infinity);
    this.scanFrames(WHITE, options.maxDepth ?? Infinity);

    // The best spot for each colour.
    let sp1 = bd.pt(bd.size, bd.size);
    let sp2 = sp1;
    for (let i = sp1; --i >= first;) {
      if (spots[i]!.occupant !== EMPTY) continue;
      if (this.better(i, sp1, BLACK)) sp1 = i;
      if (this.better(i, sp2, WHITE)) sp2 = i;
    }
    const bestBlack = sp1;
    const bestWhite = sp2;
    let ours: number;
    let theirs: number;
    if (us === BLACK) {
      ours = spots[sp1]!.combo[BLACK];
      theirs = spots[sp2]!.combo[WHITE];
    } else {
      theirs = spots[sp1]!.combo[BLACK];
      ours = spots[sp2]!.combo[WHITE];
      [sp1, sp2] = [sp2, sp1];
    }
    // Block theirs only if they are one move from an unstoppable combo and ours cannot win first.
    const blocking =
      comboA(theirs) <= 1 &&
      (comboA(ours) > 1 || comboA(theirs) + comboB(theirs) < comboA(ours) + comboB(ours));
    const chosen = blocking ? sp2 : sp1;
    this.record(bestBlack, bestWhite, chosen, blocking);
    return chosen;
  }

  /** The original's `better`: is spot `s` a better move than `s1` for `us`? */
  private better(s: number, s1: number, us: Colour): boolean {
    const sp = this.bd.spots[s]!;
    const sp1 = this.bd.spots[s1]!;
    if (sp.combo[us] < sp1.combo[us]) return true;
    if (sp.combo[us] !== sp1.combo[us]) return false;
    if (sp.level[us] < sp1.level[us]) return true;
    if (sp.level[us] !== sp1.level[us]) return false;
    if (sp.forces[us] > sp1.forces[us]) return true;
    if (sp.forces[us] !== sp1.forces[us]) return false;
    const them = us === BLACK ? WHITE : BLACK;
    const f = this.bitTest(this.forceMap, s);
    const f1 = this.bitTest(this.forceMap, s1);
    if (f && !f1) return true;
    if (!f && f1) return false;
    if (sp.combo[them] < sp1.combo[them]) return true;
    if (sp.combo[them] !== sp1.combo[them]) return false;
    if (sp.level[them] < sp1.level[them]) return true;
    if (sp.level[them] !== sp1.level[them]) return false;
    if (sp.forces[them] > sp1.forces[them]) return true;
    if (sp.forces[them] !== sp1.forces[them]) return false;
    if (sp.weight > sp1.weight) return true;
    if (sp.weight !== sp1.weight) return false;
    return (this.random.next() & 1) === 1;
  }

  /**
   * The original's `scanframes`: values every empty spot from the frames of `colour`, and
   * combines frames into ever larger combos while there are new ones and moves enough.
   */
  private scanFrames(colour: Colour, maxDepth: number): void {
    const bd = this.bd;
    const spots = bd.spots;
    this.colour = colour;
    let cbp = bd.sortedFrames[colour];
    if (!cbp) return;

    // A quick look for four in a row.
    let start = spots[cbp.vertex]!;
    const firstValue = start.frameValue[colour]![cbp.dir]!;
    if (firstValue < 0x101) {
      const d = bd.dd[cbp.dir]!;
      let s = cbp.vertex;
      for (let i = 5 + comboB(firstValue); --i >= 0; s += d) {
        const sp = spots[s]!;
        if (sp.occupant !== EMPTY) continue;
        sp.combo[colour] = firstValue;
        sp.level[colour] = 1;
      }
      return;
    }

    // Every spot of every frame takes the frame's value, and tries pairing it with crossing ones.
    let n = this.comboLength;
    const ecbp = cbp;
    do {
      let s = cbp.vertex;
      start = spots[s]!;
      const r = cbp.dir;
      const cp = start.frameValue[colour]![r]!;
      const d = bd.dd[r]!;
      let cb: number;
      let i: number;
      if (comboB(cp)) {
        // The first spot of an open frame: treated as a closed frame.
        cb = comboOf(comboA(cp) + 1, 0);
        if (cb < start.combo[colour]) {
          start.combo[colour] = cb;
          start.level[colour] = 1;
        }
        this.makeCombo2(cbp, s, 0, cb);
        if (cp !== 0x101) cb = cp;
        else if (colour !== this.nextColour) this.tmpMap.fill(0);
        s += d;
        i = 1;
      } else {
        cb = cp;
        i = 0;
      }
      for (; i < 5; i++, s += d) {
        const sp = spots[s]!;
        if (sp.occupant !== EMPTY) continue;
        if (cp < sp.combo[colour]) {
          sp.combo[colour] = cp;
          sp.level[colour] = 1;
        }
        if (cp === 0x101) {
          sp.forces[colour] = u8(sp.forces[colour] + 1);
          if (colour !== this.nextColour) {
            // The original keeps this spot in the variable that also counts the combos found so
            // far, so for the side not to move the deeper search below often stops at once.
            // Kept: it is part of how the 1994 player plays.
            n = s;
            this.bitSet(this.tmpMap, s);
          }
        }
        this.makeCombo2(cbp, s, i, cb);
      }
      if (cp === 0x101 && colour !== this.nextColour) {
        if (this.forceCount === 0) this.forceMap.set(this.tmpMap);
        else for (let k = 0; k < this.forceMap.length; k++) this.forceMap[k]! &= this.tmpMap[k]!;
      }
      spots[cbp.vertex]!.flags |= MFLAG << r;
    } while ((cbp = cbp.next!) !== ecbp);

    // Combos of three frames, four, and on, no deeper than half the moves played so far.
    let depth = 2;
    this.work = 0;
    while (
      depth <= (bd.moveNumber + 1) >> 1 &&
      depth <= maxDepth &&
      this.comboLength > n &&
      this.work < this.budget
    ) {
      n = this.comboLength;
      this.addFrames(depth);
      depth++;
    }

    // The combos waiting at empty spots set those spots' values.
    const top = bd.pt(bd.size, bd.size + 1);
    const first = bd.pt(1, 1);
    for (let i = top; --i >= first;) {
      const sp = spots[i]!;
      for (let ep = sp.empty; ep; ep = ep.next) this.takeCombo(sp, ep.combo!, colour);
      sp.empty = null;
      for (let ep = sp.nextEmpty; ep; ep = ep.next) this.takeCombo(sp, ep.combo!, colour);
      sp.nextEmpty = null;
    }
    this.sortCombos = null;
    this.comboLength = 0;
    this.lastWork += this.work;
  }

  /** A spot takes a combo's value if it is better, or as good with fewer frames. */
  private takeCombo(sp: Spot, cbp: Combo, colour: Colour): void {
    if (cbp.value <= sp.combo[colour]) {
      if (cbp.value !== sp.combo[colour]) {
        sp.combo[colour] = cbp.value;
        sp.level[colour] = cbp.frameCount;
      } else if (cbp.frameCount < sp.level[colour]) sp.level[colour] = cbp.frameCount;
    }
  }

  /** The original's `makecombo2`: every combo of two frames crossing at spot `osp`. */
  private makeCombo2(ocbp: Combo, osp: number, off: number, s: number): void {
    const bd = this.bd;
    const spots = bd.spots;
    const ocb = s;
    const baseB = comboA(ocb) + comboB(ocb) - 1;
    const fcnt = comboA(ocb) - 2;
    const emask = fcnt ? (comboB(ocb) ? 0x1e : 0x1f) & ~(1 << off) : 0;
    for (let r = 4; --r >= 0;) {
      // Not frames in the same line.
      if (r === ocbp.dir) continue;
      const d = bd.dd[r]!;
      // Not frames already paired (A with B is B with A), dead ones, or ones already forcing.
      const bmask = (BFLAG | FFLAG | MFLAG) << r;
      let fsp = osp;
      for (let f = 0; f < 5; f++, fsp -= d) {
        const fs = spots[fsp]!;
        if (fs.occupant === BORDER) break;
        if (fs.flags & bmask) continue;
        let fcb = fs.frameValue[this.colour]![r]!;
        if (comboA(fcb) >= MAXA) continue;
        // At a frame's end spot, its closed value.
        if ((f === 0 && comboB(fcb)) || fcb === 0x101) fcb = comboOf(comboA(fcb) + 1, 0);

        const c = comboA(fcb) + comboA(ocb) - 3;
        if (c > 4) continue;
        let n = comboA(fcb) + comboB(fcb) - 1;
        if (baseB < n) n = baseB;

        const ncbp = new Combo(-1);
        const fcbp = fs.frame[r]!;
        ncbp.sorted = ocbp.index < fcbp.index ? [ocbp, fcbp] : [fcbp, ocbp];
        ncbp.value = comboOf(c, n);
        ncbp.link = [ocbp, fcbp];
        ncbp.linkValue = [ocb, fcb];
        ncbp.vertexOffset = [u8(off), u8(f)];
        ncbp.vertex = osp;
        ncbp.frameCount = 2;
        ncbp.dir = 0;
        ncbp.frameIndex = 0;
        ncbp.flags = comboB(ocb) ? C_OPEN_0 : 0;
        if (comboB(fcb)) ncbp.flags |= C_OPEN_1;
        ncbp.framesLeft = [u8(fcnt), u8(comboA(fcb) - 2)];
        ncbp.emptyMask = [
          u8(emask),
          ncbp.framesLeft[1] ? u8((comboB(fcb) ? 0x1e : 0x1f) & ~(1 << f)) : 0,
        ];
        if (c > 1) {
          this.makeEmpty(ncbp);
          this.appendCombo(ncbp);
        } else this.updateCombo(ncbp, this.colour);
      }
    }
  }

  /** The original's `addframes`: tries adding one more frame to every combo of `level` frames. */
  private addFrames(level: number): void {
    const bd = this.bd;
    const spots = bd.spots;
    this.level = level;
    const colour = this.colour;

    const top = bd.pt(bd.size, bd.size + 1);
    const first = bd.pt(1, 1);
    for (let i = top; --i >= first;) {
      const sp = spots[i]!;
      for (let ep = sp.empty; ep; ep = ep.next) this.takeCombo(sp, ep.combo!, colour);
      sp.empty = sp.nextEmpty;
      sp.nextEmpty = null;
    }

    let cbp = bd.sortedFrames[colour]!;
    const ecbp = cbp;
    do {
      const fsp = cbp.vertex;
      const fs = spots[fsp]!;
      const r = cbp.dir;
      // Not frames already part of a forcing combo.
      if (fs.flags & (FFLAG << r)) continue;
      // A forcing frame counts as a closed three here.
      let fcb = fs.frameValue[colour]![r]!;
      if (fcb === 0x101) fcb = 0x200;
      if (fs.occupant === EMPTY) {
        const cb = comboB(fcb) ? comboOf(comboA(fcb) + 1, 0) : fcb;
        this.makeCombo(cbp, fsp, 0, cb);
      }
      const d = bd.dd[r]!;
      let s = fsp + d;
      for (let i = 1; i < 5; i++, s += d) {
        if (spots[s]!.occupant !== EMPTY) continue;
        this.makeCombo(cbp, s, i, fcb);
      }
    } while ((cbp = cbp.next!) !== ecbp);

    // Everything found at this level joins the list for the next.
    for (let k = this.hashCombos.length; --k >= 0;) {
      const head = this.hashCombos[k];
      if (!head) continue;
      this.hashCombos[k] = null;
      const list = this.sortCombos;
      if (!list) this.sortCombos = head;
      else {
        const tail = list.prev!;
        tail.next = head;
        list.prev = head.prev;
        head.prev!.next = list;
        head.prev = tail;
      }
    }
  }

  /** The original's `makecombo`: every combo of a waiting combo plus frame `ocbp` at `osp`. */
  private makeCombo(ocbp: Combo, osp: number, off: number, s: number): void {
    const bd = this.bd;
    const ocb = s;
    const baseB = comboA(ocb) + comboB(ocb) - 1;
    const fcnt = comboA(ocb) - 2;
    const emask = fcnt ? (comboB(ocb) ? 0x1e : 0x1f) & ~(1 << off) : 0;
    const vertices = { intersect: 0, offset: 0, frameIndex: 0 };
    for (let ep = bd.spots[osp]!.empty; ep; ep = ep.next) {
      if (this.work >= this.budget) return;
      const cbp = ep.combo!;
      const verts = this.checkFrames(cbp, ocbp, osp, s, vertices);
      if (verts < 0) continue;

      // A loop is only valid if the new frame meets the combo at one of its completion spots.
      if (verts) {
        let found = false;
        for (let nep = bd.spots[vertices.intersect]!.empty; nep; nep = nep.next) {
          if (nep.combo === cbp) {
            found = true;
            break;
          }
          if (nep.combo!.frameCount < cbp.frameCount) break;
        }
        if (!found) continue;
      }

      const c = comboA(cbp.value) + comboA(ocb) - verts - 3;
      if (c > 4) continue;
      let n = comboA(ep.frameValue) + comboB(ep.frameValue) - 1;
      if (baseB < n) n = baseB;

      const ncbp = new Combo(-1);
      if (this.sortCombo(ncbp, cbp.sorted, ocbp)) continue;
      this.work++;

      ncbp.value = comboOf(c, n);
      ncbp.link = [cbp, ocbp];
      ncbp.linkValue[1] = ocb;
      ncbp.vertexOffset[1] = u8(off);
      ncbp.vertex = osp;
      ncbp.frameCount = u8(cbp.frameCount + 1);
      ncbp.flags = comboB(ocb) ? C_OPEN_1 : 0;
      ncbp.frameIndex = ep.frameIndex;
      ncbp.framesLeft[0] = ep.framesLeft;
      ncbp.emptyMask[0] = ep.emptyMask;
      if (verts) {
        ncbp.flags |= C_LOOP;
        ncbp.dir = vertices.frameIndex;
        ncbp.framesLeft[1] = u8(fcnt - 1);
        if (ncbp.framesLeft[1]) {
          const at = Math.trunc((vertices.intersect - ocbp.vertex) / bd.dd[ocbp.dir]!);
          ncbp.emptyMask[1] = u8(emask & ~(1 << at));
        } else ncbp.emptyMask[1] = 0;
        ncbp.vertexOffset[0] = vertices.offset;
      } else {
        ncbp.dir = 0;
        ncbp.framesLeft[1] = u8(fcnt);
        ncbp.emptyMask[1] = u8(emask);
        ncbp.vertexOffset[0] = ep.offset;
      }
      if (c > 1) {
        this.makeEmpty(ncbp);
        this.comboLength++;
      } else this.updateCombo(ncbp, this.colour);
    }
  }

  /**
   * The original's `makeempty`: lists `ocbp` at every empty spot that would bring it a move closer
   * to complete. The loops' bookkeeping (frames that close back on an earlier frame) follows the
   * original exactly.
   */
  private makeEmpty(ocbp: Combo): void {
    const bd = this.bd;
    const nframes = ocbp.frameCount;
    if (nframes >= MAXDEPTH) return;
    const einfo = this.einfo;
    const ecombo = this.ecombo;

    let ep = nframes;
    let cbpp = nframes;
    let cbp = ocbp;
    for (; cbp.link[1] !== null; cbp = cbp.link[0]!) {
      const e = einfo[--ep]!;
      e.combo = cbp;
      ecombo[--cbpp] = cbp.link[1];
      e.offset = cbp.vertexOffset[1];
      e.frameIndex = cbp.frameIndex;
      e.frameValue = cbp.linkValue[1];
      e.framesLeft = cbp.framesLeft[1];
      e.emptyMask = cbp.emptyMask[1];
    }
    cbp = einfo[ep]!.combo!;
    const bottom = einfo[--ep]!;
    bottom.combo = cbp;
    ecombo[cbpp - 1] = cbp.link[0];
    bottom.offset = cbp.vertexOffset[0];
    bottom.frameIndex = 0;
    bottom.frameValue = cbp.linkValue[0];
    bottom.framesLeft = cbp.framesLeft[0];
    bottom.emptyMask = cbp.emptyMask[0];

    // Bring the masks up to date, level by level.
    let loops = 0;
    for (let i = 2, e = ep + 2; i < nframes; i++, e++) {
      const c = einfo[e]!.combo!;
      let nep = einfo[einfo[e]!.frameIndex]!;
      nep.framesLeft = c.framesLeft[0];
      nep.emptyMask = c.emptyMask[0];
      if (c.flags & C_LOOP) {
        loops++;
        // This frame closes back on an earlier one.
        nep = einfo[c.dir]!;
        nep.framesLeft = u8(nep.framesLeft - 1);
        if (nep.framesLeft) nep.emptyMask = u8(nep.emptyMask & ~(1 << c.vertexOffset[0]));
        else nep.emptyMask = 0;
      }
    }

    // A loop one move from complete counts its intersection spots too.
    if (loops && comboA(ocbp.value) === 2) {
      let e = nframes;
      do {
        e--;
        const c = einfo[e]!.combo!;
        if (!(c.flags & C_LOOP)) continue;
        const loopTo = c.dir;
        einfo[loopTo]!.framesLeft = 1;
        einfo[loopTo]!.emptyMask = u8(1 << c.vertexOffset[0]);
        einfo[e]!.framesLeft = 1;
        einfo[e]!.emptyMask = u8(1 << einfo[e]!.offset);
        e = einfo[e]!.frameIndex;
        do {
          einfo[e]!.framesLeft = 1;
          einfo[e]!.emptyMask = u8(1 << einfo[e]!.offset);
          e = einfo[e]!.frameIndex;
        } while (e > loopTo);
      } while (e !== 0);
    }

    // Every empty spot that helps complete a frame of the combo gets told.
    for (let i = 0; i < nframes; i++) {
      const info = einfo[i]!;
      const emask = info.emptyMask;
      if (emask === 0) continue;
      const frame = ecombo[i]!;
      let s = frame.vertex;
      const d = bd.dd[frame.dir]!;
      for (let k = 0, m = 1; k < 5; k++, s += d, m <<= 1) {
        const sp = bd.spots[s]!;
        if (sp.occupant !== EMPTY || !(emask & m)) continue;
        const nep = new Completion();
        nep.combo = ocbp;
        nep.offset = k;
        nep.frameIndex = i;
        if (info.framesLeft > 1) {
          nep.framesLeft = u8(info.framesLeft - 1);
          nep.emptyMask = u8(emask & ~m);
        } else {
          nep.framesLeft = 0;
          nep.emptyMask = 0;
        }
        nep.frameValue = info.frameValue;
        nep.next = sp.nextEmpty;
        sp.nextEmpty = nep;
      }
    }
  }

  /**
   * The original's `updatecombo`, for a combo one move from unstoppable. For the side about to
   * move, the spot that completes it is worth that much; for the other side, every spot of its
   * frames is a place to block it, and only spots that block every such combo are in the force
   * map.
   */
  private updateCombo(top: Combo, colour: Colour): void {
    const bd = this.bd;
    const spots = bd.spots;
    let flg = 0;
    const a = comboA(top.value);
    const nframes = top.frameCount;
    let cb = 0;
    if (colour !== this.nextColour) this.tmpMap.fill(0);

    const visit = (s: number) => {
      const sp = spots[s]!;
      sp.forces[colour] = u8(sp.forces[colour] + 1);
      if (cb <= sp.combo[colour]) {
        if (cb !== sp.combo[colour]) {
          sp.combo[colour] = cb;
          sp.level[colour] = nframes;
        } else if (nframes < sp.level[colour]) sp.level[colour] = nframes;
      }
    };

    let cbp = top;
    for (let tcbp = cbp.link[1]; tcbp !== null; cbp = cbp.link[0]!, tcbp = cbp.link[1]) {
      flg = cbp.flags;
      cb = comboOf(a, comboB(cbp.value));
      if (colour === this.nextColour) visit(cbp.vertex);
      else {
        let s = tcbp.vertex;
        const d = bd.dd[tcbp.dir]!;
        for (let i = flg & C_OPEN_1 ? 6 : 5; --i >= 0; s += d) {
          if (spots[s]!.occupant !== EMPTY) continue;
          visit(s);
          this.bitSet(this.tmpMap, s);
        }
      }
      spots[tcbp.vertex]!.flags |= FFLAG << tcbp.dir;
    }

    if (colour !== this.nextColour) {
      let s = cbp.vertex;
      const d = bd.dd[cbp.dir]!;
      for (let i = flg & C_OPEN_0 ? 6 : 5; --i >= 0; s += d) {
        if (spots[s]!.occupant !== EMPTY) continue;
        visit(s);
        this.bitSet(this.tmpMap, s);
      }
      if (this.forceCount === 0) this.forceMap.set(this.tmpMap);
      else for (let k = 0; k < this.forceMap.length; k++) this.forceMap[k]! &= this.tmpMap[k]!;
      this.forceCount++;
    }
    spots[cbp.vertex]!.flags |= FFLAG << cbp.dir;
  }

  /** The original's `appendcombo`. */
  private appendCombo(cbp: Combo): void {
    this.comboLength++;
    const list = this.sortCombos;
    if (!list) {
      this.sortCombos = cbp;
      cbp.next = cbp;
      cbp.prev = cbp;
      return;
    }
    const tail = list.prev!;
    cbp.next = list;
    cbp.prev = tail;
    list.prev = cbp;
    tail.next = cbp;
  }

  /**
   * The original's `checkframes`: 0 if frame `fcbp` can join combo `cbp` as a tree, positive if
   * it would close a valid loop (with the other intersection in `vertices`), −1 if it may not.
   */
  private checkFrames(
    cbp: Combo,
    fcbp: Combo,
    osp: number,
    s: number,
    vertices: { intersect: number; offset: number; frameIndex: number },
  ): number {
    const bd = this.bd;
    const area = bd.frameArea;
    let lcbp: Combo | null = null;
    let flg = 0;
    const cb = s;
    const fcnt = comboA(cb) - 2;
    let verts = 0;
    let index = cbp.frameCount;
    const row = fcbp.index * area;
    const i = comboB(cb) ? 2 : 0;
    let n = 0;
    for (
      let tcbp = cbp.link[1];
      tcbp !== null;
      lcbp = cbp, cbp = cbp.link[0]!, tcbp = cbp.link[1]
    ) {
      if (tcbp === fcbp) return -1;
      index--;
      const mask = bd.overlap[row + tcbp.index]!;
      flg = cbp.flags;
      n = i + (flg & C_OPEN_1 ? 1 : 0);
      if (mask & (1 << n)) {
        // Two frames in one line meeting at more than one spot are not independent.
        if (tcbp.dir === fcbp.dir && mask & (0x10 << n)) return -1;
        const at = bd.intersect[row + tcbp.index]!;
        if (osp !== at) {
          if (verts) return -1;
          if (fcnt === 0 || cbp.framesLeft[1] === 0) return -1;
          // Not at the far ends of an open frame.
          const dt = bd.dd[tcbp.dir]!;
          if (flg & C_OPEN_1 && (at === tcbp.vertex || at === tcbp.vertex + 5 * dt)) return -1;
          const df = bd.dd[fcbp.dir]!;
          if (comboB(cb) && (at === fcbp.vertex || at === fcbp.vertex + 5 * df)) return -1;
          vertices.intersect = at;
          vertices.offset = u8(Math.trunc((at - tcbp.vertex) / dt));
          vertices.frameIndex = u8(index);
          verts++;
        }
      }
      n = i + (flg & C_OPEN_0 ? 1 : 0);
    }
    if (cbp === fcbp) return -1;

    const mask = bd.overlap[row + cbp.index]!;
    if (mask & (1 << n)) {
      if (cbp.dir === fcbp.dir && mask & (0x10 << n)) return -1;
      const at = bd.intersect[row + cbp.index]!;
      if (osp !== at) {
        if (verts) return -1;
        if (fcnt === 0 || lcbp!.framesLeft[0] === 0) return -1;
        const dc = bd.dd[cbp.dir]!;
        if (flg & C_OPEN_0 && (at === cbp.vertex || at === cbp.vertex + 5 * dc)) return -1;
        const df = bd.dd[fcbp.dir]!;
        if (comboB(cb) && (at === fcbp.vertex || at === fcbp.vertex + 5 * df)) return -1;
        vertices.intersect = at;
        vertices.offset = u8(Math.trunc((at - cbp.vertex) / dc));
        vertices.frameIndex = 0;
        verts++;
      }
    }
    return verts;
  }

  /**
   * The original's `sortcombo`: the frames of `cbp` with `fcbp` merged in, in order, into
   * `ncbp.sorted`; true if that set of frames has been seen already, otherwise it is hashed.
   */
  private sortCombo(ncbp: Combo, frames: readonly Combo[], fcbp: Combo): boolean {
    const count = this.level;
    const merged: Combo[] = new Array<Combo>(count + 1);
    let spp = count + 1;
    let cpp = count;
    let inserted = false;
    do {
      cpp--;
      if (fcbp.index > frames[cpp]!.index) {
        merged[--spp] = fcbp;
        do merged[--spp] = frames[cpp]!;
        while (cpp-- !== 0);
        inserted = true;
        break;
      }
      merged[--spp] = frames[cpp]!;
    } while (cpp !== 0);
    if (!inserted) merged[spp - 1] = fcbp;
    ncbp.sorted = merged;

    const key = merged[0]!.index;
    const head = this.hashCombos[key];
    if (!head) {
      this.hashCombos[key] = ncbp;
      ncbp.next = ncbp.prev = ncbp;
      return false;
    }
    let cbp = head;
    do {
      const other = cbp.sorted;
      let same = true;
      // The first frame is always the same.
      for (let k = count; k >= 1; k--) {
        if (merged[k] !== other[k]) {
          same = false;
          break;
        }
      }
      if (same) return true;
    } while ((cbp = cbp.next!) !== head);
    const tail = head.prev!;
    ncbp.next = head;
    ncbp.prev = tail;
    head.prev = ncbp;
    tail.next = ncbp;
    return false;
  }

  /** What this pick weighed, for Fivefold's "Read the board". */
  private record(bestBlack: number, bestWhite: number, chosen: number, blocking: boolean): void {
    const bd = this.bd;
    const combo: [Uint16Array, Uint16Array] = [new Uint16Array(bd.area), new Uint16Array(bd.area)];
    const level: [Uint8Array, Uint8Array] = [new Uint8Array(bd.area), new Uint8Array(bd.area)];
    const forcing: [number, number][][] = [[], []];
    bd.spots.forEach((sp, i) => {
      for (const c of [BLACK, WHITE] as const) {
        combo[c][i] = sp.combo[c];
        level[c][i] = sp.level[c];
      }
      for (let r = 0; r < 4; r++) {
        if (!(sp.flags & (FFLAG << r)) || (sp.flags & (BFLAG << r)) !== 0) continue;
        for (const c of [BLACK, WHITE] as const)
          if (sp.frameValue[c]![r]! < MAXCOMBO) forcing[c]!.push([i, r]);
      }
    });
    this.thinking = { combo, level, forcing, best: [bestBlack, bestWhite], chosen, blocking };
  }
}
