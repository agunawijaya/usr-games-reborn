import { createRng, type Rng } from '@usr-games/kit';
import type { Layout } from './layout';
import { darken, type Look, lighten, withAlpha } from './look';

/**
 * The sea around the tank. What never moves (the water's colour, the back glass, the sand and its
 * pebbles, the far rocks) is painted once per size and look and kept. What moves is drawn every
 * frame: the caustic light (computed small and scaled up), the light rays, the plants swaying at
 * the sides, fish crossing behind the tank, and by night the marine snow and the plankton.
 */

const cache = new Map<string, HTMLCanvasElement>();

export function backdrop(layout: Layout, look: Look, seed: string): HTMLCanvasElement {
  const key = [
    layout.width,
    layout.height,
    layout.cell,
    layout.left,
    layout.top,
    look.id,
    seed,
  ].join(':');
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d')!;
  const random = createRng(`sea:${seed}`);
  paintWater(ctx, layout, look);
  paintBackGlass(ctx, layout, look, random.split('glass'));
  paintFarRocks(ctx, layout, look, random.split('rocks'));
  paintSand(ctx, layout, look, random.split('sand'));
  if (cache.size > 8) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

function paintWater(ctx: CanvasRenderingContext2D, layout: Layout, look: Look): void {
  const water = ctx.createLinearGradient(0, 0, 0, layout.floor);
  water.addColorStop(0, look.waterTop);
  water.addColorStop(0.55, look.waterMid);
  water.addColorStop(1, look.waterDeep);
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, layout.width, layout.height);
  // The surface far above: a band of light at the very top.
  const surface = ctx.createLinearGradient(0, 0, 0, layout.height * 0.18);
  surface.addColorStop(0, withAlpha(look.caustic, look.dark ? 0.12 : 0.45));
  surface.addColorStop(1, withAlpha(look.caustic, 0));
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, layout.width, layout.height * 0.18);
}

/** Faint streaks and seams on the aquarium's back wall, so the water has something behind it. */
function paintBackGlass(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  random: Rng,
): void {
  ctx.save();
  ctx.globalAlpha = look.dark ? 0.05 : 0.08;
  ctx.strokeStyle = look.caustic;
  for (let i = 0; i < 14; i++) {
    const x = random.float(0, layout.width);
    ctx.lineWidth = random.float(1, 6) * layout.dpr;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + random.float(-40, 40) * layout.dpr, layout.floor);
    ctx.stroke();
  }
  ctx.restore();
}

/** Soft rounded rocks far back on the sand, half lost in the water. */
function paintFarRocks(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  random: Rng,
): void {
  const s = layout.scenery;
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const x = random.float(0, layout.width);
    if (
      Math.abs(x - (layout.left + (layout.cols * layout.cell) / 2)) <
      layout.cols * layout.cell * 0.55
    )
      continue;
    const w = random.float(1.6, 4.2) * s;
    const h = w * random.float(0.4, 0.75);
    ctx.fillStyle = withAlpha(
      look.dark ? lighten(look.waterDeep, 0.08) : darken(look.waterDeep, 0.15),
      0.55,
    );
    ctx.beginPath();
    ctx.ellipse(x, layout.floor + s * 0.1, w / 2, h, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

function paintSand(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, random: Rng): void {
  const top = layout.floor;
  const s = layout.scenery;
  ctx.save();
  // A gently rolling edge, then bands down to the bottom.
  ctx.beginPath();
  ctx.moveTo(0, layout.height);
  for (let x = 0; x <= layout.width; x += 8 * layout.dpr)
    ctx.lineTo(x, top + Math.sin(x / (s * 3.1)) * s * 0.12 + Math.sin(x / (s * 1.3)) * s * 0.05);
  ctx.lineTo(layout.width, layout.height);
  ctx.closePath();
  const sand = ctx.createLinearGradient(0, top, 0, layout.height);
  sand.addColorStop(0, look.sand[0]);
  sand.addColorStop(0.45, look.sand[1]);
  sand.addColorStop(1, look.sand[2]);
  ctx.fillStyle = sand;
  ctx.fill();
  ctx.clip();
  // Ripples the water has combed into it.
  ctx.strokeStyle = withAlpha(look.sandShade, look.dark ? 0.35 : 0.28);
  ctx.lineWidth = Math.max(1, layout.dpr * 1.4);
  for (let i = 0; i < 46; i++) {
    const x = random.float(-s, layout.width);
    const y = random.float(top + s * 0.25, layout.height);
    const w = random.float(1.2, 3.4) * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - s * 0.12, x + w, y);
    ctx.stroke();
  }
  // Pebbles and the odd shell.
  for (let i = 0; i < 70; i++) {
    const x = random.float(0, layout.width);
    const y = random.float(top + s * 0.15, layout.height - s * 0.1);
    const r = random.float(0.06, 0.2) * s;
    ctx.fillStyle = withAlpha(look.sandShade, 0.35);
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y + r * 0.35, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = random.pick(look.pebble);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, random.float(-0.4, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// —— what moves ——

let causticBuffer: { canvas: HTMLCanvasElement; image: ImageData } | null = null;
const CAUSTIC_W = 192;
const CAUSTIC_H = 108;

/**
 * Light rippling through the water: the well-known folded-sine caustic pattern, computed on a
 * small canvas and stretched over the sea, brightest near the surface.
 */
export function drawCaustics(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  time: number,
): void {
  if (!causticBuffer) {
    const canvas = document.createElement('canvas');
    canvas.width = CAUSTIC_W;
    canvas.height = CAUSTIC_H;
    causticBuffer = {
      canvas,
      image: canvas.getContext('2d')!.createImageData(CAUSTIC_W, CAUSTIC_H),
    };
  }
  const { canvas, image } = causticBuffer;
  const data = image.data;
  const [r, g, b] = rgbOf(look.caustic);
  const t = time * 0.5 + 23;
  for (let py = 0; py < CAUSTIC_H; py++) {
    const fade = Math.pow(1 - py / CAUSTIC_H, 1.4);
    for (let px = 0; px < CAUSTIC_W; px++) {
      let x = (px / CAUSTIC_W) * 6.28 * 2 - 250;
      let y = (py / CAUSTIC_H) * 6.28 * 1.2 - 250;
      let c = 1;
      const intensity = 0.005;
      for (let n = 0; n < 3; n++) {
        const tn = t * (1 - 3.5 / (n + 1));
        const ix = x + Math.cos(tn - x) + Math.sin(tn + y);
        const iy = y + Math.sin(tn - y) + Math.cos(tn + x);
        c +=
          1 / Math.hypot(x / (Math.sin(ix + tn) / intensity), y / (Math.cos(iy + tn) / intensity));
        x = ix;
        y = iy;
      }
      c /= 3;
      c = 1.17 - Math.pow(c, 1.4);
      const v = Math.pow(Math.abs(c), 8);
      const i = (py * CAUSTIC_W + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.min(255, v * 255 * look.causticStrength * fade * 2.2);
    }
  }
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = look.dark ? 'lighter' : 'screen';
  ctx.drawImage(canvas, 0, 0, layout.width, layout.floor);
  ctx.restore();
}

function rgbOf(colour: string): [number, number, number] {
  const n = Number.parseInt(colour.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Slanting shafts of light from the surface, swaying slowly. */
export function drawRays(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  time: number,
  still: boolean,
): void {
  const t = still ? 0 : time;
  ctx.save();
  ctx.globalCompositeOperation = look.dark ? 'lighter' : 'screen';
  for (let i = 0; i < 7; i++) {
    const base = (i / 7 + 0.07) * layout.width;
    const sway = Math.sin(t * 0.21 + i * 1.7) * layout.width * 0.02;
    const w = layout.width * (0.035 + (i % 3) * 0.018);
    const x0 = base + sway;
    const x1 = base + sway - layout.width * 0.12;
    const shaft = ctx.createLinearGradient(0, 0, 0, layout.floor);
    const strength = look.rayStrength * (0.6 + 0.4 * Math.sin(t * 0.37 + i * 2.3));
    shaft.addColorStop(0, withAlpha(look.ray, strength));
    shaft.addColorStop(0.75, withAlpha(look.ray, strength * 0.25));
    shaft.addColorStop(1, withAlpha(look.ray, 0));
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x0 - w / 2, 0);
    ctx.lineTo(x0 + w / 2, 0);
    ctx.lineTo(x1 + w * 1.2, layout.floor);
    ctx.lineTo(x1 - w * 1.2, layout.floor);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

interface Blade {
  x: number;
  height: number;
  width: number;
  phase: number;
  colour: string;
  lean: number;
}

interface Garden {
  blades: Blade[];
  leafy: { x: number; height: number; phase: number; colour: string }[];
}

const gardens = new Map<string, Garden>();

/** The plants at the sides: ribbons of kelp and grass, and a few stems with round leaves. */
function gardenFor(layout: Layout, look: Look, seed: string): Garden {
  const key = [layout.width, layout.height, layout.left, layout.cell, look.id, seed].join(':');
  const known = gardens.get(key);
  if (known) return known;
  const random = createRng(`plants:${seed}`);
  const s = layout.scenery;
  const tankLeft = layout.left - s * 0.8;
  const tankRight = layout.left + layout.cols * layout.cell + s * 0.8;
  const blades: Blade[] = [];
  const leafy: Garden['leafy'] = [];
  const clumps = Math.round(layout.width / (s * 2.6));
  for (let i = 0; i < clumps; i++) {
    const x = random.float(0, layout.width);
    if (x > tankLeft && x < tankRight) continue;
    const tall = random.chance(0.45);
    for (let k = 0; k < random.int(3, 7); k++) {
      blades.push({
        x: x + random.float(-0.5, 0.5) * s,
        height: (tall ? random.float(4, 9) : random.float(1, 2.6)) * s,
        width: random.float(0.14, 0.3) * s * (tall ? 1.2 : 0.8),
        phase: random.float(0, Math.PI * 2),
        colour: random.pick(look.plant),
        lean: random.float(-0.4, 0.4),
      });
    }
    if (random.chance(0.3))
      leafy.push({
        x: x + random.float(-1, 1) * s,
        height: random.float(2.5, 5) * s,
        phase: random.float(0, 6),
        colour: random.pick(look.plant),
      });
  }
  const garden = { blades, leafy };
  if (gardens.size > 8) gardens.clear();
  gardens.set(key, garden);
  return garden;
}

export function drawPlants(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  seed: string,
  time: number,
  still: boolean,
): void {
  const garden = gardenFor(layout, look, seed);
  const t = still ? 0 : time;
  const s = layout.scenery;
  ctx.save();
  for (const blade of garden.blades) {
    const sway = (h: number) =>
      (Math.sin(t * 0.9 + blade.phase + h * 0.002) * 0.35 + blade.lean) * h * 0.18;
    const base = layout.floor + s * 0.15;
    const segments = 10;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let k = 0; k <= segments; k++) {
      const h = (k / segments) * blade.height;
      const w = blade.width * (1 - (k / segments) * 0.85);
      const x = blade.x + sway(h) * (k / segments);
      left.push([x - w / 2, base - h]);
      right.push([x + w / 2, base - h]);
    }
    const ribbon = ctx.createLinearGradient(0, base - blade.height, 0, base);
    ribbon.addColorStop(
      0,
      look.dark ? withAlpha(look.plantTip, 0.55) : lighten(blade.colour, 0.25),
    );
    ribbon.addColorStop(0.35, blade.colour);
    ribbon.addColorStop(1, darken(blade.colour, look.dark ? 0.2 : 0.3));
    ctx.fillStyle = ribbon;
    ctx.beginPath();
    ctx.moveTo(left[0]![0], left[0]![1]);
    for (const [x, y] of left) ctx.lineTo(x, y);
    for (const [x, y] of right.reverse()) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }
  for (const plant of garden.leafy) {
    const base = layout.floor + s * 0.1;
    ctx.strokeStyle = darken(plant.colour, 0.2);
    ctx.lineWidth = s * 0.06;
    const top = { x: plant.x + Math.sin(t * 0.7 + plant.phase) * s * 0.4, y: base - plant.height };
    ctx.beginPath();
    ctx.moveTo(plant.x, base);
    ctx.quadraticCurveTo(plant.x, base - plant.height * 0.5, top.x, top.y);
    ctx.stroke();
    for (let k = 1; k <= 6; k++) {
      const f = k / 6;
      const x = plant.x + (top.x - plant.x) * f * f;
      const y = base - plant.height * f;
      for (const side of [-1, 1]) {
        ctx.fillStyle = side < 0 ? plant.colour : lighten(plant.colour, 0.15);
        ctx.beginPath();
        ctx.ellipse(x + side * s * 0.22, y, s * 0.22, s * 0.13, side * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (look.dark && k % 2 === 0) {
        ctx.fillStyle = withAlpha(look.plantTip, 0.5 + 0.3 * Math.sin(t * 1.3 + k + plant.phase));
        ctx.beginPath();
        ctx.arc(x, y, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Fish crossing the sea behind the tank, each on its own lap; by night, lantern-fish. */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  time: number,
  still: boolean,
): void {
  const s = layout.scenery;
  const t = still ? 7 : time;
  const count = look.dark ? 4 : 7;
  for (let i = 0; i < count; i++) {
    const seed = i * 7.31;
    const speed = (0.025 + (i % 4) * 0.012) * layout.width;
    const going = i % 2 === 0 ? 1 : -1;
    const span = layout.width + s * 6;
    const travelled = (((t * speed + seed * 997) % span) + span) % span;
    const x = going > 0 ? travelled - s * 3 : layout.width + s * 3 - travelled;
    const y = layout.height * (0.16 + ((seed * 13.7) % 1) * 0.55) + Math.sin(t * 1.1 + i) * s * 0.3;
    const size = s * (0.3 + (i % 3) * 0.12) * (look.dark ? 1.3 : 1);
    // Crossing behind the tank, a fish is seen through two panes of glass and a tank of water:
    // faint, so it never passes for something in play.
    ctx.globalAlpha = 1 - behindTank(layout, x, s) * (look.dark ? 0.6 : 0.68);
    paintFish(ctx, x, y, size, going, look.fish[i % look.fish.length]!, look, t + i);
    ctx.globalAlpha = 1;
  }
}

/** 1 well behind the tank, 0 clear of it, easing across a fish's length at either side. */
function behindTank(layout: Layout, x: number, s: number): number {
  const from = layout.left;
  const to = layout.left + layout.cols * layout.cell;
  const outside = Math.max(from - x, x - to, 0);
  const inside = Math.min(x - from, to - x);
  if (outside > 0) return Math.max(0, 1 - outside / s);
  return Math.min(1, 1 + inside / s);
}

function paintFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  going: number,
  colour: string,
  look: Look,
  t: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(going, 1);
  const wag = Math.sin(t * 9) * 0.25;
  if (look.dark) {
    // A lantern-fish: a dark body and a lure that glows ahead of it.
    const lure = { x: size * 1.4, y: -size * 0.75 };
    const glow = ctx.createRadialGradient(lure.x, lure.y, 0, lure.x, lure.y, size * 1.6);
    glow.addColorStop(0, withAlpha(colour, 0.55));
    glow.addColorStop(1, withAlpha(colour, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(lure.x - size * 1.6, lure.y - size * 1.6, size * 3.2, size * 3.2);
    ctx.strokeStyle = withAlpha(colour, 0.5);
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.moveTo(size * 0.6, -size * 0.3);
    ctx.quadraticCurveTo(size * 1.2, -size * 1.0, lure.x, lure.y);
    ctx.stroke();
    ctx.fillStyle = '#fff8d8';
    ctx.beginPath();
    ctx.arc(lure.x, lure.y, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
    colour = '#1a2550';
  }
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size * 0.8, 0);
  ctx.lineTo(-size * 1.55, -size * (0.45 + wag));
  ctx.lineTo(-size * 1.55, size * (0.45 - wag));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.dark ? '#cfe8ff' : '#ffffff';
  ctx.beginPath();
  ctx.arc(size * 0.5, -size * 0.12, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10203a';
  ctx.beginPath();
  ctx.arc(size * 0.55, -size * 0.12, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** By night: marine snow drifting down, and plankton winking near the bottom. */
export function drawSnow(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  time: number,
  still: boolean,
): void {
  if (!look.snow) return;
  const t = still ? 5 : time;
  const count = Math.round((layout.width * layout.height) / (9000 * layout.dpr * layout.dpr));
  ctx.save();
  for (let i = 0; i < count; i++) {
    const h1 = fract(Math.sin(i * 12.9898) * 43758.5453);
    const h2 = fract(Math.sin(i * 78.233) * 12345.678);
    const fallSpeed = 0.006 + h2 * 0.012;
    const x =
      (h1 * layout.width + Math.sin(t * 0.3 + i) * layout.dpr * 12 + layout.width) % layout.width;
    const y = ((((h2 + t * fallSpeed) % 1) + 1) % 1) * layout.floor;
    const r = (0.6 + h1 * 1.6) * layout.dpr;
    ctx.fillStyle = withAlpha(look.snow, 0.25 + h2 * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.plankton) {
    for (let i = 0; i < 40; i++) {
      const h1 = fract(Math.sin(i * 91.7) * 4375.85);
      const h2 = fract(Math.sin(i * 17.3) * 9123.4);
      const x = h1 * layout.width;
      const y = layout.floor - h2 * layout.height * 0.35 + Math.sin(t * 0.5 + i) * layout.dpr * 6;
      const blink = 0.3 + 0.7 * Math.max(0, Math.sin(t * 1.4 + i * 2.1));
      ctx.fillStyle = withAlpha(look.plankton, 0.6 * blink);
      ctx.beginPath();
      ctx.arc(x, y, layout.dpr * (1.2 + h2 * 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fract(v: number): number {
  return v - Math.floor(v);
}
