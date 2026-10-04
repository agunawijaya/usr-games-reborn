import { BURST_POINTS, CORAL, SEAWEED } from '../engine/game';
import { AIR_ROWS, type Layout } from './layout';
import { darken, depthColour, FONT_DISPLAY, FONT_UI, type Look, withAlpha } from './look';
import { drawClusters, type PebbleCell } from './sinkers';
import { drawCoral, drawKelp } from './specials';

/**
 * The moments on top of the tank: rows that burst into a column of bubbles, light blooming down
 * through the water, the score riding up in a bubble to pop at the surface, the trail a plunge
 * leaves, and the murk that clouds the water at the end. Everything is a function of the age of
 * the moment, so a still frame can be taken at any instant.
 */

export interface BurstMoment {
  /** The rows that were cleared, top to bottom. */
  rows: readonly number[];
  /** What was in them, for the crack. */
  cells: readonly PebbleCell[];
  points: number;
  combo: number;
  level: number;
  /** Seconds, on the frame's clock. */
  born: number;
}

export interface Trail {
  x: number;
  /** Rows from and to, the fall a plunge made. */
  from: number;
  to: number;
  born: number;
}

export const BURST_SECONDS = 2.6;
export const TRAIL_SECONDS = 0.7;

/** A stable pseudo-random number for bubble `i` of a moment. */
function hash(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function paintBubble(
  ctx: CanvasRenderingContext2D,
  look: Look,
  x: number,
  y: number,
  r: number,
  alpha = 1,
): void {
  // Clear in the middle, brighter towards the rim, as a real bubble is.
  const film = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  film.addColorStop(0, withAlpha(look.bubbleShine, 0));
  film.addColorStop(1, withAlpha(look.bubbleShine, 0.3 * alpha));
  ctx.fillStyle = film;
  ctx.strokeStyle = withAlpha(look.bubbleRim, alpha);
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = withAlpha(look.bubbleShine, 0.9 * alpha);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.24, r * 0.14, -0.7, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * How long a burst's rows take to crack into bubbles: longer the more rows go, so a four-row burst
 * gets its moment. The session holds the next sinker back until the cells above have dropped.
 */
export function crackSeconds(rows: number): number {
  return 0.35 + rows * 0.1;
}

/** How long a burst keeps the tank busy: the crack, then the drop of everything above. */
export function burstHoldSeconds(rows: number): number {
  return crackSeconds(rows) + DROP_SECONDS;
}

const DROP_SECONDS = 0.28;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * How far the cells above a burst have fallen into its place: 0 hanging, 1 settled. They hang
 * until the rows have gone, then drop.
 */
export function dropProgress(age: number, rows: number): number {
  const t = clamp01((age - crackSeconds(rows)) / DROP_SECONDS);
  return t * t;
}

export function drawBurst(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  burst: BurstMoment,
  time: number,
  reduced: boolean,
): void {
  const age = time - burst.born;
  if (age < 0 || age > BURST_SECONDS) return;
  ctx.save();
  drawBloom(ctx, layout, look, burst, age);
  drawCrack(ctx, layout, look, burst, age);
  drawBubbleColumn(ctx, layout, look, burst, age, reduced);
  ctx.restore();
}

/** Light blooming down through the water to the rows: rays from the surface and a glow round them. */
function drawBloom(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  burst: BurstMoment,
  age: number,
): void {
  const bloom =
    Math.max(0, Math.sin(Math.min(1, age / 1.5) * Math.PI)) *
    (0.4 + burst.rows.length * 0.12) *
    (look.dark ? 0.6 : 1);
  if (bloom <= 0) return;
  const { cell } = layout;
  const tankX = layout.left;
  const tankW = layout.cols * cell;
  const surface = layout.top - cell * 0.2;
  const rowTop = layout.top + burst.rows[0]! * cell;
  const rowBottom = layout.top + (burst.rows.at(-1)! + 1) * cell;
  ctx.globalCompositeOperation = look.dark ? 'lighter' : 'screen';
  const beam = ctx.createLinearGradient(0, surface, 0, rowBottom + cell);
  beam.addColorStop(0, withAlpha(look.ray, 0.7 * bloom));
  beam.addColorStop(1, withAlpha(look.ray, 0.08 * bloom));
  ctx.fillStyle = beam;
  for (let k = 0; k < 5; k++) {
    const spread = (k - 2) * tankW * 0.16;
    const width = tankW * (0.17 - Math.abs(k - 2) * 0.03);
    ctx.beginPath();
    ctx.moveTo(tankX + tankW / 2 + spread * 0.3 - width * 0.3, surface);
    ctx.lineTo(tankX + tankW / 2 + spread * 0.3 + width * 0.3, surface);
    ctx.lineTo(tankX + tankW / 2 + spread + width, rowBottom + cell);
    ctx.lineTo(tankX + tankW / 2 + spread - width, rowBottom + cell);
    ctx.closePath();
    ctx.fill();
  }
  const middle = (rowTop + rowBottom) / 2;
  const glow = ctx.createRadialGradient(
    tankX + tankW / 2,
    middle,
    0,
    tankX + tankW / 2,
    middle,
    tankW * 0.75,
  );
  glow.addColorStop(0, withAlpha(look.ray, 0.6 * bloom));
  glow.addColorStop(1, withAlpha(look.ray, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(tankX - tankW * 0.3, middle - tankW * 0.8, tankW * 1.6, tankW * 1.6);
  ctx.globalCompositeOperation = 'source-over';
}

/** How long one pebble takes to break into bubbles, once its crack has run through it. */
const BREAK_SECONDS = 0.22;

/**
 * When a bursting pebble breaks: broadly the ones by the walls first, so the crack runs in to the
 * middle, but raggedly, never in a straight front.
 */
function breakStart(layout: Layout, burst: BurstMoment, c: PebbleCell): number {
  const fromWall = Math.min(c.x, layout.cols - 1 - c.x) / ((layout.cols - 1) / 2);
  const order = fromWall * 0.65 + hash(c.x * 31 + c.y * 17, burst.born + 3) * 0.35;
  return 0.12 + order * (crackSeconds(burst.rows.length) - 0.12 - BREAK_SECONDS);
}

/**
 * The rows cracking: the sinkers in them light up white-hot, still fused, with cracks running
 * through the glass; then pebble by pebble, from the walls in, they break apart into bubbles.
 */
function drawCrack(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  burst: BurstMoment,
  age: number,
): void {
  const { cell } = layout;
  const lit = clamp01(age * 8) * (0.6 - clamp01((age - 0.2) * 2) * 0.25);
  const whole = burst.cells.filter((c) => age < breakStart(layout, burst, c));
  const glass = whole.filter((c) => c.kind !== CORAL && c.kind !== SEAWEED);
  if (glass.length > 0) drawClusters(ctx, layout, look, glass, { time: age, glow: 1, lit });
  const options = { time: age, lit, still: true };
  drawCoral(
    ctx,
    layout,
    look,
    whole.filter((c) => c.kind === CORAL),
    options,
  );
  drawKelp(
    ctx,
    layout,
    look,
    whole.filter((c) => c.kind === SEAWEED),
    options,
  );
  ctx.save();
  ctx.lineCap = 'round';
  for (const c of burst.cells) {
    const cx = layout.left + (c.x + 0.5) * cell;
    const cy = layout.top + (c.y + 0.5) * cell;
    const broken = clamp01((age - breakStart(layout, burst, c)) / BREAK_SECONDS);
    if (broken >= 1) continue;
    if (broken === 0) {
      // Cracks spreading through the glass from the middle of each pebble.
      const reach = clamp01((age - 0.05) / 0.3);
      if (reach <= 0) continue;
      ctx.strokeStyle = withAlpha(
        look.dark ? look.bubbleShine : darken(depthColour(look, c.depth), 0.4),
        0.8,
      );
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = hash(c.x * 7 + c.y * 13 + k, burst.born) * Math.PI * 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * cell * 0.4 * reach, cy + Math.sin(a) * cell * 0.4 * reach);
      }
      ctx.stroke();
      continue;
    }
    // Breaking: the pebble turns into one big bubble, its colour draining out, swells, and pops
    // into the small ones that rise.
    const r = cell * 0.42 * (1 + broken * 0.22);
    const bx = cx + Math.sin(broken * 7 + c.x) * cell * 0.08 * broken;
    const by = cy - cell * 1.1 * broken * broken;
    ctx.fillStyle = withAlpha(depthColour(look, c.depth), 0.55 * (1 - broken));
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    paintBubble(ctx, look, bx, by, r, 1 - broken * broken);
  }
  ctx.restore();
}

/** Hundreds of bubbles, nine or so from every cell, rushing up the tank as a column. */
function drawBubbleColumn(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  burst: BurstMoment,
  age: number,
  reduced: boolean,
): void {
  const { cell } = layout;
  const tankX = layout.left;
  const tankW = layout.cols * cell;
  const surface = layout.top - cell * 0.2;
  const middle = tankX + tankW / 2;
  const count = burst.cells.length * 10;
  const salt = burst.born;
  for (let i = 0; i < count; i++) {
    const source = burst.cells[i % burst.cells.length]!;
    // Each pebble lets its bubbles go as it breaks.
    const delay = breakStart(layout, burst, source) - 0.04 + hash(i, salt) * BREAK_SECONDS;
    const t = age - delay;
    if (t <= 0) continue;
    const speed = cell * (8 + hash(i, salt + 1) * 9);
    const lift = speed * t + cell * 7 * t * t;
    const x0 = layout.left + (source.x + 0.15 + hash(i, salt + 2) * 0.7) * cell;
    const y0 = layout.top + (source.y + 0.2 + hash(i, salt + 3) * 0.6) * cell;
    // Drawn in towards the middle as they rise: a column, not a spray.
    const x =
      x0 +
      (middle - x0) * Math.min(0.55, t * 1.1) * 0.8 +
      (reduced ? 0 : Math.sin(t * 9 + i) * cell * 0.09);
    const y = y0 - lift;
    if (y < surface) continue;
    const r =
      cell * (0.05 + hash(i, salt + 4) * hash(i, salt + 5) * 0.26) * Math.min(1, 0.4 + t * 3);
    const fade = Math.min(1, (y - surface) / (cell * 1.5)) * Math.min(1, t * 8);
    paintBubble(ctx, look, x, y, r, fade);
  }
  // Pops along the surface as the column arrives.
  for (let k = 0; k < 12; k++) {
    const popAt = 0.5 + k * 0.07;
    const p = (age - popAt) / 0.35;
    if (p < 0 || p > 1) continue;
    const x = tankX + tankW * (0.15 + hash(k, salt + 9) * 0.7);
    ctx.strokeStyle = withAlpha(look.bubbleRim, 1 - p);
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    ctx.ellipse(x, surface, cell * (0.15 + p * 0.5), cell * (0.05 + p * 0.12), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** The bubbles that carry a burst's score: the rows' worth, then each thing that multiplies it. */
export function scoreFactors(
  burst: Pick<BurstMoment, 'rows' | 'combo' | 'level'>,
): { text: string; label: string }[] {
  const rows = burst.rows.length;
  const factors = [
    { text: String(BURST_POINTS[Math.min(4, rows)]), label: rows > 1 ? `${rows} rows` : '1 row' },
  ];
  if (burst.combo > 1) factors.push({ text: `×${burst.combo}`, label: 'combo' });
  if (burst.level > 1) factors.push({ text: `×${burst.level}`, label: 'level' });
  return factors;
}

const SCORE_START = 0.12;
const SCORE_RISE = 0.85;
const SCORE_POP_GAP = 0.16;

/** Seconds after a burst at which each of its score bubbles pops: for the sound to match. */
export function scorePopTimes(burst: Pick<BurstMoment, 'rows' | 'combo' | 'level'>): number[] {
  return scoreFactors(burst).map((_, k) => SCORE_START + SCORE_RISE + k * SCORE_POP_GAP);
}

/**
 * The score of a burst rides up in bubbles, one for the rows and one for each multiplier; they
 * pop one by one at the surface, and the total is left floating over the tank.
 */
export function drawScoreBubble(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  burst: BurstMoment,
  time: number,
): void {
  const age = time - burst.born;
  // Classic 1992 pays nothing for rows: its bursts carry no score.
  if (burst.points <= 0 || age < SCORE_START || age > BURST_SECONDS) return;
  const { cell } = layout;
  const surface = layout.top - cell * 0.2;
  const startY = layout.top + ((burst.rows[0]! + burst.rows.at(-1)! + 1) / 2) * cell;
  const middle = layout.left + (layout.cols * cell) / 2;
  const factors = scoreFactors(burst);
  const lastPop = SCORE_START + SCORE_RISE + (factors.length - 1) * SCORE_POP_GAP;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  factors.forEach((factor, k) => {
    const born = SCORE_START + k * 0.06;
    const popAt = SCORE_START + SCORE_RISE + k * SCORE_POP_GAP;
    const popping = clamp01((age - popAt) / 0.22);
    if (popping >= 1) return;
    const rise = clamp01((age - born) / (popAt - born));
    const eased = 1 - Math.pow(1 - rise, 2);
    const r = cell * (k === 0 ? 1.15 + burst.rows.length * 0.08 : 0.95);
    const x =
      middle +
      (k - (factors.length - 1) / 2) * cell * 2.4 +
      Math.sin(age * 5 + k * 2) * cell * 0.08;
    const y = startY + (surface + r * 0.9 - startY) * eased;
    const alpha = 1 - popping;
    paintBubble(ctx, look, x, y, r * (1 + popping * 0.5), alpha);
    ctx.globalAlpha = alpha;
    lettering(ctx, look, factor.text, x, y - r * 0.14, r * 0.6, FONT_DISPLAY, 800);
    lettering(
      ctx,
      look,
      factor.label,
      x,
      y + r * 0.42,
      Math.max(12 * layout.dpr, r * 0.27),
      FONT_UI,
      700,
    );
    ctx.globalAlpha = 1;
  });
  // The total, left floating over the tank once the last bubble has popped.
  const shown = clamp01((age - lastPop) / 0.2);
  if (shown > 0) {
    const fade = 1 - clamp01((age - BURST_SECONDS + 0.5) / 0.5);
    ctx.globalAlpha = shown * fade;
    // Above the tank's lip, clear of the next sinker coming in through the air.
    const lip = layout.top - cell * AIR_ROWS;
    const y = lip - cell * (0.75 + shown * 0.2 + (age - lastPop) * 0.25);
    lettering(
      ctx,
      look,
      `+${burst.points.toLocaleString('en-GB')}`,
      middle,
      y,
      cell * (1 + burst.rows.length * 0.1),
      FONT_DISPLAY,
      800,
    );
  }
  ctx.restore();
}

/** Score lettering: bold, with a halo so it reads over bubbles and light alike. */
function lettering(
  ctx: CanvasRenderingContext2D,
  look: Look,
  text: string,
  x: number,
  y: number,
  size: number,
  family: string,
  weight: number,
): void {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.strokeStyle = look.popOutline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = look.popInk;
  ctx.fillText(text, x, y);
}

/** A plunge leaves a short-lived wake of small bubbles where it fell. */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  trail: Trail,
  time: number,
): void {
  const age = time - trail.born;
  if (age < 0 || age > TRAIL_SECONDS) return;
  const { cell } = layout;
  const fade = 1 - age / TRAIL_SECONDS;
  const rows = trail.to - trail.from;
  ctx.save();
  for (let i = 0; i < rows * 4; i++) {
    const along = hash(i, trail.born);
    const y = layout.top + (trail.from + along * rows) * cell - age * cell * 1.2;
    const x = layout.left + (trail.x + 0.5) * cell + (hash(i, trail.born + 1) - 0.5) * cell * 1.2;
    paintBubble(ctx, look, x, y, cell * (0.04 + hash(i, trail.born + 2) * 0.08), fade);
  }
  ctx.restore();
}

/** The end of a dive: the water clouds over from the bottom up. */
export function drawMurk(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  amount: number,
): void {
  if (amount <= 0) return;
  const bottom = layout.floor;
  const top = layout.top - layout.cell;
  const rise = top + (bottom - top) * (1 - Math.min(1, amount));
  const murk = ctx.createLinearGradient(0, rise - layout.cell * 3, 0, bottom);
  murk.addColorStop(0, withAlpha(look.murk, 0));
  murk.addColorStop(0.35, look.murk);
  murk.addColorStop(1, look.murk);
  ctx.save();
  ctx.fillStyle = murk;
  ctx.fillRect(
    layout.left - layout.cell,
    rise - layout.cell * 3,
    (layout.cols + 2) * layout.cell,
    bottom - rise + layout.cell * 3,
  );
  ctx.restore();
}
