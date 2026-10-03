import { lumpyPath } from './garden';
import type { Look, Side } from './look';
import { seeded } from './noise';

/**
 * The pieces, drawn once per size into small canvases and stamped onto the board. By day they are
 * river pebbles, each a little different in outline; by night they are floating lanterns, square
 * paper boxes for the first player and round paper lanterns for the second, so the two sides differ
 * in shape as well as in colour.
 */

export const PEBBLE_VARIANTS = 6;

export interface PieceSprites {
  /** [side][variant] */
  pieces: HTMLCanvasElement[][];
  /** Halo stamps per side (by night), drawn additively. */
  halos: HTMLCanvasElement[] | null;
  /** Reflections per side (by night), centred a cell below the float. */
  reflections: HTMLCanvasElement[] | null;
  /** The sprites' size in CSS pixels; each is centred on its point. */
  size: number;
  haloSize: number;
}

function sprite(size: number, scale: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.translate(size / 2, size / 2);
  return [canvas, ctx];
}

function drawPebble(
  ctx: CanvasRenderingContext2D,
  look: Look,
  side: Side,
  slate: boolean,
  cell: number,
  seed: number,
) {
  const random = seeded(seed);
  const rx = cell * 0.46;
  const ry = cell * (0.4 + random() * 0.04);
  const outline = (dx = 0, dy = 0, grow = 1) =>
    lumpyPath(ctx, dx, dy, rx * grow, ry * grow, seeded(seed * 31 + 7), 0.07);

  // Its soft morning shadow, then a darker line where it rests in the sand.
  ctx.save();
  ctx.filter = `blur(${Math.max(1.5, cell * 0.06)}px)`;
  ctx.fillStyle = look.shadow;
  outline(cell * 0.08, cell * 0.1);
  ctx.fill();
  ctx.filter = `blur(${Math.max(0.8, cell * 0.02)}px)`;
  ctx.globalAlpha = 0.6;
  outline(cell * 0.025, cell * 0.035, 0.99);
  ctx.fill();
  ctx.restore();

  ctx.save();
  outline();
  const body = ctx.createRadialGradient(-cell * 0.17, -cell * 0.19, cell * 0.02, 0, 0, cell * 0.52);
  body.addColorStop(0, side.light);
  body.addColorStop(slate ? 0.4 : 0.48, side.body);
  body.addColorStop(1, side.shade);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  if (slate) {
    // Slate: faint bands of a lighter grey across the stone.
    ctx.filter = `blur(${Math.max(0.6, cell * 0.012)}px)`;
    ctx.strokeStyle = side.detail;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = (random() - 0.5) * ry * 1.3;
      ctx.lineWidth = cell * (0.02 + random() * 0.03);
      ctx.beginPath();
      ctx.moveTo(-rx, y + (random() - 0.5) * ry * 0.3);
      ctx.quadraticCurveTo(0, y + (random() - 0.5) * ry * 0.5, rx, y + (random() - 0.5) * ry * 0.3);
      ctx.stroke();
    }
  } else {
    // Milky quartz: a cloud of light inside, toward the side away from the sun, and a faint
    // rosy band through it.
    const inner = ctx.createRadialGradient(
      cell * 0.1,
      cell * 0.12,
      0,
      cell * 0.1,
      cell * 0.12,
      cell * 0.32,
    );
    inner.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    inner.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = inner;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.filter = `blur(${Math.max(1, cell * 0.03)}px)`;
    ctx.strokeStyle = side.detail;
    ctx.lineWidth = cell * 0.07;
    ctx.beginPath();
    const tilt = (random() - 0.5) * 0.8;
    ctx.moveTo(-rx, ry * (0.25 + tilt));
    ctx.quadraticCurveTo(0, ry * (0.05 + random() * 0.3), rx, ry * (0.3 - tilt));
    ctx.stroke();
  }
  ctx.restore();

  // The sun on its crown.
  ctx.save();
  ctx.filter = `blur(${Math.max(0.8, cell * 0.02)}px)`;
  ctx.fillStyle = slate ? 'rgba(255, 255, 255, 0.34)' : 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.ellipse(-cell * 0.16, -cell * 0.18, cell * 0.12, cell * 0.06, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A square paper lantern on a small wooden float, seen from the bank above. */
function drawBoxLantern(ctx: CanvasRenderingContext2D, side: Side, cell: number) {
  const w = cell * 0.27;
  const top = -cell * 0.3;
  const bottom = cell * 0.13;
  // The float.
  ctx.fillStyle = '#1c0f05';
  ctx.beginPath();
  ctx.roundRect(-cell * 0.34, bottom - cell * 0.02, cell * 0.68, cell * 0.12, cell * 0.03);
  ctx.fill();
  ctx.fillStyle = '#5b3313';
  ctx.beginPath();
  ctx.roundRect(-cell * 0.34, bottom - cell * 0.03, cell * 0.68, cell * 0.06, cell * 0.03);
  ctx.fill();
  // The paper front, brightest where the flame is.
  const paper = ctx.createRadialGradient(
    0,
    cell * -0.04,
    cell * 0.02,
    0,
    -cell * 0.06,
    cell * 0.34,
  );
  paper.addColorStop(0, side.light);
  paper.addColorStop(0.55, side.body);
  paper.addColorStop(1, side.shade);
  ctx.fillStyle = paper;
  ctx.fillRect(-w, top, w * 2, bottom - top);
  // The open top, seen from above, with the flame's glow inside.
  ctx.fillStyle = side.detail;
  ctx.beginPath();
  ctx.moveTo(-w, top);
  ctx.lineTo(-w * 0.78, top - cell * 0.1);
  ctx.lineTo(w * 0.78, top - cell * 0.1);
  ctx.lineTo(w, top);
  ctx.closePath();
  ctx.fill();
  const inside = ctx.createRadialGradient(0, top - cell * 0.05, 0, 0, top - cell * 0.05, w * 0.8);
  inside.addColorStop(0, '#fffbe8');
  inside.addColorStop(1, side.body);
  ctx.fillStyle = inside;
  ctx.beginPath();
  ctx.moveTo(-w * 0.82, top - cell * 0.012);
  ctx.lineTo(-w * 0.66, top - cell * 0.085);
  ctx.lineTo(w * 0.66, top - cell * 0.085);
  ctx.lineTo(w * 0.82, top - cell * 0.012);
  ctx.closePath();
  ctx.fill();
  // The wooden frame and the ribs that hold the paper.
  ctx.strokeStyle = side.detail;
  ctx.lineWidth = Math.max(1, cell * 0.035);
  ctx.strokeRect(-w, top, w * 2, bottom - top);
  ctx.lineWidth = Math.max(0.8, cell * 0.016);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(0, bottom);
  ctx.moveTo(-w, top + (bottom - top) * 0.36);
  ctx.lineTo(w, top + (bottom - top) * 0.36);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * A round paper lantern, taller than wide, with dark rims top and bottom and ribs round it, on a
 * small float. Its outline is the cue that tells it from the square ones without colour.
 */
function drawRoundLantern(ctx: CanvasRenderingContext2D, side: Side, cell: number) {
  const rx = cell * 0.23;
  const ry = cell * 0.27;
  const cy = -cell * 0.08;
  ctx.fillStyle = '#0d1426';
  ctx.beginPath();
  ctx.ellipse(0, cell * 0.17, cell * 0.24, cell * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a4767';
  ctx.beginPath();
  ctx.ellipse(0, cell * 0.155, cell * 0.24, cell * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  const paper = ctx.createRadialGradient(-rx * 0.12, cy - ry * 0.05, rx * 0.05, 0, cy, ry);
  paper.addColorStop(0, side.light);
  paper.addColorStop(0.62, side.body);
  paper.addColorStop(1, side.shade);
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = side.detail;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = Math.max(0.8, cell * 0.014);
  for (const k of [-0.62, -0.31, 0, 0.31, 0.62]) {
    const half = rx * Math.sqrt(1 - k * k);
    ctx.beginPath();
    ctx.ellipse(0, cy + k * ry, half, ry * 0.08, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = side.detail;
  ctx.beginPath();
  ctx.roundRect(-rx * 0.5, cy - ry - cell * 0.035, rx, cell * 0.06, cell * 0.015);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-rx * 0.56, cy + ry - cell * 0.03, rx * 1.12, cell * 0.06, cell * 0.015);
  ctx.fill();
}

/**
 * A lantern's reflection: soft streaks of its light below the float, which the view stretches
 * and sways a little every frame.
 */
function drawReflection(ctx: CanvasRenderingContext2D, side: Side, cell: number) {
  const top = -cell * 0.32;
  const length = cell * 0.66;
  ctx.save();
  ctx.filter = `blur(${Math.max(2, cell * 0.06)}px)`;
  const column = ctx.createLinearGradient(0, top, 0, top + length);
  column.addColorStop(0, side.body);
  column.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = column;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(-cell * 0.17, top);
  ctx.lineTo(cell * 0.17, top);
  ctx.lineTo(cell * 0.1, top + length);
  ctx.lineTo(-cell * 0.1, top + length);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // A ripple catching the light across it.
  ctx.save();
  ctx.filter = `blur(${Math.max(0.6, cell * 0.012)}px)`;
  ctx.strokeStyle = side.light;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, cell * 0.024);
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.moveTo(-cell * 0.2, top + length * 0.3);
  ctx.lineTo(cell * 0.2, top + length * 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, colour: string, radius: number) {
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  halo.addColorStop(0, colour);
  halo.addColorStop(
    0.35,
    colour.replace(/[\d.]+\)$/, (a) => `${Number.parseFloat(a) * 0.45})`),
  );
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
}

export function makePieceSprites(look: Look, cell: number, scale: number): PieceSprites {
  const size = cell * 1.5;
  if (!look.dark) {
    const pieces = look.pieces.map((side, s) =>
      Array.from({ length: PEBBLE_VARIANTS }, (_, v) => {
        const [canvas, ctx] = sprite(size, scale);
        drawPebble(ctx, look, side, s === 0, cell, 1000 + s * 100 + v);
        return canvas;
      }),
    );
    return { pieces, halos: null, reflections: null, size, haloSize: 0 };
  }
  const pieces = look.pieces.map((side, s) => {
    const [canvas, ctx] = sprite(size, scale);
    if (s === 0) drawBoxLantern(ctx, side, cell);
    else drawRoundLantern(ctx, side, cell);
    return [canvas];
  });
  const haloSize = cell * 2.2;
  const halos = look.halo.map((colour) => {
    const [canvas, ctx] = sprite(haloSize, scale);
    drawHalo(ctx, colour, haloSize / 2);
    return canvas;
  });
  const reflections = look.pieces.map((side) => {
    const [canvas, ctx] = sprite(size, scale);
    drawReflection(ctx, side, cell);
    return canvas;
  });
  return { pieces, halos, reflections, size, haloSize };
}
