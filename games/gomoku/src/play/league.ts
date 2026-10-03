import { createRng } from '@usr-games/kit';
import { type GameState, newGame, play, type Rules } from '../engine/game';
import { opponentById, type OpponentId } from '../engine/opponents';
import type { Weighing } from '../engine/campbell/mind';
import type { Look } from '../render/look';
import type { SideIndex } from '../render/view';
import type { LeagueSpeed } from '../app/saves';
import { infoCard, opponentCard, type ResultsModel, resultsCard } from '../ui/cards';
import { h } from '../ui/dom';
import { type AiSeat, createAiSeat } from './ai-client';
import { sideOf } from './read';
import type { FivefoldSound } from './sound';
import { BoardStage, pointName } from './stage';

/**
 * The Bot League: two opponents play a match, first to two wins, swapping sides each game — the
 * 1994 program's tournament mode, now a show. You watch at a pace of your choosing and can show
 * what each one weighed before its move.
 */

export interface LeagueMatch {
  first: OpponentId;
  second: OpponentId;
  speed: LeagueSpeed;
  size: 15 | 19;
  rules: Rules;
}

export interface LeagueOutcome {
  match: LeagueMatch;
  /** Wins for the first and the second named. */
  score: [number, number];
  games: number;
}

export interface LeagueHooks {
  look(): Look;
  reducedMotion(): boolean;
  sound: FivefoldSound;
  ownPause: boolean;
  inHall: boolean;
  onEnd(outcome: LeagueOutcome): void;
  onGameMenu(): void;
  onPause(): void;
}

const PACE: Record<LeagueSpeed, number> = { calm: 1.3, brisk: 0.6, swift: 0.2 };
/** Games played at most: two draws and no winner would end the match level. */
const MOST_GAMES = 5;

export class LeagueSession {
  readonly stage: BoardStage;
  private game!: GameState;
  private seats: [AiSeat, AiSeat] | null = null;
  private readonly score: [number, number] = [0, 0];
  private gameNumber = 0;
  private paused = false;
  private destroyed = false;
  private finished = false;
  private showThoughts = false;
  private weighing: Weighing | null = null;
  private weighingSide: SideIndex = 0;
  private headline: string | null = null;
  private wake: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    readonly match: LeagueMatch,
    private readonly hooks: LeagueHooks,
  ) {
    this.stage = new BoardStage(root, {
      look: hooks.look(),
      reducedMotion: hooks.reducedMotion(),
      ownPause: hooks.ownPause,
      inHall: hooks.inHall,
      size: match.size,
    });
    this.stage.screen.onGameMenu(() => hooks.onGameMenu());
    this.stage.screen.onPause(() => hooks.onPause());
    this.stage.sessionKeys = (event) => {
      if (event.key.toLowerCase() !== 'w') return false;
      this.toggleThoughts();
      return true;
    };
    void this.run();
  }

  get isOver(): boolean {
    return this.finished;
  }

  /** In game n (from 0), the first-named plays first in even games. */
  private playerOf(side: SideIndex): 0 | 1 {
    return ((side + this.gameNumber) % 2) as 0 | 1;
  }

  private idOf(player: 0 | 1): OpponentId {
    return player === 0 ? this.match.first : this.match.second;
  }

  toggleThoughts(): void {
    this.showThoughts = !this.showThoughts;
    this.stage.setWeighing(this.showThoughts ? this.weighing : null, this.weighingSide);
    this.refresh();
  }

  private async run(): Promise<void> {
    while (!this.destroyed && Math.max(...this.score) < 2 && this.gameNumber < MOST_GAMES) {
      await this.playGame();
      if (this.destroyed) return;
      this.gameNumber++;
    }
    if (this.destroyed) return;
    this.finished = true;
    this.hooks.onEnd({ match: this.match, score: [...this.score], games: this.gameNumber });
  }

  private async playGame(): Promise<void> {
    const rng = createRng(
      `league:${this.match.first}:${this.match.second}:${Date.now()}:${this.gameNumber}`,
    );
    this.game = newGame(this.match.size, this.match.rules);
    this.stage.reset(this.match.size);
    this.weighing = null;
    this.stage.setWeighing(null);
    this.seats?.forEach((s) => s.dispose());
    const setup = (side: SideIndex) => ({
      opponent: this.idOf(this.playerOf(side)),
      size: this.match.size,
      rules: this.match.rules,
      seed: `${rng.nextUint32()}`,
    });
    this.seats = [createAiSeat(setup(0)), createAiSeat(setup(1))];
    const firstName = opponentById(this.idOf(this.playerOf(0))).name;
    this.headline = `Game ${this.gameNumber + 1}: ${firstName} moves first`;
    this.refresh();
    await this.wait(1200);
    while (!this.destroyed && this.game.winner === null && !this.game.draw) {
      const side = sideOf(this.game.toMove);
      const seats: [AiSeat, AiSeat] = this.seats;
      const started = performance.now();
      const choice = await seats[side].choose();
      if (this.destroyed || seats !== this.seats) return;
      const pace = PACE[this.match.speed] * 1000 - (performance.now() - started);
      if (pace > 0) await this.wait(pace);
      await this.whilePaused();
      if (this.destroyed) return;
      let point = choice.point;
      if (this.game.board[point] !== null) point = this.game.board.indexOf(null);
      this.weighing = choice.weighing;
      this.weighingSide = side;
      play(this.game, point);
      const name = opponentById(this.idOf(this.playerOf(side))).name;
      this.stage.place(point, side, name);
      this.hooks.sound.place(this.hooks.look().dark, side === 0);
      for (const s of seats) s.played(point);
      this.stage.setWeighing(this.showThoughts ? this.weighing : null, side);
      this.headline = null;
      this.refresh();
    }
    if (this.destroyed) return;
    if (this.game.winner) {
      const winner = this.playerOf(sideOf(this.game.winner));
      this.score[winner]++;
      this.headline = `${opponentById(this.idOf(winner)).name} wins game ${this.gameNumber + 1}`;
      this.hooks.sound.win(this.hooks.look().dark);
      this.stage.setWeighing(null);
      this.refresh();
      await this.stage.showWin(this.game.winningLine!, sideOf(this.game.winner));
    } else {
      this.headline = `Game ${this.gameNumber + 1} is drawn`;
      this.refresh();
      await this.wait(1500);
    }
    await this.wait(800);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private whilePaused(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => {
      this.wake = resolve;
    });
  }

  refresh(): void {
    const look = this.hooks.look();
    const size = `${this.match.size} × ${this.match.size}`;
    this.stage.screen.setContext(
      `Bot League · ${this.match.rules === 'exact' ? 'Exactly five' : 'Freestyle'} · ${size}`,
    );
    const card = (player: 0 | 1) => {
      const id = this.idOf(player);
      const side = ((player + this.gameNumber) % 2) as SideIndex;
      return opponentCard({
        look,
        opponent: opponentById(id),
        side,
        speech: null,
        record: null,
        kicker: `${this.score[player]} ${this.score[player] === 1 ? 'win' : 'wins'} · first to two`,
      });
    };
    const last = this.game?.moves.at(-1);
    const toggle = h(
      'button',
      {
        type: 'button',
        class: 'ff-button',
        'aria-pressed': String(this.showThoughts),
        onclick: () => this.toggleThoughts(),
      },
      this.showThoughts ? 'Hide their thinking' : 'Show their thinking',
      h('kbd', {}, 'W'),
    );
    this.stage.screen.setSides(
      [
        card(0),
        infoCard(
          `Game ${this.gameNumber + 1} · move ${this.game?.moves.length ?? 0}`,
          this.headline ?? 'At the board',
          last === undefined
            ? 'The first move goes near the middle.'
            : `Last: ${pointName(this.match.size, last)}.`,
          this.showThoughts
            ? 'Dots: points the mover rated, bigger for stronger. Thin dotted lines: frames it found forcing. Ring: its choice; dashed ring: the other side’s best.'
            : 'Show their thinking to see what the 1994 search weighed before each move.',
          toggle,
        ),
      ],
      [card(1)],
    );
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }

  setLook(look: Look): void {
    this.stage.setLook(look);
    this.refresh();
  }

  showResults(model: ResultsModel): void {
    this.stage.screen.setOverlay(resultsCard(model));
  }

  destroy(): void {
    this.destroyed = true;
    this.seats?.forEach((s) => s.dispose());
    this.stage.destroy();
  }
}
