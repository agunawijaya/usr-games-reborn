import { circlePoints, curvePoints, stroke } from './hand';
import type { Look } from './look';
import { clamp, fbm, scatter } from './noise';

/**
 * What everything sits on. Scrap Paper is a page of a squared field notebook, its grain, a margin
 * rule and an old coffee ring; Lantern Dark is the cave wall, rough and nearly black, with a
 * smoother slab of slate where the map is chalked.
 */

export interface BackdropOptions {
  width: number;
  height: number;
  /** The map's area, for the coffee ring to stay clear of and for the slate in the dark. */
  map?: { x: number; y: number; w: number; h: number };
}

const cache = new Map<string, HTMLCanvasElement>();

export function backdrop(look: Look, options: BackdropOptions): HTMLCanvasElement {
  const { width, height, map } = options;
  const key = `${look.name}:${width}x${height}:${map ? `${map.x},${map.y},${map.w},${map.h}` : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(grain(look, Math.ceil(width / 2), Math.ceil(height / 2)), 0, 0, width, height);
  if (look.dark) slate(ctx, look, options);
  else notebook(ctx, look, options);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  cache.set(key, canvas);
  return canvas;
}

function hex(value: string): [number, number, number] {
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

/** Paper fibre or rock grain, at half resolution: it is soft enough not to need more. */
function grain(look: Look, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const [r, g, b] = hex(look.ground);
  const [dr, dg, db] = hex(look.groundDeep);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const broad = fbm(x / 160, y / 160, 3, 3);
      const fine = fbm(x / 3.2, y / 3.2, 8, 2) - 0.5;
      const edge =
        clamp(Math.hypot((x / width - 0.5) * 1.3, (y / height - 0.5) * 1.6) - 0.35) * 1.4;
      const mix = clamp(broad * 0.55 + edge * (look.dark ? 0.8 : 0.5));
      const lift = 1 + fine * (look.dark ? 0.5 : 0.06);
      const i = (y * width + x) * 4;
      image.data[i] = clamp((r + (dr - r) * mix) * lift, 0, 255);
      image.data[i + 1] = clamp((g + (dg - g) * mix) * lift, 0, 255);
      image.data[i + 2] = clamp((b + (db - b) * mix) * lift, 0, 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function notebook(ctx: CanvasRenderingContext2D, look: Look, options: BackdropOptions): void {
  const { width, height } = options;
  const square = Math.round(clamp(height / 40, 18, 30));
  ctx.save();
  ctx.strokeStyle = look.grid;
  ctx.lineWidth = 1;
  for (let x = (width % square) / 2; x < width; x += square) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
    ctx.stroke();
  }
  for (let y = square * 0.5; y < height; y += square) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  // Short fibres caught in the paper.
  const random = scatter(91);
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.14)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < (width * height) / 9000; i++) {
    const x = random() * width;
    const y = random() * height;
    const angle = random() * Math.PI;
    const length = 3 + random() * 9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(angle) * length * 0.5 + 1.5,
      y + Math.sin(angle) * length * 0.5,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
    );
    ctx.stroke();
  }
  ctx.restore();

  const map = options.map;
  if (map && map.w > 0)
    coffeeRing(ctx, map.x + map.w * 0.9, map.y + map.h * 0.83, Math.min(map.w, map.h) * 0.12);
  else coffeeRing(ctx, width * 0.93, height * 0.84, Math.min(width, height) * 0.075);
}

/** A ring left by a mug, darker at its rim, with a gap where the mug was lifted at an angle. */
function coffeeRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.save();
  const stain = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 1.04);
  stain.addColorStop(0, 'rgba(150, 96, 44, 0.0)');
  stain.addColorStop(0.75, 'rgba(150, 96, 44, 0.08)');
  stain.addColorStop(0.95, 'rgba(130, 78, 32, 0.16)');
  stain.addColorStop(1, 'rgba(130, 78, 32, 0)');
  ctx.fillStyle = stain;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.05, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, circlePoints({ x, y }, radius * 0.97, 5, -0.9), {
    medium: 'pencil',
    color: 'rgba(125, 74, 30, 0.34)',
    width: 2.2,
    seed: 5,
    wobble: 2.4,
  });
  ctx.restore();
}

function slate(ctx: CanvasRenderingContext2D, look: Look, options: BackdropOptions): void {
  const { width, height, map } = options;
  // Faint lamp-black streaks down the wall.
  const random = scatter(23);
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const x = random() * width;
    const top = random() * height * 0.6;
    const length = height * (0.1 + random() * 0.35);
    const streak = ctx.createLinearGradient(x, top, x, top + length);
    streak.addColorStop(0, 'rgba(0,0,0,0)');
    streak.addColorStop(0.5, `rgba(0,0,0,${0.12 + random() * 0.18})`);
    streak.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(x, top, 6 + random() * 26, length);
  }
  ctx.restore();
  if (!map) return;
  // The slab the map is chalked on: a smoother, slightly bluer stone with a ragged edge.
  const pad = 18;
  const points = [];
  const steps = 90;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const perimeter = t * 4;
    const side = Math.floor(perimeter);
    const along = perimeter - side;
    const jag = (fbm(t * 30, 3, 4, 2) - 0.5) * 22;
    const x0 = map.x - pad;
    const y0 = map.y - pad;
    const x1 = map.x + map.w + pad;
    const y1 = map.y + map.h + pad;
    if (side === 0) points.push({ x: x0 + (x1 - x0) * along, y: y0 + jag });
    else if (side === 1) points.push({ x: x1 + jag, y: y0 + (y1 - y0) * along });
    else if (side === 2) points.push({ x: x1 - (x1 - x0) * along, y: y1 + jag });
    else points.push({ x: x0 + jag, y: y1 - (y1 - y0) * along });
  }
  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  const slab = ctx.createLinearGradient(map.x, map.y, map.x + map.w, map.y + map.h);
  slab.addColorStop(0, '#1d2124');
  slab.addColorStop(1, '#16191b');
  ctx.fillStyle = slab;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.restore();
  // Old chalk smudges: a slate that has been wiped and written on before.
  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const x = map.x + random() * map.w;
    const y = map.y + random() * map.h;
    const smudge = ctx.createRadialGradient(x, y, 0, x, y, 60 + random() * 120);
    smudge.addColorStop(0, 'rgba(230, 225, 210, 0.05)');
    smudge.addColorStop(1, 'rgba(230, 225, 210, 0)');
    ctx.fillStyle = smudge;
    ctx.fillRect(map.x - pad, map.y - pad, map.w + pad * 2, map.h + pad * 2);
  }
  const scrawl = curvePoints(
    { x: map.x + map.w * 0.75, y: map.y + map.h * 0.92 },
    { x: map.x + map.w * 0.86, y: map.y + map.h * 0.86 },
    { x: map.x + map.w * 0.97, y: map.y + map.h * 0.95 },
  );
  stroke(ctx, scrawl, { medium: 'chalk', color: 'rgba(230,225,210,0.08)', width: 3, seed: 4 });
  ctx.restore();
  void look;
}
