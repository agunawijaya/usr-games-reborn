import { type Cell, same } from '../engine/geometry';
import type { Peek, Round } from '../engine/round';
import type { StrikeChance } from '../engine/snake';
import { drawAtmosphere, drawLanterns, drawWater } from './ambience';
import { drawDoor } from './door';
import { drawExplorer, drawHeldSatchel, drawWadingRipples, type ExplorerPose } from './explorer';
import { groundAt } from '../engine/garden';
import { type BoardFrame, centre, fitBoard, type Region } from './frame';
import { drawGlint, type GlintTier } from './glint';
import { blobPath, cellsOf, paintGround } from './ground';
import type { Look } from './look';
import { coilSpine, pourPath, pourStream, spill } from './moments';
import { drawPeek, drawStrikes } from './preview';
import type { Point } from './shapes';
import { drawSnake, type SnakeMood } from './snake';
import { glow, sparkle } from './shapes';
import { rgba } from './noise';
import type { FlyingGlint } from './moments';

/** The explorer stands a little taller than a square, so the satchel's bulge reads. */
const EXPLORER_SCALE = 1.5;

export type Moment =
  | {
      readonly kind: 'coil';
      /** 0–1: the snake wrapping round you. */
      readonly progress: number;
      /** 0–1: the glints flying out of the burst satchel. */
      readonly spill: number;
      readonly spillTiers: readonly GlintTier[];
    }
  | {
      /** The poster: coiled round a heap of glints instead of round you. */
      readonly kind: 'hoard';
      readonly tiers: readonly GlintTier[];
    }
  | {
      readonly kind: 'bank';
      /** 0–1: the vault hatch sliding open. */
      readonly open: number;
      /** Glints pouring from the satchel into the vault. */
      readonly pouring: boolean;
      readonly pourTiers: readonly GlintTier[];
    };

/** Everything the view needs for one frame, as plain data. */
export interface ViewScene {
  readonly round: Round;
  readonly look: Look;
  /** The tier of each glint on the ground, in the order of `round.glints`. */
  readonly tiers: readonly GlintTier[];
  readonly fullness: number;
  readonly boldness: number;
  readonly mood: SnakeMood;
  readonly strikes: readonly StrikeChance[] | null;
  readonly peek: Peek | null;
  readonly pose: ExplorerPose;
  readonly facing: 1 | -1;
  readonly moment: Moment | null;
  /** Overrides the snake's squares, for poses that leave the grid (sulking in a heap). */
  readonly snakeSpine?: readonly Point[];
  /** Varies the textures between chambers. */
  readonly seed: number;
  /** A turn in progress: where you and the snake were, and how far along the glide is. */
  readonly motion?: Motion | null;
  /** Short-lived sparkles and puffs, each with its age from 0 to 1. */
  readonly flashes?: readonly Flash[];
  /** A walk the mouse is offering: footprints to the square it would stop on. */
  readonly path?: readonly Cell[] | null;
}

export interface Motion {
  readonly you: Cell;
  readonly snake: readonly Cell[];
  /** 0 at the start of the turn, 1 when everything has arrived. */
  readonly t: number;
}

export interface Flash {
  readonly kind: 'pickup' | 'warp-out' | 'warp-in' | 'bump' | 'wake';
  readonly cell: Cell;
  readonly age: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export class GardenView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private ground: HTMLCanvasElement | null = null;
  private groundKey = '';
  private width = 1;
  private height = 1;
  private ratio = 1;
  private region: Region = { x: 0, y: 0, width: 1, height: 1 };
  frame: BoardFrame = { x: 0, y: 0, cell: 1, columns: 1, rows: 1 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    this.ctx = ctx;
  }

  /** The canvas size in CSS pixels, the board's region inside it, and the pixel ratio. */
  layout(width: number, height: number, region: Region, ratio = window.devicePixelRatio || 1) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.ratio = Math.min(2, ratio);
    this.region = region;
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.groundKey = '';
  }

  render(scene: ViewScene, time: number) {
    const { ctx } = this;
    const { round } = scene;
    this.frame = fitBoard(this.region, round.garden.width, round.garden.height);
    this.ensureGround(scene);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.drawImage(this.ground!, 0, 0, this.width, this.height);

    const frame = this.frame;
    const s = frame.cell;
    const pools = cellsOf(round.garden, 'pool');
    if (pools.length)
      drawWater(ctx, frame, blobPath(frame, pools, s * 0.11, s * 0.26), pools, scene.look, time);

    const door = centre(frame, round.garden.door);
    const glide = scene.motion ? easeInOut(Math.min(1, scene.motion.t)) : 1;
    const you = scene.motion
      ? lerpPoint(centre(frame, scene.motion.you), centre(frame, round.you), glide)
      : centre(frame, round.you);
    const near = Math.max(0, 1 - Math.hypot(door.x - you.x, door.y - you.y) / (s * 4));
    drawDoor(ctx, {
      ...door,
      cell: s,
      look: scene.look,
      time,
      open: scene.moment?.kind === 'bank' ? scene.moment.open : 0,
      beckon: Math.max(near, scene.fullness * 0.6),
    });

    round.glints.forEach((g, i) => {
      if (scene.moment?.kind === 'bank' && same(g, round.you)) return;
      const at = centre(frame, g);
      drawGlint(ctx, {
        ...at,
        size: s * 0.8,
        tier: scene.tiers[i] ?? 0,
        look: scene.look,
        time,
        phase: i * 2.1,
      });
    });

    if (scene.strikes) drawStrikes(ctx, frame, scene.strikes, scene.look, time);
    if (scene.peek) drawPeek(ctx, frame, scene.peek, scene.look, time);
    if (scene.path?.length) drawPath(ctx, frame, scene.path, scene.look, time);

    this.drawCharacters(scene, time, you, glide);
    for (const flash of scene.flashes ?? []) drawFlash(ctx, frame, flash, scene.look);
    drawLanterns(ctx, {
      frame,
      width: this.width,
      height: this.height,
      look: scene.look,
      time,
      seed: scene.seed,
    });
    drawAtmosphere(ctx, {
      frame,
      width: this.width,
      height: this.height,
      look: scene.look,
      time,
      seed: scene.seed,
    });
  }

  private drawCharacters(scene: ViewScene, time: number, you: Point, glide: number) {
    const { ctx, frame } = this;
    const s = frame.cell;
    const from = scene.motion?.snake;
    const spine =
      scene.snakeSpine ??
      scene.round.snake.map((c, i) => {
        const before = from?.[i];
        return before
          ? lerpPoint(centre(frame, before), centre(frame, c), glide)
          : centre(frame, c);
      });
    const moment = scene.moment;
    const snake = {
      cell: s,
      look: scene.look,
      time,
      boldness: scene.boldness,
      mood: scene.mood,
      gaze: you,
    };

    if (moment?.kind === 'hoard') {
      const coiled = coilSpine(spine, you, s * 1.15, 1);
      drawSnake(ctx, { ...snake, spine: coiled, gaze: you, layer: 'body' });
      drawHoard(ctx, you, s, moment.tiers, scene.look, time);
      drawSnake(ctx, {
        ...snake,
        spine: coiled,
        gaze: { x: you.x - s * 2, y: you.y + s },
        layer: 'head',
      });
      return;
    }

    if (moment?.kind === 'coil') {
      const coiled = coilSpine(spine, you, s, moment.progress);
      drawSnake(ctx, { ...snake, spine: coiled, gaze: you, layer: 'body' });
      drawExplorer(ctx, {
        ...you,
        cell: s * 1.35,
        look: scene.look,
        time,
        fullness: 0,
        facing: scene.facing,
        pose: 'startled',
        spilled: true,
      });
      drawSnake(ctx, { ...snake, spine: coiled, gaze: you, layer: 'head' });
      const satchel = { x: you.x + s * 0.2, y: you.y + s * 0.1 };
      const flying = spill(
        satchel,
        s,
        moment.spillTiers.length,
        scene.seed,
        moment.spill,
        moment.spillTiers,
      );
      drawBurst(ctx, satchel, s, moment.spill, scene.look);
      const inside = (g: { x: number; y: number }) => ({
        x: Math.max(frame.x + s * 0.3, Math.min(frame.x + frame.columns * s - s * 0.3, g.x)),
        y: Math.max(frame.y + s * 0.3, Math.min(frame.y + frame.rows * s - s * 0.3, g.y)),
      });
      for (const [i, raw] of flying.entries()) {
        const g = { ...raw, ...inside(raw) };
        if (!g.landed) drawStreak(ctx, g, satchel, s, scene.look);
        drawGlint(ctx, {
          x: g.x,
          y: g.y - g.lift,
          size: s * 0.56,
          tier: g.tier,
          look: scene.look,
          time,
          phase: i,
          tumble: g.tumble,
        });
      }
      return;
    }

    const sulking = scene.mood === 'sulk';
    drawSnake(ctx, { ...snake, spine, gaze: sulking ? awayFrom(spine[0]!, you) : you });
    if (sulking) drawGrumble(ctx, spine[0]!, s, scene.look, time);
    if (scene.mood === 'asleep') drawSnores(ctx, spine[0]!, s, scene.look, time);
    const banking = moment?.kind === 'bank' && moment.pouring;
    const pose = banking ? 'pour' : scene.pose;
    // Banking, you stand at the vault's rim and hold your satchel out over it.
    const stand = banking ? { x: you.x - s * 1.05, y: you.y + s * 0.12 } : you;
    const wading =
      !banking && groundAt(scene.round.garden, scene.round.you) === 'pool' && !scene.motion;
    drawExplorer(ctx, {
      wading,
      ...stand,
      cell: s * EXPLORER_SCALE,
      look: scene.look,
      time,
      fullness: scene.fullness,
      facing: scene.facing,
      pose,
    });

    if (wading) drawWadingRipples(ctx, stand.x, stand.y, s * EXPLORER_SCALE, scene.look, time);

    if (moment?.kind === 'bank' && moment.pouring) {
      const into = centre(frame, scene.round.garden.door);
      const mouth = { x: into.x - s * 0.32, y: into.y - s * 1.2 };
      const path = pourPath(mouth, { x: into.x, y: into.y - s * 0.05 }, s);
      drawSplash(ctx, into, s, scene.look, time);
      for (const [i, g] of pourStream(path, time, 7, moment.pourTiers).entries()) {
        drawGlint(ctx, {
          x: g.x,
          y: g.y,
          size: s * (0.5 - g.t * 0.12),
          tier: g.tier,
          look: scene.look,
          time,
          phase: i,
          tumble: g.tumble,
        });
      }
      drawHeldSatchel(ctx, mouth.x, mouth.y, s * EXPLORER_SCALE, scene.look, scene.fullness);
    }
  }

  private ensureGround(scene: ViewScene) {
    const key = `${scene.look}|${scene.seed}|${this.width}x${this.height}|${this.frame.cell}|${scene.round.garden.ground.join('')}|${scene.round.garden.door.x},${scene.round.garden.door.y}`;
    if (key === this.groundKey && this.ground) return;
    const ground = this.ground ?? document.createElement('canvas');
    ground.width = this.canvas.width;
    ground.height = this.canvas.height;
    const ctx = ground.getContext('2d')!;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    paintGround(ctx, {
      garden: scene.round.garden,
      frame: this.frame,
      width: this.width,
      height: this.height,
      look: scene.look,
      seed: scene.seed,
    });
    this.ground = ground;
    this.groundKey = key;
  }
}

/** A puff of dust and light where the satchel bursts. */
function drawBurst(
  ctx: CanvasRenderingContext2D,
  at: Point,
  s: number,
  progress: number,
  look: Look,
) {
  const t = Math.min(1, progress * 2.2);
  if (t >= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = look === 'moon' ? 'lighter' : 'source-over';
  glow(ctx, at.x, at.y, s * (0.4 + t * 1.2), rgba('#fff3c4', 0.55 * (1 - t)));
  ctx.restore();
}

/** A faint streak behind a glint still in the air, pointing back the way it came. */
function drawStreak(
  ctx: CanvasRenderingContext2D,
  g: FlyingGlint,
  origin: Point,
  s: number,
  look: Look,
) {
  const dx = g.x - origin.x;
  const dy = g.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  const tail = {
    x: g.x - (dx / length) * s * 0.55,
    y: g.y - g.lift - (dy / length) * s * 0.55 + s * 0.12,
  };
  const gradient = ctx.createLinearGradient(g.x, g.y - g.lift, tail.x, tail.y);
  gradient.addColorStop(
    0,
    look === 'sun' ? 'rgba(255, 250, 225, 0.75)' : 'rgba(220, 235, 255, 0.6)',
  );
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(g.x, g.y - g.lift);
  ctx.lineTo(tail.x, tail.y);
  ctx.stroke();
  ctx.restore();
}

/** A point the sulking snake can look at that is anywhere but you. */
function awayFrom(head: Point, you: Point): Point {
  return { x: head.x - (you.x - head.x), y: head.y + Math.abs(you.y - head.y) * 0.4 };
}

/** Three little huffs over a sulking head. */
function drawGrumble(
  ctx: CanvasRenderingContext2D,
  head: Point,
  s: number,
  look: Look,
  time: number,
) {
  ctx.save();
  ctx.strokeStyle = look === 'sun' ? 'rgba(70, 50, 20, 0.7)' : 'rgba(220, 230, 255, 0.7)';
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const phase = (time * 0.6 + k / 3) % 1;
    const x = head.x - s * 0.25 + k * s * 0.22;
    const y = head.y - s * 0.75 - phase * s * 0.25;
    ctx.globalAlpha = 1 - phase;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + s * 0.08, y - s * 0.06, x - s * 0.08, y - s * 0.12, x, y - s * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

/** Light and sparkles leaping out of the vault as glints land in it. */
function drawSplash(ctx: CanvasRenderingContext2D, at: Point, s: number, look: Look, time: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(
    ctx,
    at.x,
    at.y - s * 0.1,
    s * 0.9,
    look === 'sun' ? 'rgba(255, 220, 120, 0.4)' : 'rgba(255, 210, 120, 0.55)',
  );
  for (let k = 0; k < 6; k++) {
    const phase = (time * 1.4 + k / 6) % 1;
    const angle = -Math.PI / 2 + (k - 2.5) * 0.45;
    const x = at.x + Math.cos(angle) * s * 0.55 * phase;
    const y = at.y - s * 0.1 + Math.sin(angle) * s * 0.55 * phase;
    ctx.fillStyle = `rgba(255, 240, 190, ${0.9 * (1 - phase)})`;
    sparkle(ctx, x, y, s * 0.1 * (1 - phase * 0.5));
    ctx.fill();
  }
  ctx.restore();
}

/** Footprints along the walk the mouse offers, and a ring where it would stop. */
function drawPath(
  ctx: CanvasRenderingContext2D,
  frame: BoardFrame,
  path: readonly Cell[],
  look: Look,
  time: number,
) {
  const s = frame.cell;
  const ink = look === 'sun' ? 'rgba(60, 40, 15, 0.55)' : 'rgba(225, 235, 255, 0.6)';
  path.forEach((cell, i) => {
    const at = centre(frame, cell);
    const last = i === path.length - 1;
    ctx.save();
    ctx.fillStyle = ink;
    if (last) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.setLineDash([s * 0.08, s * 0.06]);
      ctx.lineDashOffset = -time * s * 0.3;
      ctx.beginPath();
      ctx.arc(at.x, at.y, s * 0.36, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          at.x + side * s * 0.09,
          at.y + side * s * 0.05,
          s * 0.05,
          s * 0.08,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  });
}

/** Sparkles for a pickup, a swirl for a warp, a puff for a bump, a ripple when the snake wakes. */
function drawFlash(ctx: CanvasRenderingContext2D, frame: BoardFrame, flash: Flash, look: Look) {
  const s = frame.cell;
  const at = centre(frame, flash.cell);
  const t = Math.min(1, Math.max(0, flash.age));
  const fade = 1 - t;
  ctx.save();
  ctx.globalCompositeOperation =
    look === 'moon' || flash.kind !== 'bump' ? 'lighter' : 'source-over';
  switch (flash.kind) {
    case 'pickup':
      glow(ctx, at.x, at.y, s * (0.5 + t * 0.6), rgba('#fff0b8', 0.6 * fade));
      for (let k = 0; k < 6; k++) {
        const angle = (k / 6) * Math.PI * 2 + t;
        ctx.fillStyle = `rgba(255, 246, 210, ${0.95 * fade})`;
        sparkle(
          ctx,
          at.x + Math.cos(angle) * s * 0.6 * t,
          at.y + Math.sin(angle) * s * 0.6 * t - s * 0.2 * t,
          s * 0.1,
        );
        ctx.fill();
      }
      break;
    case 'warp-out':
    case 'warp-in': {
      const ring = flash.kind === 'warp-in' ? 1 - t : t;
      ctx.strokeStyle = `rgba(190, 220, 255, ${0.8 * fade})`;
      ctx.lineWidth = s * 0.06;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(
          at.x,
          at.y,
          s * (0.2 + ring * 0.7 + k * 0.12),
          k + t * 4,
          k + t * 4 + Math.PI * 1.2,
        );
        ctx.stroke();
      }
      break;
    }
    case 'bump':
      ctx.fillStyle =
        look === 'sun' ? `rgba(120, 95, 60, ${0.35 * fade})` : `rgba(200, 210, 240, ${0.3 * fade})`;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(
          at.x + (k - 1.5) * s * 0.14,
          at.y + s * 0.3 - t * s * 0.15,
          s * (0.05 + t * 0.06),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      break;
    case 'wake':
      ctx.strokeStyle = `rgba(255, 210, 120, ${0.7 * fade})`;
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.arc(at.x, at.y, s * (0.4 + t * 1.6), 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Little "z"s drifting up from a sleeping snake. */
function drawSnores(
  ctx: CanvasRenderingContext2D,
  head: Point,
  s: number,
  look: Look,
  time: number,
) {
  ctx.save();
  ctx.fillStyle = look === 'sun' ? 'rgba(60, 40, 20, 0.75)' : 'rgba(225, 235, 255, 0.8)';
  ctx.textAlign = 'center';
  for (let k = 0; k < 3; k++) {
    const phase = (time * 0.35 + k / 3) % 1;
    ctx.globalAlpha = Math.sin(Math.PI * phase);
    ctx.font = `700 ${Math.round(s * (0.22 + phase * 0.18))}px "Fraunces Variable", Georgia, serif`;
    ctx.fillText('z', head.x + s * 0.35 + phase * s * 0.3, head.y - s * 0.5 - phase * s * 0.7);
  }
  ctx.restore();
}

/** A heap of glints, piled highest in the middle. */
function drawHoard(
  ctx: CanvasRenderingContext2D,
  at: Point,
  s: number,
  tiers: readonly GlintTier[],
  look: Look,
  time: number,
) {
  const rings = [
    { count: 7, radius: 0.5, lift: 0 },
    { count: 5, radius: 0.3, lift: 0.12 },
    { count: 1, radius: 0, lift: 0.26 },
  ];
  let i = 0;
  for (const ring of rings) {
    for (let k = 0; k < ring.count; k++) {
      const angle = (k / ring.count) * Math.PI * 2 + ring.radius * 3;
      drawGlint(ctx, {
        x: at.x + Math.cos(angle) * s * ring.radius,
        y: at.y + Math.sin(angle) * s * ring.radius * 0.7 - s * ring.lift,
        size: s * 0.5,
        tier: tiers[i % tiers.length]!,
        look,
        time,
        phase: i * 1.3,
        tumble: (i % 5) * 0.4 - 0.8,
      });
      i++;
    }
  }
}
