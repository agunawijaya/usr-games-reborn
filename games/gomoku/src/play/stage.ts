import type { Weighing } from '../engine/campbell/mind';
import { pointCentre } from '../render/geometry';
import type { Look } from '../render/look';
import {
  BoardView,
  type PieceView,
  type SideIndex,
  type ThreatView,
  WIN_TIMING,
  type WinView,
} from '../render/view';
import { h } from '../ui/dom';
import { createPlayScreen, type PlayScreen } from '../ui/play-screen';

/**
 * The board on the play screen, alive: the canvas redrawn every frame, the pieces placed with the
 * time they landed (so they settle), the threat lines, the win moment, and the player's hand —
 * a pointer that hovers and clicks, or an arrow-key cursor and Enter. Sessions decide what
 * happens; the stage shows it and reports the point chosen.
 */

export interface StageOptions {
  look: Look;
  reducedMotion: boolean;
  ownPause: boolean;
  inHall: boolean;
  size: number;
}

const LETTERS = 'ABCDEFGHJKLMNOPQRST';

export function pointName(size: number, p: number): string {
  return `${LETTERS[p % size]}${size - Math.floor(p / size)}`;
}

export class BoardStage {
  readonly screen: PlayScreen;
  readonly view: BoardView;
  /** The focusable region over the board that takes the pointer and the keys. */
  readonly board: HTMLElement;
  private readonly announcer: HTMLElement;
  private readonly started = performance.now();
  private frame = 0;
  private size: number;
  private pieces: PieceView[] = [];
  private threats: readonly ThreatView[] = [];
  private win: WinView | null = null;
  private weighing: Weighing | null = null;
  private weighingSide: SideIndex = 1;
  private cursor: number | null = null;
  private hover: number | null = null;
  private cursorShown = false;
  private hand: { side: SideIndex; pick: (p: number) => void } | null = null;
  private reducedMotion: boolean;
  private readonly observer: ResizeObserver;
  private readonly keydown = (event: KeyboardEvent) => this.handleKey(event);
  /** Keys the session takes (T, Z...), after the board has had its arrows and Enter. */
  sessionKeys: ((event: KeyboardEvent) => boolean) | null = null;

  constructor(host: HTMLElement, options: StageOptions) {
    this.size = options.size;
    this.reducedMotion = options.reducedMotion;
    this.screen = createPlayScreen(host, options.look, options);
    this.view = new BoardView(this.screen.canvas, options.look);
    this.announcer = h('p', { class: 'ff-visually-hidden', 'aria-live': 'polite' });
    this.board = h('div', {
      class: 'ff-board-hit',
      tabindex: '0',
      role: 'application',
      'aria-roledescription': 'board',
      'data-testid': 'board',
    });
    this.screen.root.append(this.board, this.announcer);
    this.describeBoard();
    this.board.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.board.addEventListener('pointerleave', () => {
      this.hover = null;
    });
    this.board.addEventListener('click', (event) => this.onClick(event));
    window.addEventListener('keydown', this.keydown);
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(this.screen.root);
    this.fit();
    this.loop();
  }

  get time(): number {
    return (performance.now() - this.started) / 1000;
  }

  private describeBoard(): void {
    this.board.setAttribute(
      'aria-label',
      `Board, ${this.size} by ${this.size}. Arrow keys move the cursor; Enter or Space places a stone.`,
    );
  }

  private fit(): void {
    const box = this.screen.root.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const { slot, horizon } = this.screen.layout(box.width, box.height);
    this.view.resize(box.width, box.height, window.devicePixelRatio || 1, slot, horizon, this.size);
    Object.assign(this.board.style, {
      left: `${slot.x}px`,
      top: `${slot.y}px`,
      width: `${slot.width}px`,
      height: `${slot.height}px`,
    });
  }

  private loop = (): void => {
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  draw(): void {
    const hand = this.hand;
    const target = this.cursorShown ? this.cursor : this.hover;
    this.view.draw({
      size: this.size,
      pieces: this.pieces,
      last: this.pieces.at(-1)?.point ?? null,
      threats: this.threats,
      cursor: hand && this.cursorShown ? this.cursor : null,
      ghost:
        hand && target !== null && !this.isTaken(target)
          ? { point: target, side: hand.side }
          : null,
      win: this.win,
      weighing: this.weighing ? { weighing: this.weighing, side: this.weighingSide } : null,
      time: this.time,
      motion: !this.reducedMotion,
    });
  }

  setLook(look: Look): void {
    this.screen.setLook(look);
    this.view.setLook(look);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** A fresh board of `size` lines with these pieces already on it (settled). */
  reset(size: number, moves: readonly number[] = []): void {
    this.size = size;
    this.describeBoard();
    this.pieces = moves.map((point, i) => ({
      point,
      side: (i % 2) as SideIndex,
      placedAt: -10,
    }));
    this.threats = [];
    this.win = null;
    this.weighing = null;
    this.cursor = null;
    this.fit();
    this.noteMoves();
  }

  /** The moves on the board, on the board's element: for the browser tests and assistive tools. */
  private noteMoves(): void {
    this.board.dataset.moves = this.pieces.map((piece) => piece.point).join(',');
  }

  isTaken(p: number): boolean {
    return this.pieces.some((piece) => piece.point === p);
  }

  /** A piece lands now (it settles with a ripple), and is announced. */
  place(point: number, side: SideIndex, who: string): void {
    this.pieces.push({ point, side, placedAt: this.time });
    this.noteMoves();
    this.cursor = point;
    this.announce(`${who} played ${pointName(this.size, point)}.`);
  }

  /** Takes the last piece back (the tutorial and local games). */
  takeBack(): void {
    this.pieces.pop();
    this.noteMoves();
  }

  announce(text: string): void {
    this.announcer.textContent = text;
  }

  setThreats(threats: readonly ThreatView[]): void {
    this.threats = threats;
  }

  /** The winning line's moment begins now; resolves when it has played. */
  showWin(line: readonly number[], side: SideIndex): Promise<void> {
    this.win = { line: [...line], side, at: this.time };
    this.threats = [];
    const length = this.reducedMotion
      ? 0.9
      : Math.max(WIN_TIMING.riseStart + WIN_TIMING.riseLength, WIN_TIMING.ringsStart + 2.4);
    return new Promise((resolve) => setTimeout(resolve, length * 1000));
  }

  /** What an AI weighed before its move, drawn over the board (the replay, the Bot League). */
  setWeighing(weighing: Weighing | null, side: SideIndex = 1): void {
    this.weighing = weighing;
    this.weighingSide = side;
  }

  /**
   * Lets the player place a piece for `side`: `pick` is told the point. Pass null to take the
   * hand away (the other side is thinking, or the game is over).
   */
  setHand(side: SideIndex | null, pick?: (p: number) => void): void {
    this.hand = side === null || !pick ? null : { side, pick };
  }

  focusBoard(): void {
    this.board.focus({ preventScroll: true });
  }

  private pointFromEvent(event: MouseEvent): number | null {
    const box = this.screen.root.getBoundingClientRect();
    return this.view.pointAt(event.clientX - box.left, event.clientY - box.top);
  }

  private onPointerMove(event: PointerEvent): void {
    this.hover = this.pointFromEvent(event);
    if (event.pointerType === 'mouse') this.cursorShown = false;
  }

  private onClick(event: MouseEvent): void {
    const p = this.pointFromEvent(event);
    if (p === null || !this.hand || this.isTaken(p)) return;
    this.cursor = p;
    this.hand.pick(p);
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.screen.root.querySelector('.ff-overlay')) return;
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select');
    if (typing) return;
    const onButton = target?.closest('button, a, [role="button"]');
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = moves[event.key];
    if (step && this.hand && !onButton) {
      event.preventDefault();
      this.moveCursor(step[0], step[1]);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && this.hand && !onButton) {
      event.preventDefault();
      if (!this.cursorShown || this.cursor === null) {
        this.moveCursor(0, 0);
        return;
      }
      if (!this.isTaken(this.cursor)) this.hand.pick(this.cursor);
      return;
    }
    if (this.sessionKeys?.(event)) event.preventDefault();
  }

  private moveCursor(dx: number, dy: number): void {
    const middle = (this.size - 1) / 2;
    const at = this.cursor ?? middle * this.size + middle;
    const x = Math.min(this.size - 1, Math.max(0, (at % this.size) + (this.cursorShown ? dx : 0)));
    const y = Math.min(
      this.size - 1,
      Math.max(0, Math.floor(at / this.size) + (this.cursorShown ? dy : 0)),
    );
    this.cursor = y * this.size + x;
    this.cursorShown = true;
    const name = pointName(this.size, this.cursor);
    this.announce(this.isTaken(this.cursor) ? `${name}, taken.` : `${name}.`);
  }

  /** The centre of a point in page pixels, for tests and the coach's pointer. */
  centreOf(p: number): { x: number; y: number } | null {
    const g = this.view.geometry;
    if (!g) return null;
    const box = this.screen.root.getBoundingClientRect();
    const c = pointCentre(g, p);
    return { x: box.left + c.x, y: box.top + c.y };
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener('keydown', this.keydown);
    this.screen.root.remove();
  }
}
