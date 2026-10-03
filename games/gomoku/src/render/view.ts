import { drawGardenBackdrop, drawGardenBoard } from './garden';
import {
  type BoardGeometry,
  boardGeometry,
  pointAtPixel,
  pointCentre,
  type Rect,
} from './geometry';
import { drawLakeBackdrop, drawLakeBoard, drawMoonPath, type LakeFrame, moonOf } from './lake';
import type { Look } from './look';
import { drawDrifters } from './drifters';
import type { Weighing } from '../engine/campbell/mind';
import { hash01 } from './noise';
import { makePieceSprites, PEBBLE_VARIANTS, type PieceSprites } from './pieces';

/**
 * The board on its canvas: the scenery behind it, the pieces, "Read the board"'s threat lines,
 * the cursor, and the winning five's moment. It draws what it is given and keeps no game state;
 * `draw` is called every frame while anything moves.
 */

export type SideIndex = 0 | 1;

export interface PieceView {
  point: number;
  side: SideIndex;
  /** Scene time it was placed, for the settling ripple. */
  placedAt: number;
}

export interface ThreatView {
  side: SideIndex;
  kind: 'four' | 'three';
  stones: number[];
  spots: number[];
}

export interface WinView {
  line: number[];
  side: SideIndex;
  /** Scene time the five was made. */
  at: number;
}

export interface BoardScene {
  size: number;
  pieces: readonly PieceView[];
  last: number | null;
  threats: readonly ThreatView[];
  cursor: number | null;
  ghost: { point: number; side: SideIndex } | null;
  win: WinView | null;
  /** What an AI weighed before its move (the replay, the Bot League), and whose move it was. */
  weighing?: { weighing: Weighing; side: SideIndex } | null;
  /** Seconds. */
  time: number;
  /** False when the player asks for reduced motion: nothing bobs, shimmers or travels. */
  motion: boolean;
}

/** The win moment's beats, in seconds after the five is made. */
export const WIN_TIMING = {
  line: 0.55,
  riseStart: 1.0,
  riseLength: 2.6,
  ringsStart: 0.5,
  ringLength: 2.2,
} as const;

/** The spacing of the raked lines in the garden, from the board's cell. */
export const rakeSpacing = (cell: number) => Math.max(12, cell * 0.27);

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeInOut = (t: number) => {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c ** 3 : 1 - (-2 * c + 2) ** 3 / 2;
};

/** What every drawing step needs once the view is sized. */
interface Paint {
  ctx: CanvasRenderingContext2D;
  g: BoardGeometry;
  sprites: PieceSprites;
  look: Look;
}

export class BoardView {
  private readonly ctx: CanvasRenderingContext2D;
  private look: Look;
  private width = 0;
  private height = 0;
  private scale = 1;
  private horizon = 0;
  private slot: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private size = 15;
  private g: BoardGeometry | null = null;
  private backdrop: HTMLCanvasElement | null = null;
  private board: HTMLCanvasElement | null = null;
  private sprites: PieceSprites | null = null;
  /** Where the moon rises, when not over the board's right-hand side (the poster). */
  private moonX: number | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    look: Look,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.look = look;
  }

  get geometry(): BoardGeometry | null {
    return this.g;
  }

  setLook(look: Look): void {
    if (look.id === this.look.id) return;
    this.look = look;
    this.rebuild();
  }

  /** Places the moon (by night) at `x`, for compositions where the board leaves the frame. */
  setMoonX(x: number): void {
    this.moonX = x;
    this.rebuild();
  }

  /** Sizes the canvas (CSS pixels) and places the board's slot and the horizon on it. */
  resize(width: number, height: number, scale: number, slot: Rect, horizon: number, size: number) {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.slot = slot;
    this.horizon = horizon;
    this.size = size;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.rebuild();
  }

  private paint(): Paint {
    return { ctx: this.ctx, g: this.g!, sprites: this.sprites!, look: this.look };
  }

  pointAt(x: number, y: number): number | null {
    return this.g ? pointAtPixel(this.g, x, y) : null;
  }

  private layer(paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.scale, this.scale);
    paint(ctx);
    return canvas;
  }

  private rebuild(): void {
    if (this.width === 0) return;
    const g = boardGeometry(this.slot, this.size);
    this.g = g;
    const look = this.look;
    const frame = this.lakeFrame();
    this.backdrop = this.layer((ctx) =>
      look.dark
        ? drawLakeBackdrop(ctx, look, frame)
        : drawGardenBackdrop(ctx, look, this.width, this.height, g.slot, rakeSpacing(g.cell)),
    );
    this.board = this.layer((ctx) =>
      look.dark ? drawLakeBoard(ctx, look, g) : drawGardenBoard(ctx, look, g),
    );
    this.sprites = makePieceSprites(look, g.cell, this.scale);
  }

  private lakeFrame(): LakeFrame {
    return {
      width: this.width,
      height: this.height,
      horizon: this.horizon,
      moonX: this.moonX ?? this.slot.x + this.slot.width * 0.9,
    };
  }

  draw(scene: BoardScene): void {
    const { ctx, g, sprites, look } = this;
    if (!g || !sprites || !this.backdrop || !this.board) return;
    if (scene.size !== this.size) {
      this.size = scene.size;
      this.rebuild();
      return this.draw(scene);
    }
    const time = scene.motion ? scene.time : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (look.dark) {
      drawMoonPath(ctx, this.lakeFrame(), time);
      this.drawDriftersBeside(time);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (look.dark && this.horizon > this.slot.y) {
      // A board larger than the frame (the poster) stays on the water, below the far shore.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, this.horizon * this.scale, this.canvas.width, this.canvas.height);
      ctx.clip();
      ctx.drawImage(this.board, 0, 0);
      ctx.restore();
    } else ctx.drawImage(this.board, 0, 0);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    const rising = this.risingSet(scene);
    const quiet = this.quietShare(scene);
    if (look.dark) this.drawWaterRings(scene, time);
    else this.drawSandRings(scene, time);
    if (scene.win && !look.dark) this.drawSunUnderFive(scene.win, scene.time - scene.win.at);
    if (look.dark) this.drawReflectionsAndHalos(scene, time, rising, quiet);
    this.drawPieces(scene, time, rising, quiet);
    this.drawLastMove(scene);
    if (scene.weighing) this.drawWeighing(scene.weighing.weighing, scene.weighing.side);
    for (const threat of scene.threats) this.drawThreat(threat);
    this.drawGhost(scene);
    this.drawCursor(scene);
    if (scene.win) this.drawWin(scene, scene.win, scene.time);
  }

  /**
   * How far the rest of the board has dimmed for the winning moment, by night: the other lanterns
   * burn lower so the five stand out as they rise.
   */
  private quietShare(scene: BoardScene): number {
    if (!this.look.dark || !scene.win) return 0;
    if (!scene.motion) return 0.5;
    const age = scene.time - scene.win.at;
    // Down while they rise; back up once they are stars.
    const settle = ease((age - WIN_TIMING.riseStart - WIN_TIMING.riseLength - 0.4) / 1.2);
    return 0.5 * ease((age - 0.3) / 0.9) * (1 - settle);
  }

  /** The winning lanterns once they have begun to rise: drawn by the moment, not in their places. */
  private risingSet(scene: BoardScene): Set<number> {
    if (!this.look.dark || !scene.win) return new Set();
    if (scene.time - scene.win.at < WIN_TIMING.riseStart) return new Set();
    return new Set(scene.win.line);
  }

  private variantOf(point: number): number {
    return Math.floor(hash01(point + 7) * PEBBLE_VARIANTS);
  }

  /** How far a lantern rides above its point right now, and its tilt. */
  private bob(
    point: number,
    time: number,
    placedAt: number,
  ): { dy: number; tilt: number; drop: number } {
    const g = this.g!;
    const phase = hash01(point) * Math.PI * 2;
    const age = time - placedAt;
    const drop = age < 0.4 ? (1 - ease(age / 0.4)) * g.cell * 0.28 : 0;
    return {
      dy: Math.sin(time * 1.15 + phase) * g.cell * 0.03 - drop,
      tilt: Math.sin(time * 0.8 + phase * 1.3) * 0.045,
      drop,
    };
  }

  private drawPieces(scene: BoardScene, time: number, rising: Set<number>, quiet: number) {
    const { ctx, g, sprites, look } = this.paint();
    const half = sprites.size / 2;
    const five = new Set(scene.win?.line ?? []);
    for (const piece of scene.pieces) {
      if (rising.has(piece.point)) continue;
      const { x, y } = pointCentre(g, piece.point);
      const image = sprites.pieces[piece.side]![look.dark ? 0 : this.variantOf(piece.point)]!;
      if (look.dark) {
        const { dy, tilt } = this.bob(piece.point, time, piece.placedAt);
        ctx.save();
        ctx.globalAlpha = five.has(piece.point) ? 1 : 1 - quiet * 0.9;
        ctx.translate(x, y + dy);
        ctx.rotate(tilt);
        ctx.drawImage(image, -half, -half, sprites.size, sprites.size);
        ctx.restore();
      } else {
        const age = time - piece.placedAt;
        const grow = age >= 0 && age < 0.2 ? 1 + (1 - ease(age / 0.2)) * 0.1 : 1;
        ctx.drawImage(
          image,
          x - half * grow,
          y - half * grow,
          sprites.size * grow,
          sprites.size * grow,
        );
      }
    }
  }

  /** By night, a few lanterns far out on the lake beside the board, below the seats' cards. */
  private drawDriftersBeside(time: number) {
    const { ctx, g, sprites } = this.paint();
    const margin = g.cell * 0.8;
    const left = {
      x: 0,
      y: this.height * 0.68,
      width: this.slot.x - margin,
      height: this.height * 0.28,
    };
    const rightX = this.slot.x + this.slot.width + margin;
    const right = {
      x: rightX,
      y: this.height * 0.52,
      width: this.width - rightX,
      height: this.height * 0.44,
    };
    drawDrifters(
      ctx,
      sprites,
      g.cell,
      [left, right],
      { horizon: this.horizon, height: this.height },
      time,
    );
  }

  /**
   * What the 1994 player weighed: a dot on every point it found promising, bigger the closer it
   * came to an unstoppable combination, in each side's threat colour; the frames it found
   * forcing as thin lines; a ring round the point it chose, and a dashed one round the other
   * side's best.
   */
  private drawWeighing(weighing: Weighing, side: SideIndex) {
    const { ctx, g, look } = this.paint();
    ctx.save();
    for (const s of [1 - side, side] as SideIndex[]) {
      const colours = look.pieces[s]!;
      ctx.strokeStyle = colours.threat;
      ctx.lineWidth = Math.max(1.2, g.cell * 0.03);
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([g.cell * 0.05, g.cell * 0.09]);
      ctx.lineCap = 'round';
      for (const frame of weighing.forcing[s]!) {
        const a = pointCentre(g, frame[0]!);
        const b = pointCentre(g, frame[frame.length - 1]!);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const strength = weighing.strength[s]!;
      ctx.fillStyle = colours.threat;
      for (let p = 0; p < strength.length; p++) {
        const v = strength[p]!;
        if (v < 0.3) continue;
        const c = pointCentre(g, p);
        // The other side's dots sit a little off-centre so both can show on one point.
        const shift = s === side ? 0 : g.cell * 0.12;
        ctx.globalAlpha = 0.25 + v * 0.55;
        ctx.beginPath();
        ctx.arc(c.x + shift, c.y + shift, g.cell * (0.05 + v * 0.11), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const ring = (p: number, dashed: boolean, colour: string) => {
      const c = pointCentre(g, p);
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(2, g.cell * 0.05);
      ctx.setLineDash(dashed ? [g.cell * 0.08, g.cell * 0.07] : []);
      ctx.beginPath();
      ctx.arc(c.x, c.y, g.cell * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(weighing.best[1 - side]!, true, look.pieces[1 - side]!.threat);
    ring(weighing.chosen, false, look.cursor);
    ctx.restore();
  }

  /** The piece you are about to place, faint, under the pointer or the keyboard cursor. */
  private drawGhost(scene: BoardScene) {
    if (!scene.ghost || scene.win) return;
    const { ctx, g, sprites } = this.paint();
    const half = sprites.size / 2;
    const { x, y } = pointCentre(g, scene.ghost.point);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(
      sprites.pieces[scene.ghost.side]![0]!,
      x - half,
      y - half,
      sprites.size,
      sprites.size,
    );
    ctx.globalAlpha = 1;
  }

  private drawReflectionsAndHalos(
    scene: BoardScene,
    time: number,
    rising: Set<number>,
    quiet: number,
  ) {
    const { ctx, g, sprites } = this.paint();
    const fade = this.riseShare(scene);
    const five = new Set(scene.win?.line ?? []);
    const half = sprites.size / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const piece of scene.pieces) {
      const { x, y } = pointCentre(g, piece.point);
      const dim = five.has(piece.point) ? 1 : 1 - quiet;
      const leaving = (rising.has(piece.point) ? 1 - fade : 1) * dim;
      const phase = hash01(piece.point + 3) * 6.28;
      // The reflection: soft streaks of its light, swaying and stretching on the water.
      const sway = Math.sin(time * 1.6 + phase);
      ctx.globalAlpha = leaving;
      ctx.save();
      ctx.translate(x + sway * g.cell * 0.025, y + g.cell * 0.55);
      ctx.scale(1 + 0.07 * sway, 1 + 0.08 * Math.sin(time * 2.3 + phase * 1.7));
      ctx.drawImage(sprites.reflections![piece.side]!, -half, -half, sprites.size, sprites.size);
      ctx.restore();
      if (rising.has(piece.point)) continue;
      const { dy } = this.bob(piece.point, time, piece.placedAt);
      const flicker = 0.88 + 0.12 * Math.sin(time * 3.3 + phase) * Math.sin(time * 1.7 + phase * 2);
      ctx.globalAlpha = flicker * dim * (five.has(piece.point) ? 1 + quiet : 1);
      const halo = sprites.halos![piece.side]!;
      ctx.drawImage(
        halo,
        x - sprites.haloSize / 2,
        y + dy - g.cell * 0.06 - sprites.haloSize / 2,
        sprites.haloSize,
        sprites.haloSize,
      );
    }
    ctx.restore();
  }

  /** A ring of light spreading on the water from each new lantern, and around the last one. */
  private drawWaterRings(scene: BoardScene, time: number) {
    const { ctx, g } = this.paint();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const piece of scene.pieces) {
      const isLast = piece.point === scene.last && !scene.win;
      let age = time - piece.placedAt;
      if (isLast && age > 1.6 && scene.motion) age = 0.4 + ((age - 0.4) % 2.6);
      if (age < 0 || age > 1.6) continue;
      const t = age / 1.6;
      const { x, y } = pointCentre(g, piece.point);
      ctx.strokeStyle = `rgba(190, 220, 255, ${0.5 * (1 - t)})`;
      ctx.lineWidth = Math.max(1, g.cell * 0.03);
      ctx.beginPath();
      ctx.ellipse(
        x,
        y + g.cell * 0.16,
        g.cell * (0.36 + t * 0.85),
        g.cell * (0.13 + t * 0.32),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The sand's ripple as a pebble settles. */
  private drawSandRings(scene: BoardScene, time: number) {
    const { ctx, g, look } = this.paint();
    for (const piece of scene.pieces) {
      const age = time - piece.placedAt;
      if (age < 0 || age > 1) continue;
      const t = ease(age);
      const { x, y } = pointCentre(g, piece.point);
      const r = g.cell * (0.46 + t * 0.32);
      ctx.globalAlpha = 1 - age;
      this.groove(ctx, look, x, y, r, Math.max(1.4, g.cell * 0.04));
      ctx.globalAlpha = 1;
    }
  }

  private groove(
    ctx: CanvasRenderingContext2D,
    look: Look,
    x: number,
    y: number,
    r: number,
    width: number,
  ) {
    ctx.lineWidth = width;
    ctx.strokeStyle = look.lineShade;
    ctx.beginPath();
    ctx.arc(x + width * 0.45, y + width * 0.55, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = look.line;
    ctx.beginPath();
    ctx.arc(x - width * 0.3, y - width * 0.35, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawLastMove(scene: BoardScene) {
    if (scene.last === null || scene.win || this.look.dark) return;
    const { ctx, g, look } = this.paint();
    const { x, y } = pointCentre(g, scene.last);
    const r = g.cell * 0.075;
    ctx.save();
    ctx.fillStyle = look.lastMove;
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.9)';
    ctx.lineWidth = Math.max(1, g.cell * 0.022);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawThreat(threat: ThreatView) {
    const { ctx, g, look } = this.paint();
    const side = look.pieces[threat.side]!;
    const points = [...threat.stones, ...threat.spots].map((p) => pointCentre(g, p));
    // The line runs the threat's whole length, completing points included.
    const along = (p: { x: number; y: number }) => p.x * 1000 + p.y;
    points.sort((a, b) => along(a) - along(b));
    const from = points[0]!;
    const to = points[points.length - 1]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / length;
    const uy = (to.y - from.y) / length;
    const reach = g.cell * 0.32;
    const dash = threat.kind === 'three' ? [g.cell * 0.2, g.cell * 0.14] : [];
    const width = Math.max(2.2, g.cell * 0.068);
    ctx.save();
    ctx.lineCap = threat.kind === 'three' ? 'butt' : 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(from.x - ux * reach, from.y - uy * reach);
    ctx.lineTo(to.x + ux * reach, to.y + uy * reach);
    // A dark (or pale) bed under the line keeps it readable over pieces of its own colour.
    ctx.strokeStyle = look.dark ? 'rgba(2, 6, 18, 0.88)' : 'rgba(255, 252, 244, 0.9)';
    ctx.lineWidth = width * 2.3;
    ctx.stroke();
    ctx.shadowColor = side.threatGlow;
    ctx.shadowBlur = g.cell * 0.22;
    ctx.strokeStyle = side.threat;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();

    for (const spot of threat.spots) {
      const { x, y } = pointCentre(g, spot);
      const r = g.cell * (threat.kind === 'four' ? 0.22 : 0.18);
      ctx.save();
      ctx.setLineDash(threat.kind === 'three' ? [g.cell * 0.09, g.cell * 0.07] : []);
      ctx.fillStyle = look.dark ? 'rgba(2, 6, 18, 0.55)' : 'rgba(255, 252, 244, 0.75)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = side.threatGlow;
      ctx.shadowBlur = g.cell * 0.2;
      ctx.strokeStyle = side.threat;
      ctx.lineWidth = Math.max(1.6, g.cell * 0.045);
      ctx.stroke();
      if (threat.kind === 'four') {
        ctx.fillStyle = side.threat;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawCursor(scene: BoardScene) {
    if (scene.cursor === null || scene.win) return;
    const { ctx, g, look } = this.paint();
    const { x, y } = pointCentre(g, scene.cursor);
    const r = g.cell * 0.46;
    const tick = g.cell * 0.16;
    ctx.save();
    ctx.strokeStyle = look.cursor;
    ctx.lineWidth = Math.max(2, g.cell * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      ctx.moveTo(x + sx * r, y + sy * (r - tick));
      ctx.lineTo(x + sx * r, y + sy * r);
      ctx.lineTo(x + sx * (r - tick), y + sy * r);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** How far the winning lanterns have risen, 0 to 1. */
  private riseShare(scene: BoardScene): number {
    if (!scene.win) return 0;
    if (!scene.motion) return 0;
    return ease((scene.time - scene.win.at - WIN_TIMING.riseStart) / WIN_TIMING.riseLength);
  }

  private drawWin(scene: BoardScene, win: WinView, time: number) {
    const { ctx, g, look } = this.paint();
    const age = scene.motion ? time - win.at : 99;
    const centres = win.line.map((p) => pointCentre(g, p));
    const first = centres[0]!;
    const last = centres[centres.length - 1]!;
    const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };

    if (!look.dark) this.drawWinRings(mid, Math.hypot(last.x - first.x, last.y - first.y) / 2, age);

    // The line of light, drawn from end to end, then holding (by night it fades as they rise).
    const drawn = ease(age / WIN_TIMING.line);
    const rise = this.riseShare(scene);
    const strength = look.dark ? 1 - rise : 1;
    if (strength > 0.01) {
      ctx.save();
      ctx.globalAlpha = strength;
      ctx.lineCap = 'round';
      ctx.shadowColor = look.winGlow;
      ctx.shadowBlur = g.cell * 0.6;
      ctx.strokeStyle = look.winGlow;
      ctx.lineWidth = g.cell * 0.19;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(first.x + (last.x - first.x) * drawn, first.y + (last.y - first.y) * drawn);
      ctx.stroke();
      ctx.shadowBlur = g.cell * 0.2;
      ctx.strokeStyle = look.winLine;
      ctx.lineWidth = g.cell * 0.06;
      ctx.stroke();
      ctx.restore();
    }
    if (look.dark) this.drawRisingLanterns(scene, win, centres, rise);
  }

  /** By day: the morning sun lights the sand round each of the five, under the pebbles. */
  private drawSunUnderFive(win: WinView, age: number) {
    const { ctx, g } = this.paint();
    const strength = 0.6 + 0.4 * Math.max(0, 1 - Math.abs(age - 0.9) / 1.4);
    ctx.save();
    for (const p of win.line) {
      const c = pointCentre(g, p);
      const glow = ctx.createRadialGradient(c.x, c.y, g.cell * 0.36, c.x, c.y, g.cell * 0.78);
      glow.addColorStop(0, `rgba(255, 206, 100, ${0.85 * strength})`);
      glow.addColorStop(1, 'rgba(255, 206, 100, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - g.cell, c.y - g.cell, g.cell * 2, g.cell * 2);
    }
    ctx.restore();
  }

  /** By day: rings raked outward in the sand around the five, which then stay. */
  private drawWinRings(mid: { x: number; y: number }, halfLength: number, age: number) {
    const { ctx, g, look } = this.paint();
    const width = Math.max(1.8, g.cell * 0.05);
    for (let k = 0; k < 3; k++) {
      const born = WIN_TIMING.ringsStart + k * 0.3;
      const t = ease((age - born) / WIN_TIMING.ringLength);
      if (t <= 0) continue;
      const settled = halfLength + g.cell * (1 + k * 0.62);
      const r = settled * (0.55 + 0.45 * t);
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 2.5);
      this.groove(ctx, look, mid.x, mid.y, r, width);
      ctx.restore();
    }
    // A wash of morning light over the five while the rings spread.
    const light = Math.max(0, 1 - Math.abs(age - 1.2) / 1.6);
    if (light > 0) {
      const glow = ctx.createRadialGradient(
        mid.x,
        mid.y,
        0,
        mid.x,
        mid.y,
        halfLength + g.cell * 1.6,
      );
      glow.addColorStop(0, `rgba(255, 236, 170, ${0.32 * light})`);
      glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(
        mid.x - halfLength - g.cell * 2,
        mid.y - halfLength - g.cell * 2,
        (halfLength + g.cell * 2) * 2,
        (halfLength + g.cell * 2) * 2,
      );
    }
  }

  /**
   * By night: the five lanterns lift off the water together and rise into the sky above the far
   * shore, where they shrink to five new stars in the line they made. Their reflections stay
   * behind on the water as glints.
   */
  private drawRisingLanterns(
    scene: BoardScene,
    win: WinView,
    centres: { x: number; y: number }[],
    rise: number,
  ) {
    const { ctx, g, sprites, look } = this.paint();
    if (rise <= 0) return;
    const targets = this.starTargets(centres);
    const half = sprites.size / 2;
    const lift = g.cell * 1.6;
    centres.forEach((from, i) => {
      // Each lantern a breath behind the one before, so the five lift off as a ripple but keep
      // the shape of their line.
      const t = Math.min(1, Math.max(0, (rise - i * 0.012) / (1 - 0.048)));
      const to = targets[i]!;
      // First they lift off the water and grow as they come up toward us; then they travel off
      // to the sky, shrinking with the distance.
      const up = ease(t / 0.35);
      const travel = easeInOut((t - 0.25) / 0.75);
      const x = from.x + (to.x - from.x) * travel;
      const y = from.y - lift * up + (to.y - (from.y - lift)) * travel;
      const scale = (1 + 0.35 * up) * (1 - 0.85 * travel ** 1.6);
      const glow = sprites.halos![win.side]!;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // The trail of light back down to where it floated.
      const trailEnd = { x: from.x + (x - from.x) * 0.35, y: from.y };
      const trail = ctx.createLinearGradient(x, y, trailEnd.x, trailEnd.y);
      trail.addColorStop(0, look.pieces[win.side]!.threatGlow);
      trail.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = g.cell * 0.22 * Math.max(0.3, scale);
      ctx.lineCap = 'round';
      ctx.globalAlpha = Math.min(1, t * 5) * (1 - travel);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(trailEnd.x, trailEnd.y);
      ctx.stroke();
      // Embers drifting off the trail.
      ctx.fillStyle = look.pieces[win.side]!.light;
      for (let e = 0; e < 6; e++) {
        const along = hash01(i * 17 + e);
        const flicker = 0.5 + 0.5 * Math.sin(scene.time * (5 + e) + e * 2.1);
        ctx.globalAlpha = (1 - along) * flicker * (1 - travel);
        const ex = x + (trailEnd.x - x) * along + (hash01(i * 31 + e) - 0.5) * g.cell * 0.5;
        const ey = y + (trailEnd.y - y) * along;
        ctx.beginPath();
        ctx.arc(ex, ey, g.cell * 0.025 * (1.5 - along), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const haloSize = sprites.haloSize * (0.7 + scale * 0.9);
      ctx.drawImage(glow, x - haloSize / 2, y - haloSize / 2, haloSize, haloSize);
      ctx.restore();

      const lantern = sprites.pieces[win.side]![0]!;
      const fadeToStar = Math.min(1, Math.max(0, (t - 0.8) / 0.18));
      ctx.save();
      ctx.globalAlpha = 1 - fadeToStar;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.drawImage(lantern, -half, -half, sprites.size, sprites.size);
      ctx.restore();
      if (fadeToStar > 0)
        this.drawStar(x, y, g.cell * 0.17 * fadeToStar, fadeToStar, scene.time + i);
      // The glint its star will leave on the water.
      this.drawStar(
        from.x,
        from.y + g.cell * 0.08,
        g.cell * 0.16 * travel,
        0.55 * travel,
        scene.time * 1.3 + i,
      );
    });
    if (rise > 0.92) {
      const show = (rise - 0.92) / 0.08;
      ctx.save();
      ctx.globalAlpha = 0.35 * show;
      ctx.strokeStyle = look.star;
      ctx.lineWidth = 1;
      ctx.beginPath();
      targets.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Where the five become stars: a small copy of their line in the sky, beside the moon and clear
   * of the title.
   */
  private starTargets(centres: { x: number; y: number }[]): { x: number; y: number }[] {
    const cx = centres.reduce((sum, p) => sum + p.x, 0) / centres.length;
    const cy = centres.reduce((sum, p) => sum + p.y, 0) / centres.length;
    const moon = moonOf(this.lakeFrame());
    const skyX = moon.x - moon.r * 3.6;
    const skyY = this.horizon * 0.5;
    const shrink = Math.min(0.4, (this.horizon * 0.5) / (this.g!.cell * 4));
    return centres.map((p) => ({ x: skyX + (p.x - cx) * shrink, y: skyY + (p.y - cy) * shrink }));
  }

  private drawStar(x: number, y: number, r: number, alpha: number, twinkle: number) {
    const ctx = this.ctx;
    if (r <= 0.2) return;
    const shimmer = 0.85 + 0.15 * Math.sin(twinkle * 4.1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * shimmer;
    const core = ctx.createRadialGradient(x, y, 0, x, y, r);
    core.addColorStop(0, 'rgba(255, 252, 235, 1)');
    core.addColorStop(0.25, 'rgba(255, 230, 170, 0.6)');
    core.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(255, 248, 225, 0.85)';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 1.15, y);
    ctx.lineTo(x + r * 1.15, y);
    ctx.moveTo(x, y - r * 1.15);
    ctx.lineTo(x, y + r * 1.15);
    ctx.stroke();
    ctx.restore();
  }
}
