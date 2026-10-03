import { createRng, type Rng } from '@usr-games/kit';
import type { Choice } from '../engine/ai';
import type { Weighing } from '../engine/campbell/mind';
import { type GameState, newGame, play, type Rules } from '../engine/game';
import { opponentById, type OpponentId } from '../engine/opponents';
import { fivePoints } from '../engine/solver';
import { foursMadeBy } from '../engine/threats';
import type { Look } from '../render/look';
import type { SideIndex } from '../render/view';
import { type ConfirmText, confirmCard, type ResultsModel, resultsCard } from '../ui/cards';
import type { GameSettings } from '../app/saves';
import { type AiSeat, createAiSeat } from './ai-client';
import { sideOf, stoneOf, tally, threatViews, turnAdvice } from './read';
import type { FivefoldSound } from './sound';
import { BoardStage, pointName } from './stage';

/**
 * A game at the board: against a ladder opponent (ranked, with Read the board off, or practice),
 * or two players sharing one device. The session takes the turns, lets the opponent think in its
 * worker with a short natural pause, keeps "Read the board" up to date, and plays the winning
 * moment before handing the result to the app.
 */

export type GameMode =
  | {
      kind: 'ladder';
      opponent: OpponentId;
      ranked: boolean;
      size: 15 | 19;
      rules: Rules;
      youFirst: boolean;
      seed: string;
    }
  | { kind: 'local'; size: 15 | 19; rules: Rules };

export interface GameSummary {
  mode: GameMode;
  game: GameState;
  /** Your side (the first player's, at one device). */
  you: SideIndex;
  /** Read the board was on at any moment. */
  readEverOn: boolean;
  /** You made two fours with one stone. */
  fourFour: boolean;
  durationSeconds: number;
  /** What the opponent weighed before each of its moves, by move number. */
  weighings: (Weighing | null)[];
  /** Moves taken back during the game. */
  takeBacks: number;
}

export interface SessionHooks {
  look(): Look;
  reducedMotion(): boolean;
  settings(): GameSettings;
  updateSettings(patch: Partial<GameSettings>): void;
  sound: FivefoldSound;
  ownPause: boolean;
  inHall: boolean;
  /** The ladder record to show beside the opponent, for a ranked game. */
  record(opponent: OpponentId): { wins: number; needed: number; star: boolean } | null;
  onEnd(summary: GameSummary): void;
  onGameMenu(): void;
  onPause(): void;
  /** Read the board was switched (the app refreshes its pause items). */
  onReadChanged?(): void;
}

export function rulesLabel(rules: Rules): string {
  return rules === 'exact' ? 'Exactly five' : 'Freestyle';
}

/** The opponent's least time "thinking", so its moves never land before you have looked up. */
const THINK_MIN = 0.55;
const THINK_SPREAD = 0.45;

export class GameSession {
  readonly stage: BoardStage;
  private readonly game: GameState;
  private seat: AiSeat | null = null;
  private readonly rng: Rng;
  private readonly you: SideIndex;
  private readOn: boolean;
  private readEverOn: boolean;
  private fourFour = false;
  private thinking = false;
  private paused = false;
  private over = false;
  private destroyed = false;
  private waiting: Choice | null = null;
  private weighings: (Weighing | null)[] = [];
  private speech: string | null;
  private takeBacks = 0;
  private moment: string | null = null;
  private readonly startedAt = performance.now();

  constructor(
    root: HTMLElement,
    readonly mode: GameMode,
    private readonly hooks: SessionHooks,
  ) {
    this.game = newGame(mode.size, mode.rules);
    this.rng = createRng(mode.kind === 'ladder' ? mode.seed : `local:${Date.now()}`);
    this.you = mode.kind === 'ladder' && !mode.youFirst ? 1 : 0;
    this.readOn = this.readAllowed && hooks.settings().readBoard;
    this.readEverOn = this.readOn;
    this.speech = mode.kind === 'ladder' ? opponentById(mode.opponent).hello : null;
    this.stage = new BoardStage(root, {
      look: hooks.look(),
      reducedMotion: hooks.reducedMotion(),
      ownPause: hooks.ownPause,
      inHall: hooks.inHall,
      size: mode.size,
    });
    this.stage.screen.onGameMenu(() => hooks.onGameMenu());
    this.stage.screen.onPause(() => hooks.onPause());
    this.stage.screen.onToggleRead((on) => this.setRead(on));
    this.stage.sessionKeys = (event) => this.onKey(event);
    if (mode.kind === 'ladder') this.seat = this.newSeat([]);
    this.nextTurn();
    this.stage.focusBoard();
  }

  get readAllowed(): boolean {
    return this.mode.kind === 'local' || !this.mode.ranked;
  }

  get isOver(): boolean {
    return this.over;
  }

  get isReadOn(): boolean {
    return this.readOn;
  }

  private newSeat(moves: readonly number[]): AiSeat {
    if (this.mode.kind !== 'ladder') throw new Error('No opponent at one device');
    return createAiSeat({
      opponent: this.mode.opponent,
      size: this.mode.size,
      rules: this.mode.rules,
      seed: `${this.mode.seed}:${moves.length}`,
      moves,
    });
  }

  private get opponentName(): string {
    return this.mode.kind === 'ladder' ? opponentById(this.mode.opponent).name : '';
  }

  private nameOf(side: SideIndex): string {
    if (this.mode.kind === 'local') return this.hooks.look().pieces[side]!.name;
    return side === this.you ? 'You' : this.opponentName;
  }

  private onKey(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    if (key === 't' && this.readAllowed && !this.over) {
      this.setRead(!this.readOn);
      return true;
    }
    if (key === 'z' && this.canTakeBack) {
      this.takeBack();
      return true;
    }
    return false;
  }

  setRead(on: boolean): void {
    if (!this.readAllowed) return;
    this.readOn = on;
    this.readEverOn ||= on;
    this.hooks.updateSettings({ readBoard: on });
    this.refresh();
    this.hooks.onReadChanged?.();
  }

  /** Practice and games at one device let a move be taken back (yours and the reply). */
  get canTakeBack(): boolean {
    if (this.over || this.thinking || this.paused) return false;
    if (this.mode.kind === 'local') return this.game.moves.length > 0;
    return !this.mode.ranked && this.game.moves.length >= (this.you === 0 ? 2 : 3);
  }

  takeBack(): void {
    if (!this.canTakeBack) return;
    const count = this.mode.kind === 'local' ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const p = this.game.moves.pop()!;
      this.game.board[p] = null;
      this.stage.takeBack();
      this.weighings.length = this.game.moves.length;
    }
    this.game.toMove = this.game.moves.length % 2 === 0 ? 'black' : 'white';
    this.takeBacks++;
    if (this.seat) {
      this.seat.dispose();
      this.seat = this.newSeat(this.game.moves);
    }
    this.stage.announce('Move taken back.');
    this.nextTurn();
  }

  private nextTurn(): void {
    if (this.over) return;
    const side = sideOf(this.game.toMove);
    if (this.mode.kind === 'ladder' && side !== this.you) void this.opponentTurn();
    else this.stage.setHand(side, (p) => this.place(p, side));
    this.refresh();
  }

  private async opponentTurn(): Promise<void> {
    const seat = this.seat!;
    this.stage.setHand(null);
    this.thinking = true;
    this.refresh();
    const pause = (THINK_MIN + this.rng.next() * THINK_SPREAD) * 1000;
    const [choice] = await Promise.all([
      seat.choose(),
      new Promise((resolve) => setTimeout(resolve, pause)),
    ]);
    if (this.destroyed || seat !== this.seat) return;
    if (this.paused) {
      this.waiting = choice;
      return;
    }
    this.applyOpponent(choice);
  }

  private applyOpponent(choice: Choice): void {
    this.thinking = false;
    let point = choice.point;
    // The search never names a taken point; if it ever did, play the first free one rather than stall.
    if (this.game.board[point] !== null) point = this.game.board.indexOf(null);
    this.weighings[this.game.moves.length] = choice.weighing;
    this.place(point, sideOf(this.game.toMove));
  }

  private place(p: number, side: SideIndex): void {
    if (
      this.over ||
      this.paused ||
      this.game.board[p] !== null ||
      sideOf(this.game.toMove) !== side
    )
      return;
    const stone = stoneOf(side);
    const result = play(this.game, p);
    if (result === 'illegal') return;
    const look = this.hooks.look();
    const mine = this.mode.kind === 'local' || side === this.you;
    this.stage.place(p, side, this.nameOf(side));
    this.hooks.sound.place(look.dark, mine);
    this.seat?.played(p);
    if (side === this.you && foursMadeBy(this.game, p, stone) >= 2) this.fourFour = true;
    if (result === 'win' || result === 'draw') {
      void this.finish();
      return;
    }
    if (this.mode.kind === 'ladder' && side !== this.you && fivePoints(this.game, stone).length > 0)
      this.hooks.sound.warning();
    this.nextTurn();
  }

  private async finish(): Promise<void> {
    this.over = true;
    this.thinking = false;
    this.stage.setHand(null);
    const game = this.game;
    const look = this.hooks.look();
    if (this.mode.kind === 'ladder') {
      const opponent = opponentById(this.mode.opponent);
      const won = game.winner === stoneOf(this.you);
      this.speech = game.draw ? opponent.afterDraw : won ? opponent.afterLoss : opponent.afterWin;
      this.moment = game.draw ? 'A full board' : won ? 'Five in a row' : `${opponent.name} wins`;
      if (game.draw) this.hooks.sound.draw();
      else if (won) this.hooks.sound.win(look.dark);
      else this.hooks.sound.loss();
    } else {
      this.moment = game.draw ? 'A full board' : `${this.nameOf(sideOf(game.winner!))} wins`;
      if (game.draw) this.hooks.sound.draw();
      else this.hooks.sound.win(look.dark);
    }
    this.refresh();
    if (game.winningLine) await this.stage.showWin(game.winningLine, sideOf(game.winner!));
    else await new Promise((resolve) => setTimeout(resolve, 900));
    if (this.destroyed) return;
    this.hooks.onEnd({
      mode: this.mode,
      game,
      you: this.you,
      readEverOn: this.readEverOn,
      fourFour: this.fourFour,
      durationSeconds: Math.round((performance.now() - this.startedAt) / 1000),
      weighings: this.weighings,
      takeBacks: this.takeBacks,
    });
  }

  /** Redraws the columns and the threats from the game as it stands. */
  refresh(): void {
    const game = this.game;
    const threats = this.readOn ? threatViews(game) : [];
    this.stage.setThreats(threats);
    const look = this.hooks.look();
    const size = `${game.size} × ${game.size}`;
    const last = game.moves.at(-1);
    const theirSide = (1 - this.you) as SideIndex;
    const mode = this.mode;
    const yourTurn = !this.over && sideOf(game.toMove) === this.you;
    const status = this.over
      ? null
      : mode.kind === 'local'
        ? { text: `${look.pieces[sideOf(game.toMove)]!.name} to move.` }
        : yourTurn
          ? turnAdvice(game, this.readOn ? threats : null, this.you, this.opponentName)
          : { text: 'Your move is next.' };
    this.stage.screen.update({
      context:
        mode.kind === 'local'
          ? `Two players · ${rulesLabel(mode.rules)} · ${size}`
          : `${mode.ranked ? 'Ladder' : 'Practice'} · ${rulesLabel(mode.rules)} · ${size}`,
      you:
        mode.kind === 'local'
          ? { name: look.pieces[0]!.name, kicker: 'First player', side: 0 }
          : { name: 'You', kicker: 'Your seat', side: this.you },
      them:
        mode.kind === 'local'
          ? { name: look.pieces[1]!.name, kicker: 'Second player', side: 1 }
          : { name: this.opponentName, kicker: 'Opponent', side: theirSide },
      opponent: mode.kind === 'ladder' ? opponentById(mode.opponent) : null,
      status,
      read: {
        on: this.readOn,
        allowed: this.readAllowed,
        mine: tally(threats, mode.kind === 'local' ? 0 : this.you),
        theirs: tally(threats, mode.kind === 'local' ? 1 : theirSide),
        offReason: 'Off in ranked games: you read it yourself. Practice games allow it.',
      },
      record: mode.kind === 'ladder' && mode.ranked ? this.hooks.record(mode.opponent) : null,
      speech: this.speech,
      thinking: this.thinking,
      moveNumber: game.moves.length + (this.over ? 0 : 1),
      lastMove: last === undefined ? null : pointName(game.size, last),
      moment: this.moment,
    });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting) this.applyOpponent(waiting);
  }

  setLook(look: Look): void {
    this.stage.setLook(look);
    this.refresh();
  }

  showResults(model: ResultsModel): void {
    this.stage.screen.setOverlay(resultsCard(model));
  }

  confirm(text: ConfirmText): Promise<boolean> {
    return new Promise((resolve) => {
      this.stage.screen.setOverlay(
        confirmCard(text, (yes) => {
          this.stage.screen.setOverlay(null);
          this.stage.focusBoard();
          resolve(yes);
        }),
      );
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.seat?.dispose();
    this.stage.destroy();
  }
}
