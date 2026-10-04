import { createRng, type Rng } from '@usr-games/kit';
import { handoutFrom } from '../ai/endgame';
import { chooseMove, type OpponentId } from '../ai/opponents';
import { Position } from '../ai/position';
import { type Board, boxEdges, isFull, newBoard, type Player, play } from '../engine/board';
import { handsBackPairs } from '../game/match';
import { Timeline } from '../ui/timeline';
import { BoardView } from './board-view';
import type { Region } from './frame';
import type { Look } from './look';
import type { MarkId } from './marks';

/**
 * The board playing itself, for the game menu and the Hall's attract mode: Berlekamp's Pupil
 * against Greedy Gus, so the double cross turns up often. Silent; it stops drawing when hidden.
 */
export interface AttractOptions {
  readonly look: Look;
  readonly reducedMotion: boolean;
  readonly seed: number;
  /** Where the board goes inside the canvas; the whole canvas by default. */
  readonly region?: (width: number, height: number) => Region;
}

const PLAYERS: readonly [OpponentId, OpponentId] = ['pupil', 'greedy-gus'];
const MARKS: readonly [MarkId, MarkId] = ['cap', 'grin'];

export class AttractLoop {
  private readonly view: BoardView;
  private readonly timeline = new Timeline();
  private board: Board;
  private rng: Rng;
  private seed: number;
  private look: Look;
  private clock = 0;
  private nextMoveAt = 0.8;
  private lastFrame = 0;
  private frame = 0;
  private visible = true;
  private lastBy: Player | null = null;
  private lastClosed: number[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: AttractOptions,
  ) {
    this.view = new BoardView(canvas);
    this.look = options.look;
    this.seed = options.seed;
    this.timeline.reducedMotion = options.reducedMotion;
    this.rng = createRng(`attract:${this.seed}`);
    this.board = this.warmBoard();
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** A game a dozen lines in, so the menu never opens on an empty board. */
  private warmBoard(): Board {
    let board = newBoard({ columns: 5, rows: 5 });
    for (let i = 0; i < 14 && !isFull(board); i++) {
      board = play(
        board,
        chooseMove(PLAYERS[board.toMove], board, { rng: this.rng, clock: 1_000_000 + i }),
      ).board;
    }
    return board;
  }

  resize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 640;
    const height = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 360;
    const region = this.options.region?.(width, height) ?? { x: 0, y: 0, width, height };
    this.view.layout(width, height, region);
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.timeline.reducedMotion = reducedMotion;
  }

  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible) {
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.tick);
    } else {
      cancelAnimationFrame(this.frame);
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.visible = false;
  }

  private tick = (now: number) => {
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    this.clock += dt;
    if (this.clock >= this.nextMoveAt) this.step();
    this.render();
    if (this.visible) this.frame = requestAnimationFrame(this.tick);
  };

  private step() {
    if (isFull(this.board)) {
      this.seed++;
      this.rng = createRng(`attract:${this.seed}`);
      this.board = newBoard({ columns: 5, rows: 5 });
      this.timeline.clear();
      this.nextMoveAt = this.clock + 0.8;
      return;
    }
    const before = Position.from(this.board);
    const couldTake = before.firstCapturable() >= 0;
    const by = this.board.toMove;
    const edge = chooseMove(PLAYERS[by], this.board, {
      rng: this.rng,
      clock: 1_000_000 + this.board.history.length,
    });
    const { board, closed } = play(this.board, edge);
    this.board = board;
    this.timeline.line(edge, this.clock);
    this.timeline.fill(closed, this.clock);
    const after = Position.from(board);
    const reachable: number[] = [];
    for (let box = 0; box < after.grid.boxes; box++)
      if (after.sides[box] === 3) reachable.push(box);
    if (closed.length === 0 && couldTake && handsBackPairs(after, reachable, edge)) {
      this.timeline.markCross(reachable, this.cutEdge(by, reachable), by, this.clock);
    }
    if (closed.length) this.lastClosed = [...closed];
    this.lastBy = by;
    const capturing = after.firstCapturable() >= 0;
    const pause = isFull(board) ? 3 : capturing ? 0.3 : this.timeline.cross ? 0.9 : 0.62;
    this.nextMoveAt = this.clock + pause;
  }

  private cutEdge(by: Player, kept: readonly number[]): number | null {
    if (this.lastBy !== by) return null;
    for (const taken of this.lastClosed) {
      for (const box of kept) {
        const shared = boxEdges(this.board, taken).find((edge) =>
          boxEdges(this.board, box).includes(edge),
        );
        if (shared !== undefined) return shared;
      }
    }
    return null;
  }

  private render() {
    const position = Position.from(this.board);
    const start = position.firstCapturable();
    const controlling = this.timeline.cross?.by === this.board.toMove;
    const trail = controlling && start >= 0 ? [...handoutFrom(position, start).boxes] : [];
    this.view.render(
      {
        board: this.board,
        look: this.look,
        marks: MARKS,
        lens: null,
        cursor: null,
        hover: null,
        drawing: this.timeline.drawing(this.clock),
        filling: this.timeline.filling(this.clock),
        lineAges: this.timeline.ages(this.clock),
        doubleCross: this.timeline.moment(this.clock, trail, this.lastClosed[0] ?? null),
        seed: 3,
      },
      this.clock,
    );
  }
}
