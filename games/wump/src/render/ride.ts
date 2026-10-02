import { letter, type Point, stroke } from './hand';
import type { Look } from './look';
import { clamp, hash2, scatter } from './noise';

/**
 * What is drawn over the tunnel during the dart ride: the dart itself, seen from just behind its
 * pompom tail, the plaque of each room it passes flashing by on the chamber wall, and in Scrap
 * Paper a flurry of pencil speed lines. The tunnel's bends are computed exactly as the shader
 * computes them, so the plaques sit where the chambers are.
 */

export interface RideOverlay {
  /** The rooms of the dart's path, in order. */
  path: readonly number[];
  travel: number;
  hop: number;
  seed: number;
  time: number;
  /** 0–1 shake of a wavering dart. */
  wobble: number;
}

function bend(z: number, seed: number): Point {
  return {
    x: Math.sin(z * 0.21 + seed) * 0.9 + Math.sin(z * 0.09 + seed * 2) * 0.5,
    y: Math.cos(z * 0.16 + seed * 1.3) * 0.55,
  };
}

/** Where a point at depth `z` on the tunnel's centre line appears on screen, and its scale. */
export function project(
  z: number,
  ride: RideOverlay,
  width: number,
  height: number,
): { at: Point; scale: number } | null {
  const t = z - ride.travel;
  if (t <= 0.05) return null;
  const c0 = bend(ride.travel, ride.seed);
  const c = bend(z, ride.seed);
  const k = 0.55 / Math.max(t, 0.35);
  // The shader's y runs up the screen; the canvas's runs down.
  return {
    at: { x: width / 2 + (c.x - c0.x) * k * height, y: height / 2 - (c.y - c0.y) * k * height },
    scale: 1 / t,
  };
}

export function drawRideOverlay(
  ctx: CanvasRenderingContext2D,
  ride: RideOverlay,
  look: Look,
  width: number,
  height: number,
): void {
  if (!look.dark) speedLines(ctx, ride, look, width, height);
  for (let k = ride.path.length; k >= 1; k--) plaque(ctx, ride, k, look, width, height);
  drawDart(ctx, ride, look, width, height);
}

function speedLines(
  ctx: CanvasRenderingContext2D,
  ride: RideOverlay,
  look: Look,
  width: number,
  height: number,
): void {
  const random = scatter(Math.floor(ride.time * 8));
  const center = { x: width / 2, y: height / 2 };
  for (let i = 0; i < 46; i++) {
    const angle = random() * Math.PI * 2;
    const inner = height * (0.32 + random() * 0.25);
    const outer = inner + height * (0.08 + random() * 0.22);
    stroke(
      ctx,
      [
        { x: center.x + Math.cos(angle) * inner, y: center.y + Math.sin(angle) * inner },
        { x: center.x + Math.cos(angle) * outer, y: center.y + Math.sin(angle) * outer },
      ],
      { medium: 'pencil', color: look.outline, width: 1.4, seed: i, wobble: 0.4, alpha: 0.4 },
    );
  }
}

/** The room's number plaque, nailed to the chamber wall, rushing past as the dart flies through. */
function plaque(
  ctx: CanvasRenderingContext2D,
  ride: RideOverlay,
  k: number,
  look: Look,
  width: number,
  height: number,
): void {
  const z = k * ride.hop;
  const view = project(z, ride, width, height);
  if (!view) return;
  const t = z - ride.travel;
  if (t > 9) return;
  // It fades before it gets close enough to fill the screen or slide off its edge.
  const alpha = clamp((9 - t) / 3) * clamp((t - 1.7) / 0.8);
  if (alpha <= 0.01) return;
  // The chamber's wall is about 1.9 tunnel radii out; the plaque hangs just inside it.
  const wall = (1.9 / t) * height * 0.78;
  const angle = -Math.PI * 0.9 + (hash2(k, ride.path[k - 1] ?? 0) - 0.5) * 0.3;
  const center = {
    x: view.at.x + Math.cos(angle) * wall * 1.25,
    y: view.at.y + Math.sin(angle) * wall * 0.9,
  };
  const h = clamp((height * 0.38) / t, 12, height * 0.17);
  const w = h * 1.8;
  const label = String(ride.path[k - 1]);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(center.x, center.y);
  ctx.rotate((hash2(k, 4) - 0.5) * 0.16);
  if (look.dark) {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.1);
    glow.addColorStop(0, 'rgba(255, 170, 80, 0.5)');
    glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-w * 1.2, -w * 1.2, w * 2.4, w * 2.4);
  }
  // The peg and the string it hangs from.
  ctx.strokeStyle = look.dark ? '#a8977d' : look.outline;
  ctx.lineWidth = Math.max(1.5, h * 0.035);
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h / 2);
  ctx.lineTo(0, -h * 0.85);
  ctx.lineTo(w * 0.3, -h / 2);
  ctx.stroke();
  ctx.fillStyle = look.sign;
  ctx.strokeStyle = look.dark ? 'rgba(0,0,0,0.7)' : look.outline;
  ctx.lineWidth = Math.max(1.5, h * 0.045);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.12);
  ctx.fill();
  ctx.stroke();
  letter(ctx, label, 0, 1, {
    medium: 'ink',
    color: look.signInk,
    size: h * 0.66,
    seed: Number(label) * 7,
    weight: 0.14,
  });
  ctx.restore();
}

/**
 * The dart, seen from just above and behind: its fluffy pompom tail close by, the shaft running
 * off towards the tunnel's heart, and the soft glow at its tip that sends a wumpus to sleep.
 */
function drawDart(
  ctx: CanvasRenderingContext2D,
  ride: RideOverlay,
  look: Look,
  width: number,
  height: number,
): void {
  const sway = Math.sin(ride.time * 2.3) * 6 + Math.sin(ride.time * 21) * ride.wobble * 14;
  const puff = { x: width * 0.535 + sway, y: height * 0.86 };
  const radius = height * 0.075;
  const ahead = project(ride.travel + 2.4, ride, width, height)?.at ?? {
    x: width / 2,
    y: height / 2,
  };
  const tip = { x: puff.x + (ahead.x - puff.x) * 0.58, y: puff.y + (ahead.y - puff.y) * 0.58 };
  const dx = tip.x - puff.x;
  const dy = tip.y - puff.y;
  const length = Math.hypot(dx, dy) || 1;
  const across = { x: -dy / length, y: dx / length };

  ctx.save();
  // The shaft, narrowing as it runs away, with a painted band near the tail.
  const shaft = (from: number, to: number, w0: number, w1: number, fill: string) => {
    const a = { x: puff.x + dx * from, y: puff.y + dy * from };
    const b = { x: puff.x + dx * to, y: puff.y + dy * to };
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a.x + across.x * w0, a.y + across.y * w0);
    ctx.lineTo(b.x + across.x * w1, b.y + across.y * w1);
    ctx.lineTo(b.x - across.x * w1, b.y - across.y * w1);
    ctx.lineTo(a.x - across.x * w0, a.y - across.y * w0);
    ctx.closePath();
    ctx.fill();
  };
  shaft(0, 1, radius * 0.16, 1.6, look.dark ? '#d8d2c2' : '#4b4a55');
  shaft(0.12, 0.2, radius * 0.15, radius * 0.13, look.dark ? '#a99cff' : '#3a5f8a');
  const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, radius * 1.1);
  glow.addColorStop(0, look.dark ? 'rgba(225, 215, 255, 0.95)' : 'rgba(110, 130, 215, 0.75)');
  glow.addColorStop(1, 'rgba(160, 150, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, radius * 1.1, 0, Math.PI * 2);
  ctx.fill();

  if (look.dark) {
    const halo = ctx.createRadialGradient(
      puff.x,
      puff.y,
      radius * 0.4,
      puff.x,
      puff.y,
      radius * 2.6,
    );
    halo.addColorStop(0, 'rgba(180, 168, 255, 0.32)');
    halo.addColorStop(1, 'rgba(180, 168, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(puff.x - radius * 2.7, puff.y - radius * 2.7, radius * 5.4, radius * 5.4);
  }
  drawPompom(ctx, puff, radius, look);
  ctx.restore();
}

/** A fluffy ball: many soft tufts scattered round its edge, lit from above. */
function drawPompom(ctx: CanvasRenderingContext2D, c: Point, radius: number, look: Look): void {
  const light = look.dark ? '#e4dfff' : '#d2dbf3';
  const mid = look.dark ? '#c2b8ff' : '#b3c1e8';
  const deep = look.dark ? '#8f82e0' : '#8ea0d4';
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius * 0.92, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 70; i++) {
    const a = hash2(i, 1) * Math.PI * 2;
    const d = Math.sqrt(hash2(i, 2)) * radius * 0.88;
    const x = c.x + Math.cos(a) * d;
    const y = c.y + Math.sin(a) * d;
    const r = radius * (0.12 + hash2(i, 3) * 0.12);
    const above = (c.y - y) / radius;
    ctx.fillStyle = above > 0.2 ? light : above < -0.35 ? deep : hash2(i, 4) > 0.5 ? mid : light;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!look.dark) {
    ctx.strokeStyle = look.outline;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = radius * (1 + Math.abs(Math.sin(i * 1.885)) * 0.05);
      if (i === 0) ctx.moveTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      else ctx.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
