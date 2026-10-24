import type { Look } from '../render/look';
import type { TableView } from '../render/scene';
import { buildScene, type TableModel } from './model';
import { CardVisuals } from './visuals';

/**
 * A table that draws itself every frame from a model, with a clock that stops while the game
 * is paused and timers on that clock. The trainer and the Daily Discard run on it; the full
 * game has its own director built the same way.
 */
export class Stage {
  readonly visuals = new CardVisuals();
  now = 0;
  private wall = 0;
  private last = 0;
  private frame = 0;
  private paused = false;
  private stopped = false;
  private timers: { at: number; run: () => void }[] = [];

  constructor(
    private readonly view: TableView,
    readonly model: TableModel,
    private readonly look: () => Look,
    private readonly reducedMotion: () => boolean,
    private readonly onFrame: () => void = () => {},
  ) {}

  start(): void {
    this.last = performance.now();
    const tick = (time: number) => {
      if (this.stopped) return;
      const dt = Math.min(0.2, Math.max(0, (time - this.last) / 1000));
      this.last = time;
      this.wall += dt;
      if (!this.paused) this.now += dt;
      const due = this.timers.filter((timer) => timer.at <= this.now);
      this.timers = this.timers.filter((timer) => timer.at > this.now);
      for (const timer of due) timer.run();
      const still = this.reducedMotion();
      this.view.render(
        buildScene(this.model, {
          look: this.look(),
          now: this.now,
          time: still ? 2 : this.wall,
          dt,
          still,
          visuals: this.visuals,
        }),
      );
      this.onFrame();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  after(seconds: number, run: () => void): void {
    const tempo = this.reducedMotion() ? 0.6 : 1;
    this.timers.push({ at: this.now + seconds * tempo, run });
  }

  clearTimers(): void {
    this.timers = [];
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
  }
}
