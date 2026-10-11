import {
  CARD_COLUMNS,
  holesFor,
  punchCard,
  punchName,
  readPattern,
  ROW_NAMES,
} from '../../codecs/bcd';
import { normalize, type Step } from '../../engine/message';
import type { StepReport } from '../../game/records';
import type { DesignFrame } from '../../render/frame';
import { CARD_ASPECT, cardCell, paintCard } from '../../render/machines/card-punch';
import type { DeskPalette } from '../../render/palette';
import { alpha, contactShadow, FONT_MONO, linear, roundRect } from '../../render/paint';
import { CloseDeskLayer, paintStationLight } from '../../render/room';
import { inField } from '../app';
import { cardChart } from '../charts';
import { button, h, place } from '../dom';
import { nextLetterHint, type Station, type StationHost } from './station';

type PunchStep = Extract<Step, { machine: 'punch' }>;

const CARD = { x: 60, y: 300, width: 1160 };

/**
 * The card punch. Reading: a card arrives without its printed line, and the holes are all
 * there is; the chart (when open) gives each character's zone and digit, and the original's
 * history notes. Punching: arrow keys walk the card, Space punches or closes a hole, Enter
 * moves on, and the card is fed when every column is done.
 */
export class PunchStation implements Station {
  readonly element = h('div', {
    class: 'dd-station dd-station--punch',
    tabindex: -1,
    'aria-label': 'The machine',
  });
  private readonly desk = new CloseDeskLayer();
  readonly typed: boolean;
  readonly instructions: string;
  readonly answerAt = { x: 1260, y: 772, width: 620 };
  private readonly step: PunchStep;
  private readonly chart: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly target: number[];
  private columns: number[];
  private col = 0;
  private row = 0;
  private hover: number | null = null;
  private stroke = 0;
  private wrongColumns = new Set<number>();
  private finished = false;
  private chartWasOpen = false;

  constructor(private readonly host: StationHost) {
    this.step = host.step as PunchStep;
    this.typed = this.step.mode === 'read';
    this.target = punchCard(this.step.text).map((column) => column.holes);
    this.columns =
      this.step.mode === 'read' ? [...this.target] : new Array<number>(this.target.length).fill(0);
    this.instructions =
      this.step.mode === 'read'
        ? 'Read the holes column by column and type the line. Arrow keys on the card name a column’s holes when the chart is open.'
        : `Punch “${this.step.text}”: arrow keys move, Space punches a hole, Enter goes to the next column. Feed the card when it is done.`;
    const characters = [
      ...new Set(this.step.text.replace(/\s/g, '') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
    ].join('');
    this.chart = h(
      'section',
      { class: 'dd-card dd-panel', 'aria-label': 'Card code' },
      h('div', { class: 'dd-band' }, h('span', {}, 'Card code'), h('span', {}, 'zone-digit')),
      h(
        'div',
        { class: 'dd-card__body' },
        cardChart(characters),
        h(
          'p',
          { class: 'dd-note' },
          '† where the old table, deduced from the old program, differs from the code it used.',
        ),
      ),
    );
    this.surface = h('div', {
      class: 'dd-card-surface',
      tabindex: 0,
      role: 'application',
      'aria-label':
        this.step.mode === 'read'
          ? 'The card: arrow keys move between columns'
          : 'The card: arrow keys move, Space punches',
    });
    this.element.append(this.chart, this.surface);
    this.chartsChanged();
  }

  tools(): HTMLElement[] {
    return this.step.mode === 'punch'
      ? [button('Feed the card', () => this.feed(), { primary: true, choice: 'feed' })]
      : [];
  }

  chartsChanged() {
    const open = this.host.chartsOpen();
    if (open) this.chartWasOpen = true;
    this.chart.hidden = !open;
  }

  layout(frame: DesignFrame) {
    const height = CARD.width / CARD_ASPECT;
    place(this.chart, frame, { x: 1260, y: 96, width: 620 });
    place(this.surface, frame, { x: CARD.x, y: CARD.y, width: CARD.width, height });
  }

  private announce() {
    const pattern = this.columns[this.col] ?? 0;
    const holes = pattern ? punchName(pattern) : 'no holes';
    if (this.step.mode === 'read') {
      this.host.say(
        this.host.chartsOpen() ? `Column ${this.col + 1}: ${holes}.` : `Column ${this.col + 1}.`,
      );
    } else {
      this.host.say(`Column ${this.col + 1}, row ${ROW_NAMES[this.row]}: ${holes}.`);
    }
  }

  onKey(event: KeyboardEvent): boolean {
    if (inField(event) || this.finished) return false;
    const last = this.target.length - 1;
    switch (event.key) {
      case 'ArrowLeft':
        this.col = Math.max(0, this.col - 1);
        break;
      case 'ArrowRight':
        this.col = Math.min(last, this.col + 1);
        break;
      case 'ArrowUp':
        if (this.step.mode === 'read') return false;
        this.row = Math.max(0, this.row - 1);
        break;
      case 'ArrowDown':
        if (this.step.mode === 'read') return false;
        this.row = Math.min(11, this.row + 1);
        break;
      case ' ':
        if (this.step.mode === 'read') return false;
        this.toggle(this.col, this.row);
        return true;
      case 'Enter':
        if (this.step.mode === 'read') return false;
        if (this.col < last) this.col++;
        else this.feed();
        break;
      case 'Backspace':
        if (this.step.mode === 'read') return false;
        this.columns[this.col] = 0;
        break;
      default:
        return false;
    }
    this.announce();
    return true;
  }

  private toggle(col: number, row: number) {
    const bit = 1 << (11 - row);
    this.columns[col] = (this.columns[col] ?? 0) ^ bit;
    if (this.columns[col]! & bit) {
      this.host.app.sounds.punch();
      this.stroke = 1;
    }
    this.wrongColumns.delete(col);
    this.announce();
  }

  private feed() {
    if (this.finished) return;
    const wrong = this.target.flatMap((pattern, i) => (this.columns[i] === pattern ? [] : [i]));
    if (wrong.length === 0) {
      this.finished = true;
      this.host.app.sounds.right();
      this.host.done({ wrong: 0, late: 0 });
      return;
    }
    this.wrongColumns = new Set(wrong);
    this.host.miss();
    this.host.app.sounds.wrong();
    this.host.say(
      `Not quite: column${wrong.length > 1 ? 's' : ''} ${wrong.map((i) => i + 1).join(', ')} ${wrong.length > 1 ? 'are' : 'is'} wrong.`,
    );
  }

  onPointer(kind: 'down' | 'move' | 'up', point: { x: number; y: number }): boolean {
    for (let col = 0; col < Math.min(CARD_COLUMNS, this.target.length + 2); col++) {
      for (let row = 0; row < 12; row++) {
        const cell = cardCell(CARD.x, CARD.y, CARD.width, col, row);
        if (
          point.x >= cell.x &&
          point.x < cell.x + cell.width &&
          point.y >= cell.y &&
          point.y < cell.y + cell.height
        ) {
          if (col >= this.target.length) return false;
          if (kind === 'move') {
            this.hover = col;
            return false;
          }
          if (kind === 'down') {
            this.col = col;
            if (this.step.mode === 'punch' && !this.finished) {
              this.row = row;
              this.toggle(col, row);
            } else this.announce();
            this.surface.focus({ preventScroll: true });
            return true;
          }
          return false;
        }
      }
    }
    if (kind === 'move') this.hover = null;
    return false;
  }

  hint(): string {
    if (this.step.mode === 'read') return nextLetterHint(this.host.typedAnswer(), this.step.text);
    const index = this.target.findIndex((pattern, i) => this.columns[i] !== pattern);
    if (index < 0) return 'Every column is right: feed the card.';
    const char = this.step.text[index]!;
    return char === ' '
      ? `Column ${index + 1} is a space: no holes.`
      : `Column ${index + 1} is ${char}: ${punchName(holesFor(char))}.`;
  }

  reveal() {
    this.finished = true;
    this.columns = [...this.target];
  }

  finalReport(): StepReport | null {
    if (this.step.mode !== 'read') return null;
    return {
      kind: 'read-card',
      letters: normalize(this.step.text).replace(/ /g, '').length,
      chart: this.chartWasOpen,
      hints: 0,
    };
  }

  tick(dt: number) {
    this.stroke = Math.max(0, this.stroke - dt * 6);
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const span = { ...frame.span, top: frame.top };
    this.desk.paint(ctx, frame, this.host.app.canvas.ratio, pal);
    void time;
    const height = CARD.width / CARD_ASPECT;
    contactShadow(ctx, CARD.x + CARD.width / 2, CARD.y + height + 10, CARD.width * 0.52, 26, 0.45);
    paintStationLight(ctx, span, pal, { x: 420, y: 200, r: 1700 });
    const open = this.host.chartsOpen();
    const focusCol = this.hover ?? this.col;
    paintCard(ctx, CARD.x, CARD.y, CARD.width, pal, {
      columns: this.columns,
      printed:
        this.step.mode === 'punch'
          ? this.columns.map((p) => (p ? (readPattern(p) ?? '?') : ' ')).join('')
          : undefined,
      cursor: this.finished ? null : focusCol,
      rowNames: open,
    });
    this.paintWrongColumns(ctx, pal);
    if (this.step.mode === 'punch') this.paintWorkOrder(ctx, pal);
    if (this.step.mode === 'punch' && !this.finished) this.paintPunchHead(ctx, pal);
    if (open && this.step.mode === 'read' && !this.finished)
      this.paintColumnLabel(ctx, pal, focusCol);
  }

  private paintWrongColumns(ctx: CanvasRenderingContext2D, pal: DeskPalette) {
    ctx.save();
    for (const col of this.wrongColumns) {
      const top = cardCell(CARD.x, CARD.y, CARD.width, col, 0);
      const bottom = cardCell(CARD.x, CARD.y, CARD.width, col, 11);
      ctx.fillStyle = alpha(pal.inkRed, 0.18);
      ctx.fillRect(top.x, top.y, top.width, bottom.y + bottom.height - top.y);
    }
    ctx.restore();
  }

  /** The line to punch, on a slip clipped above the card, with the current column's character ringed. */
  private paintWorkOrder(ctx: CanvasRenderingContext2D, pal: DeskPalette) {
    const text = this.step.text;
    const y = CARD.y - 104;
    ctx.save();
    ctx.fillStyle = alpha('#000000', 0.2);
    roundRect(ctx, CARD.x + 6, y + 6, CARD.width * 0.62, 70, 6);
    ctx.fill();
    ctx.fillStyle = pal.paper;
    roundRect(ctx, CARD.x, y, CARD.width * 0.62, 70, 6);
    ctx.fill();
    ctx.fillStyle = pal.inkRed;
    ctx.font = `600 15px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('PUNCH', CARD.x + 18, y + 36);
    ctx.font = `600 34px ${FONT_MONO}`;
    const step = 30;
    [...text].forEach((char, i) => {
      const cx = CARD.x + 110 + i * step;
      if (i === this.col && !this.finished) {
        ctx.strokeStyle = pal.inkRed;
        ctx.lineWidth = 3;
        roundRect(ctx, cx - 4, y + 12, step - 2, 46, 5);
        ctx.stroke();
      }
      const done = this.columns[i] === this.target[i] && this.target[i] !== 0;
      ctx.fillStyle = done ? alpha(pal.ink, 0.45) : pal.ink;
      ctx.fillText(char, cx, y + 37);
    });
    ctx.restore();
  }

  /** The steel die over the cursor's hole, pressing down after each punch. */
  private paintPunchHead(ctx: CanvasRenderingContext2D, pal: DeskPalette) {
    const cell = cardCell(CARD.x, CARD.y, CARD.width, this.col, this.row);
    const cx = cell.x + cell.width / 2;
    const cy = cell.y + cell.height / 2;
    ctx.save();
    ctx.strokeStyle = pal.inkRed;
    ctx.lineWidth = 3;
    roundRect(ctx, cell.x - 3, cell.y - 3, cell.width + 6, cell.height + 6, 4);
    ctx.stroke();
    const lift = 70 - this.stroke * 34;
    ctx.fillStyle = linear(ctx, cx - 16, 0, cx + 16, 0, [
      [0, pal.steelDeep],
      [0.5, pal.steelLight],
      [1, pal.steelDeep],
    ]);
    roundRect(ctx, cx - 14, cy - lift - 60, 28, 60, 5);
    ctx.fill();
    ctx.fillStyle = pal.steel;
    ctx.fillRect(cx - 6, cy - lift, 12, Math.max(4, lift - cell.height / 2));
    ctx.restore();
  }

  private paintColumnLabel(ctx: CanvasRenderingContext2D, pal: DeskPalette, col: number) {
    const pattern = this.columns[col] ?? 0;
    const cell = cardCell(CARD.x, CARD.y, CARD.width, col, 0);
    const text = pattern ? punchName(pattern) : 'blank';
    ctx.save();
    ctx.font = `600 22px ${FONT_MONO}`;
    const w = ctx.measureText(text).width + 24;
    const x = Math.min(CARD.x + CARD.width - w, Math.max(CARD.x, cell.x + cell.width / 2 - w / 2));
    const y = CARD.y - 52;
    ctx.fillStyle = pal.look === 'night' ? '#1b1511' : '#2b2119';
    roundRect(ctx, x, y, w, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#f6ecd6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + 20);
    ctx.restore();
  }
}
