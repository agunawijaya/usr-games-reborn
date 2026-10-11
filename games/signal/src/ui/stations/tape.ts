import { punchTape } from '../../codecs/ppt';
import { normalize, type Step } from '../../engine/message';
import type { StepReport } from '../../game/records';
import type { DesignFrame } from '../../render/frame';
import { paintTapeStrip } from '../../render/machines/tape-reader';
import type { DeskPalette } from '../../render/palette';
import { alpha, contactShadow, FONT_MONO, linear, mix, roundRect } from '../../render/paint';
import { CloseDeskLayer, paintStationLight } from '../../render/room';
import { inField } from '../app';
import { tapeLegend } from '../charts';
import { button, h, place } from '../dom';
import { nextLetterHint, type Station, type StationHost } from './station';

type TapeStep = Extract<Step, { machine: 'tape' }>;

const TAPE = { x: 80, y: 470, width: 1760, across: 260 };
/** The value of each hole, left to right across a row as drawn (top to bottom on screen). */
const VALUES = [128, 64, 32, 16, 8, 4, 2, 1];

/**
 * The tape reader. Reading: the strip runs in through the reader and stops with every row in
 * view; each row is one character, its holes adding up to its number. Punching: keys 1 to 8
 * punch the holes of the current row, Enter feeds the tape on, and the tape is torn off when
 * it is done. Rows run left to right; the holes of a row run down the tape.
 */
export class TapeStation implements Station {
  readonly element = h('div', {
    class: 'dd-station dd-station--tape',
    tabindex: -1,
    'aria-label': 'The machine',
  });
  private readonly desk = new CloseDeskLayer();
  readonly typed: boolean;
  readonly instructions: string;
  readonly answerAt = { x: 1260, y: 772, width: 620 };
  private readonly step: TapeStep;
  private readonly legend: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly target: number[];
  private rows: number[];
  private cursor = 0;
  private hover: number | null = null;
  /** Rows fed in so far, for the run-in animation. */
  private fed = 0;
  private slips = 0;
  private finished = false;

  constructor(private readonly host: StationHost) {
    this.step = host.step as TapeStep;
    this.typed = this.step.mode === 'read';
    this.target = punchTape(this.step.text);
    this.rows =
      this.step.mode === 'read' ? [...this.target] : new Array<number>(this.target.length).fill(0);
    this.fed = this.step.mode === 'read' && !host.app.reducedMotion ? -4 : this.target.length;
    this.instructions =
      this.step.mode === 'read'
        ? 'Each row is one character: add up its holes. Type the message.'
        : `Punch “${this.step.text}”: keys 1 to 8 punch the holes from top to bottom, Enter feeds the next row.`;
    this.legend = h(
      'section',
      { class: 'dd-card dd-panel', 'aria-label': 'Hole values' },
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, 'Hole values'),
        h('span', {}, 'eight-hole tape'),
      ),
      h('div', { class: 'dd-card__body' }, tapeLegend()),
    );
    this.surface = h('div', {
      class: 'dd-card-surface',
      tabindex: 0,
      role: 'application',
      'aria-label': 'The tape: arrow keys move between rows',
    });
    this.element.append(this.legend, this.surface);
    if (this.step.mode === 'read' && !host.app.reducedMotion) host.app.sounds.whirr(1.2);
    this.chartsChanged();
  }

  tools(): HTMLElement[] {
    return this.step.mode === 'punch'
      ? [button('Tear it off', () => this.tear(), { primary: true, choice: 'tear' })]
      : [];
  }

  chartsChanged() {
    this.legend.hidden = !this.host.chartsOpen();
  }

  layout(frame: DesignFrame) {
    place(this.legend, frame, { x: 640, y: 96, width: 600 });
    place(this.surface, frame, {
      x: TAPE.x,
      y: TAPE.y - TAPE.across / 2,
      width: TAPE.width,
      height: TAPE.across,
    });
  }

  private pitch(): number {
    return TAPE.across * 0.1 * 1.6;
  }

  /** Where row `index` sits on screen. */
  private rowX(index: number): number {
    const pitch = this.pitch();
    const length = this.target.length * pitch;
    const start = TAPE.x + Math.max(pitch * 2, (TAPE.width - length) / 2);
    return start + (index + 0.5) * pitch;
  }

  private announce() {
    const byte = this.rows[this.cursor] ?? 0;
    const holes = VALUES.filter((value) => byte & value);
    if (this.step.mode === 'read' && !this.host.chartsOpen())
      this.host.say(`Row ${this.cursor + 1}.`);
    else
      this.host.say(
        `Row ${this.cursor + 1}: ${holes.length ? `${holes.join(' + ')} = ${byte}` : 'no holes'}.`,
      );
  }

  onKey(event: KeyboardEvent): boolean {
    if (inField(event) || this.finished) return false;
    const last = this.target.length - 1;
    if (event.key === 'ArrowLeft') this.cursor = Math.max(0, this.cursor - 1);
    else if (event.key === 'ArrowRight') this.cursor = Math.min(last, this.cursor + 1);
    else if (this.step.mode === 'punch' && /^[1-8]$/.test(event.key)) {
      this.toggle(this.cursor, Number(event.key) - 1);
      return true;
    } else if (this.step.mode === 'punch' && event.key === 'Enter') {
      if (this.cursor < last) this.cursor++;
      else this.tear();
    } else if (this.step.mode === 'punch' && event.key === 'Backspace') this.rows[this.cursor] = 0;
    else return false;
    this.announce();
    return true;
  }

  private toggle(row: number, hole: number) {
    const value = VALUES[hole]!;
    this.rows[row] = (this.rows[row] ?? 0) ^ value;
    if (this.rows[row]! & value) this.host.app.sounds.punch();
    this.announce();
  }

  private tear() {
    if (this.finished) return;
    const wrong = this.target.flatMap((byte, i) => (this.rows[i] === byte ? [] : [i]));
    if (wrong.length === 0) {
      this.finished = true;
      this.host.app.sounds.right();
      this.host.done({ wrong: 0, late: 0 });
      return;
    }
    this.slips++;
    this.host.miss();
    this.host.app.sounds.wrong();
    this.host.say(
      `Not quite: row${wrong.length > 1 ? 's' : ''} ${wrong.map((i) => i + 1).join(', ')} ${wrong.length > 1 ? 'are' : 'is'} wrong.`,
    );
  }

  onPointer(kind: 'down' | 'move' | 'up', point: { x: number; y: number }): boolean {
    const pitch = this.pitch();
    const top = TAPE.y - TAPE.across / 2;
    if (point.y < top || point.y > top + TAPE.across) {
      if (kind === 'move') this.hover = null;
      return false;
    }
    const index = this.target.findIndex((_, i) => Math.abs(point.x - this.rowX(i)) <= pitch / 2);
    if (index < 0) {
      if (kind === 'move') this.hover = null;
      return false;
    }
    if (kind === 'move') {
      this.hover = index;
      return false;
    }
    if (kind !== 'down') return false;
    this.cursor = index;
    if (this.step.mode === 'punch' && !this.finished) {
      const slot = Math.round(((point.y - top) / TAPE.across - 0.12) / 0.085);
      const hole = slot < 5 ? slot : slot - 1;
      if (slot !== 5 && hole >= 0 && hole < 8) this.toggle(index, hole);
    } else this.announce();
    this.surface.focus({ preventScroll: true });
    return true;
  }

  hint(): string {
    if (this.step.mode === 'read') return nextLetterHint(this.host.typedAnswer(), this.step.text);
    const index = this.target.findIndex((byte, i) => this.rows[i] !== byte);
    if (index < 0) return 'Every row is right: tear it off.';
    const byte = this.target[index]!;
    return `Row ${index + 1} is ${this.step.text[index] === ' ' ? 'a space' : this.step.text[index]}: ${VALUES.filter((v) => byte & v).join(' + ')} = ${byte}.`;
  }

  reveal() {
    this.finished = true;
    this.rows = [...this.target];
  }

  finalReport(): StepReport | null {
    if (this.step.mode !== 'punch') return null;
    return { kind: 'punched-tape', rows: normalize(this.step.text).length, slips: this.slips };
  }

  tick(dt: number) {
    if (this.fed < this.target.length) this.fed = Math.min(this.target.length, this.fed + dt * 14);
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const span = { ...frame.span, top: frame.top };
    this.desk.paint(ctx, frame, this.host.app.canvas.ratio, pal);
    void time;
    const pitch = this.pitch();
    const top = TAPE.y - TAPE.across / 2;
    contactShadow(
      ctx,
      TAPE.x + TAPE.width / 2,
      TAPE.y + TAPE.across / 2 + 14,
      TAPE.width * 0.5,
      24,
      0.4,
    );
    // The strip runs the width of the screen; while it feeds in, its rows slide into place.
    const shift = (this.target.length - this.fed) * pitch;
    const firstCentre = this.rowX(0) + shift;
    paintTapeStrip(
      ctx,
      { x: span.left, y: TAPE.y },
      { x: span.right, y: TAPE.y },
      TAPE.across,
      pal,
      {
        rows: this.rows,
        offset: (span.left + pitch / 2 - firstCentre) / pitch,
        cursor: this.finished ? null : (this.hover ?? this.cursor),
        behind: mix(pal.woodDark, '#000000', 0.45),
        pitchScale: 1.6,
      },
    );
    paintStationLight(ctx, span, pal, { x: 420, y: 200, r: 1700 });
    this.paintReaderHead(ctx, pal, top, pitch);
    if (this.host.chartsOpen()) this.paintValues(ctx, pal, top);
    if (this.host.chartsOpen() && !this.finished) this.paintRowValue(ctx, pal, top);
  }

  /** The reader's chrome bridge over the row under the cursor. */
  private paintReaderHead(
    ctx: CanvasRenderingContext2D,
    pal: DeskPalette,
    top: number,
    pitch: number,
  ) {
    if (this.finished) return;
    const x = this.rowX(this.hover ?? this.cursor);
    ctx.save();
    ctx.fillStyle = alpha('#000000', 0.25);
    roundRect(ctx, x - pitch * 0.9 + 6, top - 46, pitch * 1.8, 34, 8);
    ctx.fill();
    ctx.fillStyle = linear(ctx, 0, top - 52, 0, top - 18, [
      [0, pal.steelLight],
      [1, pal.steelDeep],
    ]);
    roundRect(ctx, x - pitch * 0.9, top - 52, pitch * 1.8, 34, 8);
    ctx.fill();
    ctx.fillStyle = pal.indicator;
    ctx.beginPath();
    ctx.arc(x, top - 35, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Hole values beside the strip's first row, like a ruler. */
  private paintValues(ctx: CanvasRenderingContext2D, pal: DeskPalette, top: number) {
    const x = this.rowX(0) - this.pitch() * 1.4;
    ctx.save();
    ctx.font = `600 17px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    VALUES.forEach((value, hole) => {
      const slot = hole < 5 ? hole : hole + 1;
      const y = top + TAPE.across * (0.12 + slot * 0.085);
      ctx.fillStyle = pal.look === 'night' ? '#3b2a1a' : '#5b4938';
      ctx.fillText(String(value), x, y);
    });
    ctx.restore();
  }

  private paintRowValue(ctx: CanvasRenderingContext2D, pal: DeskPalette, top: number) {
    const index = this.hover ?? this.cursor;
    const byte = this.rows[index] ?? 0;
    const text = String(byte);
    const x = this.rowX(index);
    const y = top + TAPE.across + 34;
    ctx.save();
    ctx.font = `600 22px ${FONT_MONO}`;
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = pal.look === 'night' ? '#1b1511' : '#2b2119';
    roundRect(ctx, x - w / 2, y - 19, w, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#f6ecd6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }
}
