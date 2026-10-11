import {
  characterFor,
  KeyReader,
  type KeyEvent,
  morseFor,
  morseTiming,
  type MorseSchedule,
  scheduleMessage,
  spoken,
} from '../../codecs/morse';
import { MORSE_LADDER, knownAt } from '../../engine/ladder';
import { normalize, type Step } from '../../engine/message';
import type { StepReport } from '../../game/records';
import type { DesignFrame } from '../../render/frame';
import {
  layoutMarks,
  type PlacedMark,
  paintRegister,
  paintRegisterRows,
  type RegisterMark,
} from '../../render/machines/register';
import { paintTelegraph, paintTelegraphGlow } from '../../render/machines/telegraph';
import type { DeskPalette } from '../../render/palette';
import { CloseDeskLayer, paintStationLight } from '../../render/room';
import { inField } from '../app';
import { morseChart } from '../charts';
import { h, place } from '../dom';
import { nextLetterHint, type Station, type StationHost } from './station';

type TelegraphStep = Extract<Step, { machine: 'telegraph' }>;

/**
 * Keying is timed in real seconds, not on the game clock: the clock moves a frame at a time,
 * which is too coarse to tell a quick dit from a daw on a busy machine.
 */
const realSeconds = () => performance.now() / 1000;

const PAIR = { x: 110, y: 992, scale: 1.95 };
const REGISTER = { x: 640, y: 96, width: 1240, height: 120 };
const CHART = { x: 1260, y: 250, width: 620 };
/** Where pressing the mouse works the key: the lever and its knob. */
const KEY_HIT = { x: 590, y: 640, width: 540, height: 360 };
/** Code units across one row of the register: about a word and a half at a time. */
const UNITS_PER_ROW = 96;

/**
 * The telegraph. Reading: the sounder clacks out the message, the lamp lights with every mark
 * and the register inks it, so it is never sound alone. Sending: Space or the mouse works the
 * key, and a reader that learns your rhythm turns presses into letters.
 */
export class TelegraphStation implements Station {
  readonly element = h('div', {
    class: 'dd-station dd-station--telegraph',
    tabindex: -1,
    'aria-label': 'The machine',
  });
  private readonly desk = new CloseDeskLayer();
  readonly typed: boolean;
  readonly instructions: string;
  readonly answerAt = { x: 1260, y: 772, width: 620 };
  private readonly step: TelegraphStep;
  private readonly chart: HTMLElement;
  // Reading.
  private schedule: MorseSchedule | null = null;
  private placed: { marks: PlacedMark[]; rows: number } | null = null;
  private playing = false;
  private t = 0;
  private sounding = -1;
  // Sending.
  private reader: KeyReader | null = null;
  private keyDown = false;
  private pressedAt = 0;
  private sentMarks: RegisterMark[] = [];
  private sentLetters: Array<{ char: string; at: number; right: boolean | null }> = [];
  private sent = '';
  private wrong = 0;
  private firstPress: number | null = null;
  private lastRelease = 0;
  private finished = false;
  // Animation.
  private armature = 0;
  private lamp = 0;

  constructor(private readonly host: StationHost) {
    this.step = host.step as TelegraphStep;
    this.typed = this.step.mode === 'read';
    this.instructions =
      this.step.mode === 'read'
        ? 'Watch the lamp, read the register, listen if you like: then type what it says.'
        : `Key the message: tap Space (or the key) for a dit, hold it for a daw. Backspace takes back a letter.`;
    const letters =
      this.step.mode === 'read' && this.step.newLetters !== undefined
        ? this.knownLetters()
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    this.chart = h(
      'section',
      { class: 'dd-card dd-panel', 'aria-label': 'Morse chart' },
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, 'Morse chart'),
        h(
          'span',
          {},
          this.step.mode === 'read' && this.step.newLetters ? `new: ${this.step.newLetters}` : '',
        ),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        morseChart(
          this.sendingLetters(letters),
          this.step.mode === 'read' ? (this.step.newLetters ?? '') : '',
        ),
      ),
    );
    this.element.append(this.chart);
    if (this.step.mode === 'read') {
      this.schedule = scheduleMessage(
        this.step.text,
        morseTiming(this.step.wpm, this.step.spacingWpm),
      );
      this.placed = layoutMarks(this.schedule.marks, this.step.text.toUpperCase(), UNITS_PER_ROW);
      // Give the player a moment to settle before the first mark.
      this.t = -0.8;
      this.playing = true;
    } else {
      this.reader = new KeyReader(this.step.wpm);
      this.element.append(
        h(
          'button',
          {
            type: 'button',
            class: 'dd-key-button',
            'data-choice': 'key',
            'aria-label': 'Telegraph key: hold to send',
            onpointerdown: (event: Event) => {
              event.preventDefault();
              this.press();
            },
            onpointerup: () => this.release(),
            onpointerleave: () => this.release(),
          },
          'Key',
        ),
      );
    }
    this.chartsChanged();
  }

  private knownLetters(): string {
    const index = MORSE_LADDER.findIndex(
      (pair) => pair === (this.step.mode === 'read' ? this.step.newLetters : ''),
    );
    if (index >= 0) return knownAt(MORSE_LADDER, index);
    // Campaign messages bring several pairs at once; the chart shows what the text uses.
    return [...new Set(this.step.text.replace(/\s/g, ''))].join('');
  }

  private sendingLetters(letters: string): string {
    if (this.step.mode === 'send')
      return [...new Set(this.step.text.replace(/\s/g, ''))].sort().join('');
    return [...new Set(letters)].join('');
  }

  chartsChanged() {
    this.chart.hidden = !this.host.chartsOpen();
  }

  layout(frame: DesignFrame) {
    place(this.chart, frame, { x: CHART.x, y: CHART.y, width: CHART.width });
    const keyButton = this.element.querySelector<HTMLElement>('.dd-key-button');
    if (keyButton) place(keyButton, frame, KEY_HIT);
  }

  replay() {
    if (!this.schedule) return;
    this.t = -0.4;
    this.sounding = -1;
    this.playing = true;
    this.host.say('The sounder sends it again.');
  }

  tick(dt: number) {
    if (this.schedule && this.playing) this.tickPlayback(dt);
    if (this.reader && !this.finished) {
      const now = realSeconds() * 1000;
      this.take(this.reader.tick(now));
      if (this.keyDown) this.lamp = 1;
    }
    const target = this.keyDown || (this.playing && this.sounding >= 0) ? 1 : 0;
    // The armature snaps down fast and springs back a little slower.
    this.armature +=
      (target - this.armature) * Math.min(1, dt * (target > this.armature ? 60 : 28));
    if (!this.keyDown && !(this.playing && this.sounding >= 0))
      this.lamp = Math.max(0, this.lamp - dt * 9);
  }

  private tickPlayback(dt: number) {
    const schedule = this.schedule!;
    this.t += dt;
    const ms = this.t * 1000;
    const index = schedule.marks.findIndex(
      (mark) => ms >= mark.start && ms < mark.start + mark.length,
    );
    if (index !== this.sounding) {
      if (index >= 0) {
        const mark = schedule.marks[index]!;
        this.host.app.sounds.sounderDown();
        if (this.host.app.saves.prefs.load().tone) this.host.app.sounds.tone(mark.length / 1000);
        this.lamp = 1;
      } else if (this.sounding >= 0) {
        this.host.app.sounds.sounderUp();
      }
      this.sounding = index;
    }
    if (ms > schedule.duration + 400) {
      this.playing = false;
      this.sounding = -1;
    }
  }

  onKey(event: KeyboardEvent): boolean {
    if (this.step.mode !== 'send' || this.finished) return false;
    if (event.code === 'Space' && !inField(event)) {
      if (!event.repeat) this.press();
      return true;
    }
    if (event.code === 'Backspace' && !inField(event)) {
      this.takeBack();
      return true;
    }
    return false;
  }

  onKeyUp(event: KeyboardEvent): boolean {
    if (this.step.mode !== 'send' || event.code !== 'Space') return false;
    this.release();
    return true;
  }

  onPointer(kind: 'down' | 'move' | 'up', point: { x: number; y: number }): boolean {
    if (this.step.mode !== 'send') return false;
    const inside =
      point.x >= KEY_HIT.x &&
      point.x <= KEY_HIT.x + KEY_HIT.width &&
      point.y >= KEY_HIT.y &&
      point.y <= KEY_HIT.y + KEY_HIT.height;
    if (kind === 'down' && inside) {
      this.press();
      return true;
    }
    if (kind === 'up' && this.keyDown) {
      this.release();
      return true;
    }
    return false;
  }

  private press() {
    if (!this.reader || this.keyDown || this.finished) return;
    const now = realSeconds();
    this.take(this.reader.press(now * 1000));
    this.keyDown = true;
    this.pressedAt = now;
    this.firstPress ??= now;
    this.host.app.sounds.sounderDown();
    if (this.host.app.saves.prefs.load().tone) this.host.app.sounds.tone(0.12);
  }

  private release() {
    if (!this.reader || !this.keyDown) return;
    const now = realSeconds();
    this.keyDown = false;
    this.lastRelease = now;
    this.sentMarks.push({ start: this.pressedAt, length: now - this.pressedAt, mark: '.' });
    this.take(this.reader.release(now * 1000));
    this.host.app.sounds.sounderUp();
  }

  private take(events: KeyEvent[]) {
    for (const event of events) {
      if (event.kind === 'mark') {
        const last = this.sentMarks[this.sentMarks.length - 1];
        if (last) last.mark = event.mark;
        this.host.report({ kind: 'keyed', mark: event.mark });
      } else if (event.kind === 'letter') this.addLetter(event.char ?? '?', event.code);
      else if (event.kind === 'word') this.addSpace();
    }
  }

  private target(): string {
    return normalize(this.step.text);
  }

  private addLetter(char: string, code: string) {
    const index = this.sent.length;
    const expected = this.target()[index];
    const right = char === expected;
    if (!right) this.wrong++;
    this.sent += char;
    this.sentLetters.push({
      char,
      at: this.sentMarks[this.sentMarks.length - 1]?.start ?? realSeconds(),
      right,
    });
    this.host.say(
      right
        ? `${char}`
        : `That read as ${characterFor(code) ?? 'nothing in the chart'}; Backspace takes it back.`,
    );
    this.checkDone();
  }

  private addSpace() {
    if (this.sent.endsWith(' ') || this.sent.length === 0) return;
    if (this.target()[this.sent.length] === ' ') this.sent += ' ';
    this.checkDone();
  }

  private takeBack() {
    if (this.sent.length === 0) return;
    this.sent = this.sent.trimEnd().slice(0, -1);
    this.sentLetters.pop();
    this.host.say('Taken back.');
  }

  private checkDone() {
    const sent = normalize(this.sent);
    if (sent !== this.target()) return;
    this.finished = true;
    this.host.app.sounds.right();
    this.host.done({ wrong: this.wrong, late: 0 });
  }

  finalReport(): StepReport | null {
    if (this.step.mode !== 'send' || this.firstPress === null) return null;
    // Speed by the standard word: fifty units per word, the units counted in what was sent.
    const units = this.target()
      .split('')
      .reduce((sum, char) => sum + (char === ' ' ? 4 : 3), 0);
    const marks = this.sentMarks.reduce((sum, mark) => sum + (mark.mark === '.' ? 2 : 4), 0);
    const seconds = Math.max(0.5, this.lastRelease - this.firstPress);
    const wpm = (60 * ((units + marks) / 50)) / seconds;
    return { kind: 'sent-morse', wpm, wrong: this.wrong };
  }

  hint(): string {
    if (this.step.mode === 'send') {
      const next = this.target()[normalize(this.sent).length];
      if (!next || next === ' ') return 'Leave a longer pause for the space between words.';
      return `Next is ${next}: ${spoken(morseFor(next) ?? '')}.`;
    }
    return nextLetterHint(this.host.typedAnswer(), this.step.text);
  }

  reveal() {
    this.finished = true;
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const span = { ...frame.span, top: frame.top };
    this.desk.paint(ctx, frame, this.host.app.canvas.ratio, pal);
    void time;
    const keyDown = this.keyDown ? 1 : 0;
    paintTelegraph(ctx, PAIR.x, PAIR.y, PAIR.scale, pal, {
      keyDown,
      armature: this.armature,
      lamp: this.lamp,
    });
    paintStationLight(ctx, span, pal, { x: 420, y: 200, r: 1700 });
    paintTelegraphGlow(ctx, PAIR.x, PAIR.y, PAIR.scale, pal, this.lamp);
    this.paintRegisterStrip(ctx, pal);
  }

  private paintRegisterStrip(ctx: CanvasRenderingContext2D, pal: DeskPalette) {
    const { x, y, width, height } = REGISTER;
    if (this.schedule && this.placed) {
      const ms = this.playing ? Math.max(-1, this.t * 1000) : Infinity;
      paintRegisterRows(
        ctx,
        x,
        y,
        width,
        52,
        pal,
        this.placed,
        (width - 60) / UNITS_PER_ROW,
        ms,
        this.sounding,
      );
      return;
    }
    const now = realSeconds();
    const start = this.firstPress ?? now;
    const span = 10;
    const from = Math.max(start - 0.5, now - span + 1.5);
    paintRegister(ctx, x, y, width, height, pal, {
      marks: this.sentMarks,
      span,
      from,
      letters: this.sentLetters,
      live: this.keyDown ? { start: this.pressedAt, length: now - this.pressedAt } : null,
    });
  }
}
