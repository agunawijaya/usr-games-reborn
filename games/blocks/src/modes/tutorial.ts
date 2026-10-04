import { createRng } from '@usr-games/kit';
import { createGame, type Game, type GameEvent, setCell } from '../engine/game';
import { TANK_HEIGHT, TANK_WIDTH } from '../dives/dives';

/**
 * The tutorial, about a minute in three lessons: slide and turn a sinker into a gap, plunge one
 * from the top, then stand the long one up and burst four rows at once. Sinkers here wait for the
 * keys; nothing sinks on its own. A miss only sets the lesson up again.
 */

export type LessonId = 'slide' | 'plunge' | 'four' | 'done';

export interface Lesson {
  id: LessonId;
  title: string;
  body: string;
}

export const LESSONS: Readonly<Record<LessonId, Lesson>> = {
  slide: {
    id: 'slide',
    title: 'Slide and turn',
    body: '← and → slide the sinker; ↑ turns it (Z and X turn either way). Turn it to fit the three-cell gap, slide it over, then press ↓ to sink it in.',
  },
  plunge: {
    id: 'plunge',
    title: 'Plunge',
    body: 'Space sends a sinker straight to the bottom. The farther it falls, the more it scores. Plunge one from the top.',
  },
  four: {
    id: 'four',
    title: 'Four at once',
    body: 'Stand the long sinker up with ↑, slide it to the gap on the right and plunge: four rows burst together.',
  },
  done: {
    id: 'done',
    title: 'Ready to dive',
    body: 'That is the whole game. In a dive, sinkers sink on their own.',
  },
};

const ORDER: LessonId[] = ['slide', 'plunge', 'four', 'done'];
const TEE = 2;
const SQUARE = 3;
const LONG = 6;

/** Fills row `y` of the tank but for the gaps, with pebbles of one stand-in sinker per row. */
function fillRow(game: Game, y: number, gaps: readonly number[]): void {
  for (let x = 0; x < game.width; x++)
    if (!gaps.includes(x)) setCell(game, x, y, { group: 9000 + y, kind: 4, depth: y });
}

export class Tutorial {
  game: Game;
  lesson: LessonId = 'slide';
  /** A nudge shown under the lesson after a miss, or null. */
  hint: string | null = null;

  constructor() {
    this.game = this.setUp('slide');
  }

  get current(): Lesson {
    return LESSONS[this.lesson];
  }

  get step(): number {
    return ORDER.indexOf(this.lesson);
  }

  /** After a key: moves the lessons on, or sets the lesson up again after a miss. */
  after(events: readonly GameEvent[]): { advanced: boolean } {
    const landed = events.some((e) => e.kind === 'landed');
    if (!landed) return { advanced: false };
    const burst = events.find((e) => e.kind === 'burst');
    const plunged = events.find((e) => e.kind === 'plunged');
    const done =
      (this.lesson === 'slide' && burst !== undefined) ||
      (this.lesson === 'plunge' && plunged?.kind === 'plunged' && plunged.rows >= 8) ||
      (this.lesson === 'four' && burst?.kind === 'burst' && burst.burst.rows.length === 4);
    if (!done) {
      this.hint = {
        slide:
          'Not quite: the gap wants three cells along the bottom and one above. Turn it twice.',
        plunge: 'That one sank. Press Space while it is still at the top.',
        four: 'Close! Stand it up first, then slide all the way right before plunging.',
        done: null,
      }[this.lesson];
      this.game = this.setUp(this.lesson);
      return { advanced: false };
    }
    this.lesson = ORDER[ORDER.indexOf(this.lesson) + 1]!;
    this.hint = null;
    if (this.lesson !== 'done') this.game = this.setUp(this.lesson);
    return { advanced: true };
  }

  private setUp(lesson: LessonId): Game {
    // The first kind in a plan is the next one shown; the second is the one in hand.
    const plan = {
      slide: [SQUARE, TEE, SQUARE],
      plunge: [TEE, SQUARE, TEE],
      four: [SQUARE, LONG, SQUARE],
      done: [SQUARE, SQUARE],
    }[lesson];
    const game = createGame({
      rules: 'standard',
      width: TANK_WIDTH,
      height: TANK_HEIGHT,
      level: 1,
      random: createRng('tutorial'),
      plan,
    });
    if (lesson === 'slide') fillRow(game, TANK_HEIGHT - 1, [4, 5, 6]);
    if (lesson === 'four')
      for (let y = TANK_HEIGHT - 4; y < TANK_HEIGHT; y++) fillRow(game, y, [TANK_WIDTH - 1]);
    return game;
  }
}
