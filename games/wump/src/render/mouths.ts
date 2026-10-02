import { avoidFloor, type ChamberShape, insideWall, wallPoint, wrap } from './chamber-shape';
import { type Point, stroke } from './hand';
import type { Look } from './look';
import { clamp, hash2, noise2 } from './noise';

/**
 * Tunnel mouths: arched openings in the chamber's far wall, each set against the part of the
 * wall that faces its room on the map. Inside, rings recede towards a vanishing point shifted the
 * way the tunnel runs, so every mouth reads as a passage heading off somewhere.
 */

export interface Arch {
  to: number;
  /** Centre of the opening. */
  center: Point;
  width: number;
  height: number;
  /** Where the tunnel's far end seems to be. */
  vanish: Point;
  /** Unit vector from the mouth into the chamber. */
  inward: Point;
  magic: boolean;
}

export function archFor(
  shape: ChamberShape,
  angle: number,
  to: number,
  magic: boolean,
  size: number,
): Arch {
  const wall = wallPoint(shape, angle);
  const dx = shape.center.x - wall.x;
  const dy = shape.center.y - wall.y;
  const length = Math.hypot(dx, dy) || 1;
  const inward = { x: dx / length, y: dy / length };
  const width = size;
  const height = size * 1.18;
  let center = { x: wall.x + inward.x * width * 0.66, y: wall.y + inward.y * width * 0.66 };
  // Slide inwards until the whole opening sits on the far wall, inside the hollow.
  for (let i = 0; i < 40; i++) {
    const corners = [
      { x: center.x - width * 0.55, y: center.y - height * 0.5 },
      { x: center.x + width * 0.55, y: center.y - height * 0.5 },
      { x: center.x - width * 0.55, y: center.y + height * 0.5 },
      { x: center.x + width * 0.55, y: center.y + height * 0.5 },
    ];
    if (corners.every((c) => insideWall(shape, c))) break;
    center = { x: center.x + inward.x * 6, y: center.y + inward.y * 6 };
  }
  center.y = Math.min(center.y, shape.floorY - height * 0.5);
  const vanish = {
    x: center.x - inward.x * width * 0.26,
    y: center.y - inward.y * height * 0.16 - height * 0.02,
  };
  return { to, center, width, height, vanish, inward, magic };
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MouthToPlace {
  to: number;
  angle: number;
  magic: boolean;
  /** How many notebook marks sit beside its plaque. */
  marks: number;
}

/** The space a mouth takes up: its rocky collar, the plaque above it and the marks beside that. */
export function archBox(arch: Arch, sign: { w: number; h: number }, marks: number): Box {
  const collar = arch.width * 0.6;
  const markRun = marks > 0 ? sign.h * 0.62 * (0.95 + marks * 1.35) : 0;
  const top = arch.center.y - arch.height * 0.5 - sign.h * 1.75;
  return {
    x0: Math.min(arch.center.x - collar, arch.center.x - sign.w / 2),
    y0: top,
    x1: Math.max(arch.center.x + collar, arch.center.x + sign.w / 2 + markRun),
    y1: arch.center.y + arch.height * 0.58,
  };
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return a.x0 - gap < b.x1 && b.x0 - gap < a.x1 && a.y0 - gap < b.y1 && b.y0 - gap < a.y1;
}

/**
 * Places every mouth so that no two overlap, plaques and marks included, and none covers the
 * places kept clear (where the explorer stands, where the wumpus sleeps). Crowded mouths are eased
 * apart round the wall; if they still do not fit, all of them are made a little smaller.
 */
export function layoutArches(
  shape: ChamberShape,
  mouths: readonly MouthToPlace[],
  size: number,
  sign: { w: number; h: number },
  keepClear: readonly Box[],
  bounds: Box,
): Arch[] {
  const angles = mouths.map((m) => m.angle);
  let scale = size;
  let arches: Arch[] = [];
  const step = 0.045;
  const towardTop = (angle: number) => Math.sign(wrap(-Math.PI / 2 - angle)) || 1;
  for (let round = 0; round < 160; round++) {
    arches = mouths.map((m, i) => archFor(shape, angles[i]!, m.to, m.magic, scale));
    const boxes = arches.map((a, i) => archBox(a, sign, mouths[i]!.marks));
    let clash = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (!overlaps(boxes[i]!, boxes[j]!, 12)) continue;
        clash = true;
        const apart = Math.sign(wrap(angles[j]! - angles[i]!)) || 1;
        angles[i] = avoidFloor(wrap(angles[i]! - apart * step));
        angles[j] = avoidFloor(wrap(angles[j]! + apart * step));
      }
      for (const clear of keepClear) {
        if (!overlaps(boxes[i]!, clear, 10)) continue;
        clash = true;
        angles[i] = avoidFloor(wrap(angles[i]! + towardTop(angles[i]!) * step));
      }
      const box = boxes[i]!;
      if (box.y0 < bounds.y0 || box.x0 < bounds.x0 || box.x1 > bounds.x1 || box.y1 > bounds.y1) {
        clash = true;
        // Off the top: slide down the side it is on; off a side: slide towards the top.
        const angle = angles[i]!;
        const down = box.y0 < bounds.y0 ? (Math.cos(angle) >= 0 ? 1 : -1) : -towardTop(angle);
        angles[i] = avoidFloor(wrap(angle + down * step));
      }
    }
    if (!clash) return arches;
    if (round % 24 === 23) scale *= 0.92;
  }
  return arches;
}

/** The outline of an arch scaled about its own centre, roughened a little like hewn rock. */
export function archOutline(arch: Arch, scale = 1, towardVanish = 0, roughness = 1): Point[] {
  const cx = arch.center.x + (arch.vanish.x - arch.center.x) * towardVanish;
  const cy = arch.center.y + (arch.vanish.y - arch.center.y) * towardVanish;
  const w = arch.width * scale;
  const h = arch.height * scale;
  const half = w / 2;
  const bottom = cy + h / 2;
  const spring = cy - h / 2 + half;
  const raw: Point[] = [];
  const steps = 22;
  for (let i = 0; i <= 6; i++) raw.push({ x: cx - half, y: bottom - ((bottom - spring) * i) / 6 });
  for (let i = 1; i < steps; i++) {
    const a = Math.PI + (Math.PI * i) / steps;
    raw.push({ x: cx + Math.cos(a) * half, y: spring + Math.sin(a) * half * 1.05 });
  }
  for (let i = 0; i <= 6; i++) raw.push({ x: cx + half, y: spring + ((bottom - spring) * i) / 6 });
  return raw.map((p, i) => {
    const n = (noise2(i * 0.45, arch.to * 1.7, arch.to) - 0.5) * arch.width * 0.06 * roughness;
    const dx = p.x - cx;
    const dy = p.y - (cy + h * 0.1);
    const length = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / length) * n, y: p.y + (dy / length) * n };
  });
}

function trace(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** Paints a mouth into the static rock layer. */
export function paintArch(ctx: CanvasRenderingContext2D, arch: Arch, look: Look): void {
  const rim = archOutline(arch, 1.16, 0, 1.6);
  const opening = archOutline(arch);
  // A collar of rock round the opening, a shade lighter than the wall it is cut in.
  trace(ctx, rim);
  ctx.fillStyle = look.dark ? '#3c3027' : look.rockLight;
  ctx.fill();

  ctx.save();
  trace(ctx, opening);
  ctx.clip();
  const reach = Math.max(arch.width, arch.height);
  const depth = ctx.createRadialGradient(
    arch.vanish.x,
    arch.vanish.y,
    reach * 0.04,
    arch.center.x,
    arch.center.y,
    reach * 0.75,
  );
  if (look.dark) {
    depth.addColorStop(0, '#000000');
    depth.addColorStop(0.55, '#050403');
    depth.addColorStop(1, '#1d1712');
  } else {
    depth.addColorStop(0, '#221d1a');
    depth.addColorStop(0.5, '#5e5044');
    depth.addColorStop(1, '#a8957a');
  }
  ctx.fillStyle = depth;
  ctx.fillRect(arch.center.x - reach, arch.center.y - reach, reach * 2, reach * 2);
  if (!look.dark) hatchDepth(ctx, arch, look);
  if (arch.magic) shimmer(ctx, arch, look);
  // Rings receding into the tunnel; in the dark they are lost in the black.
  for (let k = 1; k <= (look.dark ? 0 : 3); k++) {
    const ring = archOutline(arch, 1 - k * 0.22, k * 0.3, 0.8);
    stroke(ctx, [...ring, ring[0]!], {
      medium: 'ink',
      color: look.dark ? 'rgba(255, 196, 130, 0.07)' : look.outline,
      width: look.dark ? 1.4 : 1.3,
      seed: arch.to * 7 + k,
      wobble: 0.7,
      alpha: look.dark ? 1 : 0.55 - k * 0.1,
    });
  }
  ctx.restore();

  if (!look.dark) {
    stroke(ctx, [...rim, rim[0]!], {
      medium: 'ink',
      color: look.outline,
      width: 1.6,
      seed: arch.to * 3,
      wobble: 1,
      alpha: 0.7,
    });
    stroke(ctx, [...opening, opening[0]!], {
      medium: 'ink',
      color: look.outline,
      width: 2.6,
      seed: arch.to * 5,
      wobble: 0.9,
    });
    rimStones(ctx, arch, look);
  }
}

/** Cross-hatching that thickens towards the vanishing point: the paper look's darkness. */
function hatchDepth(ctx: CanvasRenderingContext2D, arch: Arch, look: Look): void {
  const reach = Math.max(arch.width, arch.height) * 0.8;
  ctx.strokeStyle = look.outline;
  ctx.lineCap = 'round';
  for (const slant of [1, -1]) {
    for (let offset = -reach; offset < reach; offset += 4) {
      const ax = arch.vanish.x + offset;
      const ay = arch.vanish.y - reach;
      const bx = arch.vanish.x + offset + slant * reach * 2;
      const by = arch.vanish.y + reach;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nearness = 1 - clamp(Math.hypot(mx - arch.vanish.x, my - arch.vanish.y) / reach);
      if (slant < 0 && nearness < 0.45) continue;
      ctx.globalAlpha = 0.12 + nearness * 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function shimmer(ctx: CanvasRenderingContext2D, arch: Arch, look: Look): void {
  const reach = Math.max(arch.width, arch.height);
  const glow = ctx.createRadialGradient(
    arch.vanish.x,
    arch.vanish.y,
    0,
    arch.vanish.x,
    arch.vanish.y,
    reach * 0.7,
  );
  glow.addColorStop(0, look.dark ? 'rgba(200, 170, 255, 0.9)' : 'rgba(160, 120, 230, 0.75)');
  glow.addColorStop(0.5, look.dark ? 'rgba(90, 220, 220, 0.4)' : 'rgba(70, 170, 180, 0.35)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(arch.center.x - reach, arch.center.y - reach, reach * 2, reach * 2);
}

/** A few blocky stones picked out along the top of the arch, as a sketcher would suggest them. */
function rimStones(ctx: CanvasRenderingContext2D, arch: Arch, look: Look): void {
  const outer = archOutline(arch, 1.16, 0, 0);
  const inner = archOutline(arch, 1, 0, 0);
  for (let i = 9; i < outer.length - 8; i += 4) {
    if (hash2(arch.to, i) < 0.35) continue;
    stroke(ctx, [outer[i]!, inner[i]!], {
      medium: 'ink',
      color: look.outline,
      width: 1.3,
      seed: arch.to + i,
      wobble: 0.3,
      alpha: 0.6,
    });
  }
}

/** Lantern Dark: the lamp catches the collar of each mouth, on the side facing it. */
export function lightRim(
  ctx: CanvasRenderingContext2D,
  arch: Arch,
  source: Point,
  strength: number,
): void {
  const distance = Math.hypot(arch.center.x - source.x, arch.center.y - source.y);
  const glow = clamp(1 - distance / 1100, 0.32, 0.85) * Math.max(0.35, strength);
  const dx = source.x - arch.center.x;
  const dy = source.y - arch.center.y;
  const length = Math.hypot(dx, dy) || 1;
  const near = {
    x: arch.center.x + (dx / length) * arch.width * 0.6,
    y: arch.center.y + (dy / length) * arch.width * 0.6,
  };
  const far = {
    x: arch.center.x - (dx / length) * arch.width * 0.6,
    y: arch.center.y - (dy / length) * arch.width * 0.6,
  };
  const gradient = ctx.createLinearGradient(near.x, near.y, far.x, far.y);
  gradient.addColorStop(0, `rgba(255, 186, 110, ${glow})`);
  gradient.addColorStop(1, `rgba(255, 186, 110, ${glow * 0.15})`);
  const rim = archOutline(arch);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  rim.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}
