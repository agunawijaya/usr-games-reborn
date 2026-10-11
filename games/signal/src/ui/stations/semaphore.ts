import {
  type Direction,
  directionAngle,
  encodeSemaphore,
  judgeSend,
  type Pose,
  REST,
  samePose,
  type SemaphoreStep,
  type Verdict,
} from '../../codecs/semaphore';
import { normalize, type Step } from '../../engine/message';
import type { StepReport } from '../../game/records';
import { blit, CachedLayer, type DesignFrame } from '../../render/frame';
import { paintOutsideFigure, paintOutsideGround, paintOutsideSky } from '../../render/outside';
import type { DeskPalette } from '../../render/palette';
import { chartHeight, paintPoseChart } from '../../render/pose-chart';
import { handPosition, shoulderPosition } from '../../render/signaller';
import {
  chipPositions,
  paintSemaphoreOverlay,
  SEMAPHORE_LAYOUT,
} from '../../render/stations/semaphore-station';
import { inField } from '../app';
import { h, place } from '../dom';
import { card } from '../hud';
import { nextLetterHint, type Station, type StationHost } from './station';

type FlagStep = Extract<Step, { machine: 'semaphore' }>;

/** Keys for the flag on the reader's left: the left hand's cluster. */
const NEAR_CODES: Record<string, Direction> = {
  KeyQ: 3,
  KeyW: 4,
  KeyE: 5,
  KeyA: 2,
  KeyD: 6,
  KeyZ: 1,
  KeyX: 0,
  KeyC: 7,
};
/** Keys for the flag on the right: the number pad, or U I O / J L / M , . without one. */
const FAR_CODES: Record<string, Direction> = {
  Numpad7: 3,
  Numpad8: 4,
  Numpad9: 5,
  Numpad4: 2,
  Numpad6: 6,
  Numpad1: 1,
  Numpad2: 0,
  Numpad3: 7,
  KeyU: 3,
  KeyI: 4,
  KeyO: 5,
  KeyJ: 2,
  KeyL: 6,
  KeyM: 1,
  Comma: 0,
  Period: 7,
};

const CHART = { x: 1366, y: 84, width: 494 };

/**
 * The roof. Reading: the signaller sends the message pose by pose, dropping both flags to rest
 * between words, and the player types it. Sending: each letter is set with the two flags, by
 * keys, by clicking a position or by dragging a flag, against a clock per letter; a judge
 * stamps every letter right, late or wrong.
 */
export class SemaphoreStation implements Station {
  readonly element = h('div', {
    class: 'dd-station dd-station--semaphore',
    tabindex: -1,
    'aria-label': 'The machine',
  });
  readonly typed: boolean;
  readonly instructions: string;
  readonly answerAt = { x: 1260, y: 772, width: 620 };
  private readonly step: FlagStep;
  private readonly steps: SemaphoreStep[];
  private readonly chart: HTMLElement;
  private readonly chartCanvas: HTMLCanvasElement;
  private readonly ground = new CachedLayer();
  // The arms as drawn, easing towards their targets.
  private arms = { left: directionAngle(0) - 0.28, right: directionAngle(0) + 0.28 };
  private armSpeed = { left: 0, right: 0 };
  // Reading.
  private t = -1;
  private playing = false;
  private lastShown = -1;
  // Sending.
  private chosen: { near: Direction | null; far: Direction | null } = { near: 0, far: 0 };
  private index = 0;
  private letterTime = 0;
  private verdicts: Verdict[] = [];
  private stamp: { text: string; verdict: Verdict; age: number } | null = null;
  private dragging: 'near' | 'far' | null = null;
  private dragAngle = 0;
  private finished = false;
  private readonly word: HTMLElement;

  constructor(private readonly host: StationHost) {
    this.step = host.step as FlagStep;
    this.typed = this.step.mode === 'read';
    this.steps = encodeSemaphore(this.step.text);
    this.instructions =
      this.step.mode === 'read'
        ? 'Each pose is held for a beat; both flags drop between words. Type what is sent.'
        : 'Set both flags for each letter before its clock runs out: keys, a click on a position, or drag a flag.';
    this.chartCanvas = h('canvas', { 'aria-hidden': 'true' });
    this.chartCanvas.style.cssText = 'display:block;width:100%;height:auto';
    this.chart = card(['Pose chart', 'H hides it'], this.chartCanvas);
    this.chart.classList.add('dd-panel');
    this.word = h('div', { class: 'dd-sendword', 'aria-label': 'Word to send' });
    this.element.append(this.chart);
    if (this.step.mode === 'read') {
      this.playing = true;
      this.t = -1.2;
    } else {
      this.element.append(this.chipButtons());
      this.renderWord();
    }
    this.chartsChanged();
  }

  /** Invisible buttons over the chips, so a click or Tab and Enter can choose a position. */
  private chipButtons(): HTMLElement {
    const layer = h('div', { class: 'dd-chips' });
    for (const chip of chipPositions()) {
      layer.append(
        h('button', {
          type: 'button',
          class: 'dd-chip',
          'data-side': chip.side,
          'data-direction': chip.direction,
          'aria-label': `${chip.side === 'near' ? 'Left' : 'Right'} flag ${['down', 'low left', 'left', 'high left', 'up', 'high right', 'right', 'low right'][chip.direction]}`,
          onclick: () => this.choose(chip.side, chip.direction),
        }),
      );
    }
    return layer;
  }

  headerExtra(): HTMLElement | null {
    return this.step.mode === 'send' ? this.word : null;
  }

  chartsChanged() {
    this.chart.hidden = !this.host.chartsOpen();
    this.drawChart();
  }

  private chartLetters(): string[] {
    return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  }

  private drawChart() {
    const letters = this.chartLetters();
    // Six to a row keeps all twenty-six in view without scrolling.
    const columns = 6;
    const height = chartHeight(450, columns, letters.length);
    this.chartCanvas.width = 900;
    this.chartCanvas.height = Math.ceil(height * 2);
    const ctx = this.chartCanvas.getContext('2d')!;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 450, height);
    const current = this.step.mode === 'send' ? (this.steps[this.index]?.meaning ?? null) : null;
    const done = new Set(this.steps.slice(0, this.index).map((s) => s.meaning));
    paintPoseChart(
      ctx,
      0,
      0,
      450,
      letters,
      columns,
      this.host.app.pal,
      current && /[A-Z]/.test(current) ? current : null,
      done,
    );
  }

  layout(frame: DesignFrame) {
    place(this.chart, frame, { x: CHART.x, y: CHART.y, width: CHART.width });
    for (const element of this.element.querySelectorAll<HTMLElement>('.dd-chip')) {
      const chip = chipPositions().find(
        (c) => c.side === element.dataset.side && String(c.direction) === element.dataset.direction,
      )!;
      place(element, frame, {
        x: chip.x - chip.r,
        y: chip.y - chip.r,
        width: chip.r * 2,
        height: chip.r * 2,
      });
    }
  }

  replay() {
    this.t = -0.6;
    this.playing = true;
    this.lastShown = -1;
  }

  // ——— reading ———

  /** Seconds a step is held: a word's rest a little longer, a double letter's pause short. */
  private holdOf(step: SemaphoreStep): number {
    const hold = this.step.mode === 'read' ? this.step.hold : 1;
    if (step.kind === 'rest') return hold * 1.4;
    if (step.kind === 'pause') return hold * 0.45;
    return hold;
  }

  private shownStep(): number {
    let clock = this.t;
    for (let i = 0; i < this.steps.length; i++) {
      clock -= this.holdOf(this.steps[i]!);
      if (clock < 0) return i;
    }
    return -1;
  }

  // ——— sending ———

  private currentTarget(): SemaphoreStep | null {
    return this.steps[this.index] ?? null;
  }

  private choose(side: 'near' | 'far', direction: Direction) {
    if (this.step.mode !== 'send' || this.finished) return;
    if (this.chosen[side] !== direction) this.host.app.sounds.flag();
    this.chosen = { ...this.chosen, [side]: direction };
    this.check();
  }

  private chosenPose(): Pose | null {
    if (this.chosen.near === null || this.chosen.far === null) return null;
    return { near: this.chosen.near, far: this.chosen.far };
  }

  private check() {
    const target = this.currentTarget();
    const pose = this.chosenPose();
    if (!target || !pose || !samePose(pose, target.pose)) return;
    const limit = this.step.mode === 'send' ? this.step.limit : 1;
    const verdict = judgeSend(
      target.pose,
      pose,
      this.letterTime,
      target.kind === 'pause' ? limit : limit,
    );
    this.judge(verdict);
  }

  private judge(verdict: Verdict) {
    const target = this.currentTarget()!;
    this.verdicts.push(verdict);
    if (target.kind === 'letter' || target.kind === 'digit') {
      this.stamp = { text: `${target.meaning} · ${verdict}`, verdict, age: 0 };
      this.host.app.sounds.stamp();
    }
    this.host.say(
      target.kind === 'rest' || target.kind === 'pause'
        ? 'Rest.'
        : `${target.meaning}: ${verdict}.`,
    );
    this.index++;
    this.letterTime = 0;
    this.renderWord();
    this.drawChart();
    if (this.index >= this.steps.length) {
      this.finished = true;
      const wrong = this.verdicts.filter((v) => v === 'wrong').length;
      const late = this.verdicts.filter((v) => v === 'late').length;
      if (wrong === 0) this.host.app.sounds.right();
      window.setTimeout(() => this.host.done({ wrong, late }), 700);
    }
  }

  private renderWord() {
    const letters = this.steps.map((step, i) => {
      const verdict = this.verdicts[i];
      const label =
        step.kind === 'rest'
          ? '␣'
          : step.kind === 'pause'
            ? '·'
            : step.kind === 'numerals'
              ? '#'
              : step.meaning;
      return h(
        'li',
        {
          class: 'dd-letter',
          'data-verdict': verdict,
          'data-current': i === this.index && !this.finished ? 'true' : undefined,
          'aria-label': `${step.kind === 'rest' ? 'rest' : step.kind === 'pause' ? 'pause' : label}${verdict ? `, ${verdict}` : ''}`,
        },
        label,
        verdict
          ? h(
              'span',
              { class: 'dd-letter__mark', 'aria-hidden': 'true' },
              verdict === 'right' ? '✓' : verdict === 'late' ? '!' : '✗',
            )
          : null,
      );
    });
    const bar = h('i');
    const limit = this.step.mode === 'send' ? this.step.limit : 1;
    bar.style.width = `${Math.max(0, 100 - (this.letterTime / limit) * 100)}%`;
    this.word.replaceChildren(
      h(
        'div',
        {},
        h('ol', { class: 'dd-word dd-word--small' }, ...letters),
        h(
          'div',
          { class: 'dd-timer', role: 'timer' },
          h(
            'span',
            { class: 'dd-timer__label' },
            `${Math.max(0, limit - this.letterTime).toFixed(1)} s`,
          ),
          h('div', { class: 'dd-timer__bar' }, bar),
        ),
      ),
    );
  }

  onKey(event: KeyboardEvent): boolean {
    if (inField(event) || this.step.mode !== 'send' || this.finished) return false;
    const near = NEAR_CODES[event.code];
    const far = FAR_CODES[event.code];
    if (near !== undefined) this.choose('near', near);
    else if (far !== undefined) this.choose('far', far);
    else if (event.code === 'Space') {
      this.choose('near', REST.near);
      this.choose('far', REST.far);
    } else return false;
    return true;
  }

  onPointer(kind: 'down' | 'move' | 'up', point: { x: number; y: number }): boolean {
    if (this.step.mode !== 'send' || this.finished) return false;
    const { x, y, height } = SEMAPHORE_LAYOUT.signaller;
    if (kind === 'down') {
      for (const side of ['near', 'far'] as const) {
        const hand = handPosition(
          x,
          y,
          height,
          side === 'near' ? 'left' : 'right',
          side === 'near' ? this.arms.left : this.arms.right,
        );
        if (Math.hypot(point.x - hand.x, point.y - hand.y) < 110) {
          this.dragging = side;
          return true;
        }
      }
      return false;
    }
    if (!this.dragging) return false;
    const shoulder = shoulderPosition(x, y, height, this.dragging === 'near' ? 'left' : 'right');
    this.dragAngle = Math.atan2(point.y - shoulder.y, point.x - shoulder.x);
    if (kind === 'up') {
      // Snap to the nearest of the eight positions.
      const steps = Math.round((this.dragAngle - Math.PI / 2) / (Math.PI / 4));
      const direction = (((steps % 8) + 8) % 8) as Direction;
      const side = this.dragging;
      this.dragging = null;
      this.choose(side, direction);
    }
    return true;
  }

  hint(): string {
    if (this.step.mode === 'read') return nextLetterHint(this.host.typedAnswer(), this.step.text);
    const target = this.currentTarget();
    if (!target) return 'All sent.';
    const names = [
      'down',
      'low left',
      'left',
      'high left',
      'up',
      'high right',
      'right',
      'low right',
    ];
    return `${target.kind === 'rest' ? 'Rest' : target.meaning}: left flag ${names[target.pose.near]}, right flag ${names[target.pose.far]}.`;
  }

  reveal() {
    this.finished = true;
  }

  finalReport(): StepReport | null {
    if (this.step.mode === 'read') {
      return { kind: 'read-flags', letters: normalize(this.step.text).replace(/ /g, '').length };
    }
    return {
      kind: 'sent-flags',
      late: this.verdicts.filter((v) => v === 'late').length,
      wrong: this.verdicts.filter((v) => v === 'wrong').length,
    };
  }

  tick(dt: number) {
    let target: Pose;
    if (this.step.mode === 'read') {
      if (this.playing) {
        this.t += dt;
        const index = this.shownStep();
        if (index < 0 && this.t > 0) this.playing = false;
        if (index !== this.lastShown && index >= 0) this.host.app.sounds.flag();
        this.lastShown = index;
      }
      target = this.playing && this.lastShown >= 0 ? this.steps[this.lastShown]!.pose : REST;
    } else {
      if (!this.finished && this.currentTarget()) {
        this.letterTime += dt;
        const limit = this.step.limit;
        if (this.letterTime > limit * 2) this.judge('wrong');
        else if (Math.floor((this.letterTime - dt) * 10) !== Math.floor(this.letterTime * 10))
          this.renderWord();
      }
      target = { near: this.chosen.near ?? 0, far: this.chosen.far ?? 0 };
    }
    this.moveArms(target, dt);
    if (this.stamp) {
      this.stamp.age += dt;
      if (this.stamp.age > 1.6) this.stamp = null;
    }
  }

  /** Weighted arms: a spring that starts briskly and settles without wobbling past the pose. */
  private moveArms(pose: Pose, dt: number) {
    const rest = samePose(pose, REST);
    // At rest the two flags cross in front of the legs.
    const goals = {
      left:
        this.dragging === 'near' ? this.dragAngle : directionAngle(pose.near) - (rest ? 0.28 : 0),
      right:
        this.dragging === 'far' ? this.dragAngle : directionAngle(pose.far) + (rest ? 0.28 : 0),
    };
    for (const side of ['left', 'right'] as const) {
      let delta = goals[side] - this.arms[side];
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (this.host.app.reducedMotion) {
        this.arms[side] += delta;
        continue;
      }
      const stiffness = 90;
      const damping = 19;
      this.armSpeed[side] += (delta * stiffness - this.armSpeed[side] * damping) * dt;
      this.arms[side] += this.armSpeed[side] * dt;
    }
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const span = { ...frame.span, top: frame.top };
    const { x, y, height } = SEMAPHORE_LAYOUT.signaller;
    const width = span.right - span.left;
    const view = {
      x: span.left,
      y: span.top,
      width,
      height: 1080 - span.top,
      roofLine: 0.7,
      signaller: { x: (x - span.left) / width, y: (y - span.top) / (1080 - span.top), height },
      pose: this.arms,
      scene: this.step.scene,
      time,
      detail: 'near' as const,
    };
    paintOutsideSky(ctx, view, pal);
    const ground = this.ground.get(
      frame,
      this.host.app.canvas.ratio,
      `${pal.look}:${this.step.scene}`,
      (layer) => paintOutsideGround(layer, { ...view, time: 0 }, pal),
    );
    blit(ctx, ground);
    const send = this.step.mode === 'send';
    const target = this.currentTarget();
    paintSemaphoreOverlay(ctx, pal, {
      chips: send && !this.finished,
      chosen: this.chosen,
      ghost: send && this.host.chartsOpen() && target ? target.pose : null,
      beforeFigure: true,
    });
    paintOutsideFigure(ctx, view, pal);
    paintSemaphoreOverlay(ctx, pal, {
      chips: send && !this.finished,
      chosen: this.chosen,
      ghost: null,
      beforeFigure: false,
    });
    if (this.stamp) this.paintStamp(ctx, pal);
  }

  private paintStamp(ctx: CanvasRenderingContext2D, pal: DeskPalette) {
    const stamp = this.stamp!;
    const fade = Math.min(1, (1.6 - stamp.age) * 2);
    const color =
      stamp.verdict === 'right'
        ? pal.look === 'night'
          ? '#8fdc98'
          : '#2c6e36'
        : stamp.verdict === 'late'
          ? pal.look === 'night'
            ? '#ffc46b'
            : '#8f4f00'
          : pal.look === 'night'
            ? '#ff9a8a'
            : '#a3261d';
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(1080, 140);
    ctx.rotate(-0.12);
    const pop = 1 + Math.max(0, 0.25 - stamp.age) * 1.2;
    ctx.scale(pop, pop);
    ctx.font = `700 52px 'IBM Plex Mono', monospace`;
    const text = stamp.text.toUpperCase();
    const w = ctx.measureText(text).width + 48;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(-w / 2, -40, w, 80);
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 8, -32, w - 16, 64);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 2);
    ctx.restore();
  }
}
