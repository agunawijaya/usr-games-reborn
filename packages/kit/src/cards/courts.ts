import type { Suit } from './deck';
import type { DeckPalette } from './palette';
import { type Ctx, drawPip } from './pips';

/**
 * Twelve court figures in a stylised Art Deco manner, drawn for this deck. Each figure is a
 * half-length portrait on a 100 × 100 grid with the waist on the bottom edge; the card prints
 * it twice, the second copy turned head to foot, as real court cards are. A figure is assembled
 * from a few shared parts (robe, collar, hair, headwear, the thing it holds) chosen per card,
 * so the twelve read as one family while every suit keeps its own motif:
 * spades a fern frond, hearts a rose, diamonds a cut facet, clubs a trefoil.
 */

export type CourtRank = 'jack' | 'queen' | 'king';

type Headwear =
  | 'ziggurat'
  | 'arched'
  | 'sunburst'
  | 'tiara-rays'
  | 'tiara-arc'
  | 'tiara-steps'
  | 'cap-plume'
  | 'cap-chevron';
type Hair =
  'beard-stepped' | 'beard-round' | 'beard-pointed' | 'bob' | 'waves' | 'pageboy' | 'curls';
type Collar = 'stepped' | 'fan' | 'chevron' | 'ermine';
type Holds =
  'sceptre' | 'orb' | 'fan' | 'rose' | 'mirror' | 'lily' | 'lantern' | 'quill' | 'key' | 'branch';

export interface CourtSpec {
  rank: CourtRank;
  suit: Suit;
  /** Index into the palette's skin and hair tones. */
  skin: number;
  hair: number;
  headwear: Headwear;
  hairStyle: Hair;
  collar: Collar;
  holds: Holds;
}

function court(
  rank: CourtRank,
  suit: Suit,
  skin: number,
  hair: number,
  headwear: Headwear,
  hairStyle: Hair,
  collar: Collar,
  holds: Holds,
): CourtSpec {
  return { rank, suit, skin, hair, headwear, hairStyle, collar, holds };
}

export const COURTS: readonly CourtSpec[] = [
  court('king', 'spades', 2, 2, 'ziggurat', 'beard-stepped', 'stepped', 'sceptre'),
  court('queen', 'spades', 0, 0, 'tiara-rays', 'bob', 'fan', 'fan'),
  court('jack', 'spades', 3, 3, 'cap-plume', 'pageboy', 'chevron', 'lantern'),
  court('king', 'hearts', 0, 1, 'arched', 'beard-round', 'ermine', 'sceptre'),
  court('queen', 'hearts', 1, 2, 'tiara-arc', 'waves', 'fan', 'rose'),
  court('jack', 'hearts', 2, 0, 'cap-chevron', 'curls', 'stepped', 'quill'),
  court('king', 'diamonds', 3, 0, 'sunburst', 'beard-pointed', 'chevron', 'orb'),
  court('queen', 'diamonds', 2, 1, 'tiara-steps', 'bob', 'stepped', 'mirror'),
  court('jack', 'diamonds', 0, 3, 'cap-plume', 'pageboy', 'chevron', 'key'),
  court('king', 'clubs', 1, 2, 'ziggurat', 'beard-stepped', 'chevron', 'sceptre'),
  court('queen', 'clubs', 3, 0, 'tiara-rays', 'waves', 'fan', 'lily'),
  court('jack', 'clubs', 1, 1, 'cap-chevron', 'curls', 'stepped', 'branch'),
];

export function courtSpec(rank: CourtRank, suit: Suit): CourtSpec {
  return COURTS.find((c) => c.rank === rank && c.suit === suit)!;
}

// —— drawing helpers ——

const paths = new Map<string, Path2D>();

function path(d: string): Path2D {
  let p = paths.get(d);
  if (!p) {
    p = new Path2D(d);
    paths.set(d, p);
  }
  return p;
}

interface Pen {
  ctx: Ctx;
  palette: DeckPalette;
  spec: CourtSpec;
  /** The ink outline's width in grid units. */
  line: number;
}

function fill(pen: Pen, d: string, colour: string, outline = true): void {
  const { ctx } = pen;
  ctx.fillStyle = colour;
  ctx.fill(path(d));
  if (outline) {
    ctx.strokeStyle = pen.palette.ink;
    ctx.lineWidth = pen.line;
    ctx.lineJoin = 'round';
    ctx.stroke(path(d));
  }
}

function stroke(pen: Pen, d: string, colour: string, width: number): void {
  const { ctx } = pen;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(path(d));
}

function ellipse(
  pen: Pen,
  x: number,
  y: number,
  rx: number,
  ry: number,
  colour: string,
  outline = true,
): void {
  const { ctx } = pen;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = pen.palette.ink;
    ctx.lineWidth = pen.line;
    ctx.stroke();
  }
}

/** A suit mark with a fine ink rim, so it reads as a gilt or enamelled object, not print. */
function emblem(pen: Pen, suit: Suit, x: number, y: number, size: number, colour: string): void {
  const { ctx, palette } = pen;
  drawPip(ctx, suit, x, y, size + pen.line * 2.2, palette.ink);
  drawPip(ctx, suit, x, y, size, colour);
}

function robe(pen: Pen) {
  return pen.palette.robes[pen.spec.suit];
}

function skin(pen: Pen): string {
  return pen.palette.skin[pen.spec.skin % pen.palette.skin.length]!;
}

function hairColour(pen: Pen): string {
  return pen.palette.hair[pen.spec.hair % pen.palette.hair.length]!;
}

// —— the panel behind the figure ——

/** A faint Deco ground: rays for kings, arcs for queens, a lattice for jacks. */
function drawGround(pen: Pen): void {
  const { ctx, palette, spec } = pen;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 0.7;
  if (spec.rank === 'king') {
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (Math.PI * i) / 16;
      ctx.beginPath();
      ctx.moveTo(50, 36);
      ctx.lineTo(50 + Math.cos(a) * 80, 36 + Math.sin(a) * 80);
      ctx.stroke();
    }
  } else if (spec.rank === 'queen') {
    for (let r = 18; r < 90; r += 7) {
      ctx.beginPath();
      ctx.arc(50, 36, r, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.22;
    for (let i = -100; i < 200; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 100, 100);
      ctx.moveTo(i + 100, 0);
      ctx.lineTo(i, 100);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// —— the head group: drawn larger than the body, as court cards are ——

const HEAD_SCALE = 1.14;
const NECK_BASE = { x: 50, y: 57.5 };
const HEAD_ANCHOR_Y = 61;

function withHead(pen: Pen, draw: () => void): void {
  const { ctx } = pen;
  ctx.save();
  ctx.translate(NECK_BASE.x, HEAD_ANCHOR_Y);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  ctx.translate(-NECK_BASE.x, -NECK_BASE.y);
  draw();
  ctx.restore();
}

/** The queens' lace fan collar, standing behind the head. */
function drawFanCollar(pen: Pen): void {
  const { ctx, palette } = pen;
  const blades = 11;
  for (let i = 0; i < blades; i++) {
    const a0 = Math.PI * (1.08 + (0.84 * i) / blades);
    const a1 = Math.PI * (1.08 + (0.84 * (i + 1)) / blades);
    const am = (a0 + a1) / 2;
    ctx.beginPath();
    ctx.moveTo(50, 56);
    ctx.lineTo(50 + Math.cos(a0) * 26, 48 + Math.sin(a0) * 26);
    ctx.quadraticCurveTo(
      50 + Math.cos(am) * 31,
      48 + Math.sin(am) * 31,
      50 + Math.cos(a1) * 26,
      48 + Math.sin(a1) * 26,
    );
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? palette.cream : palette.panel;
    ctx.fill();
    ctx.strokeStyle = palette.goldDeep;
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(50, 48, 27, Math.PI * 1.08, Math.PI * 1.92);
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

// —— the robe ——

const ROBE = 'M3 100L8 79C10 67 20 61 33 59L67 59C80 61 90 67 92 79L97 100Z';
const ROBE_SHADE_LEFT = 'M3 100L8 79C10 67 20 61 33 59L35 61.5C25 66 20 76 18 100Z';
const ROBE_SHADE_RIGHT = 'M97 100L92 79C90 67 80 61 67 59L65 61.5C75 66 80 76 82 100Z';
const PLACKET = 'M41 61L59 61L64 100L36 100Z';

function drawRobe(pen: Pen): void {
  const colours = robe(pen);
  const { ctx, palette } = pen;
  fill(pen, ROBE, colours.robe);
  fill(pen, ROBE_SHADE_LEFT, colours.robeDeep, false);
  fill(pen, ROBE_SHADE_RIGHT, colours.robeDeep, false);
  // Deco pinstripes falling from the shoulders.
  ctx.save();
  ctx.globalAlpha = 0.55;
  stroke(pen, 'M25 66L21 100M30 64L27 100M75 66L79 100M70 64L73 100', palette.gold, 0.6);
  ctx.restore();
  fill(pen, PLACKET, colours.accent);
  drawPattern(pen);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = pen.line;
  ctx.stroke(path(ROBE));
}

/** The suit's motif in a column down the front panel. */
function drawPattern(pen: Pen): void {
  const { ctx, palette, spec } = pen;
  const motif = spec.suit === 'diamonds' ? palette.cream : palette.ink;
  ctx.save();
  ctx.clip(path(PLACKET));
  for (let y = 67, i = 0; y < 104; y += 8.5, i++) {
    const x = 50;
    switch (spec.suit) {
      case 'spades':
        // A fern frond: a stem with paired leaflets.
        stroke(pen, `M${x} ${y - 4}L${x} ${y + 5}`, motif, 0.7);
        stroke(pen, `M${x} ${y - 1}L${x - 4} ${y - 4}M${x} ${y - 1}L${x + 4} ${y - 4}`, motif, 0.7);
        stroke(pen, `M${x} ${y + 3}L${x - 5} ${y}M${x} ${y + 3}L${x + 5} ${y}`, motif, 0.7);
        break;
      case 'hearts':
        drawPip(ctx, 'hearts', x, y, 6, i % 2 ? motif : palette.robes.hearts.robe);
        break;
      case 'diamonds':
        drawPip(ctx, 'diamonds', x, y, 7, motif);
        stroke(pen, `M${x - 7} ${y + 4}L${x} ${y + 1}L${x + 7} ${y + 4}`, motif, 0.6);
        break;
      case 'clubs':
        for (const [dx, dy] of [
          [0, -1.8],
          [-1.8, 1],
          [1.8, 1],
        ] as const) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = motif;
          ctx.fill();
        }
        break;
    }
  }
  ctx.restore();
}

// —— collars at the neckline ——

function drawCollar(pen: Pen): void {
  const { palette, spec } = pen;
  const colours = robe(pen);
  switch (spec.collar) {
    case 'stepped':
      fill(pen, 'M31 59.5C37 72 63 72 69 59.5L63.5 57C57.5 65.5 42.5 65.5 36.5 57Z', palette.gold);
      fill(
        pen,
        'M36.5 57C42.5 65.5 57.5 65.5 63.5 57L59.5 56C55 61.5 45 61.5 40.5 56Z',
        colours.accent,
      );
      for (const [x, y] of [
        [35, 63],
        [42, 66.5],
        [50, 68],
        [58, 66.5],
        [65, 63],
      ] as const)
        fill(pen, `M${x - 1.3} ${y}l1.3 2.6l1.3-2.6Z`, palette.goldDeep, false);
      break;
    case 'chevron':
      fill(pen, 'M32 59L50 76L68 59L61.5 56.5L50 68L38.5 56.5Z', palette.gold);
      stroke(pen, 'M35.5 59.4L50 73L64.5 59.4', colours.robeDeep, 0.8);
      break;
    case 'ermine':
      fill(pen, 'M27 61C35 73 65 73 73 61L66.5 55.5C59 64 41 64 33.5 55.5Z', palette.cream);
      for (const [x, y] of [
        [33, 63],
        [41, 66.5],
        [50, 68],
        [59, 66.5],
        [67, 63],
      ] as const)
        fill(pen, `M${x} ${y - 1.6}L${x + 1} ${y + 1.6}L${x - 1} ${y + 1.6}Z`, palette.ink, false);
      break;
    case 'fan':
      // The fan itself stands behind the head; at the front, a narrow jewelled band.
      fill(pen, 'M35.5 58C42 66 58 66 64.5 58L61 56C56 61.5 44 61.5 39 56Z', palette.gold);
      ellipse(pen, 50, 64, 2.1, 2.4, colours.accent);
      break;
  }
}

// —— head ——

function drawNeck(pen: Pen): void {
  fill(pen, 'M44.5 45L55.5 45L56.5 59C53 61 47 61 43.5 59Z', skin(pen));
}

function drawHairBack(pen: Pen): void {
  const colour = hairColour(pen);
  switch (pen.spec.hairStyle) {
    case 'bob':
      fill(
        pen,
        'M35 33C35 18 42 12 50 12C58 12 65 18 65 33L66 48C62 51 58 49 57 46L43 46C42 49 38 51 34 48Z',
        colour,
      );
      break;
    case 'waves':
      fill(
        pen,
        'M34 32C34 16 42 10 50 10C58 10 66 16 66 32L68.5 52C64.5 56.5 59 55 58 50L42 50C41 55 35.5 56.5 31.5 52Z',
        colour,
      );
      break;
    case 'pageboy':
      fill(
        pen,
        'M36 30C36 19 42 15 50 15C58 15 64 19 64 30L65 43C61 46 58 44 57 42L43 42C42 44 39 46 35 43Z',
        colour,
      );
      break;
    default:
      break;
  }
}

function drawFace(pen: Pen): void {
  const { ctx, palette, spec } = pen;
  const tone = skin(pen);
  ellipse(pen, 39.6, 36, 1.9, 3.2, tone);
  ellipse(pen, 60.4, 36, 1.9, 3.2, tone);
  ellipse(pen, 50, 35.5, 10.5, 13, tone);
  // A soft light from above and to the left.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ellipse(pen, 47, 31, 6, 7, palette.cream, false);
  ctx.restore();
  // Eyes: almond shapes under heavy Deco lids, looking a little aside.
  for (const x of [45.4, 54.6]) {
    fill(
      pen,
      `M${x - 2.6} 35C${x - 1} 33.6 ${x + 1} 33.6 ${x + 2.6} 35C${x + 1} 36.1 ${x - 1} 36.1 ${x - 2.6} 35Z`,
      palette.cream,
      false,
    );
    ellipse(pen, x + 0.6, 35, 1.05, 1.05, palette.ink, false);
    stroke(pen, `M${x - 2.8} 35C${x - 1} 33.2 ${x + 1} 33.2 ${x + 2.8} 35`, palette.ink, 0.75);
  }
  const brow = hairColour(pen);
  stroke(pen, 'M42.4 31.4C44 30.3 46.4 30.2 48 31', brow, 0.9);
  stroke(pen, 'M52 31C53.6 30.2 56 30.3 57.6 31.4', brow, 0.9);
  stroke(pen, 'M50.3 34.4C50 37 49 39.4 48.9 40.6C49.8 41.2 50.8 41.2 51.6 40.8', palette.ink, 0.6);
  fill(
    pen,
    'M47 44.2C48.4 43.3 49.4 43.6 50 43.9C50.6 43.6 51.6 43.3 53 44.2C51.6 45.9 48.4 45.9 47 44.2Z',
    palette.lips,
    false,
  );
  if (spec.rank === 'queen') {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ellipse(pen, 43.5, 40.5, 2.6, 1.8, palette.lips, false);
    ellipse(pen, 56.5, 40.5, 2.6, 1.8, palette.lips, false);
    ctx.restore();
    ellipse(pen, 39.6, 41.5, 1.1, 1.6, palette.gold);
    ellipse(pen, 60.4, 41.5, 1.1, 1.6, palette.gold);
  }
}

const MOUSTACHE =
  'M43 42.4C46 40.4 49 41 50 42.2C51 41 54 40.4 57 42.4C54 44 51 43.8 50 43C49 43.8 46 44 43 42.4Z';
const LOWER_LIP = 'M47.6 45.2C49 44.6 51 44.6 52.4 45.2C51.4 46.4 48.6 46.4 47.6 45.2Z';
const SIDEBURN_LEFT = 'M38.6 24C38 28 38 32 38.6 37L41 36L41.4 25Z';
const SIDEBURN_RIGHT = 'M61.4 24C62 28 62 32 61.4 37L59 36L58.6 25Z';

function drawBeard(pen: Pen, beard: string, detail: string): void {
  const colour = hairColour(pen);
  fill(pen, beard, colour);
  fill(pen, MOUSTACHE, colour);
  fill(pen, LOWER_LIP, pen.palette.lips, false);
  if (detail) stroke(pen, detail, pen.palette.cream, 0.35);
  fill(pen, SIDEBURN_LEFT, colour);
  fill(pen, SIDEBURN_RIGHT, colour);
}

function drawHairFront(pen: Pen): void {
  const colour = hairColour(pen);
  const { palette } = pen;
  switch (pen.spec.hairStyle) {
    case 'beard-stepped':
      drawBeard(
        pen,
        'M38.5 36L39.5 44L42.5 50L46 54.5L50 57L54 54.5L57.5 50L60.5 44L61.5 36C58 42 54 44.8 50 44.8C46 44.8 42 42 38.5 36Z',
        'M42 48L58 48M45.5 52.5L54.5 52.5',
      );
      break;
    case 'beard-round':
      drawBeard(
        pen,
        'M38.5 36C38.5 50 44 58 50 58C56 58 61.5 50 61.5 36C58 42.5 54 44.8 50 44.8C46 44.8 42 42.5 38.5 36Z',
        '',
      );
      break;
    case 'beard-pointed':
      drawBeard(
        pen,
        'M38.5 36C39.5 46 44 52 50 62C56 52 60.5 46 61.5 36C58 42.5 54 44.8 50 44.8C46 44.8 42 42.5 38.5 36Z',
        'M50 48L50 59',
      );
      break;
    case 'bob':
      fill(
        pen,
        'M38.4 29C40 20 45.5 17.5 50 17.5C54.5 17.5 60 20 61.6 29C58 25.4 55 24.4 50 24.4C45 24.4 42 25.4 38.4 29Z',
        colour,
      );
      stroke(pen, 'M36 34C38 37 36 40 38 43M64 34C62 37 64 40 62 43', palette.cream, 0.4);
      break;
    case 'waves':
      fill(
        pen,
        'M38.2 30C39.4 19 45 16 50 16C55 16 60.6 19 61.8 30C59 26.5 56 24 50 26C44 24 41 26.5 38.2 30Z',
        colour,
      );
      stroke(
        pen,
        'M35 36C37 39 35 42 37 45C39 48 36 50 37 52M65 36C63 39 65 42 63 45C61 48 64 50 63 52',
        palette.cream,
        0.45,
      );
      break;
    case 'pageboy':
      fill(
        pen,
        'M38.6 30C39.6 23 45 21 50 21C55 21 60.4 23 61.4 30C58 28 55 27.2 50 27.2C45 27.2 42 28 38.6 30Z',
        colour,
      );
      break;
    case 'curls':
      for (const [x, y] of [
        [38.4, 30],
        [37.8, 35],
        [38.6, 40],
        [61.6, 30],
        [62.2, 35],
        [61.4, 40],
      ] as const)
        ellipse(pen, x, y, 2.6, 2.6, colour);
      fill(
        pen,
        'M39 29C41 24 45.5 23 50 23C54.5 23 59 24 61 29C57 27.6 54 27.4 50 27.4C46 27.4 43 27.6 39 29Z',
        colour,
      );
      break;
  }
}

// —— headwear ——

function jewel(pen: Pen, x: number, y: number, r: number): void {
  ellipse(pen, x, y, r, r, robe(pen).accent);
}

function drawRays(
  pen: Pen,
  cx: number,
  cy: number,
  inner: number,
  long: number,
  short: number,
  count: number,
  spread: number,
): void {
  const { ctx, palette } = pen;
  for (let i = 0; i <= count; i++) {
    const a = Math.PI * (1.12 + (0.76 * i) / count);
    const reach = i % 2 === 0 ? long : short;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - spread) * inner, cy + Math.sin(a - spread) * inner);
    ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
    ctx.lineTo(cx + Math.cos(a + spread) * inner, cy + Math.sin(a + spread) * inner);
    ctx.closePath();
    ctx.fillStyle = palette.gold;
    ctx.fill();
    ctx.strokeStyle = palette.goldDeep;
    ctx.lineWidth = pen.line * 0.7;
    ctx.stroke();
  }
}

function drawHeadwear(pen: Pen): void {
  const { palette, spec, ctx } = pen;
  const colours = robe(pen);
  const suitInk = palette.suit[spec.suit];
  switch (spec.headwear) {
    case 'ziggurat':
      fill(
        pen,
        'M36.5 25L36.5 16L40.5 18L40.5 12L44.5 13.8L44.5 8.6L50 5.6L55.5 8.6L55.5 13.8L59.5 12L59.5 18L63.5 16L63.5 25Z',
        palette.gold,
      );
      fill(pen, 'M36 22.5L64 22.5L64 27L36 27Z', palette.goldDeep);
      for (const x of [41, 50, 59]) jewel(pen, x, 24.8, 1.3);
      emblem(pen, spec.suit, 50, 15.4, 6.2, suitInk);
      break;
    case 'arched':
      fill(pen, 'M38.5 23C38.5 14 44 10 50 10C56 10 61.5 14 61.5 23Z', colours.robe);
      stroke(pen, 'M38.5 23C38.5 12 61.5 12 61.5 23M50 10L50 23', palette.gold, 2.2);
      fill(pen, 'M37 21.5L63 21.5L63 26.5L37 26.5Z', palette.gold);
      for (const x of [42, 50, 58]) jewel(pen, x, 24, 1.3);
      emblem(pen, spec.suit, 50, 7.4, 6, palette.gold);
      break;
    case 'sunburst':
      drawRays(pen, 50, 25, 8.5, 17, 13, 8, 0.11);
      fill(pen, 'M38 20C42 16.5 58 16.5 62 20L63 26.5L37 26.5Z', palette.gold);
      emblem(pen, spec.suit, 50, 21.8, 5.2, suitInk);
      break;
    case 'tiara-rays':
      ctx.save();
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (1.15 + (0.7 * i) / 10);
        const reach = i % 2 === 0 ? 13 : 9.5;
        ctx.beginPath();
        ctx.moveTo(50 + Math.cos(a) * 7, 24 + Math.sin(a) * 7);
        ctx.lineTo(50 + Math.cos(a) * reach, 24 + Math.sin(a) * reach);
        ctx.strokeStyle = palette.gold;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
      fill(pen, 'M40 21.5C45 18.5 55 18.5 60 21.5L59 24.5C55 22.2 45 22.2 41 24.5Z', palette.gold);
      jewel(pen, 50, 18.6, 1.6);
      break;
    case 'tiara-arc':
      fill(
        pen,
        'M39.5 22.5C42 14 58 14 60.5 22.5L58.5 23.8C55 18.4 45 18.4 41.5 23.8Z',
        palette.gold,
      );
      emblem(pen, spec.suit, 50, 15, 5.6, suitInk);
      jewel(pen, 44, 19.4, 1.1);
      jewel(pen, 56, 19.4, 1.1);
      break;
    case 'tiara-steps':
      fill(
        pen,
        'M40 24L40 19.5L43.5 20.5L43.5 16L47 17L47 13L50 11L53 13L53 17L56.5 16L56.5 20.5L60 19.5L60 24Z',
        palette.gold,
      );
      emblem(pen, spec.suit, 50, 18.6, 4.6, suitInk);
      break;
    case 'cap-plume':
      // A flat cap tilted back, a plume sweeping off it.
      fill(pen, 'M60 19C67 11 77 7 88 8C80 11 72 16 64 23Z', palette.cream);
      stroke(pen, 'M62 20C69 13 78 9 86 8.6', palette.goldDeep, 0.5);
      fill(pen, 'M34 26C34 16 44 11.5 53 12C63 12.5 69 18 67 26Z', colours.robeDeep);
      fill(pen, 'M34.5 24.5L66.5 24.5L65.8 28.6L35.2 28.6Z', colours.accent);
      jewel(pen, 59, 26.6, 1.4);
      break;
    case 'cap-chevron':
      fill(pen, 'M37 27L39.5 10C46 7 54 7 60.5 10L63 27Z', colours.robeDeep);
      for (const y of [13, 18])
        stroke(pen, `M39.5 ${y + 2}L50 ${y - 2}L60.5 ${y + 2}`, palette.gold, 1);
      fill(pen, 'M36.5 24.5L63.5 24.5L63.5 28.6L36.5 28.6Z', palette.gold);
      emblem(pen, spec.suit, 50, 22.4, 4.2, palette.gold);
      break;
  }
}

// —— the arm, the hand and what it holds ——

/** Where the hand closes, in front of the chest; everything held is placed from here. */
const HAND = { x: 67, y: 80.5 };

/** A forearm across the body from the elbow at the robe's edge, ending in a gilt cuff. */
function drawForearm(pen: Pen): void {
  const colours = robe(pen);
  fill(pen, 'M90.5 77C85 74.5 77 75 70.5 76.6L70.8 84.6C77 84 84 85.2 89 89.5Z', colours.robeDeep);
  stroke(pen, 'M86 78.5C82 77.6 77 77.8 73 78.6', pen.palette.gold, 0.5);
  fill(pen, 'M70.2 76.2L74.4 75.6L74.8 84.6L70.6 84.8Z', pen.palette.gold);
}

function drawHand(pen: Pen): void {
  const { x, y } = HAND;
  fill(
    pen,
    `M${x + 4.2} ${y - 3.6}C${x + 1} ${y - 4.8} ${x - 3.6} ${y - 4} ${x - 4.4} ${y - 0.6}C${x - 5} ${y + 2.6} ${x - 2} ${y + 4.6} ${x + 1.4} ${y + 4.2}C${x + 3.4} ${y + 4} ${x + 4.4} ${y + 2.6} ${x + 4.4} ${y + 1}Z`,
    skin(pen),
  );
  stroke(
    pen,
    `M${x - 3} ${y - 1.4}L${x + 2.4} ${y - 1.8}M${x - 3} ${y + 1.2}L${x + 2.6} ${y + 0.8}`,
    pen.palette.ink,
    0.35,
  );
}

function drawHeld(pen: Pen): void {
  const { ctx, palette, spec } = pen;
  const colours = robe(pen);
  const suitInk = palette.suit[spec.suit];
  const green = '#3f7a4b';
  const stem = '#2f5d3a';
  switch (spec.holds) {
    case 'sceptre':
      stroke(pen, 'M63.4 100L77 22', palette.ink, 3.4);
      stroke(pen, 'M63.4 100L77 22', palette.gold, 2.1);
      ellipse(pen, 77.3, 20.4, 2.6, 2.6, palette.gold);
      emblem(
        pen,
        spec.suit,
        77.6,
        13.4,
        9,
        spec.suit === 'spades' || spec.suit === 'clubs' ? palette.gold : suitInk,
      );
      drawForearm(pen);
      drawHand(pen);
      break;
    case 'orb':
      drawForearm(pen);
      ellipse(pen, 67, 69.5, 7.6, 7.6, palette.gold);
      stroke(pen, 'M59.4 69.5L74.6 69.5M67 61.9L67 77.1', palette.goldDeep, 1);
      emblem(pen, spec.suit, 67, 58.4, 6.2, suitInk);
      drawHand(pen);
      break;
    case 'fan': {
      drawForearm(pen);
      const ribs = 9;
      for (let i = 0; i < ribs; i++) {
        const a0 = -Math.PI * (0.92 - (0.62 * i) / ribs);
        const a1 = -Math.PI * (0.92 - (0.62 * (i + 1)) / ribs);
        ctx.beginPath();
        ctx.moveTo(HAND.x, HAND.y);
        ctx.arc(HAND.x, HAND.y, 25, a0, a1);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? palette.cream : colours.accent;
        ctx.fill();
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(HAND.x, HAND.y, 25, -Math.PI * 0.92, -Math.PI * 0.3);
      ctx.strokeStyle = palette.gold;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      drawHand(pen);
      break;
    }
    case 'rose':
      drawForearm(pen);
      stroke(pen, 'M66.4 80C69 71 73 62 76.6 56', stem, 1.4);
      fill(pen, 'M70.4 69C66 68.4 64 65 65.2 62C68.6 63 70.6 66 70.4 69Z', green);
      ellipse(pen, 77.4, 52.4, 6.8, 6.2, palette.robes.hearts.robe);
      stroke(
        pen,
        'M77.4 52.4m-3.6 0a3.6 3.2 0 1 0 7.2 0a3.6 3.2 0 1 0 -7.2 0M76 50.8C78 49.4 80 50.8 79.6 52.8',
        palette.robes.hearts.robeDeep,
        0.7,
      );
      drawHand(pen);
      break;
    case 'mirror':
      drawForearm(pen);
      stroke(pen, 'M66.6 81L74 64', palette.ink, 3.2);
      stroke(pen, 'M66.6 81L74 64', palette.gold, 2);
      ellipse(pen, 76.6, 54.6, 8, 9.6, palette.gold);
      ellipse(pen, 76.6, 54.6, 5.8, 7.4, '#cfe0ea');
      ctx.save();
      ctx.globalAlpha = 0.6;
      stroke(pen, 'M73.6 50.6L77.6 46.6M74.2 54.6L79.6 49.2', '#ffffff', 0.9);
      ctx.restore();
      drawHand(pen);
      break;
    case 'lily':
      drawForearm(pen);
      stroke(pen, 'M66.4 80C69 72 72.6 64 75.6 57.6', stem, 1.4);
      fill(pen, 'M70.6 69.4C66 68.4 64.2 64.6 65.6 61.6C68.8 63.2 70.4 66 70.6 69.4Z', green);
      for (const a of [-2.2, -1.57, -0.94]) {
        const x = 75.6 + Math.cos(a) * 9;
        const y = 56 + Math.sin(a) * 9;
        fill(
          pen,
          `M75.6 57Q${75.6 + Math.cos(a - 0.5) * 6} ${56 + Math.sin(a - 0.5) * 6} ${x} ${y}Q${75.6 + Math.cos(a + 0.5) * 6} ${56 + Math.sin(a + 0.5) * 6} 75.6 57Z`,
          palette.cream,
        );
      }
      ellipse(pen, 75.6, 56.6, 1.6, 1.6, palette.gold);
      drawHand(pen);
      break;
    case 'lantern':
      drawForearm(pen);
      fill(pen, 'M62 63L72 63L70.5 60L63.5 60Z', palette.gold);
      fill(pen, 'M63 63L71 63L72.5 74L61.5 74Z', '#f3c463');
      stroke(pen, 'M67 63L67 74M64.6 63L64 74M69.4 63L70 74', palette.goldDeep, 0.6);
      fill(pen, 'M61 74L73 74L71.5 77L62.5 77Z', palette.gold);
      ctx.beginPath();
      ctx.arc(67, 57.6, 2.4, 0, Math.PI * 2);
      ctx.strokeStyle = palette.gold;
      ctx.lineWidth = 1;
      ctx.stroke();
      drawHand(pen);
      break;
    case 'quill':
      fill(pen, 'M65 84C69 64 76 42 87 27C85 43 79 61 69 84Z', palette.cream);
      stroke(pen, 'M66 84C71 64 78 45 86.4 29', palette.goldDeep, 0.6);
      for (const t of [0.3, 0.45, 0.6, 0.75])
        stroke(pen, `M${66 + 19 * t} ${84 - 55 * t}l3 -1`, palette.goldDeep, 0.4);
      drawForearm(pen);
      drawHand(pen);
      break;
    case 'key':
      stroke(pen, 'M65.4 86L75 47.6', palette.ink, 3);
      stroke(pen, 'M65.4 86L75 47.6', palette.gold, 1.8);
      ellipse(pen, 76, 42, 5.6, 5.6, palette.gold);
      ellipse(pen, 76, 42, 2.8, 2.8, palette.panel);
      fill(pen, 'M71.2 62.2L75.8 63.4L75.2 65.8L70.6 64.6Z', palette.gold);
      drawForearm(pen);
      drawHand(pen);
      break;
    case 'branch':
      stroke(pen, 'M66 84C70 71 74 57 80 41', '#5a3a1e', 1.3);
      for (const [x, y, a] of [
        [70.4, 70.4, -0.4],
        [72.8, 62, 0.7],
        [75.2, 54.6, -0.5],
        [77.6, 47.4, 0.6],
        [80, 40.4, -0.2],
      ] as const) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        fill(pen, 'M0 0C3 -3 8 -3 10 0C8 3 3 3 0 0Z', green);
        ctx.restore();
      }
      drawForearm(pen);
      drawHand(pen);
      break;
  }
}

/**
 * Draws one half figure into the box (x, y, width, height), waist on the box's bottom edge.
 * The caller draws it again turned half a circle for the lower half.
 */
export function drawCourtHalf(
  ctx: Ctx,
  spec: CourtSpec,
  palette: DeckPalette,
  box: { x: number; y: number; width: number; height: number },
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.translate(box.x, box.y);
  ctx.scale(box.width / 100, box.height / 100);
  const pen: Pen = { ctx, palette, spec, line: 0.7 };
  drawGround(pen);
  // The suit's mark in the panel's corner, as on real court cards.
  drawPip(ctx, spec.suit, 11, 10, 11, palette.suit[spec.suit]);
  withHead(pen, () => {
    if (spec.collar === 'fan') drawFanCollar(pen);
    drawHairBack(pen);
  });
  drawRobe(pen);
  withHead(pen, () => drawNeck(pen));
  drawCollar(pen);
  withHead(pen, () => {
    drawFace(pen);
    drawHairFront(pen);
    drawHeadwear(pen);
  });
  drawHeld(pen);
  ctx.restore();
}
