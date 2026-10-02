import { createRng, type Rng } from '@usr-games/kit';
import type { Board } from '../engine/board';
import { withAlpha } from './fruit';
import type { Layout } from './layout';
import type { Look } from './look';
import { paintTerrain } from './terrain';

/**
 * Everything that does not move: the sky, the grass along the surface, the soil in its layers
 * with pebbles and roots, and the bed with its rocks, roots, mud and tunnels. Painted once into
 * an offscreen canvas per size, look and garden, then copied every frame.
 */

export interface BackdropSpec {
  layout: Layout;
  look: Look;
  board: Board;
  /** Seeds the scattering of pebbles, roots and clouds, so a garden always looks the same. */
  seed: string;
  grid: boolean;
}

const cache = new Map<string, HTMLCanvasElement>();

export function backdrop(spec: BackdropSpec): HTMLCanvasElement {
  const { layout, look } = spec;
  const key = [
    layout.width,
    layout.height,
    layout.cell,
    layout.left,
    layout.top,
    look.id,
    spec.seed,
    spec.grid,
  ].join(':');
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d')!;
  const random = createRng(`scenery:${spec.seed}`);
  paintSky(ctx, layout, look, random.split('sky'));
  paintSoil(ctx, layout, look, random.split('soil'));
  paintRoots(ctx, layout, look, random.split('roots'));
  paintGrass(ctx, layout, look, random.split('grass'));
  paintBed(ctx, layout, look, random.split('bed'));
  paintTerrain(ctx, layout, look, spec.board, random.split('terrain'));
  if (spec.grid) paintGrid(ctx, layout, look);
  if (cache.size > 8) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

function paintSky(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, random: Rng): void {
  const { width, surface, dpr } = layout;
  const sky = ctx.createLinearGradient(0, 0, 0, surface);
  sky.addColorStop(0, look.skyTop);
  sky.addColorStop(1, look.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, surface + layout.cell);
  if (look.dark) {
    for (let i = 0; i < Math.round(width / (9 * dpr)); i++) {
      ctx.globalAlpha = random.float(0.25, 0.9);
      ctx.fillStyle = look.star ?? '#fff';
      const r = random.float(0.5, 1.5) * dpr;
      ctx.beginPath();
      ctx.arc(random.float(0, width), random.float(0, surface * 0.9), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, width * 0.84, surface * 0.38, Math.max(10 * dpr, surface * 0.16), look);
  } else {
    const sun = ctx.createRadialGradient(
      width * 0.86,
      surface * 0.2,
      0,
      width * 0.86,
      surface * 0.2,
      surface * 1.4,
    );
    sun.addColorStop(0, 'rgba(255, 244, 196, 0.95)');
    sun.addColorStop(0.18, 'rgba(255, 236, 170, 0.55)');
    sun.addColorStop(1, 'rgba(255, 236, 170, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, surface);
    for (let i = 0; i < 5; i++) {
      paintCloud(
        ctx,
        random.float(0.04, 0.72) * width,
        random.float(0.18, 0.55) * surface,
        random.float(0.7, 1.3) * surface * 0.32,
        random,
      );
    }
  }
}

function paintMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  look: Look,
): void {
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 4);
  halo.addColorStop(0, 'rgba(220, 210, 255, 0.28)');
  halo.addColorStop(1, 'rgba(220, 210, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = '#f4efd8';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.skyTop;
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y - r * 0.22, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
}

function paintCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  random: Rng,
): void {
  const puffs = random.int(4, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  for (let i = 0; i < puffs; i++) {
    const px = x + (i - puffs / 2) * size * 0.42 + random.float(-0.1, 0.1) * size;
    const py = y - Math.sin((i / (puffs - 1)) * Math.PI) * size * 0.28;
    ctx.beginPath();
    ctx.ellipse(
      px,
      py,
      size * random.float(0.32, 0.46),
      size * random.float(0.24, 0.32),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(214, 228, 240, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.16, size * puffs * 0.2, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Three wavy layers of soil, then a dusting of light and dark specks and some pebbles. */
function paintSoil(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, random: Rng): void {
  const { width, height, surface, dpr } = layout;
  const depth = height - surface;
  const bands = [surface, surface + depth * 0.32, surface + depth * 0.66];
  look.soil.forEach((colour, i) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    const y0 = bands[i]!;
    ctx.moveTo(0, height);
    ctx.lineTo(0, y0);
    const phase = random.float(0, Math.PI * 2);
    for (let x = 0; x <= width; x += 24 * dpr) {
      const wave =
        i === 0
          ? 0
          : Math.sin(x / (180 * dpr) + phase) * 10 * dpr +
            Math.sin(x / (61 * dpr) + phase * 2) * 4 * dpr;
      ctx.lineTo(x, y0 + wave);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });
  const specks = Math.round((width * depth) / (90 * dpr * dpr));
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = random.chance(0.5) ? look.speckLight : look.speckDark;
    const s = random.float(0.6, 2.2) * dpr;
    ctx.fillRect(
      random.float(0, width),
      random.float(surface, height),
      s,
      s * random.float(0.6, 1),
    );
  }
  const pebbles = Math.round(width / (22 * dpr));
  for (let i = 0; i < pebbles; i++) {
    paintPebble(
      ctx,
      random.float(0, width),
      random.float(surface + 12 * dpr, height),
      random.float(0.08, 0.3) * layout.scenery,
      look,
      random,
    );
  }
}

export function paintPebble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  look: Look,
  random: Rng,
): void {
  const tilt = random.float(-0.6, 0.6);
  ctx.fillStyle = look.pebbleShade;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.12, r, r * 0.68, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.pebble;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.06, y - r * 0.04, r * 0.9, r * 0.58, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.22, r * 0.32, r * 0.16, tilt, 0, Math.PI * 2);
  ctx.fill();
}

/** Roots hanging down from the grass, branching as they go; the glowing look adds fungi. */
function paintRoots(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, random: Rng): void {
  const { width, height, surface, dpr } = layout;
  const cell = layout.scenery;
  const count = Math.max(6, Math.round(width / (150 * dpr)));
  const tips: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = ((i + random.float(0.2, 0.8)) / count) * width;
    root(
      x,
      surface,
      random.float(0.14, 0.24) * cell,
      random.float(0.3, 0.75) * (height - surface),
      0,
    );
  }
  function root(x: number, y: number, thickness: number, length: number, depth: number): void {
    let angle = Math.PI / 2 + random.float(-0.35, 0.35);
    let px = x;
    let py = y;
    const steps = Math.max(4, Math.round(length / (14 * dpr)));
    for (let s = 0; s < steps; s++) {
      angle += random.float(-0.28, 0.28);
      angle = Math.min(Math.PI * 0.85, Math.max(Math.PI * 0.15, angle));
      const nx = px + Math.cos(angle) * (length / steps);
      const ny = py + Math.sin(angle) * (length / steps);
      const t = thickness * (1 - s / steps) + dpr * 0.8;
      ctx.strokeStyle = look.rootShade;
      ctx.lineWidth = t + dpr * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.strokeStyle = look.rootColour;
      ctx.lineWidth = t;
      ctx.stroke();
      if (depth < 2 && random.chance(0.16))
        root(nx, ny, t * 0.6, length * random.float(0.25, 0.45), depth + 1);
      px = nx;
      py = ny;
    }
    tips.push({ x: px, y: py });
  }
  if (look.fungus.length > 0) {
    for (const tip of tips) {
      if (!random.chance(0.22)) continue;
      paintFungus(
        ctx,
        tip.x + random.float(-8, 8) * dpr,
        tip.y,
        random.float(0.28, 0.4) * cell,
        random.pick(look.fungus),
      );
    }
  }
}

/** A little glowing toadstool cluster for the night look: domed caps on short, stout stems. */
function paintFungus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string,
): void {
  ctx.save();
  const halo = ctx.createRadialGradient(x, y - size * 0.6, 0, x, y - size * 0.6, size * 2.2);
  halo.addColorStop(0, withAlpha(colour, 0.35));
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = halo;
  ctx.fillRect(x - size * 2.2, y - size * 2.8, size * 4.4, size * 4.4);
  ctx.globalAlpha = 1;
  ctx.shadowColor = colour;
  ctx.shadowBlur = size * 1.2;
  for (let i = 0; i < 3; i++) {
    const cx = x + (i - 1) * size * 0.62;
    const s = size * (i === 1 ? 1 : 0.68);
    ctx.fillStyle = 'rgba(232, 226, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, y - s * 0.32, s * 0.16, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(cx, y - s * 0.62, s * 0.44, s * 0.4, 0, Math.PI, 0);
    ctx.quadraticCurveTo(cx, y - s * 0.5, cx - s * 0.44, y - s * 0.62);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(cx - s * 0.16, y - s * 0.82, s * 0.07, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.13, y - s * 0.9, s * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The grass along the surface: a band, then blades, with flowers by day and glowing tips by night. */
function paintGrass(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, random: Rng): void {
  const { width, surface, dpr } = layout;
  const cell = layout.scenery;
  ctx.fillStyle = look.grassDark;
  ctx.beginPath();
  ctx.moveTo(0, surface + cell * 0.18);
  for (let x = 0; x <= width; x += 10 * dpr)
    ctx.lineTo(x, surface - cell * 0.08 + Math.sin(x / (37 * dpr)) * dpr * 2);
  ctx.lineTo(width, surface + cell * 0.18);
  ctx.closePath();
  ctx.fill();
  for (let x = 0; x < width; x += random.float(2.2, 4.2) * dpr) {
    const h = random.float(0.22, 0.62) * cell;
    const lean = random.float(-0.35, 0.35) * h;
    ctx.strokeStyle = random.chance(0.4) ? look.grassDark : look.grass;
    ctx.lineWidth = random.float(1.4, 2.6) * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, surface + cell * 0.05);
    ctx.quadraticCurveTo(x + lean * 0.2, surface - h * 0.6, x + lean, surface - h);
    ctx.stroke();
    if (random.chance(look.dark ? 0.06 : 0.12)) {
      ctx.fillStyle = look.grassTip;
      ctx.beginPath();
      ctx.arc(x + lean, surface - h, dpr * (look.dark ? 1.4 : 1.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!look.dark) {
    const flowers = ['#ffffff', '#ffd35a', '#ff9fc4', '#b9a2ff'];
    for (let i = 0; i < Math.round(width / (70 * dpr)); i++) {
      const x = random.float(0, width);
      const h = random.float(0.5, 0.95) * cell;
      ctx.strokeStyle = look.grassDark;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, surface);
      ctx.lineTo(x + random.float(-3, 3) * dpr, surface - h);
      ctx.stroke();
      const colour = random.pick(flowers);
      const r = cell * random.float(0.07, 0.11);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, surface - h + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f2b233';
      ctx.beginPath();
      ctx.arc(x, surface - h, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The box: a bed of loose, darker-edged loam with a soft shade under its top rim. */
function paintBed(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, random: Rng): void {
  const { left, top, cell, cols, rows, dpr } = layout;
  const w = cols * cell;
  const h = rows * cell;
  const r = cell * 0.22;
  // A frame of packed earth around the box.
  ctx.fillStyle = look.bedEdge;
  roundRect(ctx, left - cell * 0.14, top - cell * 0.14, w + cell * 0.28, h + cell * 0.28, r * 1.4);
  ctx.fill();
  ctx.fillStyle = look.bed;
  roundRect(ctx, left, top, w, h, r);
  ctx.fill();
  ctx.save();
  roundRect(ctx, left, top, w, h, r);
  ctx.clip();
  const specks = Math.round((w * h) / (70 * dpr * dpr));
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = random.chance(0.55) ? look.speckLight : look.speckDark;
    const s = random.float(0.6, 1.8) * dpr;
    ctx.fillRect(left + random.float(0, w), top + random.float(0, h), s, s);
  }
  const shade = ctx.createLinearGradient(0, top, 0, top + cell * 1.2);
  shade.addColorStop(0, look.dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(70, 36, 14, 0.32)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(left, top, w, cell * 1.2);
  ctx.restore();
  ctx.strokeStyle = look.bedRim;
  ctx.lineWidth = 1.5 * dpr;
  roundRect(ctx, left + dpr, top + dpr, w - 2 * dpr, h - 2 * dpr, r);
  ctx.stroke();
}

function paintGrid(ctx: CanvasRenderingContext2D, layout: Layout, look: Look): void {
  const { left, top, cell, cols, rows, dpr } = layout;
  ctx.strokeStyle = look.grid;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.beginPath();
  for (let x = 1; x < cols; x++) {
    ctx.moveTo(left + x * cell, top + cell * 0.1);
    ctx.lineTo(left + x * cell, top + rows * cell - cell * 0.1);
  }
  for (let y = 1; y < rows; y++) {
    ctx.moveTo(left + cell * 0.1, top + y * cell);
    ctx.lineTo(left + cols * cell - cell * 0.1, top + y * cell);
  }
  ctx.stroke();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
