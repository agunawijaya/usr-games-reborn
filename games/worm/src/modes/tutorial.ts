import { createRng } from '@usr-games/kit';
import { cellAt, parseBoard, type Board } from '../engine/board';
import { createGame, type Game, isFree, type MoveEvent } from '../engine/game';
import { type Cell, DIRS, type Dir, OPPOSITE, step } from '../engine/geometry';
import { straightStart, TUTORIAL_MAP } from '../gardens/gardens';

/**
 * The tutorial, under a minute in a little box: steer and eat, dash, then chain. The noodle
 * moves only when a key is pressed, so nothing rushes a first-timer, and the digits are put
 * where each lesson needs them. A bonk only starts the lesson over.
 */

export type LessonId = 'steer' | 'dash' | 'chain' | 'done';

export interface Lesson {
  id: LessonId;
  title: string;
  body: string;
}

export const LESSONS: Readonly<Record<LessonId, Lesson>> = {
  steer: {
    id: 'steer',
    title: 'Steer to the number',
    body: 'Arrow keys or W A S D turn the noodle. Each press is one step. Eat the 3.',
  },
  dash: {
    id: 'dash',
    title: 'Dash',
    body: 'Hold Shift and press an arrow: nine cells across or five up and down, stopping at a number. Dash to the 5.',
  },
  chain: {
    id: 'chain',
    title: 'Chain the bites',
    body: 'A bite makes a bulge to digest. Eat the 9, then the 2 before the bulge has gone: that is a chain, and it pays the whole growth still to come.',
  },
  done: {
    id: 'done',
    title: 'Ready for the garden',
    body: 'Left alone, the noodle creeps. Press keys faster and it speeds up: a bite at a quicker tempo is worth more.',
  },
};

const ORDER: LessonId[] = ['steer', 'dash', 'chain', 'done'];

export class Tutorial {
  readonly board: Board = parseBoard(TUTORIAL_MAP);
  game: Game;
  lesson: LessonId = 'steer';
  /** A nudge shown under the lesson after a near miss, or null. */
  hint: string | null = null;
  /** In the chain lesson: the 9 is eaten and the 2 is out. */
  private waitingForChain = false;

  constructor() {
    this.game = this.freshGame();
    this.setUp();
  }

  get current(): Lesson {
    return LESSONS[this.lesson];
  }

  /** After a move: moves the lessons on, and puts out the digit the next one needs. */
  after(events: readonly MoveEvent[]): { advanced: boolean } {
    const bite = events.find((e) => e.kind === 'bite');
    if (events.some((e) => e.kind === 'lost')) {
      this.hint = 'Bonk! No harm done: try that lesson again.';
      this.game = this.freshGame();
      this.setUp();
      return { advanced: false };
    }
    if (bite?.kind !== 'bite') {
      if (this.lesson === 'chain' && this.waitingForChain && this.game.growing === 0) {
        this.hint = 'The bulge was gone before the 2. Try again, a little quicker.';
        this.place(9, 3);
        this.waitingForChain = false;
      }
      return { advanced: false };
    }
    const done =
      this.lesson === 'steer' ||
      (this.lesson === 'dash' && bite.bite.dashing) ||
      (this.lesson === 'chain' && bite.bite.chain >= 2);
    if (this.lesson === 'dash' && !done)
      this.hint = 'That was a step at a time. Now with Shift held.';
    if (this.lesson === 'chain' && !done) {
      this.waitingForChain = true;
      this.place(2, 3);
      return { advanced: false };
    }
    if (!done) {
      this.setUp();
      return { advanced: false };
    }
    this.lesson = ORDER[ORDER.indexOf(this.lesson) + 1]!;
    this.hint = null;
    this.setUp();
    return { advanced: true };
  }

  private freshGame(): Game {
    return createGame({
      board: this.board,
      body: straightStart({ x: 4, y: 3 }, 'right', 4),
      heading: 'right',
      random: createRng('tutorial'),
      // Every digit is put out by hand.
      plan: [{ value: 1, at: { x: 0, y: 0 } }],
    });
  }

  private setUp(): void {
    // The game's own placement is replaced by the lesson's; an empty plan never ends the box.
    this.game.plan = null;
    if (this.lesson === 'steer') this.game.digit = { at: { x: 9, y: 1 }, value: 3 };
    else if (this.lesson === 'dash') this.place(5, 6);
    else if (this.lesson === 'chain') {
      this.waitingForChain = false;
      this.place(9, 3);
    } else this.game.digit = null;
  }

  /**
   * Puts `value` in line with the head, `distance` cells away (or as far as the box allows) in
   * the direction with the most room, never straight back.
   */
  private place(value: number, distance: number): void {
    const head = this.game.body[0]!;
    let best: { at: Cell; free: number } | null = null;
    for (const dir of DIRS as Dir[]) {
      if (this.game.heading && dir === OPPOSITE[this.game.heading]) continue;
      let at = head;
      let free = 0;
      for (let k = 0; k < distance; k++) {
        const next = step(at, dir);
        if (!isFree(this.game, next)) break;
        at = next;
        free++;
      }
      if (free > 0 && (!best || free > best.free)) best = { at, free };
    }
    const at = best?.at ?? this.anyFreeCell();
    this.game.digit = { at, value };
  }

  private anyFreeCell(): Cell {
    for (let i = 0; i < this.board.terrain.length; i++) {
      const cell = cellAt(this.board, i);
      if (isFree(this.game, cell)) return cell;
    }
    return { x: 0, y: 0 };
  }
}
