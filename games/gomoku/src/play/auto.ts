import { createRng } from '@usr-games/kit';
import { type GameState, newGame, play } from '../engine/game';
import type { OpponentId } from '../engine/opponents';
import type { Rect } from '../render/geometry';
import type { Look } from '../render/look';
import {
  BoardView,
  type PieceView,
  type SideIndex,
  WIN_TIMING,
  type WinView,
} from '../render/view';
import { Brain } from './brain';
import { sideOf } from './read';

/**
 * A game that plays itself, for the Hall's attract mode: two gentle opponents on a 15 × 15 board,
 * thinking in the page (they are quick), a move every moment, the winning five's moment, and a
 * new game. Silent. Stops when told to (off-screen), and stays still under reduced motion.
 */

const PAIRS: [OpponentId, OpponentId][] = [
  ['reed', 'heron'],
  ['heron', 'reed'],
  ['pebble', 'reed'],
];

export class AutoBoard {
  private readonly view: BoardView;
  private game!: GameState;
  private brains!: [Brain, Brain];
  private pieces: PieceView[] = [];
  private win: WinView | null = null;
  private round = 0;
  private frame = 0;
  private running = false;
  private nextMoveAt = 0;
  private readonly started = performance.now();

  constructor(
    canvas: HTMLCanvasElement,
    private look: Look,
    private readonly seed: string,
    private readonly reducedMotion: boolean,
  ) {
    this.view = new BoardView(canvas, look);
    this.newGame();
    // A still frame shows a game well under way.
    for (let i = 0; i < 24 && !this.game.winner; i++) this.step(-10);
  }

  private get time(): number {
    return (performance.now() - this.started) / 1000;
  }

  private newGame(): void {
    const rng = createRng(`${this.seed}:${this.round}`);
    const [a, b] = PAIRS[this.round % PAIRS.length]!;
    this.game = newGame(15, 'freestyle');
    this.brains = [
      new Brain({ opponent: a, size: 15, rules: 'freestyle', seed: `${rng.nextUint32()}` }),
      new Brain({ opponent: b, size: 15, rules: 'freestyle', seed: `${rng.nextUint32()}` }),
    ];
    this.pieces = [];
    this.win = null;
  }

  private step(at: number): void {
    const side = sideOf(this.game.toMove);
    const { point } = this.brains[side].choose();
    play(this.game, point);
    for (const brain of this.brains) brain.played(point);
    this.pieces.push({ point, side: side as SideIndex, placedAt: at });
    if (this.game.winningLine)
      this.win = { line: [...this.game.winningLine], side: sideOf(this.game.winner!), at };
  }

  /** The board fills the frame, with a little sky (by night) above it. */
  resize(width: number, height: number, scale: number): void {
    const side = Math.min(width, height) * 0.96;
    const slot: Rect = {
      x: (width - side) / 2,
      y: height - side - height * 0.02,
      width: side,
      height: side,
    };
    this.view.resize(width, height, scale, slot, Math.max(0, slot.y - 2), 15);
    this.draw();
  }

  setLook(look: Look): void {
    this.look = look;
    this.view.setLook(look);
    this.draw();
  }

  draw(): void {
    this.view.draw({
      size: 15,
      pieces: this.pieces,
      last: this.pieces.at(-1)?.point ?? null,
      threats: [],
      cursor: null,
      ghost: null,
      win: this.win,
      time: this.time,
      motion: !this.reducedMotion,
    });
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = this.time;
    if (now >= this.nextMoveAt) {
      if (this.win || this.game.draw) {
        this.round++;
        this.newGame();
        this.nextMoveAt = now + 0.6;
      } else {
        this.step(now);
        this.nextMoveAt =
          now + (this.win ? WIN_TIMING.riseStart + WIN_TIMING.riseLength + 1.2 : 0.75);
      }
    }
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  start(): void {
    if (this.running || this.reducedMotion) return;
    this.running = true;
    this.nextMoveAt = this.time + 0.4;
    this.tick();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}
