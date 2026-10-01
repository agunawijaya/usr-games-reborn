import type { Arena } from '../engine/arena';
import { approachLights, arenaCentre, centre, headingVector, runwayEnds } from './features';
import type { Look } from './look';
import { fractal, valueNoise } from './noise';

/**
 * The printed layer under the traffic: land, water, the grid and every fixed symbol of the arena.
 * It is painted once per arena, look and size into its own canvas; the radar then copies it each
 * frame, flat or tilted. Labels are not printed here, so they stay upright in the tilt view.
 */

/** Where land meets sea, and the edges of the hill tints above it, on the 0–1 elevation scale. */
export const SEA_LEVEL = 0.35;
export const BANDS = [SEA_LEVEL, 0.52, 0.64, 0.75] as const;

export interface GroundTexture {
  canvas: HTMLCanvasElement;
  /** Device pixels per cell. */
  cell: number;
  /** Cells of surrounding country painted beyond the arena on each side. */
  margin: { x: number; y: number };
}

const cache = new Map<string, GroundTexture>();

/**
 * The land runs on past the arena's edge, under a veil, so the radar fills its panel at any
 * window shape and the tilted view never shows a cliff at the border.
 */
export function groundTexture(
  arena: Arena,
  look: Look,
  cell: number,
  margin: { x: number; y: number },
): GroundTexture {
  const key = `${arena.id}:${look.id}:${cell}:${margin.x}:${margin.y}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((arena.width + margin.x * 2) * cell);
  canvas.height = Math.round((arena.height + margin.y * 2) * cell);
  const ctx = canvas.getContext('2d')!;
  paintLand(ctx, arena, look, cell, margin);
  ctx.translate(margin.x * cell, margin.y * cell);
  if (look.dark) paintScopeRings(ctx, arena, look, cell);
  paintGrid(ctx, arena, look, cell);
  paintAirways(ctx, arena, look, cell);
  paintAirspace(ctx, arena, look, cell);
  paintVeil(ctx, arena, look, cell, margin);
  paintRunways(ctx, arena, look, cell);
  paintBeacons(ctx, arena, look, cell);
  paintGates(ctx, arena, look, cell);
  paintNeatline(ctx, arena, look, cell);
  const texture = { canvas, cell, margin };
  if (cache.size > 12) cache.clear();
  cache.set(key, texture);
  return texture;
}

/** Outside the arena the country fades: it is scenery, not airspace you control. */
function paintVeil(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  look: Look,
  cell: number,
  margin: { x: number; y: number },
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    -margin.x * cell,
    -margin.y * cell,
    (arena.width + margin.x * 2) * cell,
    (arena.height + margin.y * 2) * cell,
  );
  ctx.rect(arena.width * cell, 0, -arena.width * cell, arena.height * cell);
  ctx.fillStyle = look.dark ? 'rgba(1, 9, 9, 0.62)' : 'rgba(236, 228, 208, 0.62)';
  ctx.fill('evenodd');
  ctx.restore();
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Elevation in 0–1 at a point in cell units: rolling hills inland, lifted so lakes stay rare,
 * and pulled under the sea towards one edge with a wandering shoreline and a few islands.
 */
export function elevationField(arena: Arena): (u: number, v: number) => number {
  const { scenery } = arena;
  const hills = fractal(valueNoise(scenery.seed), 5);
  const wobble = fractal(valueNoise(`${scenery.seed}:coast`), 4);
  const relief = scenery.relief ?? 0.5;
  const contrast = 1.5 + relief * 1.3;
  return (u, v) => {
    let e = 0.65 + (hills(u / 7.5, v / 7.5) - 0.5) * contrast;
    if (!scenery.coast) return e;
    const t =
      scenery.coast === 'east'
        ? u / arena.width
        : scenery.coast === 'west'
          ? 1 - u / arena.width
          : scenery.coast === 'south'
            ? v / arena.height
            : 1 - v / arena.height;
    const shore = t + (wobble(u / 5, v / 5) - 0.5) * 0.42;
    const sea = smoothstep(0.6, 0.82, shore);
    e -= sea * 0.48;
    return e;
  };
}

function parseColour(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function parseRgba(colour: string): [number, number, number, number] {
  if (colour.startsWith('#')) return [...parseColour(colour), 1];
  const parts = colour.match(/[\d.]+/g)!.map(Number);
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

/**
 * Land and water, pixel by pixel: flat tints between contour lines with soft shaded relief, the
 * way a printed chart shows hills. On the scope only the coastline survives, as a video map.
 */
function paintLand(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  look: Look,
  cell: number,
  margin: { x: number; y: number },
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const elevation = elevationField(arena);
  const grain = valueNoise(`${arena.scenery.seed}:grain`);
  const field = new Float32Array(width * height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      field[py * width + px] = elevation(
        (px + 0.5) / cell - margin.x,
        (py + 0.5) / cell - margin.y,
      );
    }
  }

  const image = ctx.createImageData(width, height);
  const out = image.data;
  const land = look.land.map(parseColour);
  const water = parseColour(look.water);
  const shore = parseRgba(look.shore);
  const contour = parseRgba(look.contour);
  const glassCentre = parseColour(look.glassCentre);
  const glassEdge = parseColour(look.glassEdge);
  const halfDiagonal = Math.hypot(width, height) / 2;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = py * width + px;
      const e = field[i]!;
      const right = field[i + (px < width - 1 ? 1 : 0)]!;
      const below = field[i + (py < height - 1 ? width : 0)]!;
      const gx = right - e;
      const gy = below - e;
      const slope = Math.hypot(gx, gy) + 1e-6;

      let r: number;
      let g: number;
      let b: number;
      if (look.dark) {
        const d = Math.hypot(px - width / 2, py - height / 2) / halfDiagonal;
        const t = smoothstep(0.1, 1.05, d);
        r = glassCentre[0] + (glassEdge[0] - glassCentre[0]) * t;
        g = glassCentre[1] + (glassEdge[1] - glassCentre[1]) * t;
        b = glassCentre[2] + (glassEdge[2] - glassCentre[2]) * t;
        if (e < SEA_LEVEL) {
          r *= 0.78;
          g *= 0.8;
          b *= 0.84;
        }
      } else if (e < SEA_LEVEL) {
        const depth = smoothstep(SEA_LEVEL, SEA_LEVEL - 0.14, e);
        [r, g, b] = water;
        r -= depth * 10;
        g -= depth * 6;
        b -= depth * 2;
      } else {
        let band = 0;
        while (band < 3 && e >= BANDS[band + 1]!) band++;
        [r, g, b] = land[band]!;
        // Light from the north-west, as on printed relief.
        const shade = Math.max(-1, Math.min(1, (gx + gy) * cell * 9));
        const factor = 1 - shade * 0.07 * (0.5 + (arena.scenery.relief ?? 0.5));
        r *= factor;
        g *= factor;
        b *= factor;
      }

      const lineWidth = look.dark ? 1.1 : 1.25;
      const shoreAlpha = Math.max(0, 1 - Math.abs(e - SEA_LEVEL) / slope / lineWidth) * shore[3];
      let contourAlpha = 0;
      for (const level of [...BANDS.slice(1), 0.62, 0.72, 0.77]) {
        const major = BANDS.includes(level as (typeof BANDS)[number]);
        const a = Math.max(0, 1 - Math.abs(e - level) / slope / (major ? 0.9 : 0.65));
        contourAlpha = Math.max(contourAlpha, a * (major ? 1 : 0.4));
      }
      if (e < SEA_LEVEL) contourAlpha = 0;
      contourAlpha *= contour[3];

      r += (contour[0] - r) * contourAlpha;
      g += (contour[1] - g) * contourAlpha;
      b += (contour[2] - b) * contourAlpha;
      r += (shore[0] - r) * shoreAlpha;
      g += (shore[1] - g) * shoreAlpha;
      b += (shore[2] - b) * shoreAlpha;

      const speck = (grain(px * 0.9, py * 0.9) - 0.5) * (look.dark ? 6 : 7);
      const o = i * 4;
      out[o] = r + speck;
      out[o + 1] = g + speck;
      out[o + 2] = b + speck;
      out[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Range rings and an azimuth scale, centred on the arena, like the face of a scope. */
function paintScopeRings(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  const c = arenaCentre(arena);
  const cx = c.x * cell;
  const cy = c.y * cell;
  ctx.save();
  ctx.strokeStyle = look.rings;
  ctx.lineWidth = Math.max(1, cell * 0.025);
  const reach = Math.hypot(arena.width, arena.height) / 2;
  for (let r = 4; r < reach; r += 4) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * cell, 0, Math.PI * 2);
    ctx.stroke();
  }
  const scale = (Math.min(arena.width, arena.height) / 2 - 0.35) * cell;
  ctx.lineWidth = Math.max(1, cell * 0.03);
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const long = degrees % 30 === 0;
    const angle = (degrees * Math.PI) / 180;
    const inner = scale - (long ? 0.42 : 0.2) * cell;
    ctx.strokeStyle = long ? look.gridStrong : look.rings;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(angle) * inner, cy - Math.cos(angle) * inner);
    ctx.lineTo(cx + Math.sin(angle) * scale, cy - Math.cos(angle) * scale);
    ctx.stroke();
  }
  ctx.restore();
}

function paintGrid(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number): void {
  ctx.save();
  if (look.dark) {
    ctx.fillStyle = look.grid;
    const r = Math.max(1, cell * 0.035);
    for (let y = 1; y < arena.height; y++) {
      for (let x = 1; x < arena.width; x++) {
        ctx.beginPath();
        ctx.arc(x * cell, y * cell, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = look.grid;
    ctx.lineWidth = Math.max(1, cell * 0.022);
    const arm = cell * 0.09;
    ctx.beginPath();
    for (let y = 1; y < arena.height; y++) {
      for (let x = 1; x < arena.width; x++) {
        ctx.moveTo(x * cell - arm, y * cell);
        ctx.lineTo(x * cell + arm, y * cell);
        ctx.moveTo(x * cell, y * cell - arm);
        ctx.lineTo(x * cell, y * cell + arm);
      }
    }
    ctx.stroke();
    // A graticule every five cells, like latitude and longitude on a chart.
    ctx.strokeStyle = look.rings;
    ctx.beginPath();
    for (let x = 5; x < arena.width; x += 5) {
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, arena.height * cell);
    }
    for (let y = 5; y < arena.height; y += 5) {
      ctx.moveTo(0, y * cell);
      ctx.lineTo(arena.width * cell, y * cell);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function paintAirways(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const airway of arena.airways) {
    const a = centre(airway.from);
    const b = centre(airway.to);
    ctx.strokeStyle = look.airway;
    ctx.lineWidth = cell * 0.2;
    ctx.beginPath();
    ctx.moveTo(a.x * cell, a.y * cell);
    ctx.lineTo(b.x * cell, b.y * cell);
    ctx.stroke();
    ctx.strokeStyle = look.airwayCore;
    ctx.lineWidth = Math.max(1, cell * 0.032);
    ctx.stroke();
  }
  ctx.restore();
}

/** A dashed ring around each runway: the airspace a chart prints around an airfield. */
function paintAirspace(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  ctx.save();
  ctx.strokeStyle = look.airspace;
  ctx.globalAlpha = look.dark ? 0.8 : 0.55;
  ctx.lineWidth = Math.max(1.2, cell * 0.035);
  ctx.setLineDash([cell * 0.22, cell * 0.16]);
  for (const runway of arena.runways) {
    const c = centre(runway);
    ctx.beginPath();
    ctx.arc(c.x * cell, c.y * cell, cell * 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function paintRunways(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  ctx.save();
  for (const runway of arena.runways) {
    const [threshold, end] = runwayEnds(runway);
    const along = headingVector(runway.heading);
    const across = { x: -along.y, y: along.x };

    // Unlit approach light fixtures: a short bar across the line at each light.
    ctx.strokeStyle = look.lightsOff;
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.lineCap = 'round';
    for (const light of approachLights(runway)) {
      ctx.beginPath();
      ctx.moveTo((light.x - across.x * 0.16) * cell, (light.y - across.y * 0.16) * cell);
      ctx.lineTo((light.x + across.x * 0.16) * cell, (light.y + across.y * 0.16) * cell);
      ctx.stroke();
    }

    // The airfield: a filled disc on the chart (as charts print a hard runway), a ring on the scope.
    const c = centre(runway);
    ctx.beginPath();
    ctx.arc(c.x * cell, c.y * cell, cell * 0.66, 0, Math.PI * 2);
    if (look.dark) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = look.beacon;
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = look.beacon;
      ctx.fill();
    }

    ctx.lineCap = 'butt';
    ctx.strokeStyle = look.dark ? look.runway : look.runwayMark;
    ctx.lineWidth = cell * 0.22;
    ctx.beginPath();
    ctx.moveTo(threshold.x * cell, threshold.y * cell);
    ctx.lineTo(end.x * cell, end.y * cell);
    ctx.stroke();

    // Centre-line dashes and the threshold bar.
    ctx.strokeStyle = look.dark ? look.runwayMark : look.beacon;
    ctx.lineWidth = Math.max(1, cell * 0.03);
    ctx.setLineDash([cell * 0.1, cell * 0.09]);
    ctx.beginPath();
    ctx.moveTo((threshold.x + along.x * 0.24) * cell, (threshold.y + along.y * 0.24) * cell);
    ctx.lineTo((end.x - along.x * 0.1) * cell, (end.y - along.y * 0.1) * cell);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, cell * 0.045);
    ctx.beginPath();
    const t = { x: threshold.x + along.x * 0.1, y: threshold.y + along.y * 0.1 };
    ctx.moveTo((t.x - across.x * 0.09) * cell, (t.y - across.y * 0.09) * cell);
    ctx.lineTo((t.x + across.x * 0.09) * cell, (t.y + across.y * 0.09) * cell);
    ctx.stroke();
  }
  ctx.restore();
}

/** Beacons: a compass rose on the chart, a ringed diamond on the scope. */
function paintBeacons(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  ctx.save();
  ctx.strokeStyle = look.beacon;
  ctx.fillStyle = look.beacon;
  for (const beacon of arena.beacons) {
    const c = centre(beacon);
    const cx = c.x * cell;
    const cy = c.y * cell;
    if (look.dark) {
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const s = cell * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.stroke();
    } else {
      const radius = cell * 0.95;
      ctx.lineWidth = Math.max(1, cell * 0.026);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      for (let degrees = 0; degrees < 360; degrees += 10) {
        const angle = (degrees * Math.PI) / 180;
        const tick = degrees % 90 === 0 ? 0.26 : degrees % 30 === 0 ? 0.16 : 0.09;
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius);
        ctx.lineTo(
          cx + Math.sin(angle) * (radius - cell * tick),
          cy - Math.cos(angle) * (radius - cell * tick),
        );
        ctx.stroke();
      }
      // The north pointer above the rose.
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius - cell * 0.2);
      ctx.lineTo(cx - cell * 0.07, cy - radius + cell * 0.02);
      ctx.lineTo(cx + cell * 0.07, cy - radius + cell * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // The beacon itself: a hexagon with a dot.
      const s = cell * 0.2;
      ctx.lineWidth = Math.max(1.2, cell * 0.04);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const angle = (k * Math.PI) / 3;
        ctx[k === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(angle) * s, cy + Math.sin(angle) * s);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Gates: an arrow on the border pointing the way traffic enters. */
function paintGates(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  ctx.save();
  ctx.fillStyle = look.gate;
  ctx.strokeStyle = look.gate;
  for (const gate of arena.gates) {
    const c = centre(gate);
    const along = headingVector(gate.heading);
    const across = { x: -along.y, y: along.x };
    const tip = { x: c.x + along.x * 0.42, y: c.y + along.y * 0.42 };
    const back = { x: c.x - along.x * 0.3, y: c.y - along.y * 0.3 };
    ctx.globalAlpha = look.dark ? 0.85 : 0.9;
    ctx.beginPath();
    ctx.moveTo(tip.x * cell, tip.y * cell);
    ctx.lineTo((back.x + across.x * 0.3) * cell, (back.y + across.y * 0.3) * cell);
    ctx.lineTo((c.x - along.x * 0.08) * cell, (c.y - along.y * 0.08) * cell);
    ctx.lineTo((back.x - across.x * 0.3) * cell, (back.y - across.y * 0.3) * cell);
    ctx.closePath();
    ctx.fill();
    // The cell itself, outlined: a plane must pass exactly through it.
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, cell * 0.03);
    ctx.strokeRect((gate.x + 0.08) * cell, (gate.y + 0.08) * cell, cell * 0.84, cell * 0.84);
  }
  ctx.restore();
}

/** The chart's frame with a tick for every cell; the scope's glass edge. */
function paintNeatline(ctx: CanvasRenderingContext2D, arena: Arena, look: Look, cell: number) {
  const width = arena.width * cell;
  const height = arena.height * cell;
  ctx.save();
  if (look.dark) {
    const glow = ctx.createLinearGradient(0, 0, 0, height);
    glow.addColorStop(0, 'rgba(160, 255, 228, 0.16)');
    glow.addColorStop(0.5, 'rgba(160, 255, 228, 0.04)');
    glow.addColorStop(1, 'rgba(160, 255, 228, 0.1)');
    ctx.strokeStyle = glow;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.strokeRect(1, 1, width - 2, height - 2);
  } else {
    // A chart border: a fine outer rule and a heavier inner one.
    ctx.strokeStyle = look.label;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, cell * 0.022);
    ctx.strokeRect(-cell * 0.08, -cell * 0.08, width + cell * 0.16, height + cell * 0.16);
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.strokeRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = look.gridStrong;
    ctx.lineWidth = Math.max(1, cell * 0.03);
    ctx.beginPath();
    for (let x = 1; x < arena.width; x++) {
      const long = x % 5 === 0 ? 0.24 : 0.12;
      ctx.moveTo(x * cell, cell * 0.06);
      ctx.lineTo(x * cell, cell * (0.06 + long));
      ctx.moveTo(x * cell, height - cell * 0.06);
      ctx.lineTo(x * cell, height - cell * (0.06 + long));
    }
    for (let y = 1; y < arena.height; y++) {
      const long = y % 5 === 0 ? 0.24 : 0.12;
      ctx.moveTo(cell * 0.06, y * cell);
      ctx.lineTo(cell * (0.06 + long), y * cell);
      ctx.moveTo(width - cell * 0.06, y * cell);
      ctx.lineTo(width - cell * (0.06 + long), y * cell);
    }
    ctx.stroke();
  }
  ctx.restore();
}
