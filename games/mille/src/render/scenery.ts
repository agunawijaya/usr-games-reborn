import { type Ctx, DISPLAY_FONT, alpha, circle, fillWith, hash01, poly, roundRect } from './paint';
import type { RoadFrame, RoadGeometry } from './road';
import type { RouteId, RoutePalette } from './routes';

/**
 * The landscapes of the four roads beyond the coast, each painted in flat poster layers between
 * the horizon and the roadside: the desert's mesas and saguaros, the pass's peaks and pines, the
 * rainforest's falls and canopy, the city's towers and neon. Also each road's rail and the props
 * on its near verge. Layers repeat by a stable hash of their position, so nothing jumps as the
 * camera moves.
 */

/** Screen offset of a layer that moves at `depth` times the road's pace. */
export function layerShift(frame: RoadFrame, depth: number): number {
  return frame.left * (frame.w / frame.span) * depth;
}

/** Calls `paint` for each tile of a layer in view, with the tile's index and left edge. */
function tiles(
  frame: RoadFrame,
  depth: number,
  tile: number,
  paint: (i: number, x: number) => void,
): void {
  const shift = layerShift(frame, depth);
  const first = Math.floor(shift / tile) - 1;
  for (let i = first; i < first + Math.ceil(frame.w / tile) + 3; i++)
    paint(i, frame.x + i * tile - shift);
}

/** A rolling band of ground from `top` down to `bottom`. */
function band(
  ctx: Ctx,
  frame: RoadFrame,
  depth: number,
  top: number,
  bottom: number,
  wave: number,
  colour: string,
  salt: number,
): void {
  const shift = layerShift(frame, depth);
  ctx.beginPath();
  ctx.moveTo(frame.x - 10, bottom);
  for (let px = -10; px <= frame.w + 10; px += 10) {
    const u = (px + shift) / (frame.h * 0.9);
    ctx.lineTo(
      frame.x + px,
      top + (Math.sin(u * 1.7 + salt) * 0.5 + Math.sin(u * 0.6 + salt * 2) * 0.5) * wave,
    );
  }
  ctx.lineTo(frame.x + frame.w + 10, bottom);
  ctx.closePath();
  fillWith(ctx, colour);
}

export function paintScenery(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  // Ground right across, so nothing shows through between the props.
  ctx.fillStyle = frame.route.id === 'city' ? p.farDeep : p.sea;
  ctx.fillRect(frame.x, g.horizon - 1, frame.w, g.rail - g.horizon + 3);
  switch (frame.route.id) {
    case 'desert':
      desert(ctx, frame, p, g);
      break;
    case 'alpine':
      alpine(ctx, frame, p, g);
      break;
    case 'jungle':
      jungle(ctx, frame, p, g);
      break;
    case 'city':
      city(ctx, frame, p, g);
      break;
    default:
  }
}

// —— the desert ——

function desert(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const depthBand = g.rail - g.horizon;
  // The plain, warm toward the road.
  const plain = ctx.createLinearGradient(0, g.horizon, 0, g.rail);
  plain.addColorStop(0, p.seaLight);
  plain.addColorStop(1, p.sea);
  ctx.fillStyle = plain;
  ctx.fillRect(frame.x, g.horizon, frame.w, g.rail - g.horizon + 2);
  // Mesas on the horizon: flat tops, steep sides, a shadow face.
  tiles(frame, 0.08, frame.w * 0.2, (i, x) => {
    if (hash01(i, 101) < 0.15) return;
    const w = frame.w * (0.12 + hash01(i, 102) * 0.14);
    const hgt = depthBand * (0.24 + hash01(i, 103) * 0.26);
    const base = g.horizon + depthBand * 0.08;
    poly(ctx, [x, base, x + w * 0.12, base - hgt, x + w * 0.86, base - hgt, x + w, base]);
    fillWith(ctx, hash01(i, 104) < 0.5 ? p.far : p.farDeep);
    poly(ctx, [x + w * 0.6, base - hgt, x + w * 0.86, base - hgt, x + w, base, x + w * 0.62, base]);
    fillWith(ctx, alpha('#000000', 0.12));
    ctx.fillStyle = alpha('#000000', 0.08);
    for (let k = 1; k < 4; k++)
      ctx.fillRect(x + w * 0.1, base - hgt + (hgt * k) / 4, w * 0.8, hgt * 0.04);
  });
  // Sandstone hoodoos and arches nearer in.
  band(
    ctx,
    frame,
    0.3,
    g.horizon + depthBand * 0.62,
    g.rail + 2,
    depthBand * 0.05,
    alpha(p.hillDeep, 0.35),
    0.4,
  );
  tiles(frame, 0.35, frame.w * 0.16, (i, x) => {
    const kind = hash01(i, 111);
    const base = g.horizon + depthBand * (0.6 + hash01(i, 112) * 0.2);
    const s = depthBand * (0.38 + hash01(i, 113) * 0.2);
    if (kind < 0.35) {
      // An arch.
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x + s * 0.15, base - s);
      ctx.lineTo(x + s * 1.35, base - s);
      ctx.lineTo(x + s * 1.5, base);
      ctx.lineTo(x + s * 1.15, base);
      ctx.quadraticCurveTo(x + s * 0.75, base - s * 1.3, x + s * 0.35, base);
      ctx.closePath();
      fillWith(ctx, p.hill);
    } else if (kind < 0.7) {
      // A stack of weathered rock.
      for (let k = 0; k < 3; k++) {
        const w = s * (0.5 - k * 0.1);
        roundRect(ctx, x - w / 2 + k * s * 0.05, base - s * (k + 1) * 0.42, w, s * 0.44, s * 0.08);
        fillWith(ctx, k % 2 ? p.hillDeep : p.hill);
      }
    }
    if (hash01(i, 114) < 0.75) saguaro(ctx, x + s * 1.9, base + depthBand * 0.06, s * 0.85, p);
  });
  // Telegraph poles along the road, wires dipping between them.
  const poleGap = frame.h * 0.55;
  const shift = layerShift(frame, 0.85);
  const first = Math.floor(shift / poleGap) - 1;
  const top = g.rail - frame.h * 0.22;
  ctx.strokeStyle = alpha(frame.night ? '#c9b8d8' : '#3a2a22', 0.55);
  ctx.lineWidth = 1;
  for (let i = first; i < first + frame.w / poleGap + 3; i++) {
    const x = frame.x + i * poleGap - shift;
    ctx.fillStyle = frame.night ? '#2a1e2c' : '#6a4a32';
    ctx.fillRect(x - 2, top, 4, g.rail - top);
    ctx.fillRect(x - 12, top + 4, 24, 3);
    ctx.beginPath();
    ctx.moveTo(x + 10, top + 4);
    ctx.quadraticCurveTo(x + poleGap / 2, top + 22, x + poleGap + 10, top + 4);
    ctx.moveTo(x - 10, top + 4);
    ctx.quadraticCurveTo(x + poleGap / 2 - 20, top + 26, x + poleGap - 10, top + 4);
    ctx.stroke();
  }
  if (frame.night) diner(ctx, frame, p, g);
}

function saguaro(ctx: Ctx, x: number, base: number, s: number, p: RoutePalette): void {
  const w = s * 0.13;
  ctx.fillStyle = p.foliage;
  roundRect(ctx, x - w / 2, base - s, w, s, w / 2);
  ctx.fill();
  roundRect(ctx, x - w * 2.2, base - s * 0.7, w * 0.85, s * 0.34, w / 2);
  ctx.fill();
  ctx.fillRect(x - w * 2.2, base - s * 0.42, w * 1.9, w * 0.8);
  roundRect(ctx, x + w * 1.3, base - s * 0.82, w * 0.85, s * 0.36, w / 2);
  ctx.fill();
  ctx.fillRect(x + w * 0.4, base - s * 0.5, w * 1.6, w * 0.8);
  ctx.fillStyle = p.foliageDeep;
  ctx.fillRect(x, base - s * 0.95, w * 0.18, s * 0.9);
}

function diner(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  tiles(frame, 0.9, frame.w * 1.4, (i, x) => {
    const s = frame.h * 0.1;
    const cx = x + frame.w * 0.5;
    const base = g.rail;
    ctx.fillStyle = p.wall;
    ctx.fillRect(cx, base - s * 1.1, s * 3, s * 1.1);
    ctx.save();
    ctx.shadowColor = 'rgba(255, 200, 120, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffcf7a';
    for (let k = 0; k < 4; k++)
      ctx.fillRect(cx + s * (0.2 + k * 0.7), base - s * 0.8, s * 0.45, s * 0.4);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = '#ff6fb1';
    ctx.shadowBlur = 14;
    roundRect(ctx, cx + s * 0.6, base - s * 1.75, s * 1.8, s * 0.55, s * 0.12);
    fillWith(ctx, '#1b1f33');
    ctx.fillStyle = '#ff8fc4';
    ctx.font = `800 ${s * 0.38}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DINER', cx + s * 1.5, base - s * 1.47);
    ctx.restore();
    void i;
  });
}

// —— the pass ——

function alpine(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const depthBand = g.rail - g.horizon;
  if (frame.night) aurora(ctx, frame, g);
  // Peaks with snow caps.
  tiles(frame, 0.06, frame.w * 0.26, (i, x) => {
    const w = frame.w * (0.18 + hash01(i, 201) * 0.14);
    const hgt = depthBand * (0.45 + hash01(i, 202) * 0.4);
    const base = g.horizon + depthBand * 0.25;
    const peak = x + w * (0.4 + hash01(i, 203) * 0.2);
    poly(ctx, [x, base, peak, base - hgt, x + w, base]);
    fillWith(ctx, hash01(i, 204) < 0.5 ? p.far : p.farDeep);
    // The sunlit face is a shade lighter.
    poly(ctx, [peak, base - hgt, x + w, base, peak + w * 0.08, base]);
    fillWith(ctx, alpha('#ffffff', frame.night ? 0.05 : 0.14));
    const cap = 0.3;
    poly(ctx, [
      peak - (peak - x) * cap,
      base - hgt * (1 - cap),
      peak,
      base - hgt,
      peak + (x + w - peak) * cap,
      base - hgt * (1 - cap),
      peak + (x + w - peak) * cap * 0.4,
      base - hgt * (1 - cap) + hgt * 0.06,
      peak - (peak - x) * cap * 0.3,
      base - hgt * (1 - cap) + hgt * 0.08,
    ]);
    fillWith(ctx, frame.night ? '#c9d6ee' : '#ffffff');
  });
  // Snowfields, then the forest and the chalets.
  band(ctx, frame, 0.25, g.horizon + depthBand * 0.3, g.rail + 2, depthBand * 0.08, p.hillDeep, 1);
  band(ctx, frame, 0.4, g.horizon + depthBand * 0.5, g.rail + 2, depthBand * 0.07, p.hill, 2.3);
  tiles(frame, 0.45, frame.h * 0.16, (i, x) => {
    if (hash01(i, 211) < 0.25) return;
    const s = depthBand * (0.22 + hash01(i, 212) * 0.2);
    const base = g.horizon + depthBand * (0.62 + hash01(i, 213) * 0.25);
    if (hash01(i, 214) < 0.12) chalet(ctx, frame, x, base, s * 0.9, p);
    else pine(ctx, x, base, s, p, frame.night);
  });
}

function pine(ctx: Ctx, x: number, base: number, s: number, p: RoutePalette, night: boolean): void {
  ctx.fillStyle = p.foliageDeep;
  ctx.fillRect(x - s * 0.04, base - s * 0.2, s * 0.08, s * 0.2);
  for (let k = 0; k < 3; k++) {
    const y = base - s * (0.15 + k * 0.28);
    const w = s * (0.42 - k * 0.1);
    poly(ctx, [x - w, y, x, y - s * 0.42, x + w, y]);
    fillWith(ctx, k % 2 ? p.foliage : p.foliageDeep);
    poly(ctx, [x - w * 0.5, y - s * 0.21, x, y - s * 0.42, x + w * 0.45, y - s * 0.2]);
    fillWith(ctx, night ? '#b8c6e0' : '#ffffff');
  }
}

function chalet(
  ctx: Ctx,
  frame: RoadFrame,
  x: number,
  base: number,
  s: number,
  p: RoutePalette,
): void {
  ctx.fillStyle = p.wall;
  ctx.fillRect(x - s * 0.5, base - s * 0.6, s, s * 0.6);
  poly(ctx, [x - s * 0.66, base - s * 0.58, x, base - s * 1.05, x + s * 0.66, base - s * 0.58]);
  fillWith(ctx, p.roof);
  poly(ctx, [
    x - s * 0.6,
    base - s * 0.62,
    x,
    base - s * 1.02,
    x + s * 0.6,
    base - s * 0.62,
    x,
    base - s * 0.86,
  ]);
  fillWith(ctx, frame.night ? '#c9d6ee' : '#ffffff');
  ctx.save();
  if (frame.night) {
    ctx.shadowColor = 'rgba(255, 200, 120, 0.9)';
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = p.window;
  ctx.fillRect(x - s * 0.32, base - s * 0.42, s * 0.2, s * 0.18);
  ctx.fillRect(x + s * 0.12, base - s * 0.42, s * 0.2, s * 0.18);
  ctx.restore();
}

/** Night on the pass: slow green curtains over the peaks. */
function aurora(ctx: Ctx, frame: RoadFrame, g: RoadGeometry): void {
  const top = frame.y + (g.horizon - frame.y) * 0.08;
  for (let k = 0; k < 3; k++) {
    const grad = ctx.createLinearGradient(0, top, 0, g.horizon);
    grad.addColorStop(0, alpha(k === 1 ? '#7ff0d0' : '#5fe39a', 0));
    grad.addColorStop(0.5, alpha(k === 1 ? '#7ff0d0' : '#5fe39a', 0.16));
    grad.addColorStop(1, alpha('#5fe39a', 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let px = 0; px <= frame.w; px += 12) {
      const y =
        top +
        (g.horizon - top) *
          (0.25 + 0.12 * Math.sin(px / 140 + frame.time * 0.3 + k * 2) + k * 0.08);
      if (px === 0) ctx.moveTo(frame.x + px, y);
      else ctx.lineTo(frame.x + px, y);
    }
    ctx.lineTo(frame.x + frame.w, g.horizon);
    ctx.lineTo(frame.x, g.horizon);
    ctx.closePath();
    ctx.fill();
  }
}

// —— the rainforest ——

function jungle(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const depthBand = g.rail - g.horizon;
  // Misty mountains, one with falls.
  tiles(frame, 0.07, frame.w * 0.3, (i, x) => {
    const w = frame.w * (0.22 + hash01(i, 301) * 0.16);
    const hgt = depthBand * (0.4 + hash01(i, 302) * 0.3);
    const base = g.horizon + depthBand * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.bezierCurveTo(
      x + w * 0.15,
      base - hgt,
      x + w * 0.45,
      base - hgt * 1.1,
      x + w * 0.6,
      base - hgt * 0.8,
    );
    ctx.bezierCurveTo(x + w * 0.75, base - hgt * 0.55, x + w * 0.9, base - hgt * 0.4, x + w, base);
    ctx.closePath();
    fillWith(ctx, hash01(i, 303) < 0.5 ? p.far : p.farDeep);
    if (hash01(i, 304) < 0.4) {
      // Falls: a white ribbon with a cloud of spray at its foot.
      const fx = x + w * 0.42;
      const ft = base - hgt * 0.85;
      ctx.fillStyle = alpha(frame.night ? '#bfe7e0' : '#ffffff', 0.85);
      ctx.fillRect(fx, ft, w * 0.025, hgt * 0.85);
      ctx.fillStyle = alpha('#ffffff', 0.3);
      for (let k = 0; k < 4; k++) {
        const y = ft + ((frame.time * 60 + k * 30) % (hgt * 0.85));
        ctx.fillRect(fx + w * 0.005, y, w * 0.015, hgt * 0.06);
      }
      circle(ctx, fx + w * 0.012, base - hgt * 0.02, w * 0.05);
      fillWith(ctx, alpha('#ffffff', frame.night ? 0.25 : 0.55));
    }
  });
  // Mist lying in the valley.
  const mist = ctx.createLinearGradient(
    0,
    g.horizon + depthBand * 0.15,
    0,
    g.horizon + depthBand * 0.45,
  );
  mist.addColorStop(0, alpha(p.seaLight, 0));
  mist.addColorStop(1, alpha(p.seaLight, frame.night ? 0.25 : 0.5));
  ctx.fillStyle = mist;
  ctx.fillRect(frame.x, g.horizon + depthBand * 0.15, frame.w, depthBand * 0.3);
  band(
    ctx,
    frame,
    0.3,
    g.horizon + depthBand * 0.42,
    g.rail + 2,
    depthBand * 0.06,
    p.hillDeep,
    0.7,
  );
  // The canopy: broadleaf crowns and palms, close together.
  tiles(frame, 0.45, frame.h * 0.17, (i, x) => {
    const s = depthBand * (0.4 + hash01(i, 311) * 0.25);
    const base = g.rail + depthBand * 0.02;
    if (hash01(i, 312) < 0.45) palm(ctx, x, base, s, p, hash01(i, 313) - 0.5);
    else crown(ctx, x, base, s * 0.85, p, i);
  });
  if (frame.night) fireflies(ctx, frame, g);
}

function palm(ctx: Ctx, x: number, base: number, s: number, p: RoutePalette, lean: number): void {
  ctx.strokeStyle = p.rail;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  const tx = x + lean * s * 0.4;
  const ty = base - s;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + lean * s * 0.1, base - s * 0.5, tx, ty);
  ctx.stroke();
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.5;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(s * 0.24, 0, s * 0.26, s * 0.06, 0.25, 0, Math.PI * 2);
    fillWith(ctx, k % 2 ? p.foliage : p.foliageDeep);
    ctx.restore();
  }
}

function crown(ctx: Ctx, x: number, base: number, s: number, p: RoutePalette, i: number): void {
  ctx.fillStyle = p.rail;
  ctx.fillRect(x - s * 0.04, base - s * 0.55, s * 0.08, s * 0.55);
  for (let k = 0; k < 4; k++) {
    const cx = x + (hash01(i * 5 + k, 321) - 0.5) * s * 0.6;
    const cy = base - s * (0.6 + hash01(i * 5 + k, 322) * 0.35);
    circle(ctx, cx, cy, s * (0.22 + hash01(i * 5 + k, 323) * 0.12));
    fillWith(ctx, k % 2 ? p.foliage : p.hill);
  }
  if (hash01(i, 324) < 0.4) {
    circle(ctx, x + s * 0.18, base - s * 0.7, s * 0.04);
    fillWith(ctx, '#e8574a');
  }
}

function fireflies(ctx: Ctx, frame: RoadFrame, g: RoadGeometry): void {
  for (let i = 0; i < 40; i++) {
    const x =
      frame.x + ((hash01(i, 331) * frame.w + Math.sin(frame.time * 0.5 + i) * 30) % frame.w);
    const y =
      g.horizon +
      (g.rail - g.horizon) * (0.3 + hash01(i, 332) * 0.7) +
      Math.cos(frame.time * 0.7 + i) * 8;
    const glow = 0.5 + 0.5 * Math.sin(frame.time * (1.5 + hash01(i, 333) * 2) + i * 3);
    ctx.save();
    ctx.shadowColor = '#e7ff8a';
    ctx.shadowBlur = 8;
    circle(ctx, x, y, 1.6);
    fillWith(ctx, alpha('#e7ff8a', 0.3 + glow * 0.7));
    ctx.restore();
  }
}

// —— the city ——

const NEON = ['HOTEL', 'CAFÉ', 'OPEN', 'RECORDS', 'DINER', 'GARAGE'];

function city(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const depthBand = g.rail - g.horizon;
  // The far skyline.
  tiles(frame, 0.08, frame.w * 0.05, (i, x) => {
    const w = frame.w * (0.035 + hash01(i, 401) * 0.03);
    const hgt = depthBand * (0.35 + hash01(i, 402) * 0.55);
    const base = g.horizon + depthBand * 0.35;
    ctx.fillStyle = hash01(i, 403) < 0.5 ? p.far : p.farDeep;
    ctx.fillRect(x, base - hgt, w, hgt + 2);
    if (hash01(i, 404) < 0.3) {
      ctx.fillRect(x + w * 0.45, base - hgt - hgt * 0.15, w * 0.1, hgt * 0.15);
      if (frame.night && Math.sin(frame.time * 2 + i) > 0) {
        circle(ctx, x + w * 0.5, base - hgt * 1.15, 2);
        fillWith(ctx, '#ff4a4a');
      }
    }
    windows(ctx, frame, x, base - hgt, w, hgt, i, 0.18, p);
  });
  // Nearer blocks with neon signs.
  tiles(frame, 0.4, frame.w * 0.11, (i, x) => {
    const w = frame.w * (0.08 + hash01(i, 411) * 0.03);
    const hgt = depthBand * (0.5 + hash01(i, 412) * 0.35);
    const base = g.rail + 2;
    ctx.fillStyle = hash01(i, 413) < 0.5 ? p.hill : p.hillDeep;
    ctx.fillRect(x, base - hgt, w, hgt);
    ctx.fillStyle = alpha('#000000', 0.15);
    ctx.fillRect(x + w * 0.82, base - hgt, w * 0.18, hgt);
    windows(ctx, frame, x, base - hgt, w * 0.8, hgt * 0.75, i + 500, 0.45, p);
    if (hash01(i, 414) < 0.55)
      neonSign(
        ctx,
        frame,
        x + w * 0.1,
        base - hgt * 0.92,
        w * 0.62,
        NEON[Math.floor(hash01(i, 415) * NEON.length)]!,
        i,
      );
  });
  streetlamps(ctx, frame, g);
}

function windows(
  ctx: Ctx,
  frame: RoadFrame,
  x: number,
  top: number,
  w: number,
  hgt: number,
  seed: number,
  lit: number,
  p: RoutePalette,
): void {
  const cols = Math.max(2, Math.floor(w / 9));
  const rows = Math.max(2, Math.floor(hgt / 12));
  const cw = w / cols;
  const rh = hgt / rows;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const on = hash01(seed * 131 + r * 17 + c, 421) < (frame.night ? lit + 0.2 : lit * 0.5);
      if (!on) continue;
      ctx.fillStyle = frame.night ? p.window : alpha(p.window, 0.75);
      ctx.fillRect(x + c * cw + cw * 0.25, top + r * rh + rh * 0.25, cw * 0.5, rh * 0.45);
    }
  }
}

function neonSign(
  ctx: Ctx,
  frame: RoadFrame,
  x: number,
  y: number,
  w: number,
  word: string,
  seed: number,
): void {
  const hues = ['#ff6fb1', '#5ff2e6', '#ffd24d', '#8f8bff'];
  const colour = hues[seed % hues.length]!;
  const hgt = w * 0.3;
  ctx.save();
  roundRect(ctx, x, y, w, hgt, hgt * 0.2);
  fillWith(ctx, frame.night ? '#120f24' : alpha('#120f24', 0.85));
  if (frame.night) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = frame.night ? colour : alpha(colour, 0.9);
  ctx.font = `800 ${Math.min(hgt * 0.62, (w / word.length) * 1.35)}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, x + w / 2, y + hgt * 0.54);
  ctx.restore();
}

/** Streetlamps on the far kerb; at night each throws a pool of light on the road. */
function streetlamps(ctx: Ctx, frame: RoadFrame, g: RoadGeometry): void {
  const gap = frame.h * 0.6;
  const shift = layerShift(frame, 1);
  const first = Math.floor(shift / gap) - 1;
  for (let i = first; i < first + frame.w / gap + 3; i++) {
    const x = frame.x + i * gap - shift;
    const top = g.rail - frame.h * 0.24;
    ctx.fillStyle = frame.night ? '#3a3a56' : '#4a4d66';
    ctx.fillRect(x - 2, top, 4, g.roadTop - top);
    ctx.fillRect(x, top, frame.h * 0.05, 3);
    ctx.save();
    if (frame.night) {
      ctx.shadowColor = 'rgba(255, 220, 150, 1)';
      ctx.shadowBlur = 14;
    }
    roundRect(ctx, x + frame.h * 0.035, top + 2, frame.h * 0.03, frame.h * 0.012, 3);
    fillWith(ctx, frame.night ? '#ffe7a8' : '#f1ead6');
    ctx.restore();
    if (frame.night) {
      const pool = ctx.createRadialGradient(
        x + frame.h * 0.05,
        g.roadTop + frame.h * 0.08,
        0,
        x + frame.h * 0.05,
        g.roadTop + frame.h * 0.08,
        frame.h * 0.2,
      );
      pool.addColorStop(0, 'rgba(255, 220, 150, 0.22)');
      pool.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = pool;
      ctx.fillRect(x - frame.h * 0.2, g.roadTop, frame.h * 0.5, g.roadBottom - g.roadTop);
    }
  }
}

// —— rails and verges ——

/** Each road's barrier between the scenery and the tarmac (the coast's own guard rail is in road.ts). */
export function paintRail(
  ctx: Ctx,
  frame: RoadFrame,
  p: RoutePalette,
  g: RoadGeometry,
  guardRail: () => void,
): void {
  const id: RouteId = frame.route.id;
  if (id === 'coast' || id === 'alpine') {
    guardRail();
    if (id === 'alpine') {
      // Snow along the rail's top.
      ctx.fillStyle = frame.night ? '#c9d6ee' : '#ffffff';
      const postH = g.roadTop - g.rail + frame.h * 0.03;
      ctx.fillRect(frame.x, g.rail - postH * 0.62, frame.w, postH * 0.1);
    }
    return;
  }
  if (id === 'city') {
    // A kerb rather than a rail.
    ctx.fillStyle = p.verge;
    ctx.fillRect(frame.x, g.rail, frame.w, g.roadTop - g.rail);
    ctx.fillStyle = p.vergeDeep;
    ctx.fillRect(frame.x, g.roadTop - frame.h * 0.01, frame.w, frame.h * 0.01);
    return;
  }
  // Wooden posts with two rails (desert wire, rainforest timber).
  const gap = frame.h * 0.11;
  const shift = layerShift(frame, 1);
  const first = Math.floor(shift / gap) - 1;
  const top = g.rail - frame.h * 0.05;
  ctx.fillStyle = p.rail;
  ctx.fillRect(frame.x, top + frame.h * 0.012, frame.w, frame.h * (id === 'desert' ? 0.004 : 0.01));
  ctx.fillRect(frame.x, top + frame.h * 0.032, frame.w, frame.h * (id === 'desert' ? 0.004 : 0.01));
  for (let i = first; i < first + frame.w / gap + 3; i++) {
    const x = frame.x + i * gap - shift;
    ctx.fillRect(x, top, frame.h * 0.012, g.roadTop - top);
  }
}

/** The props on each road's near verge. Returns false for the coast, whose agaves road.ts draws. */
export function paintVergeProps(ctx: Ctx, frame: RoadFrame, p: RoutePalette): boolean {
  const id = frame.route.id;
  if (id === 'coast') return false;
  tiles(frame, 1.3, frame.h * 0.5, (i, x) => {
    if (hash01(i, 70) < 0.35) return;
    const px = x + hash01(i, 71) * frame.h * 0.35;
    const y = frame.y + frame.h + frame.h * 0.02;
    const s = frame.h * (0.06 + hash01(i, 72) * 0.04);
    if (id === 'desert') {
      if (hash01(i, 73) < 0.5) saguaro(ctx, px, y, s * 1.6, p);
      else {
        ctx.beginPath();
        ctx.ellipse(px, y, s * 0.9, s * 0.5, 0, Math.PI, 0);
        fillWith(ctx, p.vergeDeep);
      }
    } else if (id === 'alpine') {
      if (hash01(i, 73) < 0.6) pine(ctx, px, y, s * 1.8, p, frame.night);
      else {
        ctx.beginPath();
        ctx.ellipse(px, y, s * 1.1, s * 0.45, 0, Math.PI, 0);
        fillWith(ctx, frame.night ? '#9fb0cc' : '#ffffff');
      }
    } else if (id === 'jungle') {
      for (let k = -3; k <= 3; k++) {
        ctx.save();
        ctx.translate(px, y);
        ctx.rotate(k * 0.32);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.7, s * 0.16, s * 0.75, 0, 0, Math.PI * 2);
        fillWith(ctx, k % 2 ? p.foliage : p.foliageDeep);
        ctx.restore();
      }
      if (hash01(i, 74) < 0.5) {
        circle(ctx, px + s * 0.4, y - s * 0.9, s * 0.18);
        fillWith(ctx, '#e8574a');
      }
    } else {
      // A hydrant or a low hedge on the pavement.
      if (hash01(i, 73) < 0.5) {
        roundRect(ctx, px - s * 0.15, y - s * 0.6, s * 0.3, s * 0.6, s * 0.08);
        fillWith(ctx, '#d6462f');
        circle(ctx, px, y - s * 0.62, s * 0.15);
        fillWith(ctx, '#d6462f');
      } else {
        roundRect(ctx, px - s * 0.8, y - s * 0.5, s * 1.6, s * 0.5, s * 0.2);
        fillWith(ctx, p.foliage);
      }
    }
  });
  return true;
}
