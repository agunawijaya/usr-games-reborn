import type { DoubleCrossMoment } from '../render/board-view';

/**
 * When things happened on the board, so a frame can be drawn at any moment: the line being drawn,
 * the boxes filling in, the tubes still flickering on, and the double cross as it plays out.
 * Times are in seconds on the play screen's own clock (which stops while the game is paused).
 */
export const LINE_SECONDS = 0.24;
export const FILL_SECONDS = 0.34;
/** How long a tube flickers and the chalk's last line keeps its glow. */
const FRESH_SECONDS = 1.2;
/** The scissors' run across the chain. */
export const CUT_SECONDS = 0.9;
/** The double cross stays marked this long, while the cascade runs. */
const CROSS_SECONDS = 7;

export interface CrossMark {
  readonly domino: readonly number[];
  readonly cutEdge: number | null;
  readonly start: number;
  /** The player who handed the boxes back, and keeps control. */
  readonly by: 0 | 1;
}

export class Timeline {
  private readonly lines = new Map<number, number>();
  private readonly boxes = new Map<number, number>();
  private latest: { edge: number; start: number } | null = null;
  cross: CrossMark | null = null;
  reducedMotion = false;

  clear() {
    this.lines.clear();
    this.boxes.clear();
    this.latest = null;
    this.cross = null;
  }

  line(edge: number, now: number) {
    this.lines.set(edge, now);
    this.latest = { edge, start: now };
  }

  /** Boxes closed by a line fill in once the line arrives, one after the other. */
  fill(boxes: readonly number[], now: number) {
    boxes.forEach((box, i) => this.boxes.set(box, now + LINE_SECONDS * 0.6 + i * 0.12));
  }

  markCross(domino: readonly number[], cutEdge: number | null, by: 0 | 1, now: number) {
    this.cross = { domino, cutEdge, start: now, by };
  }

  /** The line still being drawn, and how far along it is. */
  drawing(now: number): { edge: number; progress: number } | null {
    if (!this.latest || this.reducedMotion) return null;
    const progress = (now - this.latest.start) / LINE_SECONDS;
    return progress < 1 ? { edge: this.latest.edge, progress: Math.max(0.02, progress) } : null;
  }

  filling(now: number): Map<number, number> {
    const result = new Map<number, number>();
    for (const [box, start] of this.boxes) {
      const progress = this.reducedMotion ? 1 : (now - start) / FILL_SECONDS;
      if (progress >= 1) this.boxes.delete(box);
      else result.set(box, Math.max(0, progress));
    }
    return result;
  }

  ages(now: number): Map<number, number> {
    const result = new Map<number, number>();
    for (const [edge, start] of this.lines) {
      const age = now - start;
      if (age > FRESH_SECONDS) this.lines.delete(edge);
      else result.set(edge, this.reducedMotion ? 1 : Math.max(0, age));
    }
    return result;
  }

  /** Something is still moving on the board. */
  busy(now: number): boolean {
    return (
      this.drawing(now) !== null ||
      [...this.boxes.values()].some((start) => now - start < FILL_SECONDS)
    );
  }

  moment(now: number, trail: readonly number[], falling: number | null): DoubleCrossMoment | null {
    if (!this.cross) return null;
    const age = now - this.cross.start;
    if (age > CROSS_SECONDS) {
      this.cross = null;
      return null;
    }
    return {
      domino: this.cross.domino,
      cutEdge: this.cross.cutEdge,
      cut: this.reducedMotion ? 1 : Math.min(1, age / CUT_SECONDS),
      trail,
      falling,
    };
  }

  /** 0–1–0 over the moment the camera holds on the double cross. */
  hold(now: number): number {
    if (!this.cross || this.reducedMotion) return 0;
    const age = now - this.cross.start;
    if (age > 1.6) return 0;
    return Math.sin((Math.min(age, 1.6) / 1.6) * Math.PI);
  }
}
