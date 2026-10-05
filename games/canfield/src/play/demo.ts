import type { Move } from '../engine/rules';
import { winnableDeal } from '../engine/deals';
import { type Game, playMove, startGame } from '../engine/game';
import type { Look } from '../render/look';
import {
  emptyModel,
  finishOrder,
  finishSeconds,
  type FinishView,
  TableView,
} from '../render/table-view';
import { Animator } from './animator';
import { SILENT } from './sound';

/**
 * The Hall's attract mode: a deal the solver has won plays itself at a steady pace, silently,
 * blooms and spirals at the end, then a new deal begins. It stops whenever it is out of sight.
 */

const STEP_SECONDS = 0.55;

export class DemoTable {
  readonly view: TableView;
  private animator!: Animator;
  private game!: Game;
  private line: Move[] = [];
  private next = 0;
  private finish: FinishView | null = null;
  private restartAt = 0;
  private round = 0;
  private frame = 0;
  private running = false;
  private lastStep = 0;

  constructor(
    private readonly seed: string,
    look: Look,
    private reducedMotion: boolean,
  ) {
    this.view = new TableView(look, reducedMotion);
    this.deal();
  }

  private deal(): void {
    const found = winnableDeal(`demo:${this.seed}:${this.round++}`, 'standard', 20_000);
    this.game = startGame(
      { kind: 'random', seed: found.seed },
      found.deal,
      'standard',
      'points',
    ).game;
    this.line = found.verdict.result === 'winnable' ? found.verdict.line : [];
    this.next = 0;
    this.finish = null;
    this.animator = new Animator(this.view, this.game.layout, SILENT);
  }

  resize(width: number, height: number, scale: number): void {
    this.view.resize(width, height, scale);
    this.animator.settle(this.now());
    this.draw();
  }

  setLook(look: Look, reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.view.setLook(look, reducedMotion);
    this.draw();
  }

  private now(): number {
    return performance.now() / 1000;
  }

  private advance(now: number): void {
    if (this.finish) {
      if (now >= this.restartAt) this.deal();
      return;
    }
    if (now - this.lastStep < STEP_SECONDS || this.animator.busy(now)) return;
    this.lastStep = now;
    const move = this.line[this.next++];
    if (!move) {
      this.restartAt = now + 1.5;
      this.finish = { startedAt: now, cards: [] };
      return;
    }
    const before = this.game.layout;
    const step = playMove(this.game, move, 0);
    if (!step) {
      this.deal();
      return;
    }
    this.game = step.game;
    const lands = this.animator.play(
      before,
      step.game.layout,
      step.events,
      now,
      !this.reducedMotion,
    );
    if (this.game.ending === 'won') {
      const at = lands + 0.3;
      this.animator.bloomAll(at);
      this.finish = { startedAt: at, cards: finishOrder(this.game.layout.foundations) };
      this.restartAt = at + finishSeconds(this.finish) + 1.2;
    }
  }

  private draw(): void {
    const now = this.now();
    const model = {
      ...emptyModel(this.game.layout, this.animator.blooms),
      flights: this.animator.current(now),
      hidden: this.animator.hidden(now),
      finish: this.finish && this.finish.cards.length > 0 ? this.finish : null,
      labels: false,
    };
    this.view.render(model, now);
  }

  private loop = () => {
    this.frame = 0;
    if (!this.running) return;
    this.advance(this.now());
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastStep = this.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
