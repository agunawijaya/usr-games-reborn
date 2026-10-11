import type { Layout } from '../layout';
import { alpha, createLayer, glow, type Layer, roundRect, scatter } from '../paint';
import type { SprintPalette } from './palette';

/**
 * The stadium behind the track, painted once per size and look: sky, roof, floodlights, the
 * stands, and the crowd in rows (kept as separate strips so they can bob and cheer), and the
 * scoreboard housing the problem text sits on.
 */

export interface Stadium {
  readonly back: Layer;
  readonly rows: readonly CrowdRow[];
  /** Over the crowd: shade under the roof, haze over the far rows, floodlight glow at night. */
  readonly air: Layer;
  readonly front: Layer;
  readonly lights: readonly { x: number; y: number }[];
  readonly standsTop: number;
}

export interface CrowdRow {
  readonly layer: Layer;
  readonly y: number;
  /** Bigger at the front: how far a cheer lifts this row. */
  readonly lift: number;
  /** Where camera flashes may pop in this row. */
  readonly seats: readonly number[];
}

function standsTopOf(layout: Layout): number {
  return layout.horizon - layout.height * 0.3;
}

export function paintStadium(
  layout: Layout,
  palette: SprintPalette,
  dark: boolean,
  scale: number,
): Stadium {
  const { width, height, s } = layout;
  const standsTop = standsTopOf(layout);
  const back = createLayer(width, layout.horizon + 4, scale);
  paintSky(back.ctx, layout, palette, dark, standsTop);
  paintRoof(back.ctx, layout, palette, dark, standsTop);
  paintTiers(back.ctx, layout, palette, standsTop);
  const lights = dark ? floodlightBanks(layout, standsTop) : [];

  const rows: CrowdRow[] = [];
  const top = standsTop + 22 * s;
  const bottom = layout.horizon - 30 * s;
  const random = scatter(dark ? 917 : 331);
  let y = bottom;
  for (let row = 0; y > top + 8 * s; row++) {
    const size = 7.2 * s * Math.max(0.6, 1 - row * 0.045);
    rows.push(paintCrowdRow(width, y, size, palette, dark, random, scale));
    y -= size * 3.1;
  }

  const air = createLayer(width, layout.horizon, scale);
  paintAir(air.ctx, layout, palette, dark, standsTop, lights);
  const front = createLayer(width, height, scale);
  paintWall(front.ctx, layout, palette, dark);
  return { back, rows: rows.reverse(), air, front, lights, standsTop };
}

function paintSky(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: SprintPalette,
  dark: boolean,
  standsTop: number,
) {
  const { width, s } = layout;
  const sky = ctx.createLinearGradient(0, 0, 0, standsTop);
  palette.sky.forEach((color, i) => sky.addColorStop(i / (palette.sky.length - 1), color));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, standsTop + 2);
  const random = scatter(dark ? 41 : 7);
  if (dark) {
    for (let i = 0; i < 160; i++) {
      const x = random() * width;
      const y = random() * standsTop * 0.8;
      ctx.fillStyle = palette.star;
      ctx.globalAlpha = 0.25 + random() * 0.6;
      ctx.fillRect(x, y, 1.4 * s + random() * s, 1.4 * s + random() * s);
    }
    ctx.globalAlpha = 1;
    glow(ctx, width * 0.5, standsTop, width * 0.55, palette.haze, 1);
    return;
  }
  glow(ctx, width * 0.86, standsTop * 0.15, 360 * s, palette.sun, 1);
  for (let i = 0; i < 7; i++) {
    const x = random() * width;
    const y = standsTop * (0.12 + random() * 0.55);
    paintCloud(ctx, x, y, (70 + random() * 90) * s, palette.cloud, random);
  }
}

function paintCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  random: () => number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const puffs = 5 + Math.floor(random() * 3);
  for (let i = 0; i < puffs; i++) {
    const px = x + (i - puffs / 2) * size * 0.38;
    const py = y - Math.sin((i / (puffs - 1)) * Math.PI) * size * 0.28;
    ctx.moveTo(px + size * 0.32, py);
    ctx.arc(px, py, size * (0.26 + random() * 0.12), 0, Math.PI * 2);
  }
  ctx.ellipse(x, y + size * 0.06, size * 1.05, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintRoof(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: SprintPalette,
  dark: boolean,
  standsTop: number,
) {
  const { width, s } = layout;
  const roofBottom = standsTop + 6 * s;
  const roofTop = standsTop - 64 * s;
  // The canopy seen from below: a slab with its underside in shade and a truss along the edge.
  ctx.fillStyle = palette.roofShade;
  ctx.fillRect(0, roofTop, width, roofBottom - roofTop);
  ctx.fillStyle = palette.roof;
  ctx.fillRect(0, roofTop, width, 18 * s);
  ctx.strokeStyle = palette.truss;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  const bay = 46 * s;
  for (let x = 0; x < width + bay; x += bay) {
    ctx.moveTo(x, roofTop + 18 * s);
    ctx.lineTo(x + bay / 2, roofBottom - 4 * s);
    ctx.lineTo(x + bay, roofTop + 18 * s);
  }
  ctx.moveTo(0, roofBottom - 4 * s);
  ctx.lineTo(width, roofBottom - 4 * s);
  ctx.stroke();
  if (!dark) return;
  for (const bank of floodlightBanks(layout, standsTop)) {
    glow(ctx, bank.x, bank.y, 150 * s, 'rgba(210, 228, 255, 0.55)');
    const cells = 7;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < cells; col++) {
        const cx = bank.x + (col - (cells - 1) / 2) * 15 * s;
        const cy = bank.y + (row - 0.5) * 13 * s;
        roundRect(ctx, cx - 6 * s, cy - 5 * s, 12 * s, 10 * s, 2 * s);
        ctx.fillStyle = palette.light;
        ctx.fill();
      }
    }
    glow(ctx, bank.x, bank.y, 60 * s, 'rgba(255,255,255,0.9)');
  }
}

function floodlightBanks(layout: Layout, standsTop: number) {
  const y = standsTop - 30 * layout.s;
  return [0.07, 0.29, 0.71, 0.93].map((f) => ({ x: layout.width * f, y }));
}

function paintTiers(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: SprintPalette,
  standsTop: number,
) {
  const { width, horizon, s } = layout;
  ctx.fillStyle = palette.standBack;
  ctx.fillRect(0, standsTop + 6 * s, width, horizon - standsTop);
  ctx.fillStyle = palette.standStep;
  for (let y = standsTop + 20 * s; y < horizon; y += 22 * s) ctx.fillRect(0, y, width, 3 * s);
  // Aisles: stairs cutting through the stands every few metres.
  ctx.fillStyle = alpha(palette.standStep.startsWith('#') ? palette.standStep : '#888888', 0.9);
  for (let x = 140 * s; x < width; x += 330 * s)
    ctx.fillRect(x, standsTop + 6 * s, 16 * s, horizon - standsTop);
}

function paintCrowdRow(
  width: number,
  y: number,
  size: number,
  palette: SprintPalette,
  dark: boolean,
  random: () => number,
  scale: number,
): CrowdRow {
  const height = size * 5.2;
  const layer = createLayer(width, height, scale);
  const ctx = layer.ctx;
  const base = height - size * 0.4;
  const seats: number[] = [];
  const spacing = size * 2.15;
  for (let x = random() * spacing; x < width; x += spacing * (0.85 + random() * 0.4)) {
    // Gaps where an aisle runs, and the odd empty seat.
    if (random() < 0.07) continue;
    const shirt = palette.crowd[Math.floor(random() * palette.crowd.length)]!;
    const lit = dark ? 0.42 + random() * 0.3 : 0.62 + random() * 0.25;
    const skin = palette.crowdSkin[Math.floor(random() * palette.crowdSkin.length)]!;
    const bob = (random() - 0.5) * size * 0.5;
    const shoulders = base + bob;
    ctx.fillStyle = alpha(shirt, lit);
    roundRect(ctx, x - size * 1.05, shoulders - size * 1.3, size * 2.1, size * 1.7, size * 0.7);
    ctx.fill();
    ctx.fillStyle = dark ? alpha(skin, lit + 0.1) : skin;
    ctx.beginPath();
    ctx.arc(x, shoulders - size * 1.85, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
    if (random() < 0.55) {
      ctx.fillStyle = dark ? 'rgba(10,10,14,0.8)' : '#2b2220';
      ctx.beginPath();
      ctx.arc(x, shoulders - size * 1.95, size * 0.74, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    }
    if (random() < 0.12) {
      // Arms up: a fan on their feet.
      ctx.strokeStyle = dark ? alpha(skin, 0.7) : skin;
      ctx.lineWidth = size * 0.42;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - size * 0.8, shoulders - size * 1.1);
      ctx.lineTo(x - size * 1.15, shoulders - size * 3.1);
      ctx.moveTo(x + size * 0.8, shoulders - size * 1.1);
      ctx.lineTo(x + size * 1.15, shoulders - size * 3.1);
      ctx.stroke();
    } else if (random() < (dark ? 0.025 : 0.06)) {
      // A small flag in a lane colour.
      ctx.strokeStyle = dark ? '#8aa0bf' : '#555';
      ctx.lineWidth = size * 0.18;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.9, shoulders - size * 0.9);
      ctx.lineTo(x + size * 1.2, shoulders - size * 4.1);
      ctx.stroke();
      ctx.fillStyle = palette.confetti[Math.floor(random() * palette.confetti.length)]!;
      ctx.fillRect(x + size * 1.2, shoulders - size * 4.1, size * 1.8, size * 1.1);
    }
    if (dark && random() < 0.5) {
      // Floodlight catching the top of a head.
      ctx.strokeStyle = 'rgba(200, 220, 255, 0.35)';
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.arc(x, shoulders - size * 1.85, size * 0.66, Math.PI * 1.15, Math.PI * 1.75);
      ctx.stroke();
    }
    seats.push(x);
  }
  return { layer, y: y - height + size * 0.4, lift: size * 0.5, seats };
}

function paintWall(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: SprintPalette,
  dark: boolean,
) {
  const { width, horizon, s } = layout;
  const top = horizon - 26 * s;
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, top, width, horizon - top + 1);
  ctx.fillStyle = palette.wallStripe;
  ctx.fillRect(0, top + 8 * s, width, 4 * s);
  if (dark) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const strip = ctx.createLinearGradient(0, top, 0, top + 22 * s);
    strip.addColorStop(0, 'rgba(71, 209, 255, 0)');
    strip.addColorStop(0.45, 'rgba(71, 209, 255, 0.35)');
    strip.addColorStop(1, 'rgba(71, 209, 255, 0)');
    ctx.fillStyle = strip;
    ctx.fillRect(0, top, width, 22 * s);
    ctx.restore();
  }
}

function paintAir(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: SprintPalette,
  dark: boolean,
  standsTop: number,
  lights: readonly { x: number; y: number }[],
) {
  const { width, horizon, s } = layout;
  // The roof's shadow falls across the back rows.
  const shade = ctx.createLinearGradient(0, standsTop, 0, horizon);
  shade.addColorStop(0, dark ? 'rgba(2, 6, 16, 0.62)' : 'rgba(40, 50, 70, 0.34)');
  shade.addColorStop(0.55, dark ? 'rgba(2, 6, 16, 0.25)' : 'rgba(40, 50, 70, 0.06)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, standsTop, width, horizon - standsTop);
  if (!dark) {
    // Summer haze softens the far side of the bowl.
    const haze = ctx.createLinearGradient(0, standsTop, 0, horizon);
    haze.addColorStop(0, 'rgba(214, 232, 248, 0.38)');
    haze.addColorStop(1, 'rgba(214, 232, 248, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, standsTop, width, horizon - standsTop);
    return;
  }
  // Floodlight spill: soft pools of light hanging in the night air.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const light of lights) {
    const cone = ctx.createRadialGradient(
      light.x,
      light.y,
      10 * s,
      light.x,
      light.y + 220 * s,
      420 * s,
    );
    cone.addColorStop(0, palette.beam);
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cone;
    ctx.fillRect(light.x - 440 * s, light.y, 880 * s, horizon - light.y);
  }
  ctx.restore();
}

/** The scoreboard's housing: legs to the roof, a dark face, a bezel and a row of lamps. */
export function paintScoreboard(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: SprintPalette,
  dark: boolean,
  standsTop: number,
) {
  const { board, s } = layout;
  const pad = 20 * s;
  const x = board.x - pad;
  const y = board.y - pad;
  const w = board.w + pad * 2;
  const h = board.h + pad * 2;
  // Hangers up to the roof truss.
  ctx.strokeStyle = palette.truss;
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  for (const fx of [0.18, 0.82]) {
    ctx.moveTo(x + w * fx, Math.min(y, standsTop - 40 * s));
    ctx.lineTo(x + w * fx, 0);
  }
  ctx.stroke();
  if (dark) glow(ctx, x + w / 2, y + h / 2, w * 0.75, 'rgba(255, 190, 90, 0.16)');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24 * s;
  ctx.shadowOffsetY = 8 * s;
  roundRect(ctx, x, y, w, h, 18 * s);
  ctx.fillStyle = palette.boardHousing;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x + 4 * s, y + 4 * s, w - 8 * s, h - 8 * s, 15 * s);
  ctx.strokeStyle = palette.boardBezel;
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  roundRect(ctx, board.x, board.y, board.w, board.h, 8 * s);
  ctx.fillStyle = palette.boardFace;
  ctx.fill();
  // The LED matrix behind the digits.
  ctx.save();
  roundRect(ctx, board.x, board.y, board.w, board.h, 8 * s);
  ctx.clip();
  ctx.fillStyle = palette.boardDot;
  const pitch = 7 * s;
  for (let dy = board.y + pitch / 2; dy < board.y + board.h; dy += pitch) {
    for (let dx = board.x + pitch / 2; dx < board.x + board.w; dx += pitch) {
      ctx.fillRect(dx - 1.3 * s, dy - 1.3 * s, 2.6 * s, 2.6 * s);
    }
  }
  ctx.restore();
  // Lamps along the bottom edge.
  const lamps = 14;
  for (let i = 0; i < lamps; i++) {
    const lx = x + w * ((i + 0.5) / lamps);
    const ly = y + h - pad * 0.45;
    const color = palette.boardLamp[i % palette.boardLamp.length]!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();
    if (dark) glow(ctx, lx, ly, 12 * s, alpha(color, 0.6));
  }
}
