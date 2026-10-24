import { createRng, type Rng } from '@usr-games/kit';
import type { Look } from './look';

/**
 * The table itself. The planks, their grain and the steady light are painted once into an
 * offscreen canvas the size of the window; every frame then adds only what moves: leaf shadows
 * swaying and dust turning in the sunbeam on the porch, the fire breathing and embers rising by
 * the hearth. Under reduced motion the moving parts hold still.
 */

type Ctx = CanvasRenderingContext2D;

function surface(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function paintPlanks(ctx: Ctx, w: number, h: number, look: Look, unit: number, rng: Rng): void {
  const plankHeight = 132 * unit;
  const rows = Math.ceil(h / plankHeight) + 1;
  for (let row = 0; row < rows; row++) {
    const top = row * plankHeight - plankHeight * 0.35;
    // Each row is a few boards laid end to end, joints staggered from row to row.
    let x = -rng.float(0, 600) * unit;
    while (x < w) {
      const length = rng.float(700, 1300) * unit;
      const base = look.plank[rng.int(0, look.plank.length - 1)]!;
      ctx.fillStyle = base;
      ctx.fillRect(x, top, length, plankHeight);
      const shading = ctx.createLinearGradient(0, top, 0, top + plankHeight);
      shading.addColorStop(
        0,
        look.dark ? 'rgba(255, 210, 160, 0.05)' : 'rgba(255, 240, 210, 0.16)',
      );
      shading.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
      shading.addColorStop(1, look.dark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(80, 45, 20, 0.12)');
      ctx.fillStyle = shading;
      ctx.fillRect(x, top, length, plankHeight);
      paintGrain(ctx, x, top, length, plankHeight, look, unit, rng);
      ctx.fillStyle = look.seam;
      ctx.fillRect(x + length - 1.5 * unit, top, 2.5 * unit, plankHeight);
      x += length;
    }
    ctx.fillStyle = look.seam;
    ctx.fillRect(0, top + plankHeight - 2 * unit, w, 3 * unit);
    ctx.fillStyle = look.dark ? 'rgba(255, 180, 120, 0.05)' : 'rgba(255, 245, 225, 0.22)';
    ctx.fillRect(0, top + plankHeight + unit, w, 1.5 * unit);
  }
}

function paintGrain(
  ctx: Ctx,
  x: number,
  top: number,
  length: number,
  height: number,
  look: Look,
  unit: number,
  rng: Rng,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, length, height);
  ctx.clip();
  ctx.strokeStyle = look.grain;
  const lines = rng.int(9, 14);
  for (let i = 0; i < lines; i++) {
    const y0 = top + rng.float(0.04, 0.96) * height;
    const amplitude = rng.float(1, 6) * unit;
    const wavelength = rng.float(160, 420) * unit;
    const phase = rng.float(0, Math.PI * 2);
    ctx.lineWidth = rng.float(0.6, 1.8) * unit;
    ctx.globalAlpha = rng.float(0.35, 1);
    ctx.beginPath();
    for (let px = x; px <= x + length; px += 14 * unit) {
      const y = y0 + Math.sin((px / wavelength) * Math.PI * 2 + phase) * amplitude;
      if (px === x) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  // Now and then a knot, with the grain's rings close around it.
  if (rng.chance(0.35)) {
    const kx = x + rng.float(0.15, 0.85) * length;
    const ky = top + rng.float(0.3, 0.7) * height;
    for (let ring = 0; ring < 5; ring++) {
      ctx.globalAlpha = 0.5 - ring * 0.08;
      ctx.lineWidth = 1.2 * unit;
      ctx.beginPath();
      ctx.ellipse(kx, ky, (10 + ring * 9) * unit, (3 + ring * 3.2) * unit, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = look.seam;
    ctx.beginPath();
    ctx.ellipse(kx, ky, 6 * unit, 2.5 * unit, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The long slanted shadows of a porch railing: a top rail and evenly spaced balusters. */
function paintRailingShadow(
  ctx: Ctx,
  w: number,
  h: number,
  look: Look,
  unit: number,
): HTMLCanvasElement {
  const layer = surface(w, h);
  const g = layer.getContext('2d')!;
  // Low sun makes long shadows with fairly crisp edges, softening only a little with distance.
  g.filter = `blur(${5 * unit}px)`;
  g.fillStyle = look.shade;
  const slope = 0.42;
  const spacing = 230 * unit;
  const width = 58 * unit;
  for (let start = -h; start < w + h; start += spacing) {
    g.beginPath();
    g.moveTo(start, 0);
    g.lineTo(start + width, 0);
    g.lineTo(start + width + h / slope, h);
    g.lineTo(start + h / slope, h);
    g.closePath();
    g.globalAlpha = 0.75;
    g.fill();
  }
  // The rail itself, a broad band across the far end of the table.
  g.globalAlpha = 0.9;
  g.fillRect(0, -40 * unit, w, 96 * unit);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = look.shadeStrength * 0.55;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  return layer;
}

/**
 * The late sun comes in low through the porch's open side: a broad slanted band of warm light
 * across the table, brighter where it enters.
 */
function paintSunPool(ctx: Ctx, w: number, h: number): void {
  const layer = surface(w, h);
  const g = layer.getContext('2d')!;
  g.filter = `blur(${Math.round(w * 0.02)}px)`;
  const band = g.createLinearGradient(0, 0, w, h * 0.9);
  band.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
  band.addColorStop(0.55, 'rgba(255, 200, 120, 0.55)');
  band.addColorStop(1, 'rgba(255, 190, 110, 0)');
  g.fillStyle = band;
  g.beginPath();
  g.moveTo(-w * 0.1, h * 0.05);
  g.lineTo(w * 0.42, -h * 0.05);
  g.lineTo(w * 1.05, h * 0.62);
  g.lineTo(w * 0.62, h * 1.05);
  g.closePath();
  g.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(layer, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.16;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

function paintLight(ctx: Ctx, w: number, h: number, look: Look): void {
  const { x, y, colour, strength } = look.light;
  const cx = x * w;
  const cy = y * h;
  const radius = Math.hypot(w, h) * (look.dark ? 0.75 : 1.05);
  const light = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  light.addColorStop(0, colour);
  light.addColorStop(0.45, colour.replace(/[\d.]+\)$/, `${strength * 0.35})`));
  light.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.globalCompositeOperation = look.dark ? 'screen' : 'soft-light';
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (look.dark) {
    // The far side of the room, away from the fire, falls into shadow.
    const dark = ctx.createLinearGradient(0, 0, w, 0);
    dark.addColorStop(0, 'rgba(0, 0, 0, 0)');
    dark.addColorStop(0.55, 'rgba(8, 4, 2, 0.25)');
    dark.addColorStop(1, 'rgba(8, 4, 2, 0.6)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, w, h);
  }
  const vignette = ctx.createRadialGradient(
    w * 0.45,
    h * 0.5,
    Math.min(w, h) * 0.35,
    w * 0.45,
    h * 0.5,
    Math.hypot(w, h) * 0.62,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, look.vignette);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/** Soft leaf shadows, painted once larger than the window and swayed every frame. */
function paintLeaves(w: number, h: number, look: Look, unit: number): HTMLCanvasElement {
  const pad = 160 * unit;
  const layer = surface(w * 0.7 + pad * 2, h * 0.75 + pad * 2);
  const g = layer.getContext('2d')!;
  const rng = createRng('porch-leaves');
  g.filter = `blur(${10 * unit}px)`;
  g.fillStyle = look.shade;
  for (let i = 0; i < 70; i++) {
    const x = rng.float(0, layer.width);
    const y = rng.float(0, layer.height * (0.3 + 0.7 * rng.next()));
    const r = rng.float(18, 70) * unit;
    g.globalAlpha = rng.float(0.25, 0.6);
    g.beginPath();
    g.ellipse(x, y, r, r * rng.float(0.45, 0.8), rng.float(0, Math.PI), 0, Math.PI * 2);
    g.fill();
  }
  return layer;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

export class TablePainter {
  private base: HTMLCanvasElement | null = null;
  private leaves: HTMLCanvasElement | null = null;
  private railing: HTMLCanvasElement | null = null;
  private motes: Mote[] = [];
  private key = '';

  constructor(private look: Look) {}

  setLook(look: Look): void {
    this.look = look;
    this.key = '';
  }

  /** Repaints the still layers when the window or the look changes. */
  prepare(width: number, height: number, scale: number, unit: number): void {
    const key = `${this.look.id}:${width}x${height}@${scale}:${unit.toFixed(3)}`;
    if (key === this.key) return;
    this.key = key;
    const w = width * scale;
    const h = height * scale;
    const u = unit * scale;
    this.base = surface(w, h);
    const ctx = this.base.getContext('2d')!;
    const rng = createRng(`table:${this.look.id}`);
    paintPlanks(ctx, w, h, this.look, u, rng);
    paintLight(ctx, w, h, this.look);
    this.railing = null;
    if (!this.look.dark) {
      paintSunPool(ctx, w, h);
      this.railing = paintRailingShadow(ctx, w, h, this.look, u);
    }
    this.leaves = this.look.dark ? null : paintLeaves(w, h, this.look, u);
    const motes = createRng(`motes:${this.look.id}`);
    this.motes = Array.from({ length: this.look.dark ? 46 : 38 }, () => ({
      x: motes.next(),
      y: motes.next(),
      r: motes.float(0.8, 2.6),
      speed: motes.float(0.4, 1),
      phase: motes.float(0, Math.PI * 2),
    }));
  }

  /** The firelight's brightness at a moment: slow breathing with quick flickers on top. */
  flicker(time: number): number {
    return (
      0.78 +
      0.1 * Math.sin(time * 1.7) +
      0.06 * Math.sin(time * 4.3 + 1.2) +
      0.05 * Math.sin(time * 9.1 + 0.4) * Math.sin(time * 2.3)
    );
  }

  /** Draws the table in device pixels (the context is not scaled). */
  draw(ctx: Ctx, time: number, still: boolean): void {
    if (!this.base) return;
    const w = this.base.width;
    const h = this.base.height;
    ctx.drawImage(this.base, 0, 0);
    const t = still ? 2.4 : time;
    if (this.leaves) {
      const sway = Math.sin(t * 0.35) * 22 + Math.sin(t * 0.83) * 9;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = this.look.shadeStrength * 0.9;
      ctx.drawImage(this.leaves, -w * 0.06 + sway, -h * 0.12 + sway * 0.4);
      ctx.restore();
    }
    if (this.look.dark) this.drawFirelight(ctx, w, h, t);
    this.drawMotes(ctx, w, h, t);
  }

  /**
   * A last pass of light over everything on the table, cards and board included, so they sit
   * in the same sun or firelight as the wood.
   */
  wash(ctx: Ctx, time: number, still: boolean): void {
    if (!this.base) return;
    const w = this.base.width;
    const h = this.base.height;
    const t = still ? 2.4 : time;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    if (this.look.dark) {
      const glow = this.flicker(t);
      const light = ctx.createRadialGradient(0, h * 0.55, 0, 0, h * 0.55, w * 0.95);
      light.addColorStop(0, `rgba(255, 150, 70, ${0.55 * glow})`);
      light.addColorStop(0.6, `rgba(255, 120, 50, ${0.18 * glow})`);
      light.addColorStop(1, 'rgba(20, 10, 30, 0.35)');
      ctx.fillStyle = light;
    } else {
      if (this.railing) {
        // The railing's shadow falls across the cards and the board as well as the wood.
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = this.look.shadeStrength * 0.6;
        ctx.drawImage(this.railing, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'soft-light';
      }
      const light = ctx.createLinearGradient(0, 0, w, h);
      light.addColorStop(0, 'rgba(255, 210, 140, 0.45)');
      light.addColorStop(0.6, 'rgba(255, 220, 170, 0.08)');
      light.addColorStop(1, 'rgba(90, 60, 110, 0.25)');
      ctx.fillStyle = light;
    }
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawFirelight(ctx: Ctx, w: number, h: number, t: number): void {
    const glow = this.flicker(t);
    const cx = this.look.light.x * w + Math.sin(t * 1.3) * w * 0.004;
    const cy = this.look.light.y * h;
    const radius = Math.hypot(w, h) * 0.55 * (0.96 + glow * 0.06);
    const light = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    light.addColorStop(0, `rgba(255, 140, 60, ${0.34 * glow})`);
    light.addColorStop(0.4, `rgba(255, 110, 40, ${0.12 * glow})`);
    light.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawMotes(ctx: Ctx, w: number, h: number, t: number): void {
    ctx.save();
    ctx.fillStyle = this.look.mote;
    const scale = Math.max(1, w / 1920);
    for (const mote of this.motes) {
      let x: number;
      let y: number;
      let alpha: number;
      if (this.look.dark) {
        // Embers rise from the hearth at the left and fade as they climb.
        const life = (mote.phase / (Math.PI * 2) + t * 0.05 * mote.speed) % 1;
        x = (0.01 + mote.x * 0.16) * w + Math.sin(t * mote.speed + mote.phase) * 18 * scale;
        y = h * (1.02 - life * 0.9);
        alpha = (1 - life) * 0.8 * (0.6 + 0.4 * Math.sin(t * 6 * mote.speed + mote.phase));
      } else {
        // Dust turning slowly in the sunbeam across the top left.
        x = (mote.x * 0.55 + Math.sin(t * 0.07 * mote.speed + mote.phase) * 0.04) * w;
        y = (mote.y * 0.6 + Math.cos(t * 0.05 * mote.speed + mote.phase) * 0.03) * h;
        alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.9 * mote.speed + mote.phase));
      }
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.beginPath();
      ctx.arc(x, y, mote.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
