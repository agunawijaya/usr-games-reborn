import type { Cell, Dir } from '../engine/geometry';
import type { Layout } from './layout';
import type { Look } from './look';

/**
 * The noodle: a soft, glossy earthworm drawn as one smooth tube through its cells, with rings
 * across the body, a saddle a few cells behind the head, bulges where it is still digesting and
 * a cheeky upright face. The tube is stroked along a curve through the cell centres, in runs of
 * one width that step only where the body swells or tapers, so even a noodle of 300 cells is a
 * few dozen strokes a layer. Everything inside the body is painted on a layer of its own and
 * kept inside it, then laid on the garden in one go.
 */

export type Mood = 'calm' | 'munch' | 'delight' | 'dizzy';

export interface NoodleScene {
  body: readonly Cell[];
  heading: Dir | null;
  layout: Layout;
  look: Look;
  time: number;
  /** Food on its way down: `at` counts cells from the head, `size` is the digit eaten. */
  bulges?: readonly { at: number; size: number }[];
  /** 0–1 along the body: the centre of a rainbow wave after a big chain, or null. */
  pulse?: number | null;
  /** Where the eyes look, in device pixels. */
  lookAt?: { x: number; y: number } | null;
  mood?: Mood;
  /** 0–1: the loss: the body sags and dims from the head back. */
  sag?: number;
  /** Paints each part of the body its own colour (the filled box's mosaic), by position along it. */
  tint?: ((u: number, length: number) => string) | null;
  /** For a tunnel mouth, the mouth at the other end; the body is drawn going into one and out of the other. */
  tunnelPartner?: (cell: Cell) => Cell | null;
  /** Draws a tunnel mouth over the body, so the part of the body inside it is hidden. */
  coverHole?: (cell: Cell) => void;
  /**
   * How far the latest move has got, 0 to 1: the head glides from the cell it left into the
   * new one and the tail draws in from `vacated`, so the noodle slides rather than jumps.
   */
  lead?: number;
  /** The cell the tail left on the latest move, if it moved. */
  vacated?: Cell | null;
  reducedMotion?: boolean;
}

interface Sample {
  x: number;
  y: number;
  /** Position along the body in cells: 0 at the head's centre. */
  u: number;
  /** Unit tangent, pointing from head to tail. */
  tx: number;
  ty: number;
  /** The tube's radius here, in device pixels. */
  r: number;
}

/** The head is the rounded end of the same tube, only a touch fuller, never a ball on a stick. */
const HEAD_RADIUS = 0.43;
const BODY_RADIUS = 0.41;
/** Over how many cells the tail narrows, and how fine its tip is. */
const TAIL_CELLS = 2.8;
const TAIL_TIP = 0.45;
const SAMPLE_STEP = 0.08;
/** The saddle spans two whole segments, ring to ring. */
const SADDLE_FROM = 2.5;
const SADDLE_TO = 4.5;

interface Run {
  cells: Cell[];
  /** Index in the body of the run's first cell. */
  start: number;
  /** The mouth this run's head-side end went into the ground through, drawn running into it. */
  lead: Cell | null;
}

/**
 * Splits the body where it passes through a tunnel. The noodle moved from the cell after the
 * break onto one mouth and came out of the other, which is the cell before the break; so the
 * piece behind the break is drawn running on into the first mouth, and both mouths are drawn
 * over the body (except over the head, which peeks out of its hole).
 */
function runs(
  body: readonly Cell[],
  partner: ((cell: Cell) => Cell | null) | undefined,
): { pieces: Run[]; holes: Cell[] } {
  const pieces: Run[] = [];
  const holes: Cell[] = [];
  let current: Run = { cells: [], start: 0, lead: null };
  body.forEach((c, i) => {
    const prev = body[i - 1];
    if (prev && Math.abs(prev.x - c.x) + Math.abs(prev.y - c.y) !== 1) {
      pieces.push(current);
      const entry = partner?.(prev) ?? null;
      current = { cells: [], start: i, lead: entry };
      if (entry) holes.push(entry);
      if (i - 1 > 0) holes.push(prev);
    }
    current.cells.push(c);
  });
  if (current.cells.length > 0) pieces.push(current);
  return { pieces, holes };
}

/**
 * Points along a curve through the cell centres. Every bend is a quarter circle half a cell
 * across, wider than the tube is thick, so the inside of a bend stays soft instead of creasing.
 */
function sampleRun(layout: Layout, run: Run): Sample[] {
  const { cell } = layout;
  const cells = run.lead ? [run.lead, ...run.cells] : run.cells;
  const start = run.lead ? run.start - 1 : run.start;
  const pts = cells.map((c) => ({
    x: layout.left + (c.x + 0.5) * cell,
    y: layout.top + (c.y + 0.5) * cell,
  }));
  const samples: Sample[] = [];
  const push = (x: number, y: number, u: number) =>
    samples.push({ x, y, u: start + u, tx: 0, ty: 0, r: 0 });
  if (pts.length === 1) {
    push(pts[0]!.x, pts[0]!.y, 0);
  } else {
    const mid = (i: number) => ({
      x: (pts[i]!.x + pts[i + 1]!.x) / 2,
      y: (pts[i]!.y + pts[i + 1]!.y) / 2,
    });
    const line = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      u0: number,
      u1: number,
    ) => {
      const n = Math.max(1, Math.round((u1 - u0) / SAMPLE_STEP));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, u0 + (u1 - u0) * t);
      }
    };
    line(pts[0]!, mid(0), 0, 0.5);
    for (let i = 1; i < pts.length - 1; i++) {
      const a = mid(i - 1);
      const c = pts[i]!;
      const b = mid(i);
      const straight = Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6;
      if (straight) {
        line(a, b, i - 0.5, i + 0.5);
        continue;
      }
      // The arc's centre is the cell's inner corner; a and b sit a quarter turn apart round it.
      const ox = a.x + b.x - c.x;
      const oy = a.y + b.y - c.y;
      const n = Math.round(1 / SAMPLE_STEP);
      for (let k = 0; k < n; k++) {
        const angle = (k / n) * (Math.PI / 2);
        const x = ox + (a.x - ox) * Math.cos(angle) + (b.x - ox) * Math.sin(angle);
        const y = oy + (a.y - oy) * Math.cos(angle) + (b.y - oy) * Math.sin(angle);
        push(x, y, i - 0.5 + k / n);
      }
    }
    line(mid(pts.length - 2), pts.at(-1)!, pts.length - 1.5, pts.length - 1);
    push(pts.at(-1)!.x, pts.at(-1)!.y, pts.length - 1);
  }
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)]!;
    const b = samples[Math.min(samples.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    samples[i]!.tx = (b.x - a.x) / len;
    samples[i]!.ty = (b.y - a.y) / len;
  }
  return samples;
}

function touching(a: Cell | undefined, b: Cell | undefined): boolean {
  return !!a && !!b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** One piece of the curve cut down to `from`…`to` along the body, measured again from `from`. */
function trim(piece: readonly Sample[], from: number, to: number): Sample[] {
  const out: Sample[] = [];
  const at = (a: Sample, b: Sample, u: number): Sample => {
    const t = b.u === a.u ? 0 : (u - a.u) / (b.u - a.u);
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      u,
      tx: a.tx + (b.tx - a.tx) * t,
      ty: a.ty + (b.ty - a.ty) * t,
      r: a.r + (b.r - a.r) * t,
    };
  };
  piece.forEach((s, i) => {
    const prev = piece[i - 1];
    if (prev && prev.u < from && s.u > from) out.push(at(prev, s, from));
    if (s.u >= from && s.u <= to) out.push({ ...s });
    if (prev && prev.u < to && s.u > to) out.push(at(prev, s, to));
  });
  for (const sample of out) sample.u -= from;
  return out;
}

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function radiusAt(u: number, length: number, scene: NoodleScene): number {
  // One tube from end to end: a hair fuller at the head, easing into the body.
  let r = BODY_RADIUS + (HEAD_RADIUS - BODY_RADIUS) * (1 - smooth(u / 1.4));
  if (length > SADDLE_TO + 2)
    r *=
      1 + 0.06 * Math.max(0, Math.sin(((u - SADDLE_FROM) / (SADDLE_TO - SADDLE_FROM)) * Math.PI));
  // A long, soft taper that keeps narrowing right to a blunt, rounded tip; a short noodle
  // tapers over less of itself, so it never turns into a cone.
  const tail = Math.max(0, length - 1 - u);
  const taper = Math.min(TAIL_CELLS, Math.max(1, (length - 1) * 0.4));
  if (length > 2)
    r *= TAIL_TIP + (1 - TAIL_TIP) * Math.sin((Math.min(1, tail / taper) * Math.PI) / 2);
  for (const bulge of scene.bulges ?? []) {
    const d = u - bulge.at;
    r += (0.06 + bulge.size * 0.017) * Math.exp(-(d * d) / 0.5);
  }
  return r * scene.layout.cell;
}

/**
 * The canvases the noodle is painted on before it goes onto the garden, one set per garden
 * canvas: the body and everything inside it, a scratch layer for see-through washes (so their
 * strokes never darken where they overlap), and two small ones for the glow, blurred cheaply at
 * a quarter of the size.
 */
interface Layers {
  body: CanvasRenderingContext2D;
  wash: CanvasRenderingContext2D;
  glow: CanvasRenderingContext2D;
  glowBlur: CanvasRenderingContext2D;
}

const LAYERS = new WeakMap<object, Layers>();
const GLOW_SCALE = 0.25;

function layersFor(target: CanvasRenderingContext2D): Layers {
  const { width, height } = target.canvas;
  const existing = LAYERS.get(target.canvas);
  if (existing && existing.body.canvas.width === width && existing.body.canvas.height === height)
    return existing;
  const make = (w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w));
    canvas.height = Math.max(1, Math.ceil(h));
    return canvas.getContext('2d')!;
  };
  const layers: Layers = {
    body: make(width, height),
    wash: make(width, height),
    glow: make(width * GLOW_SCALE, height * GLOW_SCALE),
    glowBlur: make(width * GLOW_SCALE, height * GLOW_SCALE),
  };
  LAYERS.set(target.canvas, layers);
  return layers;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The part of the canvas the noodle can touch, so only that much is cleared and copied. */
function boundsOf(
  samples: readonly Sample[],
  margin: number,
  canvas: { width: number; height: number },
): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of samples) {
    x0 = Math.min(x0, s.x);
    y0 = Math.min(y0, s.y);
    x1 = Math.max(x1, s.x);
    y1 = Math.max(y1, s.y);
  }
  const x = Math.max(0, Math.floor(x0 - margin));
  const y = Math.max(0, Math.floor(y0 - margin));
  return {
    x,
    y,
    w: Math.max(1, Math.min(canvas.width, Math.ceil(x1 + margin)) - x),
    h: Math.max(1, Math.min(canvas.height, Math.ceil(y1 + margin)) - y),
  };
}

function copy(target: CanvasRenderingContext2D, layer: CanvasRenderingContext2D, box: Box): void {
  target.drawImage(layer.canvas, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h);
}

/** `rgba(r, g, b, a)` as the solid colour and its alpha, for painting washes solid first. */
function splitAlpha(colour: string): [string, number] {
  const match = /^rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/.exec(colour.replace(/\s+/g, ''));
  if (!match) return [colour, 1];
  return [`rgb(${match[1]},${match[2]},${match[3]})`, Number(match[4])];
}

/**
 * Strokes the tube along each piece of the curve, `widthOf` wide at every sample. Runs of the
 * same width (most of the body) go down as one long stroke; the width only steps where it
 * really changes, at the head, the tail, a bulge or the saddle. Round caps and joins keep the
 * steps seamless. `keep` limits the stroke to part of the body.
 */
function strokeTube(
  ctx: CanvasRenderingContext2D,
  pieces: readonly Sample[][],
  widthOf: (s: Sample) => number,
  options: {
    dx?: number;
    dy?: number;
    keep?: (s: Sample) => boolean;
    colourOf?: (s: Sample) => string;
  } = {},
): void {
  const { dx = 0, dy = 0, keep, colourOf } = options;
  const kept = (s: Sample | undefined) => s !== undefined && (!keep || keep(s));
  // Widths in half pixels; a colour too, when every part of the body has its own.
  const key = colourOf
    ? (s: Sample) => `${Math.round(widthOf(s) * 2)}${colourOf(s)}`
    : (s: Sample) => Math.round(widthOf(s) * 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const piece of pieces) {
    let i = 0;
    while (i < piece.length) {
      if (!kept(piece[i])) {
        i++;
        continue;
      }
      const runKey = key(piece[i]!);
      let j = i + 1;
      while (j < piece.length && kept(piece[j]) && key(piece[j]!) === runKey) j++;
      // Each run reaches one sample into its neighbours, so the joins overlap.
      const first = kept(piece[i - 1]) ? i - 1 : i;
      const last = kept(piece[j]) ? j : j - 1;
      const width = Math.round(widthOf(piece[i]!) * 2) / 2;
      if (width > 0) {
        if (colourOf) ctx.strokeStyle = colourOf(piece[i]!);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(piece[first]!.x + dx, piece[first]!.y + dy);
        if (first === last) ctx.lineTo(piece[first]!.x + dx + 0.01, piece[first]!.y + dy);
        for (let k = first + 1; k <= last; k++) {
          // Along a straight stretch the points in between add nothing but work.
          if (k < last && inLine(piece[k - 1]!, piece[k]!, piece[k + 1]!)) continue;
          ctx.lineTo(piece[k]!.x + dx, piece[k]!.y + dy);
        }
        ctx.stroke();
      }
      i = j;
    }
  }
}

function inLine(a: Sample, b: Sample, c: Sample): boolean {
  return Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 0.01;
}

/**
 * A see-through wash over the body: painted solid on the scratch layer, then laid on with its
 * alpha, so overlapping strokes never show as darker spots.
 */
function wash(
  target: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  box: Box,
  colour: string,
  alpha: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
  scratch.clearRect(box.x, box.y, box.w, box.h);
  scratch.save();
  scratch.strokeStyle = colour;
  scratch.fillStyle = colour;
  paint(scratch);
  scratch.restore();
  target.save();
  target.globalAlpha *= alpha;
  copy(target, scratch, box);
  target.restore();
}

export function drawNoodle(ctx: CanvasRenderingContext2D, scene: NoodleScene): void {
  const { layout, look, body } = scene;
  if (body.length === 0) return;
  const paint = look.noodle;
  const sag = scene.sag ?? 0;
  const cell = layout.cell;
  // Mid-move, the head is still part-way back towards the cell it left, and the tail part-way
  // into the cell it is leaving. Through a tunnel the head simply appears at the far mouth.
  const lead = Math.min(1, Math.max(0, scene.lead ?? 1));
  const headGlides = lead < 1 && touching(body[0], body[1]);
  const tailGlides = lead < 1 && touching(scene.vacated ?? undefined, body.at(-1));
  const drawn = tailGlides ? [...body, scene.vacated!] : body;
  const from = headGlides ? 1 - lead : 0;
  const to = drawn.length - 1 - (tailGlides ? lead : 0);
  const length = to - from + 1;
  const split = runs(drawn, scene.tunnelPartner);
  const pieces = split.pieces
    .map((r) => trim(sampleRun(layout, r), from, to))
    .filter((piece) => piece.length > 0);
  const samples = pieces.flat();
  if (samples.length === 0) return;
  if (sag > 0) {
    // The loss: the body droops a little, more towards the middle, as it goes limp.
    for (const s of samples)
      s.y += Math.sin(Math.min(1, s.u / Math.max(1, length - 1)) * Math.PI) * cell * 0.18 * sag;
  }
  for (const s of samples) s.r = radiusAt(s.u, length, scene);
  const outline = Math.max(1.5, cell * 0.05);
  const radius = BODY_RADIUS * cell;
  const box = boundsOf(samples, cell * 1.4, ctx.canvas);
  const layers = layersFor(ctx);

  // Under the noodle: a soft shadow on the soil by day, a glow round it by night.
  if (paint.shadow) {
    const [solid, alpha] = splitAlpha(paint.shadow);
    wash(ctx, layers.wash, box, solid, alpha, (w) =>
      strokeTube(w, pieces, (s) => s.r * 2, { dx: cell * 0.07, dy: cell * 0.12 }),
    );
  }
  if (paint.halo)
    paintHalo(ctx, layers, box, paint.halo, pieces, outline + cell * 0.16, 1 - sag * 0.8, cell);

  ctx.strokeStyle = paint.outline;
  strokeTube(ctx, pieces, (s) => (s.r + outline) * 2);

  // The body and everything inside it, on its own layer: what is painted from here on stays
  // inside the tube.
  const b = layers.body;
  b.clearRect(box.x, box.y, box.w, box.h);
  b.save();
  b.strokeStyle = paint.body;
  strokeTube(
    b,
    pieces,
    (s) => s.r * 2,
    scene.tint ? { colourOf: (s) => scene.tint!(Math.round(s.u * 3) / 3, length) } : {},
  );
  b.globalCompositeOperation = 'source-atop';
  const rings = ringPoints(pieces, (u) => radiusAt(u, length, scene));
  // The saddle: a peachier band a few cells behind the head, as on a real earthworm.
  const saddleStart = rings.find((ring) => ring.u === SADDLE_FROM);
  const saddleEnd = rings.find((ring) => ring.u === SADDLE_TO);
  if (length > SADDLE_TO + 2 && !scene.tint && saddleStart && saddleEnd) {
    b.save();
    // Cut along the two rings that bound it, so its ends wrap round the tube like the rings do.
    capRegion(b, saddleStart, saddleStart.r, 1);
    b.clip();
    capRegion(b, saddleEnd, saddleEnd.r, -1);
    b.clip();
    b.strokeStyle = paint.saddle;
    strokeTube(b, pieces, (s) => s.r * 2 + 2, {
      keep: (s) => s.u > SADDLE_FROM - 0.6 && s.u < SADDLE_TO + 0.6,
    });
    b.restore();
  }
  // Roundness: a shade along the lower side, then a soft lighter core towards the light.
  wash(b, layers.wash, box, paint.outline, look.dark ? 0.26 : 0.2, (w) =>
    strokeTube(w, pieces, (s) => s.r * 2, { dx: radius * 0.1, dy: radius * 0.5 }),
  );
  wash(b, layers.wash, box, paint.belly, scene.tint ? 0.25 : 0.55, (w) =>
    strokeTube(w, pieces, (s) => s.r * 1.16, { dx: -radius * 0.06, dy: -radius * 0.18 }),
  );
  paintRings(b, rings, paint.ring, cell);
  if (scene.pulse !== null && scene.pulse !== undefined)
    paintPulse(b, samples, scene.pulse, length);
  paintGloss(b, pieces, paint.highlight, look.dark, length, radius);
  if (sag > 0) {
    // Colour drains from the head back, segment by segment.
    const [solid, alpha] = splitAlpha(
      look.dark ? 'rgba(20, 12, 30, 0.6)' : 'rgba(120, 110, 105, 0.55)',
    );
    wash(b, layers.wash, box, solid, alpha, (w) =>
      strokeTube(w, pieces, (s) => s.r * 2.1, { keep: (s) => s.u <= sag * (length + 2) }),
    );
  }
  b.restore();
  copy(ctx, b, box);

  // Tunnel mouths over the body: what went in is hidden, the head still peeks out of its hole.
  if (scene.coverHole) for (const hole of split.holes) scene.coverHole(hole);
  const head = samples.find((sample) => sample.u === 0) ?? samples[0]!;
  paintFace(ctx, head.x, head.y, HEAD_RADIUS * cell, scene);
}

/** The night glow: the body's shape, small and blurred, laid round the noodle. */
function paintHalo(
  ctx: CanvasRenderingContext2D,
  layers: Layers,
  box: Box,
  colour: string,
  pieces: readonly Sample[][],
  spread: number,
  strength: number,
  cell: number,
): void {
  const [solid, alpha] = splitAlpha(colour);
  const small: Box = {
    x: Math.floor(box.x * GLOW_SCALE),
    y: Math.floor(box.y * GLOW_SCALE),
    w: Math.ceil(box.w * GLOW_SCALE) + 1,
    h: Math.ceil(box.h * GLOW_SCALE) + 1,
  };
  const { glow, glowBlur } = layers;
  glow.clearRect(small.x, small.y, small.w, small.h);
  glow.save();
  glow.scale(GLOW_SCALE, GLOW_SCALE);
  glow.strokeStyle = solid;
  strokeTube(glow, pieces, (s) => (s.r + spread) * 2);
  glow.restore();
  glowBlur.clearRect(small.x, small.y, small.w, small.h);
  glowBlur.save();
  glowBlur.filter = `blur(${Math.max(1, cell * 0.7 * GLOW_SCALE * 0.5)}px)`;
  copy(glowBlur, glow, small);
  glowBlur.restore();
  ctx.save();
  ctx.globalAlpha = alpha * strength;
  ctx.drawImage(
    glowBlur.canvas,
    small.x,
    small.y,
    small.w,
    small.h,
    small.x / GLOW_SCALE,
    small.y / GLOW_SCALE,
    small.w / GLOW_SCALE,
    small.h / GLOW_SCALE,
  );
  ctx.restore();
}

/** The gloss: a soft streak along the upper-left of the tube, one stroke per piece of body. */
function paintGloss(
  ctx: CanvasRenderingContext2D,
  pieces: readonly Sample[][],
  colour: string,
  dark: boolean,
  length: number,
  shine: number,
): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, alpha] of [
    [0.3, dark ? 0.14 : 0.22],
    [0.12, dark ? 0.45 : 0.7],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = shine * width;
    ctx.beginPath();
    for (const piece of pieces) {
      let started = false;
      for (const s of piece) {
        if (s.u <= 0.55 || s.u >= length - 1.3) continue;
        // Towards the light, up and to the left: near the top of a level run, near the left of
        // an upright one, never jumping across the tube at a bend, and narrowing with the tail.
        const x = s.x - s.r * 0.38;
        const y = s.y - s.r * 0.4;
        if (started) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        started = true;
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

type Ring = Sample;

/**
 * Where the rings sit: exactly on every cell boundary behind the head, found between the samples
 * either side, so they slide along with the body instead of hopping from sample to sample.
 */
function ringPoints(pieces: readonly Sample[][], radiusOf: (u: number) => number): Ring[] {
  const rings: Ring[] = [];
  for (const piece of pieces) {
    if (piece.length < 2) continue;
    // The first half-cell mark at or after the piece's start, and never the one by the head.
    const first = Math.max(1.5, Math.ceil(piece[0]!.u - 0.5) + 0.5);
    let i = 1;
    for (let mark = first; mark <= piece.at(-1)!.u; mark++) {
      while (i < piece.length - 1 && piece[i]!.u < mark) i++;
      const a = piece[i - 1]!;
      const b = piece[i]!;
      const t = b.u === a.u ? 0 : (mark - a.u) / (b.u - a.u);
      const tx = a.tx + (b.tx - a.tx) * t;
      const ty = a.ty + (b.ty - a.ty) * t;
      const len = Math.hypot(tx, ty) || 1;
      rings.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        u: mark,
        tx: tx / len,
        ty: ty / len,
        r: radiusOf(mark),
      });
    }
  }
  return rings;
}

/** A ring reaches this share of the tube's radius, and bows towards the tail by this share of it. */
const RING_REACH = 0.86;
const RING_BOW = 0.32;

/** Rings across the body: a short curved line at every cell boundary. */
function paintRings(
  ctx: CanvasRenderingContext2D,
  rings: readonly Ring[],
  colour: string,
  cell: number,
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1.2, cell * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of rings) {
    const r = s.r * RING_REACH;
    const nx = -s.ty;
    const ny = s.tx;
    // Bowed towards the tail, so the rings read as wrapping round a tube.
    const bow = r * RING_BOW;
    ctx.moveTo(s.x + nx * r, s.y + ny * r);
    ctx.quadraticCurveTo(s.x + s.tx * bow, s.y + s.ty * bow, s.x - nx * r, s.y - ny * r);
  }
  ctx.stroke();
}

/**
 * The side of a ring towards the tail (`keep` 1) or towards the head (`keep` -1), as a path to
 * clip with. Its edge follows the ring's bowed curve across the tube.
 */
function capRegion(ctx: CanvasRenderingContext2D, s: Sample, radius: number, keep: 1 | -1): void {
  const reach = radius * RING_REACH;
  // The ring is a quadratic curve; its middle lies half its control point's bow along the tube.
  const depth = (reach * RING_BOW) / 2;
  // Far enough to take in the whole band, two cells long, round any bend.
  const far = radius * 10;
  const nx = -s.ty;
  const ny = s.tx;
  const at = (n: number, t: number): [number, number] => [
    s.x + nx * n + s.tx * t,
    s.y + ny * n + s.ty * t,
  ];
  ctx.beginPath();
  ctx.moveTo(...at(-far, 0));
  for (let k = -8; k <= 8; k++) {
    const n = (k / 8) * radius * 1.1;
    ctx.lineTo(...at(n, depth * (1 - (n / reach) ** 2)));
  }
  ctx.lineTo(...at(far, 0));
  ctx.lineTo(...at(far, keep * far));
  ctx.lineTo(...at(-far, keep * far));
  ctx.closePath();
}

/** A band of rainbow travelling from head to tail. */
function paintPulse(
  ctx: CanvasRenderingContext2D,
  samples: readonly Sample[],
  pulse: number,
  length: number,
): void {
  const centre = pulse * (length + 6) - 3;
  for (const s of samples) {
    const d = s.u - centre;
    if (Math.abs(d) > 3.2) continue;
    const alpha = 0.78 * Math.cos((d / 3.2) * (Math.PI / 2));
    ctx.fillStyle = `hsla(${(s.u * 40 + pulse * 360) % 360}, 95%, 66%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.02, 0, Math.PI * 2);
    ctx.fill();
  }
}

const STEP_X: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1 };
const STEP_Y: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0 };

/** An upright cartoon face, nudged towards the way the noodle is going. */
function paintFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  scene: NoodleScene,
): void {
  const paint = scene.look.noodle;
  const dir = scene.heading ?? 'right';
  const mood = scene.mood ?? 'calm';
  const fx = x + STEP_X[dir] * r * 0.2;
  const fy = y + STEP_Y[dir] * r * 0.12 - r * 0.08;
  const spread = r * 0.38;
  const eyeY = fy - r * 0.1;
  const blink = !scene.reducedMotion && mood === 'calm' && scene.time % 4.2 > 4.05;

  ctx.save();
  for (const side of [-1, 1]) {
    const ex = fx + side * spread;
    ctx.fillStyle = paint.cheek;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(ex + side * r * 0.16, eyeY + r * 0.38, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const side of [-1, 1]) {
    const ex = fx + side * spread;
    if (mood === 'delight' || blink) {
      // Happy closed eyes: upturned arcs, bold enough to read at play size.
      ctx.strokeStyle = paint.pupil;
      ctx.lineWidth = r * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, eyeY + r * 0.12, r * 0.24, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = paint.outline;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.3, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paint.eye;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.25, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (mood === 'dizzy') {
      ctx.strokeStyle = paint.pupil;
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) {
        const rr = (a / (Math.PI * 4)) * r * 0.2;
        const px = ex + Math.cos(a + scene.time * 6) * rr;
        const py = eyeY + Math.sin(a + scene.time * 6) * rr;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      continue;
    }
    let lx = STEP_X[dir] * 0.5;
    let ly = STEP_Y[dir] * 0.5;
    if (scene.lookAt) {
      const dx = scene.lookAt.x - ex;
      const dy = scene.lookAt.y - eyeY;
      const d = Math.hypot(dx, dy) || 1;
      lx = dx / d;
      ly = dy / d;
    }
    const px = ex + lx * r * 0.09;
    const py = eyeY + ly * r * 0.11;
    ctx.fillStyle = paint.pupil;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.15, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - r * 0.05, py - r * 0.07, r * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  const mouthY = fy + r * 0.34;
  ctx.strokeStyle = paint.mouth;
  ctx.fillStyle = paint.mouth;
  ctx.lineWidth = r * 0.08;
  ctx.lineCap = 'round';
  if (mood === 'munch') {
    ctx.beginPath();
    ctx.ellipse(fx, mouthY + r * 0.02, r * 0.13, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'dizzy') {
    ctx.beginPath();
    ctx.moveTo(fx - r * 0.14, mouthY);
    ctx.quadraticCurveTo(fx - r * 0.05, mouthY - r * 0.08, fx, mouthY);
    ctx.quadraticCurveTo(fx + r * 0.05, mouthY + r * 0.08, fx + r * 0.14, mouthY);
    ctx.stroke();
  } else {
    const wide = mood === 'delight' ? 0.2 : 0.13;
    ctx.beginPath();
    ctx.arc(fx, mouthY - r * 0.1, r * wide, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}
