import { type Look, SNAKE_COLOURS, type SnakePalette } from './look';
import { mix, rgba } from './noise';
import { glow, type Point, smoothPath, sparkle } from './shapes';

/**
 * The snake: six squares of glossy, patterned scales drawn as one sinuous body, with a tiny
 * crown-like frill and big expressive eyes. Its frill and eyes brighten with its boldness. The
 * spine is any list of points, head first: the centres of its six squares in play, or a spiral
 * when it coils round you.
 */
export type SnakeMood = 'curious' | 'bold' | 'smug' | 'wink' | 'sulk' | 'asleep';

export interface SnakeDraw {
  readonly spine: readonly Point[];
  readonly cell: number;
  readonly look: Look;
  readonly time: number;
  /** 0–1: the chance it heads straight for you, shown in its frill and eyes. */
  readonly boldness: number;
  readonly mood: SnakeMood;
  /** Where its eyes look; null looks ahead. */
  readonly gaze: Point | null;
  /** 0–1 to hold the tongue out for a still; animated when left out. */
  readonly tongue?: number;
  /** Draw only the body or only the head, to put something between them (the coil). */
  readonly layer?: 'all' | 'body' | 'head';
}

interface Sample extends Point {
  /** 0 at the head, 1 at the tip of the tail. */
  readonly t: number;
  readonly nx: number;
  readonly ny: number;
  readonly width: number;
}

function dedupe(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const last = result[result.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.5) result.push({ ...p });
  }
  return result;
}

/** Folded bodies (segments sharing a square) still get a little curl, never a dot. */
function enoughSpine(points: Point[], cell: number): Point[] {
  if (points.length >= 3) return points;
  const head = points[0]!;
  const tail = points[1] ?? { x: head.x - cell * 0.4, y: head.y + cell * 0.2 };
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const length = Math.hypot(dx, dy) || 1;
  return [
    head,
    {
      x: head.x + dx * 0.6 - (dy / length) * cell * 0.25,
      y: head.y + dy * 0.6 + (dx / length) * cell * 0.25,
    },
    { x: tail.x + (dy / length) * cell * 0.2, y: tail.y - (dx / length) * cell * 0.2 },
  ];
}

function bodyWidth(t: number, cell: number): number {
  return cell * (0.6 * Math.pow(1 - t, 0.5) + 0.07);
}

/** The head is drawn larger than the body, cartoon-fashion, so its face reads at a glance. */
const HEAD_SCALE = 1.6;

function sampleBody(spine: readonly Point[], cell: number): Sample[] {
  const path = smoothPath(spine, 10);
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    lengths.push(
      lengths[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y),
    );
  }
  const total = lengths[lengths.length - 1] || 1;
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)]!;
    const b = path[Math.min(path.length - 1, i + 1)]!;
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    const t = lengths[i]! / total;
    return { x: p.x, y: p.y, t, nx: -ty / len, ny: tx / len, width: bodyWidth(t, cell) };
  });
}

function outline(samples: readonly Sample[]): Path2D {
  const path = new Path2D();
  samples.forEach((s, i) => {
    const x = s.x + (s.nx * s.width) / 2;
    const y = s.y + (s.ny * s.width) / 2;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]!;
    path.lineTo(s.x - (s.nx * s.width) / 2, s.y - (s.ny * s.width) / 2);
  }
  path.closePath();
  return path;
}

export function drawSnake(ctx: CanvasRenderingContext2D, d: SnakeDraw) {
  const colours = SNAKE_COLOURS[d.look];
  const spine = enoughSpine(dedupe(d.spine), d.cell);
  const samples = sampleBody(spine, d.cell);
  const body = outline(samples);
  const s = d.cell;
  const layer = d.layer ?? 'all';

  if (layer !== 'head') {
    // Shadow on the stones.
    ctx.save();
    ctx.translate(s * 0.08, s * 0.13);
    ctx.filter = `blur(${Math.max(1, s * 0.05)}px)`;
    ctx.fillStyle = rgba('#000000', d.look === 'sun' ? 0.28 : 0.45);
    ctx.fill(body);
    ctx.restore();
    drawBody(ctx, samples, body, colours, s);
  }
  if (layer !== 'body') drawHead(ctx, samples, d, colours);
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  samples: readonly Sample[],
  body: Path2D,
  c: SnakePalette,
  s: number,
) {
  ctx.fillStyle = c.body[1];
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  // The lighter back, a band down the middle of the body.
  ctx.lineCap = 'round';
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    ctx.strokeStyle = c.body[0];
    ctx.lineWidth = b.width * 0.64;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Scales: rows of small arcs along both flanks.
  ctx.strokeStyle = rgba(c.outline, 0.28);
  ctx.lineWidth = Math.max(1, s * 0.012);
  for (let i = 2; i < samples.length; i += 2) {
    const p = samples[i]!;
    for (const side of [-1, 1]) {
      const ox = p.x + p.nx * side * p.width * 0.3;
      const oy = p.y + p.ny * side * p.width * 0.3;
      ctx.beginPath();
      const back = Math.atan2(-p.nx, p.ny);
      ctx.arc(ox, oy, p.width * 0.13, back - 1.2, back + 1.2);
      ctx.stroke();
    }
  }
  // Diamonds down the spine: the vain snake's pride.
  const spacing = s * 0.42;
  let travelled = 0;
  let next = s * 0.62;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    travelled += Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled < next || b.t > 0.94) continue;
    next += spacing;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const along = b.width * 0.36;
    const across = b.width * 0.24;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.fillStyle = c.pattern;
    ctx.strokeStyle = c.patternEdge;
    ctx.lineWidth = Math.max(1, s * 0.016);
    ctx.beginPath();
    ctx.moveTo(along, 0);
    ctx.lineTo(0, across);
    ctx.lineTo(-along, 0);
    ctx.lineTo(0, -across);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.beginPath();
    ctx.moveTo(along * 0.5, -across * 0.1);
    ctx.lineTo(0, -across * 0.6);
    ctx.lineTo(-along * 0.2, -across * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // A glossy highlight on the side that faces the north-west light.
  ctx.lineCap = 'round';
  for (let i = 3; i < samples.length - 3; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const towardLight = b.nx + b.ny < 0 ? 1 : -1;
    const fade = Math.sin(Math.PI * b.t);
    ctx.strokeStyle = rgba('#ffffff', 0.32 * fade);
    ctx.lineWidth = b.width * 0.12;
    ctx.beginPath();
    ctx.moveTo(a.x + a.nx * towardLight * a.width * 0.2, a.y + a.ny * towardLight * a.width * 0.2);
    ctx.lineTo(b.x + b.nx * towardLight * b.width * 0.2, b.y + b.ny * towardLight * b.width * 0.2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = rgba(c.outline, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke(body);
}

// ---------------------------------------------------------------------------------- the head

function drawHead(
  ctx: CanvasRenderingContext2D,
  samples: readonly Sample[],
  d: SnakeDraw,
  c: SnakePalette,
) {
  const s = d.cell;
  const head = samples[0]!;
  const neck = samples[Math.min(samples.length - 1, 4)]!;
  const angle = Math.atan2(head.y - neck.y, head.x - neck.x);
  const bold = Math.max(0, Math.min(1, d.boldness));
  const look = localGaze(head, angle, d.gaze);

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);

  // Head shadow and shape: broad at the eyes, a rounded snout ahead.
  const shape = new Path2D();
  shape.moveTo(-s * 0.2, -s * 0.19);
  shape.bezierCurveTo(s * 0.02, -s * 0.33, s * 0.3, -s * 0.24, s * 0.36, -s * 0.06);
  shape.quadraticCurveTo(s * 0.4, 0, s * 0.36, s * 0.06);
  shape.bezierCurveTo(s * 0.3, s * 0.24, s * 0.02, s * 0.33, -s * 0.2, s * 0.19);
  shape.closePath();
  ctx.save();
  ctx.translate(s * 0.05, s * 0.08);
  ctx.fillStyle = rgba('#000000', 0.2);
  ctx.fill(shape);
  ctx.restore();
  const skin = ctx.createLinearGradient(-s * 0.2, -s * 0.3, s * 0.3, s * 0.3);
  skin.addColorStop(0, mix(c.body[0], '#ffffff', 0.12));
  skin.addColorStop(1, c.body[1]);
  ctx.fillStyle = skin;
  ctx.fill(shape);
  ctx.strokeStyle = rgba(c.outline, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke(shape);

  drawFrill(ctx, s, c, bold, d.look);
  drawMouth(ctx, s, c, d);
  drawEyes(ctx, s, c, d, look, bold);
  ctx.restore();
}

function drawFrill(
  ctx: CanvasRenderingContext2D,
  s: number,
  c: SnakePalette,
  bold: number,
  look: Look,
) {
  // A tiny crown of five scales behind the eyes; it brightens and glows as the snake grows bold.
  const dull = mix(c.body[0], c.frill[0], 0.45);
  const tip = mix(dull, c.frill[0], bold);
  const base = mix(c.body[1], c.frill[1], 0.3 + bold * 0.7);
  if (bold > 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = look === 'moon' ? 'lighter' : 'source-over';
    glow(
      ctx,
      -s * 0.2,
      0,
      s * (0.3 + bold * 0.3),
      rgba(c.frill[0], (bold - 0.35) * (look === 'moon' ? 0.7 : 0.45)),
    );
    ctx.restore();
  }
  // The band the crown sits on.
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(-s * 0.11, 0, s * 0.045, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  const points = [-0.2, -0.1, 0, 0.1, 0.2];
  points.forEach((offset, i) => {
    const height = s * (i === 2 ? 0.26 : i % 2 ? 0.2 : 0.15) * (0.7 + bold * 0.4);
    const y = offset * s * 1.05;
    const gradient = ctx.createLinearGradient(-s * 0.12, 0, -s * 0.12 - height, 0);
    gradient.addColorStop(0, base);
    gradient.addColorStop(1, tip);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, y - s * 0.045);
    ctx.lineTo(-s * 0.12 - height, y);
    ctx.lineTo(-s * 0.1, y + s * 0.045);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(tip, '#ffffff', 0.4);
    ctx.beginPath();
    ctx.arc(-s * 0.12 - height, y, s * 0.018, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMouth(ctx: CanvasRenderingContext2D, s: number, c: SnakePalette, d: SnakeDraw) {
  // Nostrils.
  ctx.fillStyle = rgba(c.outline, 0.7);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 0.31, side * s * 0.05, s * 0.016, s * 0.01, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The mouth runs along both sides of the snout; a grin curls up at the corners.
  ctx.strokeStyle = rgba(c.outline, 0.85);
  ctx.lineWidth = Math.max(1.2, s * 0.022);
  ctx.lineCap = 'round';
  const curl = d.mood === 'smug' || d.mood === 'wink' ? 1 : d.mood === 'sulk' ? -1 : 0.3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.37, side * s * 0.02);
    ctx.quadraticCurveTo(s * 0.28, side * s * 0.15, s * 0.14, side * s * (0.2 - curl * 0.02));
    ctx.quadraticCurveTo(
      s * 0.1,
      side * s * (0.21 - curl * 0.04),
      s * 0.08,
      side * s * (0.17 - curl * 0.06),
    );
    ctx.stroke();
  }
  // Tongue: a forked flick from the snout.
  const flick = d.tongue ?? Math.pow(Math.max(0, Math.sin(d.time * 1.9)), 6);
  if (flick > 0.02 && d.mood !== 'sulk' && d.mood !== 'asleep') {
    const reach = s * 0.26 * flick;
    const wiggle = Math.sin(d.time * 30) * s * 0.02 * flick;
    ctx.strokeStyle = c.tongue;
    ctx.lineWidth = Math.max(1.4, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(s * 0.38, 0);
    ctx.quadraticCurveTo(s * 0.38 + reach * 0.5, wiggle, s * 0.38 + reach, 0);
    ctx.lineTo(s * 0.38 + reach + s * 0.06 * flick, -s * 0.04 * flick);
    ctx.moveTo(s * 0.38 + reach, 0);
    ctx.lineTo(s * 0.38 + reach + s * 0.06 * flick, s * 0.04 * flick);
    ctx.stroke();
  }
}

/** The direction of the gaze in the head's own frame, where ahead is +x. */
function localGaze(head: Point, angle: number, gaze: Point | null): Point {
  if (!gaze) return { x: 1, y: 0 };
  const dx = gaze.x - head.x;
  const dy = gaze.y - head.y;
  const x = dx * Math.cos(-angle) - dy * Math.sin(-angle);
  const y = dx * Math.sin(-angle) + dy * Math.cos(-angle);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  s: number,
  c: SnakePalette,
  d: SnakeDraw,
  look: Point,
  bold: number,
) {
  const gx = look.x;
  const gy = look.y;
  const sclera = s * 0.13;
  for (const side of [-1, 1] as const) {
    const ex = s * 0.06;
    const ey = side * s * 0.15;
    if (d.look === 'moon') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, ex, ey, s * (0.22 + bold * 0.14), c.eyeGlow);
      ctx.restore();
    }
    // It winks with the eye turned away from you, the one you can see past the coil.
    // Asleep, both eyes are shut; winking, only the one turned away from you.
    const winking = d.mood === 'asleep' || (d.mood === 'wink' && side === (gy >= 0 ? -1 : 1));
    if (winking) {
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = Math.max(1.6, s * 0.03);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex - s * 0.02, ey, sclera * 0.85, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      if (d.mood === 'wink') {
        ctx.fillStyle = rgba('#fff6c8', 0.95);
        sparkle(ctx, ex + s * 0.1, ey + s * 0.12, s * 0.07);
        ctx.fill();
      }
      continue;
    }
    ctx.fillStyle = c.eyeWhite;
    ctx.beginPath();
    ctx.arc(ex, ey, sclera, 0, Math.PI * 2);
    ctx.fill();
    const irisRadius = s * (0.082 - bold * 0.008);
    const ix = ex + gx * s * 0.03;
    const iy = ey + gy * s * 0.03;
    const iris = ctx.createRadialGradient(
      ix - irisRadius * 0.3,
      iy - irisRadius * 0.3,
      0,
      ix,
      iy,
      irisRadius,
    );
    iris.addColorStop(0, mix(c.iris, '#ffffff', 0.35 + bold * 0.2));
    iris.addColorStop(1, c.iris);
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ix, iy, irisRadius, 0, Math.PI * 2);
    ctx.fill();
    // A round pupil, narrowing to a slit as it grows bold.
    ctx.fillStyle = c.pupil;
    ctx.beginPath();
    ctx.ellipse(
      ix + gx * s * 0.01,
      iy + gy * s * 0.01,
      s * (0.05 - bold * 0.03),
      s * 0.052,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.9);
    ctx.beginPath();
    ctx.arc(ix - s * 0.025, iy - s * 0.025, s * 0.02, 0, Math.PI * 2);
    ctx.fill();
    drawLid(ctx, s, c, d.mood, ex, ey, side, sclera, bold);
    ctx.strokeStyle = rgba(c.outline, 0.7);
    ctx.lineWidth = Math.max(1, s * 0.018);
    ctx.beginPath();
    ctx.arc(ex, ey, sclera, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Eyelids and brows make the moods: wide and raised when curious, a sly slant when bold, flat
 * and half shut when smug, heavy and drooping when it sulks.
 */
function drawLid(
  ctx: CanvasRenderingContext2D,
  s: number,
  c: SnakePalette,
  mood: SnakeMood,
  ex: number,
  ey: number,
  side: -1 | 1,
  sclera: number,
  bold: number,
) {
  const cover =
    mood === 'smug' || mood === 'wink'
      ? 0.5
      : mood === 'sulk'
        ? 0.62
        : mood === 'bold'
          ? 0.28 + bold * 0.1
          : 0;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ex, ey, sclera * 1.02, 0, Math.PI * 2);
  ctx.clip();
  if (cover > 0) {
    // The lid comes down from the back of the eye (toward the frill), slanted inward when sly.
    const slant = mood === 'bold' ? side * 0.35 : mood === 'sulk' ? -side * 0.25 : 0;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(slant);
    ctx.fillStyle = mix(c.body[0], c.body[1], 0.3);
    ctx.fillRect(-sclera * 1.2, -sclera * 1.2, sclera * 2.4 * cover, sclera * 2.4);
    ctx.strokeStyle = rgba(c.outline, 0.85);
    ctx.lineWidth = Math.max(1.2, s * 0.022);
    ctx.beginPath();
    ctx.moveTo(-sclera * 1.2 + sclera * 2.4 * cover, -sclera * 1.2);
    ctx.lineTo(-sclera * 1.2 + sclera * 2.4 * cover, sclera * 1.2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  if (mood === 'curious') {
    ctx.strokeStyle = rgba(c.outline, 0.7);
    ctx.lineWidth = Math.max(1.2, s * 0.02);
    ctx.beginPath();
    ctx.arc(ex - s * 0.02, ey, sclera * 1.35, Math.PI * 0.75, Math.PI * 1.25);
    ctx.stroke();
  }
}
