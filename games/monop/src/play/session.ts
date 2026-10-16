import { Rival } from '../engine/ai';
import { newChronicle, record, type Chronicle } from '../engine/coach';
import { apply, newGame, whyNot } from '../engine/game';
import { keep, openLedger, type Ledger } from '../engine/ledger';
import { actor } from '../engine/state';
import type { Action, GameEvent, GameState, Rules, SeatSetup } from '../engine/types';
import type { BoardId } from '../boards/themes';
import { judge, restricted, type Goal, type Restriction, type Verdict } from '../scenarios/goals';
import { displayOf, showEvent, type Display } from './display';

/**
 * One game being played: the engine's state, the rivals' minds, the story so far, and the pace.
 * Every move, a person's or a rival's, goes through `apply`; its events are shown one by one by
 * the stagehand before the next move is made. When the move belongs to a person the session
 * simply waits for them. Several people may share the table (hot seat); the first of them is
 * the player whose career the game counts for, and whose ledger the session keeps. A scenario
 * adds its goals, judged after every move, and the restrictions it puts on that player.
 */

export interface Stagehand {
  /** Shows one event; resolves when its moment on screen is over. */
  play(event: GameEvent, session: PlaySession): Promise<void>;
  /** A rival's sentence, as it makes an offer or answers one. */
  say(seat: number, line: string, action: Action, session: PlaySession): Promise<void>;
  /** Time on the table's clock: paused while the game is paused, quicker at a faster pace. */
  wait(seconds: number): Promise<void>;
  /** Redraw the panels: the picture changed, or a decision is waiting. */
  refresh(session: PlaySession): void;
}

export interface SessionOptions {
  readonly board: BoardId;
  readonly seed: string;
  readonly rules: Rules;
  readonly seats: readonly SeatSetup[];
  /** Sets the table up after the deal: scenarios, and staged games for recordings. */
  readonly prepare?: (state: GameState) => void;
  /** A scenario's goals: the game ends as soon as the referee decides them. */
  readonly goals?: readonly Goal[];
  readonly restrictions?: readonly Restriction[];
  /** A game saved earlier, picked up where it stopped instead of dealt afresh. */
  readonly resume?: SavedPlay;
  /** Called whenever play stops to wait for a person: the moment to save. */
  readonly onSettle?: (session: PlaySession) => void;
}

/** What a game in progress needs to carry on: the engine's state and the story so far. */
export interface SavedPlay {
  readonly state: GameState;
  readonly chronicle: Chronicle;
  readonly ledger: Ledger;
  /** Seconds played before it was saved. */
  readonly seconds: number;
}

export interface RivalLine {
  readonly seat: number;
  readonly text: string;
  readonly action: Action;
}

/** How long a rival seems to think before it moves, in seconds on the table's clock. */
const THINK = 0.55;

export class PlaySession {
  readonly state: GameState;
  display: Display;
  readonly chronicle: Chronicle;
  /** The first person at the table: their story in numbers, for scenarios, packages and the career. */
  readonly ledger: Ledger;
  /** A scenario's outcome, once the referee has decided it. */
  verdict: Verdict | null = null;
  readonly startedAt: number;
  /** The last thing a rival said, for the trade table and the banner. */
  lastLine: RivalLine | null = null;
  private readonly rivals: (Rival | null)[];
  private readonly goals: readonly Goal[] | null;
  private readonly restrictions: readonly Restriction[];
  private running = false;
  private ended = false;
  private readonly onSettle: ((session: PlaySession) => void) | null;

  constructor(
    options: SessionOptions,
    private readonly stage: Stagehand,
  ) {
    const resume = options.resume ? structuredClone(options.resume) : null;
    this.state =
      resume?.state ??
      newGame({
        board: options.board,
        seed: options.seed,
        rules: options.rules,
        seats: options.seats,
      });
    if (!resume) options.prepare?.(this.state);
    this.startedAt = Date.now() - (resume?.seconds ?? 0) * 1000;
    this.display = displayOf(this.state);
    this.chronicle = resume?.chronicle ?? newChronicle(this.state);
    this.ledger = resume?.ledger ?? openLedger(Math.max(0, this.owner), this.state);
    this.onSettle = options.onSettle ?? null;
    this.goals = options.goals ?? null;
    this.restrictions = options.restrictions ?? [];
    this.rivals = options.seats.map((seat, index) =>
      seat.kind === 'ai'
        ? new Rival(index, seat.personality ?? 'steady', seat.difficulty ?? 'medium', options.seed)
        : null,
    );
  }

  /** The seat whose move it is now. */
  get actor(): number {
    return actor(this.state);
  }

  /** The first person at the table: the Hall's player. */
  get owner(): number {
    return this.state.seats.findIndex((s) => s.kind === 'human');
  }

  /** The engine has ended the game, or a scenario's referee has. */
  get over(): boolean {
    return this.state.phase.kind === 'over' || this.verdict !== null;
  }

  /** True while a move is being made or shown. */
  get busy(): boolean {
    return this.running;
  }

  /** True while the game is waiting for a person to move. */
  get awaitingPerson(): boolean {
    return !this.running && !this.over && this.rivals[this.actor] === null;
  }

  isRival(seat: number): boolean {
    return this.rivals[seat] !== null;
  }

  /** Starts play: rivals move until it is a person's turn. */
  start(): void {
    this.stage.refresh(this);
    void this.carryOn();
  }

  /** Stops the session for good; pending animations finish but nothing more is played. */
  end(): void {
    this.ended = true;
  }

  /** Why the person's move is not allowed, or null; the move is made when it is. */
  async act(action: Action): Promise<string | null> {
    // Keys pressed while a move is still being shown are ignored rather than queued.
    if (this.running) return null;
    if (!this.awaitingPerson) return 'Wait for your turn.';
    const reason =
      (this.actor === this.owner
        ? restricted(this.restrictions, this.state, this.actor, action)
        : null) ?? whyNot(this.state, action);
    if (reason !== null) return reason;
    this.running = true;
    this.stage.refresh(this);
    await this.perform(action);
    this.running = false;
    await this.carryOn();
    return null;
  }

  private async perform(action: Action): Promise<void> {
    const events = apply(this.state, action);
    record(this.chronicle, this.state, events);
    keep(this.ledger, this.state, events);
    if (this.goals) this.verdict = judge(this.goals, this.state, this.ledger);
    for (const event of events) {
      if (this.ended) return;
      showEvent(this.display, event, this.state);
      await this.stage.play(event, this);
    }
    this.display = displayOf(this.state);
  }

  /** The game as it stands, to save and pick up later. */
  saved(): SavedPlay {
    return {
      state: structuredClone(this.state),
      chronicle: structuredClone(this.chronicle),
      ledger: structuredClone(this.ledger),
      seconds: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }

  /** Lets the rivals move, one move at a time, until a person must move or the game ends. */
  private async carryOn(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (!this.ended && !this.over) {
      const rival = this.rivals[this.actor];
      if (!rival) break;
      this.stage.refresh(this);
      await this.stage.wait(THINK);
      if (this.ended) break;
      const decision = rival.decide(this.state);
      if (decision.line) {
        this.lastLine = { seat: rival.seat, text: decision.line, action: decision.action };
        await this.stage.say(rival.seat, decision.line, decision.action, this);
      }
      await this.perform(decision.action);
    }
    this.running = false;
    if (!this.ended) this.stage.refresh(this);
    if (!this.ended && this.awaitingPerson) this.onSettle?.(this);
  }
}
