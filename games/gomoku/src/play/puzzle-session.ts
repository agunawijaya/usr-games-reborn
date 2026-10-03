import { type GameState, other, play, type Stone } from '../engine/game';
import { fivePoints, quickestWin, type SolveOptions, winningFirstMoves } from '../engine/solver';
import { attackerOf, BANDS, type Puzzle, puzzleGame, solveOptions } from '../modes/puzzles';
import type { Look } from '../render/look';
import type { SideIndex } from '../render/view';
import type { GameSettings } from '../app/saves';
import {
  type CardAction,
  infoCard,
  readCard,
  type ResultsModel,
  resultsCard,
  seatCard,
} from '../ui/cards';
import { h } from '../ui/dom';
import { sideOf, tally, threatViews } from './read';
import type { FivefoldSound } from './sound';
import { BoardStage } from './stage';

/**
 * A puzzle at the board. You play the side to move and must keep a forced win alive with every
 * move: any move that still forces five in the moves left is right, not only the one in the
 * answer. The other side answers each threat as well as it can — a four at its point of five,
 * a three with the defence that makes your win longest. A move that lets it off the hook ends the
 * try; "Show me" plays the answer through.
 */

export interface PuzzleRun {
  puzzle: Puzzle;
  /** For the Daily Puzzle: its number (Read the board stays off). */
  daily: { number: number } | null;
}

export interface PuzzleOutcome {
  run: PuzzleRun;
  /** Tries in this visit, the solving one included. */
  tries: number;
  /** Your moves in the solving try. */
  moves: number;
  /** Solved by you, not shown. */
  solved: boolean;
}

export interface PuzzleHooks {
  look(): Look;
  reducedMotion(): boolean;
  settings(): GameSettings;
  updateSettings(patch: Partial<GameSettings>): void;
  sound: FivefoldSound;
  ownPause: boolean;
  inHall: boolean;
  onSolved(outcome: PuzzleOutcome): void;
  onGameMenu(): void;
  onPause(): void;
  onNext?(): void;
}

/** Waits a moment, so the other side's answer reads as a reply. */
const REPLY_DELAY = 500;

export class PuzzleSession {
  readonly stage: BoardStage;
  private game!: GameState;
  private attacker: Stone;
  private left = 0;
  private tries = 1;
  private yourMoves = 0;
  private busy = false;
  private ended = false;
  private readOn: boolean;
  private showing = false;
  private destroyed = false;
  private note: { text: string; urgent?: boolean } | null = null;

  constructor(
    root: HTMLElement,
    readonly run: PuzzleRun,
    private readonly hooks: PuzzleHooks,
  ) {
    this.attacker = attackerOf(run.puzzle);
    this.readOn = !run.daily && hooks.settings().readBoard;
    this.stage = new BoardStage(root, {
      look: hooks.look(),
      reducedMotion: hooks.reducedMotion(),
      ownPause: hooks.ownPause,
      inHall: hooks.inHall,
      size: puzzleGame(run.puzzle).size,
    });
    this.stage.screen.onGameMenu(() => hooks.onGameMenu());
    this.stage.screen.onPause(() => hooks.onPause());
    this.stage.sessionKeys = (event) => this.onKey(event);
    this.start();
    this.stage.focusBoard();
  }

  get isOver(): boolean {
    return this.ended;
  }

  private get you(): SideIndex {
    return sideOf(this.attacker);
  }

  private get options(): SolveOptions {
    return solveOptions(this.run.puzzle);
  }

  /** The puzzle from its start, for a first try or another. */
  private start(): void {
    this.game = puzzleGame(this.run.puzzle);
    this.left = this.run.puzzle.moves;
    this.yourMoves = 0;
    this.busy = false;
    this.ended = false;
    this.showing = false;
    this.note = null;
    this.stage.reset(this.game.size, this.game.moves);
    this.stage.screen.setOverlay(null);
    this.stage.setHand(this.you, (p) => this.yourMove(p));
    this.refresh();
  }

  private onKey(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    if (key === 't' && !this.run.daily) {
      this.setRead(!this.readOn);
      return true;
    }
    if (key === 'r' && !this.busy) {
      this.tryAgain();
      return true;
    }
    if (key === 's' && !this.busy && !this.showing) {
      void this.showMe();
      return true;
    }
    return false;
  }

  private setRead(on: boolean): void {
    if (this.run.daily) return;
    this.readOn = on;
    this.hooks.updateSettings({ readBoard: on });
    this.refresh();
  }

  tryAgain(): void {
    if (this.busy) return;
    this.tries++;
    this.start();
  }

  private place(p: number, stone: Stone, who: string): void {
    play(this.game, p);
    this.stage.place(p, sideOf(stone), who);
    this.hooks.sound.place(this.hooks.look().dark, stone === this.attacker);
  }

  private async yourMove(p: number): Promise<void> {
    if (this.busy || this.ended || this.game.board[p] !== null) return;
    this.busy = true;
    this.stage.setHand(null);
    const right = winningFirstMoves(this.game, {
      ...this.options,
      moves: this.left,
    }).moves.includes(p);
    this.place(p, this.attacker, 'You');
    this.yourMoves++;
    this.left--;
    if (this.game.winner) {
      await this.solved();
      return;
    }
    if (!right) {
      await this.missed();
      return;
    }
    await this.wait(REPLY_DELAY);
    if (this.destroyed) return;
    this.place(this.bestDefence(), other(this.attacker), 'The other side');
    this.busy = false;
    this.stage.setHand(this.you, (q) => this.yourMove(q));
    this.refresh();
  }

  /**
   * The other side's answer: the point of five it must block, or, to a three, the defence after
   * which your quickest win is longest.
   */
  private bestDefence(): number {
    const game = this.game;
    const threats = fivePoints(game, this.attacker);
    if (threats.length > 0) return threats[0]!;
    const defender = other(this.attacker);
    const candidates = new Set<number>();
    for (const t of threatViews(game))
      if (t.side === this.you) for (const q of [...t.spots, ...t.stones]) candidates.add(q);
    let best = -1;
    let longest = -1;
    for (const q of candidates) {
      if (game.board[q] !== null) continue;
      game.board[q] = defender;
      game.toMove = this.attacker;
      const n = quickestWin(game, { ...this.options, moves: this.left }) ?? 99;
      game.board[q] = null;
      game.toMove = defender;
      if (n > longest) {
        longest = n;
        best = q;
      }
    }
    return best >= 0 ? best : game.board.indexOf(null);
  }

  /** Your move let the other side off the hook: it answers, and the try is over. */
  private async missed(): Promise<void> {
    await this.wait(REPLY_DELAY);
    if (this.destroyed) return;
    const defender = other(this.attacker);
    if (!this.game.winner && !this.game.draw) {
      const theirFive = fivePoints(this.game, defender)[0];
      const reply = theirFive ?? this.bestDefence();
      this.place(reply, defender, 'The other side');
    }
    this.hooks.sound.miss();
    this.ended = true;
    this.busy = false;
    this.note = {
      text: 'That lets the other side off the hook. Try again (R) or Show me (S).',
      urgent: true,
    };
    this.refresh();
  }

  /** Plays the answer through from the start, slowly. */
  async showMe(): Promise<void> {
    if (this.busy) return;
    this.start();
    this.busy = true;
    this.showing = true;
    this.stage.setHand(null);
    this.note = { text: 'Watch: one forcing move after another.' };
    this.refresh();
    while (!this.game.winner && this.left > 0) {
      await this.wait(700);
      if (this.destroyed) return;
      const moves = winningFirstMoves(this.game, { ...this.options, moves: this.left }).moves;
      const p =
        moves.includes(this.run.puzzle.answer) && this.yourMoves === 0
          ? this.run.puzzle.answer
          : moves[0];
      if (p === undefined) break;
      this.place(p, this.attacker, 'The answer');
      this.left--;
      if (this.game.winner) break;
      await this.wait(REPLY_DELAY);
      if (this.destroyed) return;
      this.place(this.bestDefence(), other(this.attacker), 'The other side');
    }
    if (this.game.winningLine) await this.stage.showWin(this.game.winningLine, this.you);
    this.busy = false;
    this.ended = true;
    this.note = { text: 'That was the answer. Try it yourself (R).' };
    this.refresh();
    this.hooks.onSolved({ run: this.run, tries: this.tries, moves: this.yourMoves, solved: false });
  }

  private async solved(): Promise<void> {
    this.ended = true;
    this.hooks.sound.solved();
    this.note = { text: `Five in a row, in ${this.yourMoves}.` };
    this.refresh();
    await this.stage.showWin(this.game.winningLine!, this.you);
    if (this.destroyed) return;
    this.busy = false;
    this.hooks.onSolved({
      run: this.run,
      tries: this.tries,
      moves: this.yourMoves,
      solved: true,
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  refresh(): void {
    const look = this.hooks.look();
    const puzzle = this.run.puzzle;
    const threats = this.readOn ? threatViews(this.game) : [];
    this.stage.setThreats(threats);
    const band = BANDS.find((b) => b.id === puzzle.band)!;
    const title = this.run.daily
      ? `Daily Puzzle #${this.run.daily.number}`
      : `Puzzle ${puzzle.number}`;
    this.stage.screen.setContext(
      this.run.daily
        ? `Daily Puzzle · win in ${puzzle.moves}`
        : `Puzzles · ${band.name} · win in ${puzzle.moves}`,
    );
    const pips = h(
      'p',
      { class: 'ff-pips ff-puzzle-pips', 'aria-label': `${this.left} of your moves left` },
      'Your moves ',
      ...Array.from({ length: puzzle.moves }, (_, i) =>
        h('span', { class: `ff-pip${i < puzzle.moves - this.left ? ' is-on' : ''}` }),
      ),
    );
    const status =
      this.note ??
      (this.showing
        ? { text: 'Watch the answer.' }
        : this.left === puzzle.moves
          ? { text: `Win in ${puzzle.moves}. Every move must keep the win forced.` }
          : { text: `${this.left} to go. Keep forcing.` });
    const actions: CardAction[] = [
      { label: 'Try again', key: 'R', run: () => this.tryAgain() },
      { label: 'Show me', key: 'S', run: () => void this.showMe() },
    ];
    if (this.hooks.onNext && this.ended)
      actions.push({ label: 'Next puzzle', key: 'N', run: () => this.hooks.onNext?.() });
    const buttons = h(
      'div',
      { class: 'ff-card__actions' },
      ...actions.map((a) =>
        h(
          'button',
          { type: 'button', class: 'ff-button', onclick: () => a.run(), disabled: this.busy },
          a.label,
          a.key ? h('kbd', {}, a.key) : null,
        ),
      ),
    );
    this.stage.screen.setSides(
      [
        seatCard({
          look,
          side: this.you,
          kicker: title,
          name: 'You',
          status,
        }),
        this.run.daily
          ? infoCard('Read the board', 'Off today', 'The Daily Puzzle is read with your own eyes.')
          : readCard({
              on: this.readOn,
              allowed: true,
              mine: { name: 'You', tally: tally(threats, this.you) },
              theirs: { name: 'Them', tally: tally(threats, (1 - this.you) as SideIndex) },
              toggle: (on) => this.setRead(on),
            }),
      ],
      [
        infoCard(
          `${band.name} · try ${this.tries}`,
          `Win in ${puzzle.moves}`,
          pips,
          `You play ${look.pieces[this.you]!.name}. ${puzzle.threes ? 'Fours and open threes' : 'Fours alone'} will do it; only one first move wins this fast.`,
          'The other side blocks every four and answers every three as well as it can.',
          buttons,
        ),
      ],
    );
    this.stage.announce(`${status.text}`);
  }

  /** No clock runs in a puzzle: pausing changes nothing. */
  pause(): void {}

  resume(): void {}

  setLook(look: Look): void {
    this.stage.setLook(look);
    this.refresh();
  }

  showResults(model: ResultsModel): void {
    this.stage.screen.setOverlay(resultsCard(model));
  }

  destroy(): void {
    this.destroyed = true;
    this.stage.destroy();
  }
}
