import { createRng, type Rng } from '@usr-games/kit';
import type { PondLayout, Point } from './layout';
import type { Look } from './look';
import { drawSprite, sprite } from './sprite-cache';

/**
 * Lily pads with their flowers, and the reeds and cattails at the pond's ends. Pads bob and
 * reeds sway with time; their places are fixed for each layout, so the pond is the same pond
 * every visit.
 */

type Ctx = CanvasRenderingContext2D;

interface Pad {
  x: number;
  y: number;
  r: number;
  rotation: number;
  flower: boolean;
  phase: number;
}

interface Reed {
  x: number;
  y: number;
  height: number;
  lean: number;
  head: boolean;
  phase: number;
  blade: boolean;
}

const padCache = new WeakMap<PondLayout, Pad[]>();
const reedCache = new WeakMap<PondLayout, Reed[]>();

function padsFor(layout: PondLayout): Pad[] {
  let pads = padCache.get(layout);
  if (pads) return pads;
  const rng = createRng('gone-fishing:pads');
  const { pond, s, pile } = layout;
  pads = [];
  let tries = 0;
  while (pads.length < 17 && tries++ < 600) {
    const angle = rng.float(0, Math.PI * 2);
    // Most pads gather towards the shore, as they do in a real pond.
    const reach = Math.sqrt(rng.float(0.25, 0.92));
    const x = pond.cx + Math.cos(angle) * pond.rx * reach;
    const y = pond.cy + Math.sin(angle) * pond.ry * reach;
    const r = rng.float(18, 40) * s;
    // Leave the pile's pad, the rivals' shore and the cast's landing water clear.
    if (Math.hypot(x - pile.x, (y - pile.y) * 2) < 190 * s) continue;
    if (y < pond.farShore(x) + 70 * s) continue;
    if (pads.some((p) => Math.hypot(p.x - x, (p.y - y) * 2) < (p.r + r) * 1.3)) continue;
    pads.push({
      x,
      y,
      r,
      rotation: rng.float(0, Math.PI * 2),
      flower: rng.chance(0.4),
      phase: rng.float(0, Math.PI * 2),
    });
  }
  padCache.set(layout, pads);
  return pads;
}

export function drawPad(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  rotation: number,
  look: Look,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.42);
  ctx.rotate(rotation);
  // The notch: a narrow wedge cut to the middle.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, 0.12, Math.PI * 2 - 0.12);
  ctx.closePath();
  const fill = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  fill.addColorStop(0, look.pad.light);
  fill.addColorStop(0.7, look.pad.mid);
  fill.addColorStop(1, look.pad.shade);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = look.pad.shade;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = look.pad.vein;
  ctx.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const a = 0.12 + (i / 9) * (Math.PI * 2 - 0.24);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLily(ctx: Ctx, x: number, y: number, size: number, look: Look): void {
  ctx.save();
  ctx.translate(x, y);
  // Two rings of pointed petals, the back ones darker, opening upwards.
  for (const [count, length, colour, rise] of [
    [8, 1, look.lily.petalShade, 0.15],
    [6, 0.82, look.lily.petal, 0.45],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rise > 0.3 ? 0.3 : 0);
      const tipX = Math.cos(a) * size * length;
      const tipY = Math.sin(a) * size * length * 0.45 - size * rise;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        tipX * 0.5 - Math.sin(a) * size * 0.22,
        tipY * 0.5 - size * 0.1,
        tipX,
        tipY,
      );
      ctx.quadraticCurveTo(tipX * 0.5 + Math.sin(a) * size * 0.22, tipY * 0.5 - size * 0.1, 0, 0);
      ctx.fillStyle = colour;
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.18, size * 0.2, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = look.lily.heart;
  ctx.fill();
  ctx.restore();
}

export function drawPads(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  padsFor(layout).forEach((pad, i) => {
    const bob = Math.sin(time * 0.9 + pad.phase) * 1.4 * layout.s;
    // Each pad with its flower is painted once; only its gentle bob moves it.
    const width = pad.r * 2.4;
    const height = pad.r * 2;
    const image = sprite(`pad:${look.id}:${i}:${pad.r.toFixed(1)}`, width, height, 2, (paint) => {
      drawPad(paint, 0, 0, pad.r, pad.rotation, look);
      if (pad.flower) drawLily(paint, pad.r * 0.2, -pad.r * 0.08, pad.r * 0.78, look);
    });
    drawSprite(ctx, image, pad.x, pad.y + bob, width, height);
  });
}

function reedsFor(layout: PondLayout): Reed[] {
  let reeds = reedCache.get(layout);
  if (reeds) return reeds;
  const rng = createRng('gone-fishing:reeds');
  const { pond, s, height } = layout;
  reeds = [];
  const clump = (centre: Point, count: number, spread: number, tall: number, local: Rng) => {
    for (let i = 0; i < count; i++) {
      reeds!.push({
        x: centre.x + local.float(-spread, spread) * s,
        y: centre.y + local.float(-8, 10) * s,
        height: local.float(0.55, 1) * tall * s,
        lean: local.float(-0.25, 0.25),
        head: local.chance(0.4),
        phase: local.float(0, Math.PI * 2),
        blade: local.chance(0.45),
      });
    }
  };
  const left = pond.edge(Math.PI * 0.94);
  const right = pond.edge(Math.PI * 0.08);
  clump({ x: left.x + 10 * s, y: left.y + 8 * s }, 16, 46, 150, rng.split('left'));
  clump({ x: right.x - 14 * s, y: right.y + 12 * s }, 14, 40, 140, rng.split('right'));
  clump({ x: 120 * s, y: height - 30 * s }, 22, 110, 190, rng.split('corner'));
  clump({ x: pond.cx + pond.rx * 0.98, y: height - 60 * s }, 10, 50, 130, rng.split('near-right'));
  reeds.sort((a, b) => a.y - b.y);
  reedCache.set(layout, reeds);
  return reeds;
}

export function drawReeds(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  ctx.lineCap = 'round';
  for (const reed of reedsFor(layout)) {
    const sway = Math.sin(time * 0.8 + reed.phase) * 0.06 + reed.lean;
    const tipX = reed.x + Math.sin(sway) * reed.height;
    const tipY = reed.y - Math.cos(sway) * reed.height;
    const bendX = reed.x + Math.sin(sway * 0.4) * reed.height * 0.5;
    const bendY = reed.y - reed.height * 0.5;
    if (reed.blade) {
      // A long flat leaf, wide at the base and bending over at the top.
      ctx.beginPath();
      ctx.moveTo(reed.x - 3 * layout.s, reed.y);
      ctx.quadraticCurveTo(
        bendX - 2 * layout.s,
        bendY,
        tipX + sway * 30 * layout.s,
        tipY + 10 * layout.s,
      );
      ctx.quadraticCurveTo(bendX + 3 * layout.s, bendY, reed.x + 3 * layout.s, reed.y);
      ctx.fillStyle = look.reed.stemShade;
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = look.reed.stem;
    ctx.lineWidth = 2.6 * layout.s;
    ctx.beginPath();
    ctx.moveTo(reed.x, reed.y);
    ctx.quadraticCurveTo(bendX, bendY, tipX, tipY);
    ctx.stroke();
    if (reed.head) {
      // A cattail: a brown velvet head just below a thin spike.
      const along = 0.82;
      const hx = reed.x + (tipX - reed.x) * along;
      const hy = reed.y + (tipY - reed.y) * along;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(sway);
      ctx.fillStyle = look.reed.head;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 * layout.s, 17 * layout.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(-1.6 * layout.s, -3 * layout.s, 1.6 * layout.s, 10 * layout.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
