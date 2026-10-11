import type { StepReport } from '../../game/records';
import type { Step } from '../../engine/message';
import type { DesignFrame } from '../../render/frame';
import type { DeskPalette } from '../../render/palette';
import type { App } from '../app';

/**
 * A machine at work on one step. The message screen around it holds the story, the answer
 * field, the stars and the clock; a station draws its machine, takes its keys and pointer, and
 * says when it is done.
 */
export interface StationHost {
  readonly app: App;
  readonly step: Step;
  /** Seconds on the game clock. */
  now(): number;
  /** Charts are open now (free help, or help the player chose to pay for). */
  chartsOpen(): boolean;
  /** For machine-judged steps: the step is over, with letters wrong and late. */
  done(outcome: { wrong: number; late: number }): void;
  /** A wrong lock-in at a machine-judged step (counts like a wrong answer). */
  miss(): void;
  /** A moment worth remembering (packages). */
  report(report: StepReport): void;
  /** One line in the status area, read out to screen readers. */
  say(text: string): void;
  /** What the player has typed so far, for hints. */
  typedAnswer(): string;
}

export interface Station {
  readonly element: HTMLElement;
  /** True when the answer is typed into the message screen's field. */
  readonly typed: boolean;
  /** What the answer card says while working (machine-judged steps). */
  readonly instructions: string;
  /** Where the message screen puts the answer card, in design pixels. */
  readonly answerAt: { x: number; y: number; width: number };
  layout(frame: DesignFrame): void;
  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number): void;
  tick(dt: number, time: number): void;
  onKey?(event: KeyboardEvent): boolean;
  onKeyUp?(event: KeyboardEvent): boolean;
  onPointer?(
    kind: 'down' | 'move' | 'up',
    point: { x: number; y: number },
    event: PointerEvent,
  ): boolean;
  onWheel?(deltaY: number): void;
  /** A small nudge; returns what to tell the player. */
  hint(): string;
  /** Something the machine keeps in the header card (the word being sent). */
  headerExtra?(): HTMLElement | null;
  /** The machine's own buttons (read it, feed the card…), shown first in the answer card. */
  tools?(): HTMLElement[];
  /** The machine plays its message again, where it has one. */
  replay?(): void;
  /** Charts changed (opened or closed). */
  chartsChanged?(): void;
  /**
   * The typed answer was right: the machine's moment (a flip, a flourish). Returns the seconds
   * to wait before moving on, if the moment needs them.
   */
  solved?(): number | void;
  /** A typed answer was wrong. */
  missed?(): void;
  /** The answer was given up: show it on the machine. */
  reveal?(): void;
  /** Report what the station learned when the step ends (packages). */
  finalReport?(): StepReport | null;
  destroy?(): void;
}

/** The first letter where a typed answer goes wrong, as a hint. */
export function nextLetterHint(given: string, expected: string): string {
  const a = given.toUpperCase().replace(/\s+/g, ' ').trim();
  const b = expected.toUpperCase();
  let i = 0;
  while (i < b.length && a[i] === b[i]) i++;
  while (i < b.length && b[i] === ' ') i++;
  if (i >= b.length) return 'Everything so far is right.';
  return `Letter ${[...b.slice(0, i + 1)].filter((c) => c !== ' ').length} is ${b[i]}.`;
}
