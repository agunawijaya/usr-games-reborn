import { CUBE_SETS } from '../engine/cube-sets';
import { facesOf, type Roll } from '../engine/roll';
import { ATTRACT_BOARDS, type AttractBoard } from './attract-boards';
import type { BoardView } from './board-view';

/**
 * The attract loop: a hunter at work on a showcase board, silently. Cubes tumble in, words are
 * traced one cube at a time, each flashes as it is found (the long one pops), and the board ends
 * lit as a web before the next one tumbles in. Used behind the title and in the Hall's tiles.
 */

export function rollOf(board: AttractBoard): Roll {
  const cubes = CUBE_SETS[4];
  const faces = board.cubeAt.map((cube, cell) => facesOf(cubes[cube]!)[board.faceUp[cell]!]!);
  return { board: { size: 4, faces }, cubeAt: [...board.cubeAt], faceUp: [...board.faceUp] };
}

const STEP_MS = 170;
const HOLD_MS = 380;
const GAP_MS = 420;
const WEB_MS = 3400;
/** Returned by the last step of a board: tumble the next one in. */
const NEXT_BOARD = -1;

export class AttractLoop {
  private index: number;
  private timer = 0;
  private running = false;
  private visible = true;
  private queue: Array<() => number> = [];

  constructor(
    private readonly board: BoardView,
    seed: number,
    /** Called with each word as it is found, for a caption. */
    private readonly onWord: (word: string) => void = () => undefined,
  ) {
    this.index = seed % ATTRACT_BOARDS.length;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextBoard();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.board.setVisible(visible);
    if (visible && this.running && this.timer === 0) this.run();
  }

  stop() {
    this.running = false;
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  private nextBoard() {
    const showcase = ATTRACT_BOARDS[this.index % ATTRACT_BOARDS.length]!;
    this.index++;
    const board = this.board;
    board.setRoll(rollOf(showcase), this.index * 7, true);
    board.setDimmed(0.12);
    this.queue = [() => Math.max(600, board.tumbleRemaining() * 1000 + 300)];
    for (const { word, path } of showcase.words) {
      for (let step = 1; step <= path.length; step++) {
        this.queue.push(() => {
          board.setTrace(path.slice(0, step));
          return STEP_MS;
        });
      }
      this.queue.push(() => {
        if (word.length >= 7) board.pop(path);
        else board.flash(path);
        this.onWord(word);
        return HOLD_MS;
      });
      this.queue.push(() => {
        board.setTrace([]);
        return GAP_MS;
      });
    }
    this.queue.push(() => {
      board.showWeb(showcase.words.map(({ path }) => ({ path, found: true })));
      return WEB_MS;
    });
    this.queue.push(() => NEXT_BOARD);
    this.run();
  }

  private run() {
    this.timer = 0;
    if (!this.running || !this.visible) return;
    const step = this.queue.shift();
    if (!step) return;
    const wait = step();
    if (!this.running) return;
    if (wait === NEXT_BOARD) this.nextBoard();
    else this.timer = window.setTimeout(() => this.run(), wait);
  }
}
