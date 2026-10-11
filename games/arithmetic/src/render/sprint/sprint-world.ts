import type { Layout } from '../layout';
import type { Look } from '../look';
import {
  alpha,
  clamp,
  createLayer,
  easeOutCubic,
  glow,
  type Layer,
  roundRect,
  scatter,
} from '../paint';
import type { World, WorldCue, WorldScene } from '../world';
import { DAY, NIGHT, type SprintPalette } from './palette';
import {
  celebratePose,
  drawRunner,
  hurdlePose,
  mixPose,
  type Pose,
  runPose,
  setPose,
  standPose,
  stumblePose,
} from './runner';
import { paintScoreboard, paintStadium, type Stadium } from './stadium';
import {
  drawLanes,
  grainPattern,
  paintGround,
  RUNNER_LANE,
  trackGeometry,
  type TrackGeometry,
} from './track';

/**
 * Sprint: every correct answer is a stride, a streak makes the runner faster, a wrong answer is a
 * stumble, a split clears a hurdle, and a finished block breaks the tape. Distances are in
 * metres along the runner's lane; the camera follows the runner.
 */

interface Hurdle {
  /** Position along the lane, in metres. */
  readonly at: number;
  label: number | null;
  cleared: boolean;
}

interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  color: string;
  born: number;
  life: number;
  size: number;
  kind: 'confetti' | 'dust' | 'flash';
}

const JUMP_SECONDS = 0.62;
const HURDLE_GAP = 5.5;

export class SprintWorld implements World {
  look: Look;
  private palette: SprintPalette;
  private reducedMotion: boolean;
  private layout: Layout | null = null;
  private scale = 1;
  private stadium: Stadium | null = null;
  private ground: Layer | null = null;
  private board: Layer | null = null;
  private geometry: TrackGeometry | null = null;
  private grain: CanvasPattern | null = null;
  private scene: WorldScene = { kind: 'quiet' };

  private distance = 0;
  private speed = 0;
  private phase = 0;
  private lastTime: number | null = null;
  private stumbleAt = -10;
  private cheerAt = -10;
  private finishAt: number | null = null;
  private finishLine: number | null = null;
  private tapeBroken = false;
  private hurdles: Hurdle[] = [];
  private jumpAt: number | null = null;
  private bursts: Burst[] = [];
  private streak = 0;
  private readonly random = scatter(2026);

  constructor(look: Look, reducedMotion: boolean, scale: number) {
    this.look = look;
    this.palette = look.dark ? NIGHT : DAY;
    this.reducedMotion = reducedMotion;
    this.scale = scale;
  }

  resize(layout: Layout) {
    this.layout = layout;
    this.repaint();
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.palette = look.dark ? NIGHT : DAY;
    this.reducedMotion = reducedMotion;
    this.repaint();
  }

  private repaint() {
    const layout = this.layout;
    if (!layout) return;
    this.stadium = paintStadium(layout, this.palette, this.look.dark, this.scale);
    this.geometry = trackGeometry(layout);
    this.ground = paintGround(layout, this.geometry, this.palette, this.look.dark, this.scale);
    this.grain = grainPattern(this.ground.ctx, this.palette, this.look.dark);
    this.board = createLayer(layout.width, layout.horizon + 40 * layout.s, this.scale);
    paintScoreboard(this.board.ctx, layout, this.palette, this.look.dark, this.stadium.standsTop);
  }

  show(scene: WorldScene, time: number) {
    const previous = this.scene;
    this.scene = scene;
    if (scene.kind !== 'sums' && scene.kind !== 'finish') {
      this.finishLine = null;
      this.finishAt = null;
    }
    if (scene.kind === 'sums') {
      this.streak = scene.streak;
      if (previous.kind !== 'sums') {
        this.finishLine = null;
        this.tapeBroken = false;
        this.finishAt = null;
        this.speed = Math.max(this.speed, 3);
      }
    }
    if (scene.kind === 'split') {
      if (previous.kind !== 'split' || previous.start !== scene.start) this.layHurdles(scene);
      // Label hurdles already cleared (a scene restored mid-split, or a still).
      scene.found.forEach((prime, i) => {
        const hurdle = this.hurdles[i];
        if (hurdle) {
          hurdle.label = prime;
          hurdle.cleared = true;
        }
      });
    }
    void time;
  }

  private layHurdles(scene: WorldScene & { kind: 'split' }) {
    this.hurdles = Array.from({ length: Math.max(1, scene.total) }, (_, i) => ({
      at: this.distance + 6 + i * HURDLE_GAP,
      label: null,
      cleared: false,
    }));
    this.jumpAt = null;
  }

  cue(cue: WorldCue, time: number) {
    switch (cue.kind) {
      case 'correct':
        this.streak = cue.streak;
        this.speed += 2.4;
        this.cheerAt = time;
        this.puff(time, 3);
        break;
      case 'wrong':
      case 'bounce':
        this.stumbleAt = time;
        this.streak = 0;
        this.speed *= 0.35;
        this.puff(time, 6);
        break;
      case 'split': {
        const hurdle = this.hurdles.find((h) => !h.cleared);
        if (hurdle) {
          hurdle.label = cue.prime;
          hurdle.cleared = true;
        }
        this.cheerAt = time;
        break;
      }
      case 'finish':
        this.finishLine = this.distance + 7;
        this.finishAt = time;
        this.tapeBroken = false;
        this.cheerAt = time;
        if (cue.personalBest) this.confetti(time);
        break;
    }
  }

  /** Holds every motion at a given state for a still: the hero frames use this. */
  stage(
    options: {
      distance?: number;
      phase?: number;
      speed?: number;
      jump?: number;
      tapeBroken?: boolean;
      /** Puts the finish line this many metres ahead of the runner. */
      tapeAhead?: number;
    },
    time: number,
  ) {
    if (options.tapeAhead !== undefined)
      this.finishLine = (options.distance ?? this.distance) + options.tapeAhead;
    if (options.distance !== undefined) this.distance = options.distance;
    if (options.phase !== undefined) this.phase = options.phase;
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.jump !== undefined) this.jumpAt = time - options.jump * JUMP_SECONDS;
    if (options.tapeBroken !== undefined) this.tapeBroken = options.tapeBroken;
    this.lastTime = time;
  }

  /** Personal-best confetti, in the lane colours. */
  confetti(time: number) {
    const layout = this.layout;
    if (!layout || this.reducedMotion) return;
    for (let i = 0; i < 140; i++) {
      this.bursts.push({
        x: layout.width * (0.2 + this.random() * 0.7),
        y: -20 - this.random() * layout.height * 0.3,
        vx: (this.random() - 0.5) * 80,
        vy: 120 + this.random() * 160,
        spin: (this.random() - 0.5) * 12,
        angle: this.random() * Math.PI,
        color: this.palette.confetti[i % this.palette.confetti.length]!,
        born: time,
        life: 3.2 + this.random() * 1.5,
        size: (6 + this.random() * 6) * layout.s,
        kind: 'confetti',
      });
    }
  }

  private puff(time: number, count: number) {
    const layout = this.layout;
    const geometry = this.geometry;
    if (!layout || !geometry || this.reducedMotion) return;
    const ground = geometry.lanes[RUNNER_LANE]!.middle + 14 * layout.s;
    for (let i = 0; i < count; i++) {
      this.bursts.push({
        x: this.runnerX() - 20 * layout.s,
        y: ground,
        vx: -60 - this.random() * 90,
        vy: -20 - this.random() * 30,
        spin: 0,
        angle: 0,
        color: this.palette.dust,
        born: time,
        life: 0.5 + this.random() * 0.3,
        size: (5 + this.random() * 7) * layout.s,
        kind: 'dust',
      });
    }
  }

  private runnerX(): number {
    const layout = this.layout!;
    if (layout.kind === 'menu') return layout.width * 0.62;
    if (layout.kind === 'results') return layout.width * 0.3;
    return layout.width * 0.36;
  }

  private advance(time: number) {
    const dt = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, 0.1);
    this.lastTime = time;
    const scene = this.scene;
    let target = 0;
    if (scene.kind === 'sums') target = 3.2 + Math.min(this.streak, 10) * 0.45;
    if (this.finishAt !== null) target = 7.5 - Math.min(5.5, (time - this.finishAt) * 2.2);
    if (scene.kind === 'split') {
      const next = this.hurdles.find((h) => !h.cleared || h.at > this.distance - 1);
      const waiting = next && !next.cleared;
      if (waiting) {
        const gap = next.at - this.distance;
        target = clamp((gap - 2.4) * 1.6, 0, 5.5);
      } else {
        target = 6;
      }
      // Start the jump as a cleared hurdle comes up.
      const ahead = this.hurdles.find(
        (h) => h.cleared && h.at - this.distance < 1.35 && h.at - this.distance > 0.2,
      );
      if (ahead && (this.jumpAt === null || time - this.jumpAt > JUMP_SECONDS)) this.jumpAt = time;
    }
    if (scene.kind === 'menu' || scene.kind === 'ready') target = 0;
    const rate = target > this.speed ? 3 : 4.5;
    this.speed += (target - this.speed) * Math.min(1, rate * dt);
    if (this.finishLine !== null && this.distance >= this.finishLine - 0.2) this.tapeBroken = true;
    if (this.reducedMotion) return;
    this.distance += this.speed * dt;
    this.phase += dt * Math.PI * 2 * (1.1 + 0.16 * Math.max(this.speed, 2.2));
  }

  private currentPose(time: number): Pose {
    const scene = this.scene;
    const breath = this.reducedMotion ? 0 : Math.sin(time * 1.6);
    if (scene.kind === 'menu' || scene.kind === 'ready') return setPose(breath);
    const stride = clamp(0.45 + this.speed * 0.075, 0.5, 1);
    let pose = runPose(this.phase, stride);
    // Between runs the athlete stands easy; any burst of speed blends back into a run.
    if (
      scene.kind === 'quiet' ||
      scene.kind === 'number' ||
      (scene.kind === 'finish' && this.finishAt === null)
    ) {
      pose = mixPose(standPose(Math.abs(breath)), pose, clamp(this.speed / 2.5, 0, 1));
    }
    if (this.jumpAt !== null) {
      const t = (time - this.jumpAt) / JUMP_SECONDS;
      if (t >= 0 && t <= 1) {
        const arc = Math.sin(Math.PI * t);
        const over = hurdlePose();
        pose = mixPose(pose, { ...over, lift: over.lift * arc }, Math.min(1, arc * 1.8));
      }
    }
    const sinceStumble = time - this.stumbleAt;
    if (sinceStumble >= 0 && sinceStumble < 0.55) {
      pose = mixPose(pose, stumblePose(this.phase), Math.sin((sinceStumble / 0.55) * Math.PI));
    }
    if (this.finishAt !== null && time - this.finishAt > 1.1) {
      pose = mixPose(
        pose,
        celebratePose(this.phase),
        Math.min(1, (time - this.finishAt - 1.1) * 2.5),
      );
    }
    return pose;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): boolean {
    const layout = this.layout;
    const stadium = this.stadium;
    const geometry = this.geometry;
    if (!layout || !stadium || !geometry || !this.ground || !this.board) return false;
    this.advance(time);
    const { width, s } = layout;
    ctx.drawImage(stadium.back.canvas, 0, 0, stadium.back.width, stadium.back.height);
    const cheer = this.reducedMotion ? 0 : Math.max(0, 1 - (time - this.cheerAt) / 1.4);
    stadium.rows.forEach((row, i) => {
      const bob = this.reducedMotion
        ? 0
        : Math.sin(time * 2.2 + i * 0.9) * row.lift * 0.35 +
          Math.abs(Math.sin(time * 9 + i)) * row.lift * cheer * 1.6;
      ctx.drawImage(row.layer.canvas, 0, row.y - bob, row.layer.width, row.layer.height);
    });
    ctx.drawImage(stadium.air.canvas, 0, 0, stadium.air.width, stadium.air.height);
    if (this.look.dark && !this.reducedMotion) this.cameraFlashes(ctx, time, stadium);
    ctx.drawImage(this.board.canvas, 0, 0, this.board.width, this.board.height);
    ctx.drawImage(this.ground.canvas, 0, geometry.top, this.ground.width, this.ground.height);
    drawLanes(ctx, layout, geometry, this.palette, this.grain, this.distance);
    ctx.drawImage(stadium.front.canvas, 0, 0, stadium.front.width, stadium.front.height);

    const lane = geometry.lanes[RUNNER_LANE]!;
    const runnerX = this.runnerX();
    const toScreen = (metres: number) =>
      runnerX + (metres - this.distance) * geometry.metre * lane.depth;
    for (const hurdle of this.hurdles) {
      if (this.scene.kind === 'split')
        this.drawHurdle(ctx, toScreen(hurdle.at), lane, hurdle, s, time);
    }
    if (this.finishLine !== null) this.drawFinish(ctx, toScreen(this.finishLine), geometry, s);

    if (this.scene.kind === 'sums' && this.scene.ghost !== null)
      this.drawGhost(ctx, geometry, runnerX, this.scene.ghost, time);
    const speedLines = !this.reducedMotion && this.speed > 5.2;
    if (speedLines) this.drawSpeedLines(ctx, runnerX, lane.middle, layout, time);
    drawRunner(
      ctx,
      {
        x: runnerX,
        ground: lane.middle + 10 * s,
        height: layout.height * 0.25,
        pose: this.currentPose(time),
        bib: '20',
        rim: this.look.dark,
      },
      this.palette,
    );
    this.drawBursts(ctx, time, width);
    return true;
  }

  /** Your personal best, running beside you in the next lane out: ahead or behind by its pace. */
  private drawGhost(
    ctx: CanvasRenderingContext2D,
    geometry: TrackGeometry,
    runnerX: number,
    problems: number,
    time: number,
  ) {
    const layout = this.layout!;
    const lane = geometry.lanes[RUNNER_LANE - 1]!;
    const x = runnerX + problems * 5 * geometry.metre * lane.depth;
    if (x < -100 || x > layout.width + 100) return;
    const height = layout.height * 0.25 * lane.depth;
    const ground = lane.middle + 8 * layout.s * lane.depth;
    ctx.save();
    ctx.globalAlpha = this.look.dark ? 0.42 : 0.5;
    drawRunner(
      ctx,
      {
        x,
        ground,
        height,
        pose: runPose(this.phase + 2.4, clamp(0.45 + this.speed * 0.075, 0.5, 1)),
        bib: '',
        rim: false,
        ghost: this.palette.ghost,
      },
      this.palette,
    );
    ctx.restore();
    // A small tag over its head says whose pace it is.
    const tagY = ground - height * 1.12;
    const s = layout.s;
    ctx.font = `800 ${Math.round(15 * s)}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    const label = 'YOUR BEST';
    const w = ctx.measureText(label).width + 18 * s;
    roundRect(ctx, x - w / 2 + 6 * s, tagY - 13 * s, w, 26 * s, 13 * s);
    ctx.fillStyle = this.look.dark ? 'rgba(10, 30, 50, 0.8)' : 'rgba(255, 255, 255, 0.88)';
    ctx.fill();
    ctx.fillStyle = this.look.dark ? '#8fe3ff' : '#1f4e8c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 6 * s, tagY + 1 * s);
    void time;
  }

  private drawHurdle(
    ctx: CanvasRenderingContext2D,
    x: number,
    lane: { top: number; bottom: number; depth: number },
    hurdle: Hurdle,
    s: number,
    time: number,
  ) {
    if (x < -120 * s || x > this.layout!.width + 120 * s) return;
    const height = this.layout!.height * 0.25 * 0.5;
    const nearFoot = lane.bottom - 6 * s;
    const farFoot = lane.top + 8 * s;
    const skew = 34 * s;
    ctx.save();
    ctx.lineCap = 'round';
    // Far upright, then the striped top bar, then the near upright in front of it.
    ctx.strokeStyle = alpha('#9aa3b2', 0.9);
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(x + skew, farFoot);
    ctx.lineTo(x + skew, farFoot - height * 0.9);
    ctx.stroke();
    const barTop = nearFoot - height;
    ctx.fillStyle = this.palette.hurdle;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, barTop);
    ctx.lineTo(x + skew + 3 * s, farFoot - height * 0.9 - 2 * s);
    ctx.lineTo(x + skew + 3 * s, farFoot - height * 0.9 + 16 * s);
    ctx.lineTo(x - 3 * s, barTop + 22 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.palette.hurdleBar;
    for (let i = 0; i < 3; i++) {
      const t0 = (i * 2 + 0.5) / 6;
      const t1 = (i * 2 + 1.5) / 6;
      ctx.beginPath();
      ctx.moveTo(x - 3 * s + (skew + 6 * s) * t0, barTop + (farFoot - height * 0.9 - barTop) * t0);
      ctx.lineTo(x - 3 * s + (skew + 6 * s) * t1, barTop + (farFoot - height * 0.9 - barTop) * t1);
      ctx.lineTo(
        x - 3 * s + (skew + 6 * s) * t1,
        barTop + 22 * s + (farFoot - height * 0.9 + 16 * s - barTop - 22 * s) * t1,
      );
      ctx.lineTo(
        x - 3 * s + (skew + 6 * s) * t0,
        barTop + 22 * s + (farFoot - height * 0.9 + 16 * s - barTop - 22 * s) * t0,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#c3c9d4';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x, nearFoot);
    ctx.lineTo(x, barTop + 6 * s);
    ctx.moveTo(x - 12 * s, nearFoot);
    ctx.lineTo(x + 14 * s, nearFoot);
    ctx.stroke();
    // The prime it stands for, on a badge floating above head height so the runner never hides it.
    const runnerHeight = this.layout!.height * 0.25;
    const badgeX = x + skew / 2;
    const badgeY = nearFoot - runnerHeight * 1.3;
    const r = 25 * s;
    const lit = hurdle.label !== null;
    ctx.strokeStyle = alpha(this.look.dark ? '#9fb3d1' : '#1b2c50', 0.35);
    ctx.lineWidth = 2 * s;
    ctx.setLineDash([4 * s, 5 * s]);
    ctx.beginPath();
    ctx.moveTo(badgeX, badgeY + r);
    ctx.lineTo(badgeX, barTop - 4 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    const newest = lit && hurdle === this.hurdles.filter((h) => h.cleared).at(-1);
    if (lit && (this.look.dark || newest))
      glow(
        ctx,
        badgeX,
        badgeY,
        r * (newest ? 3.4 : 2.6),
        newest ? 'rgba(255, 170, 60, 0.6)' : 'rgba(255, 190, 90, 0.45)',
      );
    if (newest) {
      ctx.strokeStyle = this.look.dark ? 'rgba(255, 220, 160, 0.9)' : 'rgba(194, 65, 12, 0.85)';
      ctx.lineWidth = 2.5 * s;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(badgeX + Math.cos(a) * r * 1.35, badgeY + Math.sin(a) * r * 1.35);
        ctx.lineTo(badgeX + Math.cos(a) * r * 1.85, badgeY + Math.sin(a) * r * 1.85);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, r, 0, Math.PI * 2);
    ctx.fillStyle = lit ? this.palette.singlet : alpha(this.look.dark ? '#1a2335' : '#ffffff', 0.9);
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = lit ? '#ffffff' : alpha(this.look.dark ? '#9fb3d1' : '#1b2c50', 0.6);
    ctx.stroke();
    ctx.fillStyle = lit ? '#ffffff' : this.look.dark ? '#9fb3d1' : '#1b2c50';
    const text = lit ? String(hurdle.label) : '?';
    ctx.font = `800 ${Math.round((text.length > 2 ? 16 : 26) * s)}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, badgeX, badgeY + 1 * s);
    ctx.restore();
    void time;
  }

  private drawFinish(ctx: CanvasRenderingContext2D, x: number, geometry: TrackGeometry, s: number) {
    if (x < -200 * s || x > this.layout!.width + 200 * s) return;
    // The line across every lane, slanting with depth, then the tape at chest height.
    ctx.fillStyle = '#ffffff';
    for (const lane of geometry.lanes) {
      const offset = (lane.depth - 1) * 30 * s;
      ctx.fillRect(
        x + offset - 4 * s * lane.depth,
        lane.top,
        8 * s * lane.depth,
        lane.bottom - lane.top,
      );
    }
    const lane = geometry.lanes[RUNNER_LANE]!;
    const tapeY = lane.middle - this.layout!.height * 0.2 * 0.62;
    ctx.strokeStyle = this.palette.tape;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    if (this.tapeBroken) {
      ctx.moveTo(x, tapeY - 30 * s);
      ctx.quadraticCurveTo(x - 30 * s, tapeY + 10 * s, x - 70 * s, tapeY + 40 * s);
    } else {
      ctx.moveTo(x - 10 * s, lane.bottom - this.layout!.height * 0.2 * 0.62);
      ctx.lineTo(x + 26 * s, lane.top - this.layout!.height * 0.2 * 0.6);
    }
    ctx.stroke();
  }

  private drawSpeedLines(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    layout: Layout,
    time: number,
  ) {
    const { s } = layout;
    const strength = clamp((this.speed - 5.2) / 3, 0, 1);
    ctx.strokeStyle = alpha(this.look.dark ? '#cfe2ff' : '#ffffff', 0.5 * strength);
    ctx.lineWidth = 2.2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ly = y - layout.height * 0.2 * (0.2 + i * 0.13);
      const drift = ((time * 900 + i * 137) % 260) * s;
      const start = x - 70 * s - drift;
      ctx.moveTo(start, ly);
      ctx.lineTo(start - (60 + i * 12) * s * strength, ly);
    }
    ctx.stroke();
  }

  private cameraFlashes(ctx: CanvasRenderingContext2D, time: number, stadium: Stadium) {
    const layout = this.layout!;
    // A handful of flashes per second, more when the crowd cheers.
    const slot = Math.floor(time * 7);
    for (let k = 0; k < 3; k++) {
      const random = scatter(slot * 31 + k * 7 + 1);
      if (random() > 0.55) continue;
      const row = stadium.rows[Math.floor(random() * stadium.rows.length)]!;
      const seat = row.seats[Math.floor(random() * row.seats.length)];
      if (seat === undefined) continue;
      const fade = 1 - (time * 7 - slot);
      const y = row.y + row.layer.height * 0.35;
      glow(ctx, seat, y, 26 * layout.s, `rgba(255,255,255,${0.9 * fade})`);
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.fillRect(seat - 2 * layout.s, y - 2 * layout.s, 4 * layout.s, 4 * layout.s);
    }
  }

  private drawBursts(ctx: CanvasRenderingContext2D, time: number, width: number) {
    this.bursts = this.bursts.filter((b) => time - b.born < b.life);
    for (const b of this.bursts) {
      const t = time - b.born;
      const fade = 1 - easeOutCubic(t / b.life) * (b.kind === 'confetti' ? 0.3 : 1);
      const x = b.x + b.vx * t;
      const y = b.y + b.vy * t + (b.kind === 'dust' ? -10 * t * t : 0);
      if (x < -40 || x > width + 40) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = b.color;
      if (b.kind === 'confetti') {
        ctx.translate(x + Math.sin(t * 3 + b.angle) * 18, y);
        ctx.rotate(b.angle + b.spin * t);
        ctx.scale(1, Math.cos(t * 7 + b.angle));
        roundRect(ctx, -b.size / 2, -b.size / 4, b.size, b.size / 2, 1);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, b.size * (1 + t * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  destroy() {
    this.bursts = [];
  }
}
