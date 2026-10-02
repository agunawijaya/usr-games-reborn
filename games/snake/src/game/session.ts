import { createRng, restoreRng, type Rng } from '@usr-games/kit';
import { type ChamberPlan, DAILY_LENGTH, RUN_LENGTH } from '../engine/chambers';
import { gardenFromRows } from '../engine/garden';
import { type Cell, reach } from '../engine/geometry';
import {
  luckyBreak,
  type LuckyBreak,
  peek,
  type Peek,
  pockets,
  type Round,
  RUN_RULES,
  step,
  type Turn,
  warp,
  warpCost,
} from '../engine/round';
import { currentPlan, goDeeper, isLastChamber, playRng, type Run, startRun } from '../engine/run';
import { classicRound } from '../engine/setup';
import { chunkFor } from '../engine/value';

/**
 * One sitting of play: a run of chambers, the Daily Run, a Classic game or the tutorial. It
 * wraps the engine, keeps the counts the packages and the results need, and says which phase
 * the screen should show. No DOM here.
 */
export type SessionMode = 'run' | 'daily' | 'classic' | 'tutorial';

export type Phase = 'playing' | 'door' | 'caught' | 'over';

export interface SessionStats {
  pickups: number;
  warps: number;
  peeks: number;
  luckyBreaks: number;
  /** The closest the snake has come to you in this chamber, in squares. */
  closestHere: number;
  /** A chamber left with the snake never within two squares. */
  charmed: boolean;
  mostInOneChamber: number;
}

export interface Ending {
  readonly banked: number | null;
  readonly chamber: number;
  /** Classic only: the pockets when the game ended, debts included. */
  readonly pockets: number;
}

const TUTORIAL_GARDEN = [
  '............',
  '..HH........',
  '............',
  '.........#..',
  '............',
  '.....HH.....',
  '............',
  '............',
];

export class Session {
  run: Run | null = null;
  round: Round;
  phase: Phase = 'playing';
  ending: Ending | null = null;
  readonly stats: SessionStats = {
    pickups: 0,
    warps: 0,
    peeks: 0,
    luckyBreaks: 0,
    closestHere: Infinity,
    charmed: false,
    mostInOneChamber: 0,
  };
  private rng: Rng;
  readonly startedAt = Date.now();

  constructor(
    readonly mode: SessionMode,
    readonly seed: string,
    readonly classicSize: { width: number; height: number } = { width: 24, height: 13 },
  ) {
    if (mode === 'classic') {
      this.round = classicRound(
        classicSize.width,
        classicSize.height,
        createRng(`${seed}:classic`),
      );
      this.rng = createRng(`${seed}:classic:play`);
    } else if (mode === 'tutorial') {
      this.round = tutorialRound();
      this.rng = createRng(`${seed}:tutorial`);
    } else {
      this.run = startRun(seed, mode === 'daily' ? DAILY_LENGTH : RUN_LENGTH);
      this.round = this.run.round;
      this.rng = playRng(seed, 1);
    }
    this.watchDistance();
  }

  get plan(): ChamberPlan | null {
    return this.run ? currentPlan(this.run) : null;
  }

  get depth(): number {
    return this.run ? this.run.index + 1 : 1;
  }

  get chambers(): number | null {
    return this.run ? this.run.plans.length : null;
  }

  get pockets(): number {
    return pockets(this.round);
  }

  get warpCost(): number {
    return warpCost(this.round);
  }

  get lastChamber(): boolean {
    return !this.run || isLastChamber(this.run);
  }

  step(direction: number): Turn {
    if (this.phase !== 'playing') return { round: this.round, events: [] };
    const turn = step(this.round, direction, this.rng);
    this.round = turn.round;
    for (const event of turn.events) {
      if (event.kind === 'pickup') this.stats.pickups++;
      if (event.kind === 'door') this.phase = 'door';
      if (event.kind === 'caught') this.phase = 'caught';
    }
    this.stats.mostInOneChamber = Math.max(this.stats.mostInOneChamber, this.round.pickups);
    this.watchDistance();
    return turn;
  }

  warp() {
    if (this.phase !== 'playing') return;
    this.round = warp(this.round, this.rng);
    this.stats.warps++;
    this.watchDistance();
  }

  peek(): Peek | null {
    this.stats.peeks++;
    return peek(this.round);
  }

  /**
   * The digit the dial would land on after `skip` more draws of the play stream (one per snake
   * step): lets a test stage a capture that ends either way.
   */
  luckyRollAfter(skip: number): number {
    const ahead = restoreRng(this.rng.state());
    for (let i = 0; i < skip; i++) ahead.int(0, 1023);
    return ahead.int(0, 255) % 10;
  }

  /** After a capture: spin the dial. An escape puts you back in play. */
  luckyBreak(): LuckyBreak {
    const roll = luckyBreak(this.round, this.rng);
    if (roll.escaped) {
      this.round = roll.round;
      this.stats.luckyBreaks++;
      this.phase = 'playing';
      this.watchDistance();
    } else {
      this.phase = 'over';
      this.ending = { banked: null, chamber: this.depth, pockets: this.pockets };
    }
    return roll;
  }

  /** At the door: bank everything and end the sitting. */
  bank(): Ending {
    this.charmCheck();
    // A run banks what you carry, a debt as nothing; Classic keeps the original's sum, debts and all.
    const banked = this.run ? Math.max(0, this.pockets) : this.pockets;
    this.phase = 'over';
    this.ending = { banked, chamber: this.depth, pockets: this.pockets };
    return this.ending;
  }

  /** At the door: down to the next chamber, pockets and all. */
  deeper() {
    if (!this.run || isLastChamber(this.run)) return;
    this.charmCheck();
    this.run = goDeeper({ ...this.run, round: this.round });
    this.round = this.run.round;
    this.rng = playRng(this.seed, this.run.index + 1);
    this.stats.closestHere = Infinity;
    this.phase = 'playing';
    this.watchDistance();
  }

  /** Classic and the tutorial end at the door; a run asks. */
  get asksAtDoor(): boolean {
    return this.run !== null && !isLastChamber(this.run);
  }

  private charmCheck() {
    if (this.stats.closestHere > 2) this.stats.charmed = true;
  }

  private watchDistance() {
    const nearest = Math.min(...this.round.snake.map((s) => reach(s, this.round.you)));
    this.stats.closestHere = Math.min(this.stats.closestHere, nearest);
  }
}

/**
 * The tutorial's little lawn: a glint two steps away, the door beyond, and a snake far off
 * that will not head for empty pockets.
 */
function tutorialRound(): Round {
  const garden = gardenFromRows(TUTORIAL_GARDEN);
  const snake: Cell[] = [
    { x: 1, y: 7 },
    { x: 0, y: 7 },
    { x: 0, y: 6 },
    { x: 0, y: 5 },
    { x: 1, y: 5 },
    { x: 2, y: 5 },
  ];
  return {
    garden,
    you: { x: 3, y: 3 },
    glints: [{ x: 5, y: 3 }],
    snake,
    heading: 2,
    loot: 0,
    penalty: 0,
    chunk: chunkFor(garden.width, garden.height),
    appetite: 0,
    ledger: { gross: 0, spent: 0 },
    rules: RUN_RULES,
    moves: 0,
    pickups: 0,
    warps: 0,
  };
}
