import { createRng } from '@usr-games/kit';
import type { Arena } from '../engine/arena';
import type { Cell } from '../engine/geometry';
import type { FlightRole } from '../engine/traffic';
import { centre, headingVector, type Point } from './features';
import { BANDS, elevationField, SEA_LEVEL } from './ground';
import { valueNoise } from './noise';

/**
 * The end-of-shift tapestry: every flight of the shift becomes a thread woven across a cloth the
 * shape of the arena. Threads pass over and under each other where they cross, a near-miss is
 * tied as a knot, a landing is finished with a cross-stitch and a flight that left by a gate
 * runs off the cloth into the fringe. It is drawn from the shift's own tracks, so no two are alike.
 */

/** How a flight left the sky; 'aloft' for one still flying when the shift ended. */
export type ThreadEnding = 'landed' | 'exited' | 'lost' | 'aloft';

export interface WovenFlight {
  track: readonly Cell[];
  hue: number;
  role: FlightRole;
  ending: ThreadEnding;
}

export interface TapestrySpec {
  arena: Arena;
  flights: readonly WovenFlight[];
  /** Where two flights came close without losing separation, in cells. */
  knots: readonly Point[];
  dark: boolean;
  caption: string;
  seed: string;
}

interface Cloth {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Pixels per cell. */
  cell: number;
}

type Rgb = [number, number, number];

interface Palette {
  base: Rgb;
  /** Weft colours for the sea and the hills, so the cloth carries the arena's map. */
  sea: Rgb;
  hills: Rgb;
  coast: Rgb;
  border: [string, string];
  stitch: string;
  caption: string;
  shadow: string;
}

const LIGHT: Palette = {
  base: [244, 235, 214],
  sea: [205, 220, 228],
  hills: [238, 219, 182],
  coast: [92, 122, 150],
  border: ['#9c3b2c', '#c99a3e'],
  stitch: '#b88a2a',
  caption: '#3c2f25',
  shadow: 'rgba(60, 40, 20, 0.35)',
};

const DARK: Palette = {
  base: [30, 36, 78],
  sea: [17, 24, 58],
  hills: [44, 44, 86],
  coast: [96, 130, 190],
  border: ['#c9a24a', '#3f8f8a'],
  stitch: '#f0c86a',
  caption: '#efe3c4',
  shadow: 'rgba(0, 0, 0, 0.55)',
};

export function drawTapestry(canvas: HTMLCanvasElement, spec: TapestrySpec): void {
  const ctx = canvas.getContext('2d')!;
  const palette = spec.dark ? DARK : LIGHT;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const fringe = Math.round(width * 0.035);
  const captionBand = Math.round(height * 0.11);
  const clothWidth = width - fringe * 2;
  const clothHeight = height - fringe * 2;
  const cell = Math.min(
    clothWidth / spec.arena.width,
    (clothHeight - captionBand) / spec.arena.height,
  );
  const cloth: Cloth = {
    left: (width - cell * spec.arena.width) / 2,
    top: fringe,
    width: cell * spec.arena.width,
    height: cell * spec.arena.height + captionBand,
    cell,
  };

  weave(ctx, cloth, palette, spec);
  drawFringes(ctx, cloth, spec, palette);
  drawBorder(ctx, cloth, palette);
  drawLandmarks(ctx, cloth, spec, palette);
  const paths = spec.flights.map((flight, i) => threadPath(cloth, spec, flight, i));
  paths.forEach((path, i) => drawThread(ctx, cloth, path, spec.flights[i]!, spec.dark));
  drawCrossings(ctx, cloth, paths, spec);
  paths.forEach((path, i) => finishThread(ctx, cloth, path, spec.flights[i]!, palette));
  spec.knots.forEach((knot, i) => drawKnot(ctx, cloth, knot, spec, i));
  drawCaption(ctx, cloth, spec, palette, captionBand);
}

/** A plain weave, pixel by pixel: warp and weft threads three pixels wide, over and under. */
function weave(ctx: CanvasRenderingContext2D, cloth: Cloth, palette: Palette, spec: TapestrySpec) {
  const left = Math.floor(cloth.left);
  const top = Math.floor(cloth.top);
  const width = Math.ceil(cloth.width);
  const height = Math.ceil(cloth.height);
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const slub = valueNoise(`${spec.seed}:slub`);
  const pitch = Math.max(3, Math.round(cloth.cell / 12));
  const elevation = elevationField(spec.arena);
  const mapHeight = spec.arena.height * cloth.cell;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // The weft takes the colour of the ground beneath: sea, lowland or hills.
      let colour = palette.base;
      if (y < mapHeight) {
        const e = elevation(x / cloth.cell, y / cloth.cell);
        const edge = elevation((x + 1.5) / cloth.cell, y / cloth.cell);
        const crossesCoast = e < SEA_LEVEL !== edge < SEA_LEVEL;
        colour = crossesCoast
          ? palette.coast
          : e < SEA_LEVEL
            ? palette.sea
            : e >= BANDS[2]
              ? palette.hills
              : palette.base;
      }
      const warp = Math.floor(x / pitch);
      const weft = Math.floor(y / pitch);
      const over = (warp + weft) % 2 === 0;
      const across = over ? (x % pitch) / (pitch - 1) : (y % pitch) / (pitch - 1);
      // Each thread is rounded: brightest along its middle.
      const round = 1 - Math.abs(across - 0.5) * 0.22;
      const thread = slub(over ? warp * 0.37 : weft * 0.37, over ? y * 0.02 : x * 0.02);
      const light = round * (0.95 + thread * 0.08) * (over ? 1 : 0.975);
      const o = (y * width + x) * 4;
      data[o] = colour[0] * light;
      data[o + 1] = colour[1] * light;
      data[o + 2] = colour[2] * light;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, left, top);
}

/** A woven border band of two colours, the way a tapestry is edged. */
function drawBorder(ctx: CanvasRenderingContext2D, cloth: Cloth, palette: Palette) {
  const band = cloth.cell * 0.22;
  ctx.save();
  palette.border.forEach((colour, i) => {
    const inset = band * (0.5 + i * 1.15);
    ctx.strokeStyle = colour;
    ctx.lineWidth = band;
    ctx.setLineDash([band * 0.7, band * 0.35]);
    ctx.strokeRect(
      cloth.left + inset,
      cloth.top + inset,
      cloth.width - inset * 2,
      cloth.height - inset * 2,
    );
  });
  ctx.restore();
}

function toCloth(cloth: Cloth, cell: Point): Point {
  return { x: cloth.left + cell.x * cloth.cell, y: cloth.top + cell.y * cloth.cell };
}

/** Runways as satin-stitched bars and beacons as small stitched stars, for orientation. */
function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  spec: TapestrySpec,
  palette: Palette,
) {
  ctx.save();
  ctx.strokeStyle = palette.caption;
  ctx.globalAlpha = 0.55;
  ctx.lineCap = 'round';
  for (const runway of spec.arena.runways) {
    const c = toCloth(cloth, centre(runway));
    const along = headingVector(runway.heading);
    const across = { x: -along.y, y: along.x };
    ctx.lineWidth = Math.max(1, cloth.cell * 0.05);
    for (let k = -4; k <= 4; k++) {
      const at = {
        x: c.x + along.x * k * cloth.cell * 0.11,
        y: c.y + along.y * k * cloth.cell * 0.11,
      };
      ctx.beginPath();
      ctx.moveTo(at.x - across.x * cloth.cell * 0.14, at.y - across.y * cloth.cell * 0.14);
      ctx.lineTo(at.x + across.x * cloth.cell * 0.14, at.y + across.y * cloth.cell * 0.14);
      ctx.stroke();
    }
  }
  for (const beacon of spec.arena.beacons) {
    const c = toCloth(cloth, centre(beacon));
    ctx.lineWidth = Math.max(1, cloth.cell * 0.04);
    for (let k = 0; k < 8; k++) {
      const angle = (k / 8) * Math.PI * 2;
      const reach = cloth.cell * (k % 2 === 0 ? 0.32 : 0.18);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(angle) * reach, c.y + Math.sin(angle) * reach);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function threadColour(
  flight: WovenFlight,
  dark: boolean,
  shade: 'base' | 'light' | 'deep',
): string {
  const hue = flight.role === 'medical' ? 6 : flight.role === 'mail' ? 222 : flight.hue;
  const saturation = flight.role === 'mail' ? 30 : dark ? 72 : 58;
  const lightness = {
    base: dark ? 64 : 44,
    light: dark ? 82 : 62,
    deep: dark ? 46 : 30,
  }[shade];
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/**
 * A thread's path on the cloth: the track's cells joined by a smooth curve, nudged a little so
 * it looks laid by hand. A flight that left by a gate runs on past the edge into the fringe.
 */
function threadPath(cloth: Cloth, spec: TapestrySpec, flight: WovenFlight, index: number): Point[] {
  const rng = createRng(`${spec.seed}:thread:${index}`);
  // Threads that share an airway lie side by side, like a band of warp, instead of on top of
  // each other: each keeps its own small offset across the cloth.
  const lane = ((index % 7) - 3) * 0.11 * cloth.cell;
  const phase = rng.next() * Math.PI * 2;
  const points = flight.track.map((c, i) => {
    const p = toCloth(cloth, centre(c));
    // A gentle wave along the yarn, as if it had been laid by hand.
    const wave = Math.sin(i * 1.3 + phase) * cloth.cell * 0.09;
    return {
      x: p.x + lane + wave + (rng.next() - 0.5) * cloth.cell * 0.06,
      y: p.y + lane * 0.8 - wave + (rng.next() - 0.5) * cloth.cell * 0.06,
    };
  });
  if (flight.ending === 'exited' && flight.track.length >= 2) {
    const last = flight.track[flight.track.length - 1]!;
    const before = flight.track[flight.track.length - 2]!;
    const dx = last.x - before.x;
    const dy = last.y - before.y;
    const end = points[points.length - 1]!;
    points.push({ x: end.x + dx * cloth.cell * 1.1, y: end.y + dy * cloth.cell * 1.1 });
  }
  return smooth(points, 5);
}

/** Catmull-Rom through the points, `steps` samples per span. */
function smooth(points: readonly Point[], steps: number): Point[] {
  if (points.length < 3) return [...points];
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

function trace(ctx: CanvasRenderingContext2D, path: readonly Point[]) {
  ctx.beginPath();
  path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
}

/** A yarn: a soft shadow, the body, and a dashed highlight that reads as twist. */
function drawThread(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  path: readonly Point[],
  flight: WovenFlight,
  dark: boolean,
) {
  const width = cloth.cell * 0.2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(width * 0.12, width * 0.3);
  trace(ctx, path);
  ctx.strokeStyle = dark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(70, 45, 15, 0.32)';
  ctx.lineWidth = width * 1.35;
  ctx.stroke();
  ctx.translate(-width * 0.12, -width * 0.3);
  if (dark) {
    ctx.shadowColor = threadColour(flight, dark, 'base');
    ctx.shadowBlur = width * 0.9;
  }
  trace(ctx, path);
  ctx.strokeStyle = threadColour(flight, dark, 'base');
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = threadColour(flight, dark, 'light');
  ctx.lineWidth = width * 0.42;
  ctx.setLineDash([width * 0.55, width * 0.75]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

interface Crossing {
  over: number;
  at: number;
  point: Point;
}

/**
 * Where two threads cross, every other crossing brings the earlier thread back over the later
 * one, which is what makes the cloth look woven rather than painted.
 */
function drawCrossings(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  paths: readonly Point[][],
  spec: TapestrySpec,
) {
  const crossings: Crossing[] = [];
  for (let a = 0; a < paths.length; a++) {
    for (let b = a + 1; b < paths.length; b++) {
      const pa = paths[a]!;
      const pb = paths[b]!;
      for (let i = 0; i < pa.length - 1; i++) {
        for (let j = 0; j < pb.length - 1; j++) {
          const hit = intersect(pa[i]!, pa[i + 1]!, pb[j]!, pb[j + 1]!);
          if (hit) crossings.push({ over: a, at: i, point: hit });
        }
      }
    }
  }
  crossings.forEach((crossing, n) => {
    if (n % 2 === 1) return;
    const path = paths[crossing.over]!;
    const piece = path.slice(Math.max(0, crossing.at - 2), Math.min(path.length, crossing.at + 4));
    drawThread(ctx, cloth, piece, spec.flights[crossing.over]!, spec.dark);
  });
}

function intersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** How a thread ends: a cross-stitch for a landing, a frayed end for a loss. */
function finishThread(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  path: readonly Point[],
  flight: WovenFlight,
  palette: Palette,
) {
  const end = path[path.length - 1];
  if (!end) return;
  ctx.save();
  ctx.lineCap = 'round';
  if (flight.ending === 'landed') {
    const r = cloth.cell * 0.26;
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = cloth.cell * 0.13;
    ctx.beginPath();
    ctx.moveTo(end.x - r + 1, end.y - r + 2);
    ctx.lineTo(end.x + r + 1, end.y + r + 2);
    ctx.moveTo(end.x + r + 1, end.y - r + 2);
    ctx.lineTo(end.x - r + 1, end.y + r + 2);
    ctx.stroke();
    ctx.strokeStyle = palette.stitch;
    ctx.lineWidth = cloth.cell * 0.1;
    ctx.beginPath();
    ctx.moveTo(end.x - r, end.y - r);
    ctx.lineTo(end.x + r, end.y + r);
    ctx.moveTo(end.x + r, end.y - r);
    ctx.lineTo(end.x - r, end.y + r);
    ctx.stroke();
  } else if (flight.ending === 'lost') {
    ctx.strokeStyle = threadColour(flight, palette === DARK, 'base');
    ctx.lineWidth = cloth.cell * 0.04;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x + Math.cos(k * 0.5) * cloth.cell * 0.4,
        end.y + Math.sin(k * 0.5) * cloth.cell * 0.4,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Tassels outside the cloth at every gate, in the colours of the flights that left there. */
function drawFringes(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  spec: TapestrySpec,
  palette: Palette,
) {
  ctx.save();
  ctx.lineCap = 'round';
  const right = cloth.left + cloth.width;
  const bottom = cloth.top + spec.arena.height * cloth.cell;
  spec.arena.gates.forEach((gate, index) => {
    const leaving = spec.flights.filter((f) => {
      const last = f.track[f.track.length - 1];
      return f.ending === 'exited' && last && last.x === gate.x && last.y === gate.y;
    });
    const c = toCloth(cloth, centre(gate));
    const outward = {
      x: gate.x < 1 ? -1 : gate.x >= spec.arena.width - 1 ? 1 : 0,
      y: gate.y < 1 ? -1 : gate.y >= spec.arena.height - 1 ? 1 : 0,
    };
    if (outward.x === 0 && outward.y === 0) return;
    const base = {
      x: outward.x < 0 ? cloth.left : outward.x > 0 ? right : c.x,
      y: outward.y < 0 ? cloth.top : outward.y > 0 ? bottom : c.y,
    };
    const strands = Math.max(7, leaving.length * 4);
    const rng = createRng(`${spec.seed}:fringe:${index}`);
    for (let k = 0; k < strands; k++) {
      const spread = (k / (strands - 1) - 0.5) * cloth.cell * 0.9;
      const flight = leaving[k % Math.max(1, leaving.length)];
      ctx.strokeStyle = flight ? threadColour(flight, spec.dark, 'base') : palette.border[1];
      ctx.lineWidth = cloth.cell * 0.07;
      const length = cloth.cell * (0.75 + rng.next() * 0.3);
      const sx = base.x + (outward.y !== 0 ? spread : 0);
      const sy = base.y + (outward.x !== 0 ? spread : 0);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(
        sx + outward.x * length * 0.5 + (rng.next() - 0.5) * 4,
        sy + outward.y * length * 0.5 + (rng.next() - 0.5) * 4,
        sx + outward.x * length,
        sy + outward.y * length,
      );
      ctx.stroke();
    }
    // The binding that gathers the tassel.
    ctx.strokeStyle = palette.border[0];
    ctx.lineWidth = cloth.cell * 0.09;
    ctx.beginPath();
    const bind = cloth.cell * 0.22;
    if (outward.y !== 0) {
      ctx.moveTo(base.x - cloth.cell * 0.4, base.y + outward.y * bind);
      ctx.lineTo(base.x + cloth.cell * 0.4, base.y + outward.y * bind);
    } else {
      ctx.moveTo(base.x + outward.x * bind, base.y - cloth.cell * 0.4);
      ctx.lineTo(base.x + outward.x * bind, base.y + cloth.cell * 0.4);
    }
    ctx.stroke();
  });
  ctx.restore();
}

/** A near-miss, tied off as a small knot where the two threads met. */
function drawKnot(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  knot: Point,
  spec: TapestrySpec,
  index: number,
) {
  const at = toCloth(cloth, knot);
  const r = cloth.cell * 0.34;
  ctx.save();
  ctx.fillStyle = spec.dark ? 'rgba(0,0,0,0.5)' : 'rgba(60,40,20,0.35)';
  ctx.beginPath();
  ctx.arc(at.x + r * 0.15, at.y + r * 0.25, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  const colour = spec.dark ? '#ff9c80' : '#a8341c';
  ctx.strokeStyle = colour;
  ctx.lineWidth = cloth.cell * 0.1;
  ctx.lineCap = 'round';
  for (let turn = 0; turn < 3; turn++) {
    const start = turn * 2.1 + index;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r * (0.45 + turn * 0.22), start, start + 4.2);
    ctx.stroke();
  }
  ctx.restore();
}

/** The shift's name worked into a band along the bottom of the cloth. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  cloth: Cloth,
  spec: TapestrySpec,
  palette: Palette,
  band: number,
) {
  const y = cloth.top + cloth.height - band * 0.55;
  ctx.save();
  ctx.fillStyle = palette.caption;
  ctx.globalAlpha = 0.88;
  ctx.font = `italic 600 ${(band * 0.36).toFixed(1)}px "Fraunces Variable", "Fraunces", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.caption, cloth.left + cloth.width / 2, y);
  ctx.strokeStyle = palette.border[0];
  ctx.lineWidth = Math.max(1, cloth.cell * 0.04);
  ctx.setLineDash([cloth.cell * 0.18, cloth.cell * 0.12]);
  const width = ctx.measureText(spec.caption).width;
  ctx.beginPath();
  ctx.moveTo(cloth.left + cloth.width / 2 - width / 2, y + band * 0.28);
  ctx.lineTo(cloth.left + cloth.width / 2 + width / 2, y + band * 0.28);
  ctx.stroke();
  ctx.restore();
}
