import {
  bestRotation,
  CODE_FREQUENCIES,
  keywordColumn,
  rotate,
  rotationFit,
  shareAfter,
} from '../../codecs/caesar';
import { cipherTextOf, foolsTheMachine, readingTurn } from '../../engine/generate';
import type { Step } from '../../engine/message';
import type { StepReport } from '../../game/records';
import type { Flap } from '../../render/flaps';
import type { DesignFrame } from '../../render/frame';
import type { DeskPalette } from '../../render/palette';
import { CloseDeskLayer } from '../../render/room';
import { CIPHER_LAYOUT, paintCipherStation } from '../../render/stations/cipher-station';
import { inField } from '../app';
import { button, h } from '../dom';
import type { Station, StationHost } from './station';

type CipherStep = Extract<Step, { machine: 'cipher' }>;

/** Tiles per line on the reading board. */
const LINE = 15;

/**
 * The cipher wheel. The player turns the disc (arrow keys, the mouse wheel, or dragging it)
 * and the split-flap board flips to the new reading; the scope shows the letters' shares
 * against English and lights the turn the old codebreaker would choose. Enter reads it off.
 * Keyword messages turn one ring per letter of the keyword, chosen with the up and down keys.
 */
export class CipherStation implements Station {
  readonly element = h('div', {
    class: 'dd-station dd-station--cipher',
    tabindex: -1,
    'aria-label': 'The machine',
  });
  private readonly desk = new CloseDeskLayer();
  readonly typed = false;
  readonly instructions: string;
  readonly answerAt = { x: 1010, y: 852, width: 840 };
  private readonly step: CipherStep;
  private readonly secret: string;
  private readonly rings: number;
  private turns: number[];
  private ring = 0;
  /** The disc as drawn, easing towards the chosen turn. */
  private shown = 0;
  private spin = 0;
  private lock = 0;
  private solvedAt: number | null = null;
  private flaps: Flap[] = [];
  private delays: number[] = [];
  private dragAngle: number | null = null;
  private scopeUsed = false;
  private autoTurned = false;
  private finished = false;

  constructor(private readonly host: StationHost) {
    this.step = host.step as CipherStep;
    this.secret = cipherTextOf(this.step);
    this.rings = this.step.keyword ? this.step.keyword.length : 1;
    this.turns = new Array<number>(this.rings).fill(0);
    this.instructions = this.step.keyword
      ? `Four rings in turn: choose one with ↑ ↓, turn it with ← →. The key word is ${this.step.keyword}. Enter when it reads.`
      : 'Turn the wheel with ← → (or drag it) until the board reads, then press Enter.';
    this.flaps = [...this.secret].map((char) => ({ char, resolved: false }));
    this.delays = this.flaps.map(() => 0);
    this.chartsChanged();
  }

  chartsChanged() {
    const open = this.host.chartsOpen();
    if (open) this.scopeUsed = true;
    this.autoButton.hidden = !open || this.rings > 1;
  }

  private readonly autoButton = button('Let the scope turn it', () => this.autoTurn(), {
    small: true,
    choice: 'auto',
  });
  private readonly lockButton = button('Read it', () => this.lockIn(), {
    primary: true,
    key: 'Enter',
    choice: 'lock',
  });

  tools(): HTMLElement[] {
    return [this.lockButton, this.autoButton];
  }

  layout() {
    // The wheel, scope and board are drawn; the buttons live in the answer card.
  }

  /** The reading at the current turns. */
  private reading(): string {
    if (this.rings === 1) return rotate(this.secret, this.turns[0]!);
    let index = 0;
    let out = '';
    for (const char of this.secret) {
      if (/[A-Z]/.test(char)) {
        out += rotate(char, this.turns[index % this.rings]!);
        index++;
      } else out += char;
    }
    return out;
  }

  private turn(by: number) {
    if (this.finished) return;
    this.turns[this.ring] = (((this.turns[this.ring]! + by) % 26) + 26) % 26;
    this.host.app.sounds.detent();
    this.retarget();
  }

  /** Sends the board's tiles flipping towards the new reading, left to right. */
  private retarget() {
    const reading = this.reading();
    let k = 0;
    this.flaps = this.flaps.map((flap, i) => {
      const next = reading[i]!;
      // A tile always flips from what it shows now, even if it was mid-flip.
      const current = flap.char;
      if (current === next && flap.flip === undefined) return flap;
      this.delays[i] = (k++ % LINE) * 0.025;
      return { char: current, next, flip: 0, resolved: false };
    });
  }

  private autoTurn() {
    if (this.rings > 1 || this.finished) return;
    this.autoTurned = true;
    this.turns[0] = bestRotation(this.secret);
    this.spin = 1;
    this.host.app.sounds.detent();
    this.retarget();
    this.host.say(`The scope turns the wheel to ${this.turns[0]}. Does it read?`);
  }

  private lockIn() {
    if (this.finished) return;
    if (this.reading() === this.step.text) {
      this.finished = true;
      this.solvedAt = this.host.now();
      this.lock = 1;
      // The board resolves: every tile flips once more into bright, read letters.
      this.flaps = this.flaps.map((flap, i) => {
        this.delays[i] = i * 0.045;
        return {
          char: flap.next ?? flap.char,
          next: flap.next ?? flap.char,
          flip: 0,
          resolved: true,
        };
      });
      this.host.app.sounds.right();
      this.host.say(`It reads: ${this.step.text}.`);
      window.setTimeout(
        () => this.host.done({ wrong: 0, late: 0 }),
        this.host.app.reducedMotion ? 300 : 1400,
      );
      return;
    }
    this.host.app.sounds.wrong();
    this.host.miss();
    this.host.say('Not yet: that is not English. Keep turning.');
  }

  finalReport(): StepReport {
    return {
      kind: 'cracked',
      scope: this.scopeUsed,
      hints: 0,
      fooled:
        this.rings === 1 && foolsTheMachine(this.step.text, this.step.shift) && !this.autoTurned,
    };
  }

  onKey(event: KeyboardEvent): boolean {
    if (inField(event)) return false;
    if (event.key === 'ArrowLeft') this.turn(-1);
    else if (event.key === 'ArrowRight') this.turn(1);
    else if (event.key === 'ArrowUp' && this.rings > 1) this.selectRing(this.ring - 1);
    else if (event.key === 'ArrowDown' && this.rings > 1) this.selectRing(this.ring + 1);
    else if (event.key === 'Enter') this.lockIn();
    else return false;
    return true;
  }

  private selectRing(ring: number) {
    this.ring = (ring + this.rings) % this.rings;
    this.host.say(
      `Ring ${this.ring + 1} of ${this.rings}: every ${this.rings === 2 ? 'second' : this.rings === 3 ? 'third' : 'fourth'} letter, starting with letter ${this.ring + 1}.`,
    );
  }

  onPointer(
    kind: 'down' | 'move' | 'up',
    point: { x: number; y: number },
    event: PointerEvent,
  ): boolean {
    const { wheel } = CIPHER_LAYOUT;
    const dx = point.x - wheel.x;
    const dy = point.y - wheel.y;
    const angle = Math.atan2(dy, dx);
    if (kind === 'down' && Math.hypot(dx, dy) < wheel.r) {
      this.dragAngle = angle;
      return true;
    }
    if (kind === 'move' && this.dragAngle !== null) {
      let delta = angle - this.dragAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      const step = (Math.PI * 2) / 26;
      // Dragging the disc clockwise moves the letters under the pointer forward.
      if (Math.abs(delta) >= step) {
        const steps = Math.trunc(delta / step);
        this.turn(-steps);
        this.dragAngle += steps * step;
      }
      return true;
    }
    if (kind === 'up' && this.dragAngle !== null) {
      this.dragAngle = null;
      return true;
    }
    void event;
    return false;
  }

  onWheel(deltaY: number) {
    this.turn(deltaY > 0 ? 1 : -1);
  }

  hint(): string {
    const plain = this.step.text.replace(/[^A-Z]/g, '');
    const cipher = this.secret.replace(/[^A-Z]/g, '');
    if (this.rings > 1) {
      const shift = this.step.keyword!.charCodeAt(this.ring) - 65;
      return `Ring ${this.ring + 1} reads at a turn of ${readingTurn(shift)}.`;
    }
    const e = plain.indexOf('E') >= 0 ? plain.indexOf('E') : 0;
    return `In this message, ${cipher[e]} stands for ${plain[e]}.`;
  }

  reveal() {
    this.finished = true;
    if (this.rings === 1) this.turns[0] = readingTurn(this.step.shift);
    else this.turns = [...this.step.keyword!].map((char) => readingTurn(char.charCodeAt(0) - 65));
    this.retarget();
  }

  tick(dt: number) {
    const target = this.turns[this.ring]!;
    let delta = target - this.shown;
    if (delta > 13) delta -= 26;
    if (delta < -13) delta += 26;
    const motion = this.host.app.reducedMotion;
    this.shown = motion ? target : (this.shown + delta * Math.min(1, dt * 12) + 26) % 26;
    this.spin = Math.max(0, Math.min(1, Math.abs(delta) / 3, this.spin - dt * 2));
    this.lock = Math.max(0, this.lock - dt * 0.6);
    this.flaps = this.flaps.map((flap, i) => {
      if (flap.flip === undefined || flap.flip >= 1) return flap;
      if (this.delays[i]! > 0) {
        this.delays[i]! -= dt;
        return flap;
      }
      const flip = motion ? 1 : Math.min(1, flap.flip + dt * 9);
      if (flip >= 1) {
        if (!motion && i % 3 === 0) this.host.app.sounds.flap();
        return { char: flap.next ?? flap.char, resolved: flap.resolved };
      }
      return { ...flap, flip };
    });
    void this.solvedAt;
  }

  private lines(): Flap[][] {
    const out: Flap[][] = [];
    let line: Flap[] = [];
    const words: Flap[][] = [];
    let word: Flap[] = [];
    this.flaps.forEach((flap, i) => {
      if (this.secret[i] === ' ') {
        words.push(word);
        word = [];
      } else word.push(flap);
    });
    words.push(word);
    for (const w of words) {
      if (line.length > 0 && line.length + 1 + w.length > LINE) {
        out.push(line);
        line = [];
      }
      if (line.length > 0) line.push({ char: ' ', resolved: false });
      line.push(...w);
    }
    if (line.length > 0) out.push(line);
    return out;
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const turn = this.turns[this.ring]!;
    const column = this.rings > 1 ? keywordColumn(this.secret, this.rings, this.ring) : this.secret;
    const fit = rotationFit(column)[turn] ?? 0;
    const best = bestRotation(column);
    const open = this.host.chartsOpen();
    this.desk.paint(ctx, frame, this.host.app.canvas.ratio, pal);
    paintCipherStation(ctx, { ...frame.span, top: frame.top }, pal, {
      deskLaid: true,
      time,
      rotation: this.shown,
      spin: this.spin,
      lock: this.lock,
      cipherText: this.secret,
      lines: this.lines(),
      scope: {
        shares: open ? shareAfter(column, turn) : new Array<number>(26).fill(0),
        english: CODE_FREQUENCIES,
        rotation: turn,
        fit: open ? fit : 0,
        lit: open && turn === best ? 1 : 0,
        detail: 'near',
        time,
      },
      highlight: null,
      ringLabel: this.rings > 1 ? `RING ${this.ring + 1}/${this.rings}` : null,
      scopeOff: !open,
    });
  }
}
