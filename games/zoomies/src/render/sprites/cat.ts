import type { Coat, Look } from '../palette';
import { circle, type Ctx, ellipse, floorShadow, glow, line } from '../shapes';

/**
 * The cat, drawn in a slight three-quarter view so its face reads at any size: big head,
 * small loaf of a body, a tail with opinions. Every coat is the same drawing in other colours.
 */

export type CatPose = 'sit' | 'step' | 'loaf' | 'zoom' | 'fluffed' | 'happy';

export interface CatDrawing {
  readonly coat: Coat;
  readonly pose: CatPose;
  /** −1 faces left, 1 faces right. */
  readonly facing: -1 | 1;
  /** Where the eyes look, in −1…1 on each axis. */
  readonly gaze: { readonly x: number; readonly y: number };
  /** Seconds, for breathing, blinking and the tail's sway. */
  readonly time: number;
  readonly look: Look;
  /** Draw as a faded ghost (a rival's replay). */
  readonly ghost?: boolean;
}

const INK_DAY = 'rgba(58, 38, 24, 0.55)';
const INK_NIGHT = 'rgba(8, 6, 18, 0.75)';

function outline(ctx: Ctx, look: Look, width: number) {
  ctx.strokeStyle = look === 'day' ? INK_DAY : INK_NIGHT;
  ctx.lineWidth = width;
  ctx.stroke();
}

function earPath(ctx: Ctx, s: number, side: -1 | 1, flat: number) {
  ctx.beginPath();
  ctx.moveTo(side * 0.19 * s, -0.15 * s);
  ctx.lineTo(side * (0.17 + flat * 0.08) * s, (-0.34 + flat * 0.12) * s);
  ctx.lineTo(side * 0.04 * s, -0.25 * s);
  ctx.closePath();
}

function drawEars(ctx: Ctx, s: number, d: CatDrawing, flat: number) {
  for (const side of [-1, 1] as const) {
    earPath(ctx, s, side, flat);
    ctx.fillStyle = d.coat.patch && side === -1 ? d.coat.patch : d.coat.fur;
    ctx.fill();
    outline(ctx, d.look, 0.018 * s);
    ctx.beginPath();
    ctx.moveTo(side * 0.165 * s, -0.17 * s);
    ctx.lineTo(side * (0.155 + flat * 0.06) * s, (-0.295 + flat * 0.1) * s);
    ctx.lineTo(side * 0.075 * s, -0.235 * s);
    ctx.closePath();
    ctx.fillStyle = d.look === 'day' ? '#f2a7a0' : '#b8737a';
    ctx.fill();
  }
}

function drawTail(ctx: Ctx, s: number, d: CatDrawing) {
  const sway = Math.sin(d.time * 2.2) * 0.05 * s;
  const side = -d.facing;
  ctx.beginPath();
  ctx.lineCap = 'round';
  if (d.pose === 'happy') {
    ctx.moveTo(side * 0.14 * s, 0.16 * s);
    ctx.quadraticCurveTo(side * 0.3 * s, 0.0, side * 0.27 * s + sway, -0.3 * s);
    ctx.quadraticCurveTo(side * 0.25 * s, -0.42 * s, side * 0.17 * s, -0.36 * s);
  } else if (d.pose === 'loaf') {
    ctx.moveTo(side * 0.2 * s, 0.24 * s);
    ctx.quadraticCurveTo(0, 0.38 * s, -side * 0.14 * s, 0.3 * s);
  } else {
    ctx.moveTo(side * 0.16 * s, 0.22 * s);
    ctx.quadraticCurveTo(side * 0.42 * s, 0.2 * s, side * 0.36 * s + sway, -0.04 * s);
    ctx.quadraticCurveTo(
      side * 0.33 * s + sway,
      -0.16 * s,
      side * 0.27 * s + sway * 1.4,
      -0.14 * s,
    );
  }
  const width = (d.pose === 'fluffed' ? 0.15 : 0.085) * s;
  ctx.strokeStyle = d.look === 'day' ? INK_DAY : INK_NIGHT;
  ctx.lineWidth = width + 0.035 * s;
  ctx.stroke();
  ctx.strokeStyle = d.coat.fur;
  ctx.lineWidth = width;
  ctx.stroke();
  if (d.coat.stripe) {
    // Rings across the tail: square-ended dashes, so they read as bands, not beads.
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.setLineDash([0.035 * s, 0.065 * s]);
    ctx.lineDashOffset = -0.04 * s;
    ctx.strokeStyle = d.coat.stripe;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }
}

function spikyEllipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spikes: number,
  depth: number,
) {
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 + depth : 1;
    const x = cx + Math.cos(angle) * rx * r;
    const y = cy + Math.sin(angle) * ry * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawBody(ctx: Ctx, s: number, d: CatDrawing) {
  const breathe = 1 + Math.sin(d.time * 2) * 0.02;
  if (d.pose === 'loaf') {
    ctx.beginPath();
    ctx.roundRect(-0.27 * s, 0.03 * s, 0.54 * s, 0.27 * s, 0.13 * s);
    ctx.fillStyle = d.coat.fur;
    ctx.fill();
    outline(ctx, d.look, 0.02 * s);
    if (d.coat.patch) ellipse(ctx, 0.1 * s, 0.1 * s, 0.1 * s, 0.06 * s, d.coat.patch);
    if (d.coat.stripe) {
      for (const x of [-0.12, 0, 0.12])
        line(ctx, x * s, 0.05 * s, x * s + 0.02 * s, 0.14 * s, d.coat.stripe, 0.03 * s);
    }
    return;
  }
  if (d.pose === 'fluffed') {
    spikyEllipse(ctx, 0, 0.13 * s, 0.27 * s, 0.23 * s, 14, 0.16);
    ctx.fillStyle = d.coat.fur;
    ctx.fill();
    outline(ctx, d.look, 0.02 * s);
    return;
  }
  ellipse(ctx, 0, 0.14 * s, 0.22 * s, 0.19 * s * breathe, d.coat.fur);
  ctx.beginPath();
  ctx.ellipse(0, 0.14 * s, 0.22 * s, 0.19 * s * breathe, 0, 0, Math.PI * 2);
  outline(ctx, d.look, 0.02 * s);
  if (d.coat.patch) ellipse(ctx, -0.1 * s, 0.1 * s, 0.09 * s, 0.07 * s, d.coat.patch);
  if (d.coat.stripe) {
    for (const side of [-1, 1]) {
      line(ctx, side * 0.2 * s, 0.08 * s, side * 0.14 * s, 0.1 * s, d.coat.stripe, 0.022 * s);
      line(ctx, side * 0.21 * s, 0.16 * s, side * 0.15 * s, 0.17 * s, d.coat.stripe, 0.022 * s);
    }
  }
  ellipse(ctx, 0, 0.2 * s, 0.11 * s, 0.11 * s, d.coat.belly);
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 0.085 * s, 0.31 * s, 0.065 * s, 0.045 * s, d.coat.belly);
    ctx.beginPath();
    ctx.ellipse(side * 0.085 * s, 0.31 * s, 0.065 * s, 0.045 * s, 0, 0, Math.PI * 2);
    outline(ctx, d.look, 0.014 * s);
  }
}

function drawFace(ctx: Ctx, s: number, d: CatDrawing) {
  const head = { x: d.facing * 0.025 * s, y: -0.1 * s };
  const blink = d.pose === 'sit' && (d.time % 4.2 < 0.12 || (d.time + 1.3) % 6.7 < 0.1);
  ctx.save();
  ctx.translate(head.x, head.y);
  // Muzzle
  ellipse(ctx, 0, 0.075 * s, 0.085 * s, 0.055 * s, d.coat.belly);
  // Eyes
  const eyeY = -0.005 * s;
  for (const side of [-1, 1]) {
    const ex = side * 0.078 * s;
    if (d.pose === 'loaf' || blink) {
      ctx.beginPath();
      ctx.arc(ex, eyeY, 0.035 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = '#2a1d16';
      ctx.lineWidth = 0.018 * s;
      ctx.stroke();
      continue;
    }
    if (d.pose === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.02 * s, 0.035 * s, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.strokeStyle = '#2a1d16';
      ctx.lineWidth = 0.02 * s;
      ctx.stroke();
      continue;
    }
    const wide = d.pose === 'fluffed' ? 1.25 : 1;
    const paint = () => ellipse(ctx, ex, eyeY, 0.046 * s * wide, 0.054 * s * wide, d.coat.eye);
    if (d.look === 'night') glow(ctx, d.coat.eye, 0.25 * s, paint);
    else paint();
    const px = ex + d.gaze.x * 0.014 * s;
    const py = eyeY + d.gaze.y * 0.012 * s;
    const pupilWidth = d.pose === 'fluffed' ? 0.012 : d.look === 'night' ? 0.03 : 0.018;
    ellipse(ctx, px, py, pupilWidth * s, 0.042 * s, '#141018');
    circle(ctx, px - 0.012 * s, py - 0.018 * s, 0.011 * s, 'rgba(255,255,255,0.9)');
  }
  // Nose and mouth
  ctx.beginPath();
  ctx.moveTo(-0.018 * s, 0.045 * s);
  ctx.lineTo(0.018 * s, 0.045 * s);
  ctx.lineTo(0, 0.066 * s);
  ctx.closePath();
  ctx.fillStyle = '#e07a7f';
  ctx.fill();
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 0.012 * s;
  if (d.pose === 'fluffed') {
    ctx.beginPath();
    ctx.ellipse(0, 0.1 * s, 0.022 * s, 0.026 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5a2a2a';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 0.066 * s);
    ctx.quadraticCurveTo(-0.02 * s, 0.098 * s, -0.04 * s, 0.08 * s);
    ctx.moveTo(0, 0.066 * s);
    ctx.quadraticCurveTo(0.02 * s, 0.098 * s, 0.04 * s, 0.08 * s);
    ctx.stroke();
  }
  // Whiskers
  const whisker = d.look === 'day' ? 'rgba(70, 50, 40, 0.55)' : 'rgba(235, 230, 255, 0.55)';
  for (const side of [-1, 1]) {
    line(ctx, side * 0.07 * s, 0.07 * s, side * 0.27 * s, 0.035 * s, whisker, 0.01 * s);
    line(ctx, side * 0.07 * s, 0.085 * s, side * 0.27 * s, 0.1 * s, whisker, 0.01 * s);
  }
  ctx.restore();
}

function drawHead(ctx: Ctx, s: number, d: CatDrawing) {
  const offset = d.pose === 'loaf' ? 0.08 * s : 0;
  ctx.save();
  ctx.translate(d.facing * 0.025 * s, offset);
  drawEars(ctx, s, d, d.pose === 'zoom' ? 1 : 0);
  ctx.beginPath();
  ctx.ellipse(0, -0.1 * s, 0.215 * s, 0.19 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = d.coat.fur;
  ctx.fill();
  outline(ctx, d.look, 0.02 * s);
  if (d.coat.patch) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -0.1 * s, 0.215 * s, 0.19 * s, 0, 0, Math.PI * 2);
    ctx.clip();
    ellipse(ctx, -0.13 * s, -0.2 * s, 0.13 * s, 0.11 * s, d.coat.patch);
    ctx.restore();
  }
  if (d.coat.stripe) {
    for (const x of [-0.045, 0, 0.045])
      line(ctx, x * s, -0.27 * s, x * 0.8 * s, -0.2 * s, d.coat.stripe, 0.024 * s);
    for (const side of [-1, 1]) {
      line(ctx, side * 0.205 * s, -0.11 * s, side * 0.15 * s, -0.1 * s, d.coat.stripe, 0.02 * s);
      line(ctx, side * 0.2 * s, -0.06 * s, side * 0.15 * s, -0.065 * s, d.coat.stripe, 0.02 * s);
    }
  }
  ctx.translate(-d.facing * 0.025 * s, 0);
  drawFace(ctx, s, d);
  ctx.restore();
}

export function drawCat(ctx: Ctx, cx: number, cy: number, s: number, d: CatDrawing) {
  ctx.save();
  if (d.ghost) ctx.globalAlpha *= 0.55;
  floorShadow(
    ctx,
    cx,
    cy + 0.32 * s,
    0.32 * s,
    0.1 * s,
    d.look === 'day' ? 'rgba(70,45,20,0.35)' : 'rgba(0,0,0,0.5)',
  );
  ctx.translate(cx, cy);
  if (d.pose === 'zoom') ctx.scale(1.12, 0.9);
  drawTail(ctx, s, d);
  drawBody(ctx, s, d);
  drawHead(ctx, s, d);
  ctx.restore();
}
