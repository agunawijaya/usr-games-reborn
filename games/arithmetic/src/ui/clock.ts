/**
 * An event's stopwatch: it runs only while the player can play, stopping for the Hall's pause,
 * a hidden tab and the short celebrations between items, and it can carry time penalties.
 */
export class EventClock {
  private startedAt: number | null = null;
  private banked = 0;
  private penalty = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  start() {
    if (this.startedAt === null) this.startedAt = this.now();
  }

  stop() {
    if (this.startedAt === null) return;
    this.banked += this.now() - this.startedAt;
    this.startedAt = null;
  }

  get running(): boolean {
    return this.startedAt !== null;
  }

  /** Rush adds seconds for bounces and wrong choices. */
  addPenalty(ms: number) {
    this.penalty += ms;
  }

  get penalties(): number {
    return this.penalty;
  }

  /** Milliseconds played so far, penalties included. */
  elapsed(): number {
    const live = this.startedAt === null ? 0 : this.now() - this.startedAt;
    return this.banked + live + this.penalty;
  }
}

/** `0:31.4`, or `12:05.0` past ten minutes. */
export function clockText(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

/** `1.4 s` */
export function secondsText(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
