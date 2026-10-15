import { createRng, type Rng } from '@usr-games/kit';
import type { PondLayout } from './layout';
import type { Look } from './look';

/**
 * The still parts of the pond, painted once for each size and look: the sky (a low morning sun,
 * or the moon and its stars), the tree line, the grassy banks, the basin of the pond with its
 * shore, and the trees mirrored in the far water. Everything that moves is drawn over it every
 * frame by the live layer.
 */

type Ctx = CanvasRenderingContext2D;

export function moonPosition(layout: PondLayout): { x: number; y: number; r: number } {
  return { x: layout.pond.cx - layout.pond.rx * 0.28, y: layout.horizon * 0.42, r: 34 * layout.s };
}

export function sunPosition(layout: PondLayout): { x: number; y: number } {
  return { x: layout.pond.cx - layout.pond.rx * 0.55, y: layout.horizon * 0.35 };
}

export function paintScenery(ctx: Ctx, layout: PondLayout, look: Look): void {
  const rng = createRng('gone-fishing:scenery');
  paintSky(ctx, layout, look, rng.split('sky'));
  paintTrees(ctx, layout, look, rng.split('trees'));
  paintBanks(ctx, layout, look);
  paintBushes(ctx, layout, look, rng.split('bushes'));
  paintFlowers(ctx, layout, look, rng.split('flowers'));
  paintPond(ctx, layout, look, rng.split('pond'));
  paintNearBank(ctx, layout, look, rng.split('near'));
  paintAir(ctx, layout, look);
}

function paintSky(ctx: Ctx, layout: PondLayout, look: Look, rng: Rng): void {
  const { width, horizon } = layout;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 60 * layout.s);
  sky.addColorStop(0, look.sky.top);
  sky.addColorStop(0.6, look.sky.middle);
  sky.addColorStop(1, look.sky.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 80 * layout.s);

  if (look.moon) {
    for (let i = 0; i < 160; i++) {
      const x = rng.float(0, width);
      const y = rng.float(0, horizon * 1.05);
      const r = rng.float(0.4, 1.4) * layout.s;
      ctx.globalAlpha = rng.float(0.25, 0.9) * (1 - y / (horizon * 1.3));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const moon = moonPosition(layout);
    const halo = ctx.createRadialGradient(moon.x, moon.y, moon.r, moon.x, moon.y, moon.r * 5);
    halo.addColorStop(0, look.moon.halo);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(moon.x - moon.r * 5, moon.y - moon.r * 5, moon.r * 10, moon.r * 10);
    ctx.fillStyle = look.moon.disc;
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
    ctx.fill();
    // A few soft seas on the moon's face.
    ctx.fillStyle = 'rgba(180, 170, 140, 0.25)';
    for (const [dx, dy, r] of [
      [-0.3, -0.2, 0.28],
      [0.25, 0.1, 0.22],
      [-0.05, 0.35, 0.16],
    ] as const) {
      ctx.beginPath();
      ctx.arc(moon.x + dx * moon.r, moon.y + dy * moon.r, r * moon.r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const sun = sunPosition(layout);
  const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, horizon * 2.2);
  glow.addColorStop(0, 'rgba(255, 246, 214, 0.95)');
  glow.addColorStop(0.18, 'rgba(255, 240, 200, 0.55)');
  glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, horizon + 80 * layout.s);
  // Soft morning clouds, flat underneath.
  for (let i = 0; i < 5; i++) {
    const cx = rng.float(width * 0.25, width * 0.95);
    const cy = rng.float(horizon * 0.2, horizon * 0.62);
    const w = rng.float(90, 180) * layout.s;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const bx = cx - w / 2 + (k + 0.5) * (w / 4);
      const r = (w / 5) * (0.8 + 0.5 * Math.sin(k * 2 + i));
      ctx.moveTo(bx + r, cy);
      ctx.arc(bx, cy, r, Math.PI, 0);
    }
    ctx.fill();
    ctx.fillRect(cx - w / 2, cy - 1, w, 4 * layout.s);
  }
}

/** Rows of rounded canopies along the horizon, palest and tallest at the back. */
function treeLine(
  ctx: Ctx,
  layout: PondLayout,
  rng: Rng,
  row: number,
  colour: string,
  flip = false,
): void {
  const { width, horizon, s } = layout;
  const base = horizon + (12 + row * 14) * s;
  const height = (96 - row * 18) * s;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, base);
  let x = -20 * s;
  while (x < width + 40 * s) {
    const r = rng.float(18, 44) * s * (1 - row * 0.12);
    const top = base - height * rng.float(0.55, 1);
    ctx.lineTo(x, top + r);
    ctx.arc(x + r, top + r, r, Math.PI, 0);
    x += r * rng.float(1.2, 1.8);
  }
  ctx.lineTo(width, base);
  ctx.closePath();
  if (flip) {
    ctx.save();
    ctx.translate(0, base * 2);
    ctx.scale(1, -1);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fill();
  }
}

function paintTrees(ctx: Ctx, layout: PondLayout, look: Look, rng: Rng): void {
  look.trees.forEach((colour, row) => {
    treeLine(ctx, layout, rng.split(`row${row}`), row, colour);
    // A few taller poplars rise from the middle rows, breaking the line.
    if (row === 1 || row === 2) poplars(ctx, layout, rng.split(`poplars${row}`), row, colour);
  });
}

function poplars(ctx: Ctx, layout: PondLayout, rng: Rng, row: number, colour: string): void {
  const { width, horizon, s } = layout;
  const base = horizon + (12 + row * 14) * s;
  ctx.fillStyle = colour;
  for (let i = 0; i < 4; i++) {
    const x = rng.float(0.05, 0.95) * width;
    const height = rng.float(120, 170) * s * (1 - row * 0.15);
    const half = rng.float(13, 20) * s;
    ctx.beginPath();
    ctx.moveTo(x - half, base);
    ctx.bezierCurveTo(
      x - half * 1.3,
      base - height * 0.5,
      x - half * 0.4,
      base - height,
      x,
      base - height,
    );
    ctx.bezierCurveTo(
      x + half * 0.4,
      base - height,
      x + half * 1.3,
      base - height * 0.5,
      x + half,
      base,
    );
    ctx.closePath();
    ctx.fill();
  }
}

/** Rounded shrubs along the far bank, each with a lit top and a shaded foot. */
function paintBushes(ctx: Ctx, layout: PondLayout, look: Look, rng: Rng): void {
  const { pond, s, horizon } = layout;
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const x = pond.cx + side * pond.rx * rng.float(0.55, 1.15);
    const y = Math.min(pond.farShore(x) - 6 * s, horizon + rng.float(70, 120) * s);
    const r = rng.float(22, 40) * s;
    for (let k = 0; k < 3; k++) {
      const bx = x + (k - 1) * r * 0.8;
      const by = y - (k === 1 ? r * 0.35 : 0);
      const fill = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.5, r * 0.1, bx, by, r);
      fill.addColorStop(0, look.dark ? look.grass.light : look.trees[1]!);
      fill.addColorStop(1, look.grass.shade);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(bx, by, r * (k === 1 ? 1 : 0.8), Math.PI, 0);
      ctx.lineTo(bx + r, by + r * 0.25);
      ctx.lineTo(bx - r, by + r * 0.25);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Specks of wildflowers in the grass: white and yellow by day, faint lilac by night. */
function paintFlowers(ctx: Ctx, layout: PondLayout, look: Look, rng: Rng): void {
  const { width, height, horizon, s, pond } = layout;
  const colours = look.dark ? ['#b9a6d8', '#8fa7c9'] : ['#ffffff', '#ffe36e', '#f6b3d1', '#c7b8ff'];
  for (let i = 0; i < 220; i++) {
    const x = rng.float(0, width);
    const y = rng.float(horizon + 50 * s, height);
    const inPond =
      ((x - pond.cx) / (pond.rx * 1.06)) ** 2 + ((y - pond.cy) / (pond.ry * 1.12)) ** 2 < 1;
    if (inPond) continue;
    const r = rng.float(1.6, 3.2) * s * (0.6 + (y / height) * 0.6);
    ctx.fillStyle = rng.pick(colours);
    ctx.globalAlpha = look.dark ? 0.55 : 0.9;
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Morning shafts of sunlight from the upper left; a low mist over the water at night. */
function paintAir(ctx: Ctx, layout: PondLayout, look: Look): void {
  const { width, height, pond } = layout;
  if (look.dark) {
    const mist = ctx.createLinearGradient(0, pond.cy - pond.ry * 1.2, 0, pond.cy - pond.ry * 0.4);
    mist.addColorStop(0, 'rgba(180, 200, 240, 0)');
    mist.addColorStop(0.5, 'rgba(180, 200, 240, 0.12)');
    mist.addColorStop(1, 'rgba(180, 200, 240, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, pond.cy - pond.ry * 1.2, width, pond.ry * 0.8);
    return;
  }
  const sun = sunPosition(layout);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 5; i++) {
    const angle = 0.5 + i * 0.13;
    const spread = 0.035 + (i % 2) * 0.02;
    const reach = Math.hypot(width, height);
    ctx.fillStyle = `rgba(255, 250, 225, ${0.32 - i * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(sun.x, sun.y);
    ctx.lineTo(sun.x + Math.cos(angle - spread) * reach, sun.y + Math.sin(angle - spread) * reach);
    ctx.lineTo(sun.x + Math.cos(angle + spread) * reach, sun.y + Math.sin(angle + spread) * reach);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function paintBanks(ctx: Ctx, layout: PondLayout, look: Look): void {
  const { width, height, horizon, s } = layout;
  const top = horizon + 40 * s;
  const grass = ctx.createLinearGradient(0, top, 0, height);
  grass.addColorStop(0, look.grass.mid);
  grass.addColorStop(0.35, look.grass.light);
  grass.addColorStop(1, look.grass.mid);
  ctx.fillStyle = grass;
  ctx.fillRect(0, top, width, height - top);
}

function pondPath(ctx: Ctx, layout: PondLayout, grow = 0): void {
  const { pond } = layout;
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    const p = pond.edge(angle);
    const x = p.x + Math.cos(angle) * grow;
    const y = p.y + Math.sin(angle) * grow * 0.6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function clipToPond(ctx: Ctx, layout: PondLayout): void {
  pondPath(ctx, layout);
  ctx.clip();
}

function paintPond(ctx: Ctx, layout: PondLayout, look: Look, rng: Rng): void {
  const { pond, s } = layout;
  // The muddy shore and a band of shade where the grass meets it.
  pondPath(ctx, layout, 16 * s);
  ctx.fillStyle = look.grass.shade;
  ctx.fill();
  pondPath(ctx, layout, 7 * s);
  ctx.fillStyle = look.soil;
  ctx.fill();

  pondPath(ctx, layout);
  const water = ctx.createLinearGradient(0, pond.cy - pond.ry, 0, pond.cy + pond.ry);
  water.addColorStop(0, look.water.far);
  water.addColorStop(0.45, look.water.middle);
  water.addColorStop(1, look.water.near);
  ctx.fillStyle = water;
  ctx.fill();

  ctx.save();
  clipToPond(ctx, layout);
  // The sky's light lying on the far water.
  const skyLight = ctx.createLinearGradient(0, pond.cy - pond.ry, 0, pond.cy);
  skyLight.addColorStop(0, look.dark ? 'rgba(60, 90, 140, 0.35)' : 'rgba(255, 248, 230, 0.4)');
  skyLight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = skyLight;
  ctx.fillRect(pond.cx - pond.rx * 1.1, pond.cy - pond.ry * 1.1, pond.rx * 2.2, pond.ry * 1.2);
  // Depth: darker towards the middle, where the koi swim.
  const depth = ctx.createRadialGradient(
    pond.cx,
    pond.cy + pond.ry * 0.2,
    pond.ry * 0.2,
    pond.cx,
    pond.cy,
    pond.rx,
  );
  depth.addColorStop(0, look.water.deep);
  depth.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = depth;
  ctx.fillRect(pond.cx - pond.rx, pond.cy - pond.ry, pond.rx * 2, pond.ry * 2);
  ctx.globalAlpha = look.reflection * 0.5;
  // The far trees mirrored in the water.
  const mirrored = rng.split('mirror');
  look.trees.forEach((colour, row) =>
    treeLine(ctx, layout, mirrored.split(`row${row}`), row, colour, true),
  );
  ctx.globalAlpha = 1;
  ctx.restore();

  // Pebbles along the waterline.
  for (let i = 0; i < 70; i++) {
    const angle = rng.float(0, Math.PI * 2);
    const p = pond.edge(angle);
    const r = rng.float(2.5, 7) * s;
    ctx.fillStyle = rng.chance(0.5) ? look.stone.light : look.stone.mid;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.2, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintNearBank(ctx: Ctx, layout: PondLayout, look: Look, rng: Rng): void {
  const { width, height, s } = layout;
  // Grass tufts across the near bank, denser towards the bottom.
  for (let i = 0; i < 260; i++) {
    const x = rng.float(0, width);
    const y = rng.float(height * 0.78, height);
    if (y < layout.pond.nearShore(x) + 18 * s) continue;
    tuft(
      ctx,
      x,
      y,
      rng.float(8, 18) * s,
      rng.chance(0.5) ? look.grass.shade : look.grass.light,
      rng,
    );
  }
  for (let i = 0; i < 120; i++) {
    const x = rng.float(0, width);
    const y = rng.float(layout.horizon + 46 * s, layout.pond.cy);
    if (
      y > layout.pond.farShore(x) - 12 * s &&
      Math.abs(x - layout.pond.cx) < layout.pond.rx * 1.05
    ) {
      continue;
    }
    tuft(ctx, x, y, rng.float(6, 12) * s, look.grass.shade, rng);
  }
  const shade = ctx.createLinearGradient(0, height * 0.86, 0, height);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, look.dark ? 'rgba(0, 0, 10, 0.35)' : 'rgba(30, 60, 30, 0.18)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, height * 0.86, width, height * 0.14);
}

function tuft(ctx: Ctx, x: number, y: number, size: number, colour: string, rng: Rng): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const lean = rng.float(-0.5, 0.5);
    ctx.beginPath();
    ctx.moveTo(x + k * size * 0.12, y);
    ctx.quadraticCurveTo(
      x + lean * size * 0.5,
      y - size * 0.6,
      x + lean * size,
      y - size * rng.float(0.7, 1.1),
    );
    ctx.stroke();
  }
}
