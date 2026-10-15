/**
 * A queue of timed steps: the director turns each thing that happens at the pond into one or
 * more steps (a line spoken, cards flying, a cast, a leap) and plays them one after another on
 * its own clock, which stops while the game is paused.
 */

export interface Step {
  /** Seconds on the step clock. */
  duration: number;
  /** When the step begins: moods, words, sounds, the notebook. */
  start?(): void;
  /** Every frame while it runs, with its age in seconds. */
  frame?(age: number): void;
  /** When it ends: cards land, counts change. */
  end?(): void;
}

export class StepQueue {
  private readonly steps: Step[] = [];
  private current: Step | null = null;
  private age = 0;

  get busy(): boolean {
    return this.current !== null || this.steps.length > 0;
  }

  /** The step under way and how long it has run, for drawing it. */
  get running(): { step: Step; age: number } | null {
    return this.current ? { step: this.current, age: this.age } : null;
  }

  push(...steps: Step[]): void {
    this.steps.push(...steps);
  }

  /** Advances by `dt` seconds, ending and starting as many steps as fit. */
  advance(dt: number): void {
    let left = dt;
    for (let guard = 0; guard < 64; guard++) {
      if (!this.current) {
        const next = this.steps.shift();
        if (!next) return;
        this.current = next;
        this.age = 0;
        next.start?.();
      }
      const step = this.current;
      const remaining = step.duration - this.age;
      if (left < remaining) {
        this.age += left;
        step.frame?.(this.age);
        return;
      }
      left -= Math.max(0, remaining);
      this.age = step.duration;
      step.frame?.(this.age);
      this.current = null;
      step.end?.();
    }
  }

  /** Finishes everything at once (reduced motion skipping, leaving a game): ends run in order. */
  flush(): void {
    for (let guard = 0; guard < 4096 && this.busy; guard++) this.advance(1e6);
  }

  clear(): void {
    this.steps.length = 0;
    this.current = null;
  }
}
