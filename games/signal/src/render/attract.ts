import { morseTiming, type MorseSchedule, scheduleMessage } from '../codecs/morse';
import { directionAngle, encodeSemaphore } from '../codecs/semaphore';
import { DeskScene } from './desk-view';
import { DesignCanvas } from './frame';
import { type Look, paletteFor } from './palette';
import { alpha, FONT_DISPLAY, FONT_MONO, roundRect } from './paint';

/**
 * The Hall's attract loop: the desk at work. The telegraph clacks out a message, its lamp
 * blinking with every mark, while the words appear on a telegram form, and the signaller across
 * the street flags a word of their own. Silent, and still while it is off screen.
 */
const MESSAGES = ['TEA AT TEN', 'LOOK UP', 'MEET AT DAWN', 'LAMP STILL ON'];

export class AttractLoop {
  private readonly canvas = new DesignCanvas();
  private readonly scene = new DeskScene();
  private look: Look;
  private reducedMotion: boolean;
  private visible = true;
  private running = true;
  private frameId = 0;
  private last: number | null = null;
  private time = 0;
  private message = 0;
  private schedule: MorseSchedule;
  private readonly flags = encodeSemaphore(' WAVE ');
  private arms = { left: directionAngle(0), right: directionAngle(0) };

  constructor(
    private readonly host: HTMLElement,
    look: Look,
    reducedMotion: boolean,
    seed: number,
  ) {
    this.look = look;
    this.reducedMotion = reducedMotion;
    this.message = seed % MESSAGES.length;
    this.schedule = this.makeSchedule();
    this.canvas.element.style.cssText = 'position:absolute;inset:0;display:block';
    host.append(this.canvas.element);
    this.resize();
    const tick = (now: number) => {
      if (!this.running) return;
      if (this.visible) {
        const dt = this.last === null ? 0 : Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        this.advance(dt);
        this.draw();
      } else this.last = null;
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private makeSchedule() {
    return scheduleMessage(MESSAGES[this.message]!, morseTiming(14, 9));
  }

  resize() {
    this.canvas.resize(Math.max(160, this.host.clientWidth), Math.max(90, this.host.clientHeight));
    this.draw();
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.reducedMotion = reducedMotion;
    this.scene.invalidate();
    this.draw();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.last = null;
  }

  private advance(dt: number) {
    if (this.reducedMotion) return;
    this.time += dt;
    // Each message, then a pause to read it, then the next.
    if (this.time * 1000 > this.schedule.duration + 3500) {
      this.time = 0;
      this.message = (this.message + 1) % MESSAGES.length;
      this.schedule = this.makeSchedule();
    }
    const beat = 1.5;
    const step = this.flags[Math.floor((this.time / beat) % this.flags.length)]!;
    for (const side of ['left', 'right'] as const) {
      const goal = directionAngle(side === 'left' ? step.pose.near : step.pose.far);
      let delta = goal - this.arms[side];
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.arms[side] += delta * Math.min(1, dt * 7);
    }
  }

  private draw() {
    const pal = paletteFor(this.look);
    const ms = this.reducedMotion ? this.schedule.duration : this.time * 1000;
    const sounding = this.schedule.marks.some(
      (mark) => ms >= mark.start && ms < mark.start + mark.length,
    );
    const shown = this.schedule.characters
      .filter((c) => c.end <= ms)
      .map((c) => c.char)
      .join('');
    this.canvas.paint((ctx, frame) => {
      this.scene.paint(ctx, frame, this.canvas.ratio, pal, {
        time: this.time,
        waiting: [],
        focus: null,
        pose: this.arms,
        scene: 'rooftop',
        clock: 23.5,
        reducedMotion: this.reducedMotion,
        notes: ['E T  A N  I M', '... --- ...'],
        telegraph: { keyDown: 0, armature: sounding ? 1 : 0, lamp: sounding ? 1 : 0 },
      });
      // The telegram form the words land on.
      const x = 640;
      const y = 820;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.03);
      ctx.fillStyle = alpha('#000000', 0.25);
      roundRect(ctx, 8, 10, 440, 150, 8);
      ctx.fill();
      ctx.fillStyle = pal.paper;
      roundRect(ctx, 0, 0, 440, 150, 8);
      ctx.fill();
      ctx.fillStyle = pal.inkRed;
      ctx.fillRect(0, 0, 440, 34);
      ctx.fillStyle = '#fff6e6';
      ctx.font = `600 18px ${FONT_MONO}`;
      ctx.fillText('INCOMING · NIGHT WIRE', 18, 24);
      ctx.fillStyle = pal.ink;
      ctx.font = `600 40px ${FONT_DISPLAY}`;
      ctx.fillText(shown, 22, 104);
      ctx.restore();
    });
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.canvas.element.remove();
  }
}
