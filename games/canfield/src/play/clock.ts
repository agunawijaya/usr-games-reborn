/**
 * The deal's clock: milliseconds of play, stopped while the game is paused, hidden or over.
 * It reads the page's clock only when asked, so a paused game costs nothing.
 */
export class GameClock {
  private elapsed: number;
  private since: number | null = null;

  constructor(
    startMs = 0,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.elapsed = startMs;
  }

  get running(): boolean {
    return this.since !== null;
  }

  start(): void {
    if (this.since === null) this.since = this.now();
  }

  stop(): void {
    if (this.since === null) return;
    this.elapsed += this.now() - this.since;
    this.since = null;
  }

  ms(): number {
    return this.elapsed + (this.since === null ? 0 : this.now() - this.since);
  }
}

/** `4:31`, or `1:02:09` past an hour. */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
