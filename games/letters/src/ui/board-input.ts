import { type Board, canExtend, faceLabel, type Rule, spell } from '../engine/grid';
import { pathsSpelling } from '../engine/solver';
import type { BoardView } from '../render/board-view';
import type { Point } from '../render/camera';
import { h } from './dom';

/**
 * Every way to build a word on the board. Drag across touching cubes (drag back to undo a
 * step) and let go to claim it; or click cubes one by one and click the last again (or press
 * Enter, or Claim) to claim it; or type the letters, and the board lights every path that
 * spells them; or move between cubes with the arrow keys and add them with Space. A layer of
 * real buttons over the cubes carries keyboard focus and screen-reader labels.
 */

export interface ChainView {
  /** The cubes of the chain being built, or of the path shown for typed letters. */
  cells: readonly number[];
  /** Letters typed, when the word is being typed. */
  typed: string;
  /** Other cubes that could also spell the typed letters. */
  hints: readonly number[];
  /** True when typed letters spell nothing on the board. */
  stray: boolean;
  /** Where the pointer is while dragging, for the ribbon's loose end. */
  tail: Point | null;
}

export interface InputHandlers {
  change(view: ChainView): void;
  /** A cube joined the chain; `index` is its place in the word. */
  step(index: number): void;
  claimPath(cells: readonly number[]): void;
  claimTyped(typed: string, shown: readonly number[] | undefined): void;
}

const DRAG_REACH = 0.42;

export class BoardInput {
  readonly layer: HTMLElement;
  private board: Board | null = null;
  private rule: Rule = 'classic';
  private cells: number[] = [];
  private typed = '';
  private options: number[][] = [];
  private tail: Point | null = null;
  private dragging = false;
  private grew = false;
  private enabled = false;
  private focusCell = 0;
  private buttons: HTMLButtonElement[] = [];
  private readonly detach: () => void;

  constructor(
    private readonly view: BoardView,
    /** The element pointer events are read from: the board's space on screen. */
    private readonly surface: HTMLElement,
    /** The element whose top-left corner the board view's coordinates start from. */
    private readonly origin: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {
    this.layer = h('div', { class: 'chl-cubes', role: 'grid', 'aria-label': 'Letter cubes' });
    const down = (event: PointerEvent) => this.down(event);
    const move = (event: PointerEvent) => this.move(event);
    const up = (event: PointerEvent) => this.up(event, true);
    const cancel = (event: PointerEvent) => this.up(event, false);
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', cancel);
    this.detach = () => {
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', cancel);
    };
  }

  setBoard(board: Board, rule: Rule) {
    this.board = board;
    this.rule = rule;
    this.clear();
    this.buildButtons();
  }

  enable(on: boolean) {
    this.enabled = on;
    this.layer.dataset.enabled = String(on);
    for (const button of this.buttons) button.disabled = !on;
    if (!on) {
      this.dragging = false;
      this.clear();
    }
  }

  get hasWord(): boolean {
    return this.cells.length > 0 || this.typed.length > 0;
  }

  clear() {
    this.cells = [];
    this.typed = '';
    this.options = [];
    this.tail = null;
    this.emit();
  }

  /** Claims whatever is being built, from the keyboard or the Claim button. */
  claim() {
    if (!this.enabled) return;
    if (this.typed) this.handlers.claimTyped(this.typed, this.options[0]);
    else if (this.cells.length > 0) this.handlers.claimPath([...this.cells]);
  }

  /** Places the focusable cube buttons over the cubes as they sit on screen. */
  layout() {
    const frame = this.origin.getBoundingClientRect();
    const layer = this.layer.getBoundingClientRect();
    this.buttons.forEach((button, cell) => {
      const box = this.view.cellBox(cell);
      if (!box) return;
      button.style.left = `${box.x + frame.left - layer.left}px`;
      button.style.top = `${box.y + frame.top - layer.top}px`;
      button.style.width = `${box.width}px`;
      button.style.height = `${box.height}px`;
    });
  }

  /** Keys while a round runs; returns true when the key was used. */
  onKey(event: KeyboardEvent): boolean {
    if (!this.enabled || !this.board) return false;
    const onCube = (event.target as HTMLElement | null)?.classList.contains('chl-cube') ?? false;
    const key = event.key;
    if (/^[a-zA-Z]$/.test(key)) {
      this.type(key.toLowerCase());
      return true;
    }
    if (key === 'Backspace') {
      this.stepBack();
      return true;
    }
    if (key === 'Delete') {
      this.clear();
      return true;
    }
    // On a cube button, Enter and Space are its own click: add the cube (or claim at the end),
    // unless letters have been typed, which Enter always claims.
    if ((key === 'Enter' && !this.typed) || key === ' ') {
      if (onCube) return false;
    }
    if (key === 'Enter') {
      this.claim();
      return true;
    }
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = arrows[key];
    if (delta) {
      this.moveFocus(delta[0], delta[1]);
      return true;
    }
    return false;
  }

  destroy() {
    this.detach();
    this.layer.remove();
  }

  private buildButtons() {
    const board = this.board!;
    this.buttons = board.faces.map((face, cell) => {
      const row = Math.floor(cell / board.size) + 1;
      const column = (cell % board.size) + 1;
      const button = h('button', {
        class: 'chl-cube',
        type: 'button',
        role: 'gridcell',
        tabindex: cell === this.focusCell ? 0 : -1,
        'aria-label': `${faceLabel(face)}, row ${row}, column ${column}`,
        'data-cell': cell,
      });
      button.addEventListener('click', (event) => {
        // Pointer presses are handled on the surface below; this is the keyboard's click.
        if ((event as PointerEvent).pointerType) return;
        this.tap(cell);
      });
      button.addEventListener('focus', () => (this.focusCell = cell));
      return button;
    });
    this.layer.replaceChildren(...this.buttons);
    this.focusCell = Math.min(this.focusCell, this.buttons.length - 1);
  }

  private moveFocus(dRow: number, dColumn: number) {
    const size = this.board!.size;
    const row = Math.max(0, Math.min(size - 1, Math.floor(this.focusCell / size) + dRow));
    const column = Math.max(0, Math.min(size - 1, (this.focusCell % size) + dColumn));
    this.focusCell = row * size + column;
    this.buttons.forEach((button, cell) => (button.tabIndex = cell === this.focusCell ? 0 : -1));
    this.buttons[this.focusCell]?.focus();
  }

  private point(event: PointerEvent): Point {
    const frame = this.origin.getBoundingClientRect();
    return { x: event.clientX - frame.left, y: event.clientY - frame.top };
  }

  private down(event: PointerEvent) {
    if (!this.enabled || event.button !== 0) return;
    const cell = this.view.cellAt(this.point(event), 0.5);
    if (cell === null) return;
    event.preventDefault();
    if (!this.typed && cell === this.cells.at(-1) && this.rule !== 'mirror') {
      this.claim();
      return;
    }
    this.surface.setPointerCapture(event.pointerId);
    this.dragging = true;
    this.grew = false;
    this.tap(cell);
    this.tail = this.point(event);
    this.emit();
  }

  /** A press or a keyboard click on a cube: start, extend, cut back to, or claim the chain. */
  private tap(cell: number) {
    if (!this.enabled || !this.board) return;
    if (this.typed) {
      this.typed = '';
      this.options = [];
      this.cells = [];
    }
    const last = this.cells.at(-1);
    if (this.cells.length === 0) {
      this.add(cell);
    } else if (cell === last && this.rule !== 'mirror') {
      // Pressing the last cube again claims the word (in Mirror it repeats the cube instead).
      if (!this.dragging) this.claim();
    } else if (cell !== last && this.cells.includes(cell) && this.rule === 'classic') {
      this.cells = this.cells.slice(0, this.cells.indexOf(cell) + 1);
    } else if (canExtend(this.board.size, this.rule, this.cells, cell)) {
      this.add(cell);
    } else {
      this.cells = [];
      this.add(cell);
    }
    this.emit();
  }

  private move(event: PointerEvent) {
    if (!this.dragging || !this.enabled || !this.board) return;
    const at = this.point(event);
    this.tail = at;
    const cell = this.view.cellAt(at, DRAG_REACH);
    const last = this.cells.at(-1);
    if (cell !== null && cell !== last) {
      if (cell === this.cells.at(-2)) {
        // Dragging back onto the previous cube takes the last step back.
        this.cells.pop();
        this.grew = true;
      } else if (canExtend(this.board.size, this.rule, this.cells, cell)) {
        this.add(cell);
        this.grew = true;
      }
    }
    this.emit();
  }

  private up(event: PointerEvent, release: boolean) {
    if (!this.dragging) return;
    this.dragging = false;
    this.tail = null;
    if (this.surface.hasPointerCapture(event.pointerId))
      this.surface.releasePointerCapture(event.pointerId);
    if (release && this.grew && this.cells.length > 1) this.claim();
    else this.emit();
  }

  private add(cell: number) {
    this.cells.push(cell);
    this.handlers.step(this.cells.length - 1);
  }

  private type(letter: string) {
    if (this.cells.length > 0 && !this.typed) this.cells = [];
    this.typed += letter;
    this.findOptions();
    if (this.options.length > 0) this.handlers.step(this.typed.length - 1);
    this.emit();
  }

  private stepBack() {
    if (this.typed) {
      this.typed = this.typed.slice(0, -1);
      this.findOptions();
    } else {
      this.cells.pop();
    }
    this.emit();
  }

  private findOptions() {
    this.options = this.typed ? pathsSpelling(this.board!, this.rule, this.typed) : [];
  }

  private emit() {
    if (this.typed) {
      const shown = this.options[0] ?? [];
      const hints = new Set(this.options.flat());
      for (const cell of shown) hints.delete(cell);
      this.handlers.change({
        cells: shown,
        typed: this.typed,
        hints: [...hints],
        stray: this.options.length === 0,
        tail: null,
      });
      return;
    }
    this.handlers.change({
      cells: this.cells,
      typed: '',
      hints: [],
      stray: false,
      tail: this.dragging ? this.tail : null,
    });
  }
}

/** The letters a chain spells, for the word chips. */
export function chainLetters(board: Board, view: ChainView): string {
  return view.typed || spell(board, view.cells);
}
