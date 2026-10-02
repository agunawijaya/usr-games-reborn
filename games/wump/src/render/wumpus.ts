import type { Look } from './look';
import { hash2, noise2 } from './noise';

/**
 * The wumpus: huge, round, shaggy and permanently sleepy, with a potato nose, stubby arms, and the
 * legendary sucker feet. It is meant to be lovable and a little ridiculous, never frightening: no
 * teeth, no claws. Drawn in a 200-unit box around its centre, then scaled to `size`.
 */

export type WumpusPose = 'idle' | 'grumpy' | 'charging' | 'yawning' | 'asleep';

export interface WumpusDrawing {
  x: number;
  /** The floor it sits on. */
  y: number;
  size: number;
  pose: WumpusPose;
  time: number;
  /** Where its light comes from, for the rim of the fur (radians, 0 = from the right). */
  lightFrom?: number;
  /** A sleep dart stuck in its fur, pompom out. */
  dart?: boolean;
  /** 0–1: how far into the pose (a yawn opening, a curl closing). */
  progress?: number;
}

interface Body {
  rx: number;
  ry: number;
  /** Height of the body's centre above the floor, in units. */
  lift: number;
  squash: number;
}

function bodyFor(pose: WumpusPose, breath: number, progress: number): Body {
  switch (pose) {
    case 'asleep':
      return { rx: 112 + breath * 2, ry: 66 + breath * 3, lift: 64, squash: 1 };
    case 'yawning':
      return {
        rx: 98 - progress * 4,
        ry: 92 + progress * 6 + breath,
        lift: 92 + progress * 6,
        squash: 1,
      };
    case 'charging':
      return { rx: 104, ry: 84, lift: 86, squash: 0.96 };
    default:
      return { rx: 100 + breath, ry: 88 + breath * 2, lift: 88, squash: 1 };
  }
}

export function drawWumpus(ctx: CanvasRenderingContext2D, w: WumpusDrawing, look: Look): void {
  const scale = w.size / 200;
  const progress = w.progress ?? 1;
  const breath = Math.sin(w.time * (w.pose === 'asleep' ? 1.4 : 2.2));
  const body = bodyFor(w.pose, breath, progress);
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.scale(scale, scale);
  if (w.pose === 'charging') ctx.rotate(-0.08);

  drawFloorShadow(ctx, body, look);
  drawFeet(ctx, w.pose, body, look);
  ctx.translate(0, -body.lift);
  drawFur(ctx, body, look, w.time, w.pose);
  drawShading(ctx, body, look, w.lightFrom ?? -Math.PI / 3);
  drawBelly(ctx, body, look, w.pose);
  drawArms(ctx, w.pose, body, look, progress, breath);
  drawFace(ctx, w.pose, body, look, progress, w.time);
  drawTuft(ctx, body, look, w.time);
  if (w.dart) drawDart(ctx, body, look);
  ctx.restore();
  if (w.pose === 'asleep') drawSnores(ctx, w, scale, body, look);
}

function drawFloorShadow(ctx: CanvasRenderingContext2D, body: Body, look: Look): void {
  const gradient = ctx.createRadialGradient(0, -2, 4, 0, -2, body.rx * 1.25);
  gradient.addColorStop(0, look.dark ? 'rgba(0,0,0,0.6)' : 'rgba(60,40,20,0.28)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, -2, body.rx * 1.25, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The silhouette as a closed loop of points, a little flattened where it sits. */
function silhouette(body: Body, steps = 120): { x: number; y: number }[] {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    let x = Math.cos(angle) * body.rx;
    let y = Math.sin(angle) * body.ry;
    if (y > body.ry * 0.62) y = body.ry * 0.62 + (y - body.ry * 0.62) * 0.4;
    x *= body.squash;
    return { x, y };
  });
}

function drawFur(
  ctx: CanvasRenderingContext2D,
  body: Body,
  look: Look,
  time: number,
  pose: WumpusPose,
): void {
  const outline = silhouette(body);
  // The shaggy edge: strands combed outwards, longer on top, swaying a little.
  const strands = 170;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < strands; i++) {
      const angle = ((i + layer * 0.5) / strands) * Math.PI * 2;
      const base = outline[Math.floor((angle / (Math.PI * 2)) * outline.length) % outline.length]!;
      const top = Math.max(0, -Math.sin(angle));
      const length = (7 + hash2(i, layer, 7) * 10 + top * 8) * (layer === 0 ? 1.1 : 0.85);
      const sway = Math.sin(time * 1.3 + i * 0.4) * (pose === 'asleep' ? 0.6 : 1.4);
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      const tipX = base.x + nx * length + sway - ny * length * 0.55;
      const tipY = base.y + ny * length * 0.85 + nx * length * 0.15;
      const width = 7 + hash2(i, 3 + layer) * 6;
      ctx.beginPath();
      ctx.moveTo(base.x - ny * width - nx * 6, base.y + nx * width - ny * 6);
      ctx.quadraticCurveTo(base.x + nx * length * 0.6, base.y + ny * length * 0.6, tipX, tipY);
      ctx.quadraticCurveTo(
        base.x + nx * length * 0.4,
        base.y + ny * length * 0.4,
        base.x + ny * width - nx * 6,
        base.y - nx * width - ny * 6,
      );
      ctx.closePath();
      ctx.fillStyle = layer === 0 ? look.furDark : hash2(i, 9) > 0.7 ? look.furLight : look.fur;
      ctx.fill();
    }
  }
  ctx.beginPath();
  outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = look.fur;
  ctx.fill();
  // Fur texture inside: short combed curls.
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 110; i++) {
    const px = (hash2(i, 1, 31) - 0.5) * body.rx * 2;
    const py = (hash2(i, 2, 31) - 0.5) * body.ry * 2;
    const angle = Math.atan2(py, px) + (noise2(px * 0.02, py * 0.02, 5) - 0.5) * 1.2;
    const length = 8 + hash2(i, 3, 31) * 10;
    ctx.strokeStyle = hash2(i, 4, 31) > 0.5 ? look.furDark : look.furLight;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(
      px + Math.cos(angle) * length * 0.6 + 3,
      py + Math.sin(angle) * length * 0.6,
      px + Math.cos(angle) * length,
      py + Math.sin(angle) * length,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Light on one side, shade on the other and underneath. */
function drawShading(
  ctx: CanvasRenderingContext2D,
  body: Body,
  look: Look,
  lightFrom: number,
): void {
  const outline = silhouette(body);
  ctx.save();
  ctx.beginPath();
  outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  const lx = Math.cos(lightFrom) * body.rx;
  const ly = Math.sin(lightFrom) * body.ry;
  const light = ctx.createRadialGradient(lx * 0.7, ly * 0.7, 4, lx * 0.2, ly * 0.2, body.rx * 1.9);
  light.addColorStop(0, look.dark ? 'rgba(255, 214, 150, 0.32)' : 'rgba(255, 250, 225, 0.38)');
  light.addColorStop(0.5, 'rgba(0,0,0,0)');
  light.addColorStop(1, look.dark ? 'rgba(0,0,0,0.55)' : 'rgba(40,46,20,0.32)');
  ctx.fillStyle = light;
  ctx.fillRect(-body.rx * 1.5, -body.ry * 1.5, body.rx * 3, body.ry * 3);
  ctx.restore();
}

function drawBelly(ctx: CanvasRenderingContext2D, body: Body, look: Look, pose: WumpusPose): void {
  if (pose === 'asleep') return;
  ctx.save();
  ctx.globalAlpha = look.dark ? 0.55 : 0.7;
  ctx.fillStyle = look.belly;
  ctx.beginPath();
  ctx.ellipse(0, body.ry * 0.36, body.rx * 0.5, body.ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFeet(ctx: CanvasRenderingContext2D, pose: WumpusPose, body: Body, look: Look): void {
  const feet = pose === 'asleep' ? [-0.62, 0.7] : [-0.42, 0.42];
  for (const side of feet) {
    const fx = side * body.rx;
    const fy = pose === 'asleep' ? -14 : -12;
    ctx.fillStyle = look.furDark;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sucker pads: a row of round cups along the front of each foot.
    for (let k = 0; k < 3; k++) {
      const px = fx + (k - 1) * 15;
      const py = fy + 8;
      ctx.fillStyle = look.belly;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(px, py, 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = look.dark ? 'rgba(0,0,0,0.45)' : look.furDark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(px, py, 2.8, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  pose: WumpusPose,
  body: Body,
  look: Look,
  progress: number,
  breath: number,
): void {
  if (pose === 'asleep') {
    // One paw tucked under the chin.
    ctx.fillStyle = look.furDark;
    ctx.beginPath();
    ctx.ellipse(-body.rx * 0.18, body.ry * 0.38, 26, 13, -0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const raise = pose === 'yawning' ? progress : pose === 'charging' ? 0.5 : 0;
  for (const side of [-1, 1]) {
    const sx = side * body.rx * 0.82;
    const sy = body.ry * 0.12;
    const hx = side * (body.rx * 1.02 + raise * 18);
    const hy = sy + 30 - raise * 90 + breath * 2;
    ctx.strokeStyle = look.furDark;
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(side * (body.rx * 1.0), sy + 10 - raise * 40, hx, hy);
    ctx.stroke();
    ctx.fillStyle = look.fur;
    ctx.beginPath();
    ctx.arc(hx, hy, 13, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  pose: WumpusPose,
  body: Body,
  look: Look,
  progress: number,
  time: number,
): void {
  const faceY = pose === 'asleep' ? body.ry * 0.05 : -body.ry * 0.18;
  const faceX = pose === 'asleep' ? -body.rx * 0.32 : 0;
  const eyeGap = pose === 'asleep' ? 26 : 30;
  ctx.save();
  ctx.translate(faceX, faceY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const closed = pose === 'asleep' || (pose === 'yawning' && progress > 0.35);
  for (const side of [-1, 1]) {
    const ex = side * eyeGap;
    if (closed) {
      ctx.strokeStyle = look.eye;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      if (pose === 'yawning') {
        ctx.moveTo(ex - 12, -2);
        ctx.lineTo(ex, 6);
        ctx.lineTo(ex + 12, -2);
      } else {
        ctx.arc(ex, -4, 12, 0.15 * Math.PI, 0.85 * Math.PI);
      }
      ctx.stroke();
      continue;
    }
    const open =
      pose === 'charging' ? 1 : pose === 'grumpy' ? 0.7 : 0.48 + Math.sin(time * 0.7) * 0.04;
    ctx.fillStyle = look.dark ? '#e9e2cf' : '#fbf7ea';
    ctx.beginPath();
    ctx.ellipse(ex, 0, 17, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.eye;
    ctx.beginPath();
    ctx.ellipse(ex + side * -2, 4, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + side * -2 - 3, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // Heavy lids: the sleepy look is the wumpus's resting face.
    const lidLine = -19 + 38 * (1 - open);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, 0, 18, 20, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = look.fur;
    ctx.fillRect(ex - 22, -24, 44, lidLine + 26);
    ctx.restore();
    ctx.strokeStyle = look.furDark;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(ex - 17, lidLine - 1);
    ctx.quadraticCurveTo(ex, lidLine + 5, ex + 17, lidLine - 1);
    ctx.stroke();
    if (pose === 'grumpy' || pose === 'charging') {
      ctx.strokeStyle = look.furDark;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(ex - side * 18, -30);
      ctx.lineTo(ex + side * 14, -22);
      ctx.stroke();
    }
  }

  // The potato nose.
  const noseY = closed && pose === 'asleep' ? 18 : 26;
  ctx.fillStyle = look.nose;
  ctx.beginPath();
  ctx.ellipse(0, noseY, 21, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-6, noseY - 5, 7, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 7, noseY + 5, 3.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The mouth: no teeth, ever.
  const mouthY = noseY + 24;
  ctx.strokeStyle = look.eye;
  ctx.lineWidth = 4;
  if (pose === 'yawning') {
    const open = 6 + progress * 26;
    ctx.fillStyle = look.dark ? '#2a0f12' : '#5a2a2c';
    ctx.beginPath();
    ctx.ellipse(0, mouthY + open * 0.3, 17 + progress * 6, open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d7727a';
    ctx.beginPath();
    ctx.ellipse(0, mouthY + open * 0.85, 11 + progress * 3, open * 0.4, 0, Math.PI, 0, true);
    ctx.fill();
  } else if (pose === 'charging') {
    ctx.fillStyle = look.dark ? '#2a0f12' : '#5a2a2c';
    ctx.beginPath();
    ctx.ellipse(0, mouthY + 4, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const curve = pose === 'grumpy' ? -7 : pose === 'asleep' ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(-15, mouthY);
    ctx.quadraticCurveTo(0, mouthY + curve * 2, 15, mouthY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTuft(ctx: CanvasRenderingContext2D, body: Body, look: Look, time: number): void {
  const sway = Math.sin(time * 1.7) * 3;
  ctx.strokeStyle = look.furDark;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -body.ry - 4);
  ctx.quadraticCurveTo(-12 + sway, -body.ry - 34, 8 + sway, -body.ry - 30);
  ctx.quadraticCurveTo(18 + sway, -body.ry - 24, 8 + sway, -body.ry - 18);
  ctx.stroke();
}

function drawDart(ctx: CanvasRenderingContext2D, body: Body, look: Look): void {
  const x = body.rx * 0.52;
  const y = -body.ry * 0.55;
  ctx.strokeStyle = look.dark ? '#cfc8b4' : '#4a4a52';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 26, y - 22);
  ctx.stroke();
  ctx.fillStyle = look.dark ? '#d9d2ff' : '#b9c6ea';
  ctx.beginPath();
  ctx.arc(x + 32, y - 27, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x + 28, y - 31, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Zs drifting up from a sleeping wumpus, each one fading as it rises. */
function drawSnores(
  ctx: CanvasRenderingContext2D,
  w: WumpusDrawing,
  scale: number,
  body: Body,
  look: Look,
): void {
  for (let i = 0; i < 3; i++) {
    const phase = (w.time * 0.35 + i / 3) % 1;
    const size = (14 + i * 6 + phase * 10) * scale;
    const x = w.x + (-body.rx * 0.3 + 40 + phase * 70 + Math.sin(phase * 6 + i) * 10) * scale;
    const y = w.y - (body.lift + body.ry + 20 + phase * 120) * scale;
    ctx.save();
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.9;
    ctx.strokeStyle = look.dark ? '#d9d2ff' : look.dart;
    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y - size / 2);
    ctx.lineTo(x + size / 2, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Where the eyes of an awake wumpus are, in canvas pixels, so they can catch the last of the
 * light in a dark chamber.
 */
export function wumpusEyes(w: WumpusDrawing): { x: number; y: number; r: number }[] {
  const scale = w.size / 200;
  const body = bodyFor(w.pose, 0, w.progress ?? 1);
  const faceY = -body.lift - body.ry * 0.18;
  return [-30, 30].map((dx) => ({ x: w.x + dx * scale, y: w.y + faceY * scale, r: 17 * scale }));
}
