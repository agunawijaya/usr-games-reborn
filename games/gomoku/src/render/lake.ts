import { drawCoordinates } from './garden';
import { type BoardGeometry, starPoints } from './geometry';
import type { Look } from './look';
import { seeded } from './noise';

/**
 * Lantern Lake's scenery: a still lake at night seen from a high bank, the far shore and the sky
 * above it in a band at the top, a low moon whose path shimmers across the water, and the board
 * as a square of calm water with its grid drawn in light. The still parts are drawn once into
 * caches; the moon's path and the twinkles move every frame.
 */

export interface LakeFrame {
  width: number;
  height: number;
  /** The waterline of the far shore. */
  horizon: number;
  /** Where the moon rises over the shore, across the frame. */
  moonX: number;
}

export function moonOf(frame: LakeFrame): { x: number; y: number; r: number } {
  const r = Math.max(18, frame.height * 0.038);
  return { x: frame.moonX, y: frame.horizon - r * 1.45, r };
}

function drawSky(ctx: CanvasRenderingContext2D, look: Look, frame: LakeFrame) {
  const { width, horizon } = frame;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(0.6, look.sky[1]);
  sky.addColorStop(1, look.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);

  const random = seeded(77);
  const count = Math.round((width * horizon) / 700);
  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * horizon * 0.92;
    const big = random() < 0.08;
    ctx.globalAlpha = 0.25 + random() * 0.6;
    ctx.fillStyle = look.star;
    ctx.beginPath();
    ctx.arc(x, y, big ? 1.4 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const moon = moonOf(frame);
  const glow = ctx.createRadialGradient(moon.x, moon.y, moon.r * 0.8, moon.x, moon.y, moon.r * 5);
  glow.addColorStop(0, 'rgba(245, 241, 226, 0.28)');
  glow.addColorStop(1, 'rgba(245, 241, 226, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(moon.x - moon.r * 5, 0, moon.r * 10, horizon);
  const face = ctx.createRadialGradient(
    moon.x - moon.r * 0.3,
    moon.y - moon.r * 0.3,
    moon.r * 0.1,
    moon.x,
    moon.y,
    moon.r,
  );
  face.addColorStop(0, '#fffdf4');
  face.addColorStop(1, '#e6dfc8');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
  ctx.fill();
  // Its seas, faintly.
  ctx.fillStyle = 'rgba(170, 160, 135, 0.28)';
  for (const [dx, dy, s] of [
    [-0.25, -0.1, 0.28],
    [0.2, 0.15, 0.22],
    [0.05, -0.38, 0.14],
  ] as const) {
    ctx.beginPath();
    ctx.arc(moon.x + dx * moon.r, moon.y + dy * moon.r, s * moon.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Two layers of the far shore: soft hills, then a line of trees down to the water. */
function drawShore(ctx: CanvasRenderingContext2D, look: Look, frame: LakeFrame) {
  const { width, horizon, height } = frame;
  const random = seeded(31);
  const unit = height * 0.03;
  ctx.fillStyle = look.shore[1];
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width + 40; x += 40) {
    const hill = Math.sin(x * 0.0021 + 1.2) * 0.6 + Math.sin(x * 0.0057) * 0.4;
    ctx.lineTo(x, horizon - unit * (1.1 + hill * 0.7));
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = look.shore[0];
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 6 + random() * 10) {
    const tree = random() < 0.55 ? unit * (0.35 + random() * 0.5) : unit * 0.18;
    ctx.lineTo(x, horizon - unit * 0.2);
    ctx.lineTo(x + 3, horizon - tree);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // A few lanterns on the far bank, and their light on the water.
  for (let i = 0; i < 9; i++) {
    const x = (0.05 + random() * 0.9) * width;
    const warm = random() < 0.7;
    ctx.fillStyle = warm ? 'rgba(255, 180, 90, 0.9)' : 'rgba(210, 225, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x, horizon - unit * 0.12, 1.3, 0, Math.PI * 2);
    ctx.fill();
    const gleam = ctx.createLinearGradient(0, horizon + 2, 0, horizon + 2 + unit * 0.4);
    gleam.addColorStop(0, warm ? 'rgba(255, 170, 80, 0.28)' : 'rgba(200, 220, 255, 0.22)');
    gleam.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gleam;
    ctx.fillRect(x - 0.75, horizon + 2, 1.5, unit * 0.4);
  }
}

function drawWater(ctx: CanvasRenderingContext2D, look: Look, frame: LakeFrame) {
  const { width, height, horizon } = frame;
  const water = ctx.createLinearGradient(0, horizon, 0, height);
  water.addColorStop(0, '#16264f');
  water.addColorStop(0.08, look.ground[0]);
  water.addColorStop(1, look.ground[1]);
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Faint ripples, closer together toward the far shore.
  const random = seeded(5);
  ctx.strokeStyle = look.ripple;
  ctx.lineCap = 'round';
  for (let t = 0; t < 1; t += 0.012) {
    const y = horizon + (height - horizon) * t ** 1.5;
    ctx.lineWidth = 0.6 + t * 1.4;
    for (let x = random() * 120; x < width; x += 60 + random() * 160) {
      const length = (20 + random() * 90) * (0.4 + t);
      ctx.globalAlpha = 0.4 + random() * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // The sky's stars, dimly mirrored.
  for (let i = 0; i < width / 6; i++) {
    ctx.fillStyle = `rgba(220, 232, 255, ${0.08 + random() * 0.16})`;
    const x = random() * width;
    const y = horizon + 10 + random() * (height - horizon);
    ctx.fillRect(x - 1.2, y, 2.4, 1);
  }
}

/** Sky, shore and water: everything behind the board. */
export function drawLakeBackdrop(ctx: CanvasRenderingContext2D, look: Look, frame: LakeFrame) {
  drawWater(ctx, look, frame);
  drawSky(ctx, look, frame);
  drawShore(ctx, look, frame);
}

/** The moon's path on the water, every frame: broken streaks that widen and shiver toward the bank. */
export function drawMoonPath(ctx: CanvasRenderingContext2D, frame: LakeFrame, time: number) {
  const { height, horizon } = frame;
  const moon = moonOf(frame);
  const random = seeded(919);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let k = 0; k < 90; k++) {
    const t = random() ** 1.3;
    const y = horizon + 3 + (height - horizon) * t ** 1.35;
    const spread = moon.r * (0.4 + t * 1.9);
    const sway = Math.sin(time * (0.7 + random() * 0.8) + k * 1.9);
    const x = moon.x + (random() - 0.5) * spread * 1.4 + sway * moon.r * 0.12;
    const half = moon.r * (0.15 + random() * 0.55) * (0.5 + t) * (0.8 + 0.2 * sway);
    ctx.strokeStyle = `rgba(245, 238, 215, ${(0.3 - t * 0.22) * (0.65 + 0.35 * sway)})`;
    ctx.lineWidth = 1 + t * 2.2;
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** The board: a square of calm water, its grid in light, the marked points, the coordinates. */
export function drawLakeBoard(ctx: CanvasRenderingContext2D, look: Look, g: BoardGeometry) {
  const bed = g.slot;
  const pad = g.cell * 0.2;
  ctx.save();
  ctx.fillStyle = look.bed;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = g.cell * 0.6;
  ctx.beginPath();
  ctx.roundRect(bed.x + pad, bed.y + pad, bed.width - pad * 2, bed.height - pad * 2, g.cell * 0.35);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = look.bedEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bed.x + pad, bed.y + pad, bed.width - pad * 2, bed.height - pad * 2, g.cell * 0.35);
  ctx.stroke();
  ctx.restore();

  const span = g.cell * (g.size - 1);
  const grid = new Path2D();
  for (let i = 0; i < g.size; i++) {
    grid.moveTo(g.left, g.top + i * g.cell);
    grid.lineTo(g.left + span, g.top + i * g.cell);
    grid.moveTo(g.left + i * g.cell, g.top);
    grid.lineTo(g.left + i * g.cell, g.top + span);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = look.lineShade;
  ctx.shadowBlur = look.lineGlow;
  ctx.strokeStyle = look.line;
  ctx.lineWidth = Math.max(1, g.cell * 0.022);
  ctx.stroke(grid);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(225, 238, 255, 0.35)';
  ctx.lineWidth = Math.max(0.6, g.cell * 0.01);
  ctx.stroke(grid);
  ctx.restore();

  for (const p of starPoints(g.size)) {
    const x = g.left + (p % g.size) * g.cell;
    const y = g.top + Math.floor(p / g.size) * g.cell;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, g.cell * 0.22);
    glow.addColorStop(0, 'rgba(200, 225, 255, 0.85)');
    glow.addColorStop(0.3, 'rgba(150, 196, 255, 0.35)');
    glow.addColorStop(1, 'rgba(150, 196, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - g.cell * 0.22, y - g.cell * 0.22, g.cell * 0.44, g.cell * 0.44);
  }
  drawCoordinates(ctx, look, g);
}
