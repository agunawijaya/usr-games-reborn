import { createRng, type Rng } from '@usr-games/kit';

/**
 * The rooms around the table, painted in code. Each room has a still base (the table and what
 * stands on and around it), painted once per size, and an overlay of light that falls across
 * the cards too. The Observatory adds a sky of stars that turns, a few pixels a second, seen
 * above the table and in the star mirror set into it.
 */

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The free corner of the table below the talon and hand, where each room puts its centrepiece. */
export interface Decor {
  x: number;
  y: number;
  w: number;
  h: number;
}

function surface(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    return canvas;
  }
  return new OffscreenCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
}

function context(canvas: OffscreenCanvas | HTMLCanvasElement): Ctx2D {
  return canvas.getContext('2d') as Ctx2D;
}

// —— Sunroom: the table ——

const WOOD = {
  planks: ['#ead6b2', '#e6d0a9', '#efdcba', '#e3cca3', '#ebd8b5'],
  grain: 'rgba(150, 105, 52, 0.13)',
  grainDark: 'rgba(120, 80, 36, 0.16)',
  seam: 'rgba(110, 72, 30, 0.38)',
  seamLight: 'rgba(255, 246, 225, 0.55)',
};

function paintPlanks(ctx: Ctx2D, w: number, h: number, rng: Rng): void {
  const plank = Math.max(70, h * 0.118);
  for (let y = -rng.float(0, plank), row = 0; y < h; y += plank, row++) {
    ctx.fillStyle = WOOD.planks[(row * 3 + rng.int(0, 4)) % WOOD.planks.length]!;
    ctx.fillRect(0, y, w, plank);
    for (let g = 0; g < 16; g++) {
      const gy = y + rng.float(4, plank - 4);
      const amp = rng.float(0.5, 2.6);
      const wave = rng.float(0.002, 0.006);
      const phase = rng.float(0, 6.28);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const yy = gy + Math.sin(x * wave + phase) * amp;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = g % 4 === 0 ? WOOD.grainDark : WOOD.grain;
      ctx.lineWidth = rng.float(0.6, 1.8);
      ctx.stroke();
    }
    if (rng.chance(0.45)) {
      const kx = rng.float(0, w);
      const ky = y + rng.float(plank * 0.3, plank * 0.7);
      for (let r = 4; r > 0; r--) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 4.5, r * 1.6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = WOOD.grainDark;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }
    for (let x = rng.float(-w * 0.3, 0); x < w; x += rng.float(w * 0.45, w * 0.8)) {
      if (x <= 0) continue;
      ctx.fillStyle = WOOD.seam;
      ctx.fillRect(x, y, 1.4, plank);
      ctx.fillStyle = WOOD.seamLight;
      ctx.fillRect(x + 1.4, y, 1, plank);
    }
    ctx.fillStyle = WOOD.seam;
    ctx.fillRect(0, y, w, 1.5);
    ctx.fillStyle = WOOD.seamLight;
    ctx.fillRect(0, y + 1.5, w, 1);
  }
}

// —— Sunroom: plants ——

const GREENS = ['#2f6b3c', '#3a7a45', '#2a5f36', '#44854c'];

/**
 * A split leaf, painted on its own canvas so its cuts never reach the table: a heart-shaped
 * blade hanging from its stalk down the canvas, slits curving in from the edge between the
 * veins, a few holes beside the midrib.
 */
function splitLeaf(length: number, colour: string, rng: Rng) {
  const width = length * 1.05;
  const canvas = surface(width, length * 1.06);
  const ctx = context(canvas);
  ctx.translate(width / 2, length * 0.03);
  const half = length * 0.47;
  const lean = rng.float(-0.06, 0.06) * length;
  ctx.beginPath();
  ctx.moveTo(0, length * 0.1);
  // Two rounded lobes either side of the stalk, then down to a tip that leans a little.
  ctx.bezierCurveTo(
    -half * 0.3,
    -length * 0.02,
    -half * 1.05,
    -length * 0.02,
    -half * 1.0,
    length * 0.36,
  );
  ctx.bezierCurveTo(-half * 0.95, length * 0.7, -half * 0.35, length * 0.94, lean, length);
  ctx.bezierCurveTo(
    half * 0.35,
    length * 0.94,
    half * 0.95,
    length * 0.7,
    half * 1.0,
    length * 0.36,
  );
  ctx.bezierCurveTo(half * 1.05, -length * 0.02, half * 0.3, -length * 0.02, 0, length * 0.1);
  ctx.closePath();
  const shade = ctx.createLinearGradient(-half, 0, half, length);
  shade.addColorStop(0, colour);
  shade.addColorStop(0.55, colour);
  shade.addColorStop(1, '#69a65f');
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (const side of [-1, 1]) {
    const slits = rng.int(4, 6);
    for (let i = 0; i < slits; i++) {
      const t = 0.2 + (i / slits) * 0.66 + rng.float(-0.03, 0.03);
      const y = length * t;
      const inner = half * rng.float(0.22, 0.4);
      const sweep = length * rng.float(0.08, 0.13);
      ctx.beginPath();
      ctx.moveTo(side * inner, y);
      ctx.quadraticCurveTo(side * half * 0.75, y + sweep * 0.4, side * half * 1.3, y + sweep);
      ctx.lineTo(side * half * 1.3, y + sweep + length * 0.05);
      ctx.quadraticCurveTo(
        side * half * 0.75,
        y + sweep * 0.55 + length * 0.012,
        side * inner,
        y + length * 0.012,
      );
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(
        side * half * 0.18,
        length * (0.32 + i * 0.22),
        half * 0.045,
        length * 0.022,
        side * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(196, 228, 168, 0.8)';
  ctx.lineWidth = Math.max(1.4, length * 0.013);
  ctx.beginPath();
  ctx.moveTo(0, length * 0.1);
  ctx.quadraticCurveTo(lean * 0.4, length * 0.55, lean, length * 0.97);
  ctx.stroke();
  return canvas;
}

function leafPath(ctx: Ctx2D, length: number, width: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width * 0.9, length * 0.18, width, length * 0.62, 0, length);
  ctx.bezierCurveTo(-width, length * 0.62, -width * 0.9, length * 0.18, 0, 0);
  ctx.closePath();
}

/** A fern frond: a curving stem lined with leaflets that shrink towards the tip. */
function paintFrond(ctx: Ctx2D, length: number, colour: string, curl: number): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  const steps = 26;
  let x = 0;
  let y = 0;
  let angle = 0;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const seg = length / steps;
    angle += curl / steps;
    const nx = x + Math.sin(angle) * seg;
    const ny = y + Math.cos(angle) * seg;
    ctx.lineWidth = Math.max(1, (1 - t) * length * 0.012);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    const leaflet = length * 0.17 * (1 - t) ** 0.7 + length * 0.02;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(-angle + side * 1.05);
      leafPath(ctx, leaflet, leaflet * 0.28);
      ctx.fill();
      ctx.restore();
    }
    x = nx;
    y = ny;
  }
  ctx.restore();
}

interface Placed {
  image: OffscreenCanvas | HTMLCanvasElement;
  x: number;
  y: number;
  angle: number;
  /** Where on the image the leaf is held (its stalk), as fractions. */
  pivot: { x: number; y: number };
}

/**
 * Draws placed leaves, each with its soft shadow just before it, so a leaf shades the table and
 * the leaves beneath it; the light comes from the top left.
 */
function drawLeaves(ctx: Ctx2D, leaves: readonly Placed[], h: number): void {
  const drop = { x: h * 0.02, y: h * 0.03 };
  for (const leaf of leaves) {
    for (const pass of ['shadow', 'leaf'] as const) {
      ctx.save();
      ctx.translate(
        leaf.x + (pass === 'shadow' ? drop.x : 0),
        leaf.y + (pass === 'shadow' ? drop.y : 0),
      );
      ctx.rotate(leaf.angle);
      if (pass === 'shadow') {
        ctx.filter = `blur(${Math.round(h * 0.009)}px) brightness(0)`;
        ctx.globalAlpha = 0.26;
      }
      ctx.drawImage(
        leaf.image,
        -leaf.image.width * leaf.pivot.x,
        -leaf.image.height * leaf.pivot.y,
      );
      ctx.restore();
    }
  }
}

function frondImage(length: number, colour: string, curl: number) {
  const size = length * 1.25;
  const canvas = surface(size, size);
  const ctx = context(canvas);
  ctx.translate(size / 2, size * 0.04);
  paintFrond(ctx, length, colour, curl);
  return canvas;
}

function paintPot(ctx: Ctx2D, x: number, y: number, r: number, h: number): void {
  ctx.save();
  ctx.filter = `blur(${Math.round(h * 0.012)}px)`;
  ctx.beginPath();
  ctx.arc(x + h * 0.024, y + h * 0.034, r * 1.02, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70, 45, 15, 0.35)';
  ctx.fill();
  ctx.restore();
  const rim = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  rim.addColorStop(0, '#e19661');
  rim.addColorStop(1, '#a24f28');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.83, 0, Math.PI * 2);
  ctx.fillStyle = '#4a3324';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.915, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 222, 190, 0.4)';
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.stroke();
}

/** A lush potted plant standing on the table, seen from above: fronds under, split leaves over. */
function paintPottedPlant(ctx: Ctx2D, cx: number, cy: number, size: number, h: number): void {
  const rng = createRng(`pot:${Math.round(size)}`);
  const r = size * 0.4;
  paintPot(ctx, cx, cy, r, h);
  const leaves: Placed[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * (i + 0.3)) / 6 + rng.float(-0.3, 0.3);
    leaves.push({
      image: frondImage(
        size * rng.float(0.62, 0.8),
        i % 2 ? '#4f9a52' : '#3f8645',
        rng.float(-0.7, 0.7),
      ),
      x: cx,
      y: cy,
      angle: angle - Math.PI / 2,
      pivot: { x: 0.5, y: 0.04 },
    });
  }
  // Split leaves of different ages: big ones low, younger ones on top, none quite evenly spaced.
  const plan = [
    { angle: 0.4, length: 0.95 },
    { angle: 1.55, length: 0.82 },
    { angle: 2.7, length: 0.9 },
    { angle: 3.9, length: 0.78 },
    { angle: 5.1, length: 0.88 },
    { angle: 1.0, length: 0.62 },
    { angle: 3.3, length: 0.58 },
    { angle: 5.7, length: 0.5 },
  ];
  plan.forEach((leaf, i) => {
    const angle = leaf.angle + rng.float(-0.18, 0.18);
    leaves.push({
      image: splitLeaf(size * leaf.length, GREENS[i % GREENS.length]!, rng),
      x: cx + Math.cos(angle) * r * 0.1,
      y: cy + Math.sin(angle) * r * 0.1,
      angle: angle - Math.PI / 2,
      pivot: { x: 0.5, y: 0.03 },
    });
  });
  drawLeaves(ctx, leaves, h);
}

/** Leaves of plants standing beside the table, reaching over its corners. */
function paintCornerGreenery(ctx: Ctx2D, w: number, h: number): void {
  const rng = createRng(`corners:${w}x${h}`);
  const leaves: Placed[] = [];
  // Bottom left: split leaves from a plant just off the table.
  const bl = { x: -h * 0.04, y: h * 1.04 };
  [-0.55, -0.95, -1.3, -0.2].forEach((angle, i) => {
    leaves.push({
      image: splitLeaf(h * rng.float(0.3, 0.38), GREENS[i % GREENS.length]!, rng),
      x: bl.x,
      y: bl.y,
      angle: angle - Math.PI,
      pivot: { x: 0.5, y: 0.02 },
    });
  });
  // Top left, behind the title: a fern leaning in.
  [-0.5, -0.9, -0.15].forEach((angle, i) => {
    leaves.push({
      image: frondImage(
        h * rng.float(0.26, 0.34),
        GREENS[(i + 1) % GREENS.length]!,
        rng.float(-0.6, 0.6),
      ),
      x: -h * 0.03,
      y: -h * 0.03,
      angle,
      pivot: { x: 0.5, y: 0.04 },
    });
  });
  // Bottom right: fern fronds from a plant beside the table.
  [0.55, 0.9, 0.25, 1.2].forEach((angle, i) => {
    leaves.push({
      image: frondImage(
        h * rng.float(0.3, 0.4),
        GREENS[(i + 2) % GREENS.length]!,
        rng.float(-0.5, 0.5),
      ),
      x: w + h * 0.03,
      y: h * 1.03,
      angle: angle + Math.PI * 0.5,
      pivot: { x: 0.5, y: 0.04 },
    });
  });
  drawLeaves(ctx, leaves, h);
}

export function paintSunroomBase(ctx: Ctx2D, w: number, h: number, decor: Decor): void {
  const rng = createRng(`sunroom:${w}x${h}`);
  paintPlanks(ctx, w, h, rng);
  const vignette = ctx.createRadialGradient(w * 0.45, h * 0.4, h * 0.3, w * 0.5, h * 0.5, h * 1.05);
  vignette.addColorStop(0, 'rgba(255, 248, 230, 0)');
  vignette.addColorStop(1, 'rgba(120, 82, 40, 0.3)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  paintCornerGreenery(ctx, w, h);
  const size = Math.min(decor.w, decor.h) * 0.62;
  if (size > 60) paintPottedPlant(ctx, decor.x + decor.w * 0.52, decor.y + decor.h * 0.52, size, h);
}

/** The sunlit panes of the glasshouse roof, falling across the table from the upper left. */
function panes(
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number; alpha: number }[] {
  const pane = h * 0.25;
  const bar = h * 0.03;
  const result = [];
  for (let row = -1; row < 5; row++) {
    for (let col = -3; col < 14; col++) {
      const x = col * (pane * 1.12 + bar) + w * 0.08;
      const y = row * (pane + bar) - h * 0.06;
      const cx = x + pane * 0.56 - (y + pane / 2) * SHEAR;
      const away = Math.hypot((cx - w * 0.5) / w, (y + pane / 2 - h * 0.44) / h);
      const alpha = Math.max(0, 1 - away * 1.25);
      if (alpha > 0.04) result.push({ x, y, w: pane * 1.12, h: pane, alpha });
    }
  }
  return result;
}

const SHEAR = 0.5;

/**
 * Shade, multiplied over the table and the cards: the room's soft shadow everywhere except where
 * the sun comes through the panes, the glazing bars' shadows between them, and leaf shade.
 */
export function paintSunroomShade(ctx: Ctx2D, w: number, h: number): void {
  const rng = createRng(`sunshade:${w}x${h}`);
  ctx.save();
  ctx.fillStyle = 'rgb(226, 205, 176)';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${Math.round(h * 0.01)}px)`;
  ctx.setTransform(1, 0, -SHEAR, 1, 0, 0);
  for (const p of panes(w, h)) {
    // Lit panes multiply by white: the table shows as it is.
    const lit = Math.round(226 + (255 - 226) * p.alpha);
    const litG = Math.round(205 + (252 - 205) * p.alpha);
    const litB = Math.round(176 + (240 - 176) * p.alpha);
    ctx.fillStyle = `rgb(${lit}, ${litG}, ${litB})`;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${Math.round(h * 0.007)}px)`;
  for (let i = 0; i < 26; i++) {
    // Leaf shade gathers towards the room's edges, under the plants, and spares the middle.
    const edge = rng.next() < 0.5;
    const x = edge
      ? rng.next() < 0.5
        ? rng.float(0, w * 0.22)
        : rng.float(w * 0.78, w)
      : rng.float(0, w);
    const y = edge
      ? rng.float(0, h)
      : rng.next() < 0.5
        ? rng.float(0, h * 0.12)
        : rng.float(h * 0.82, h);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.float(0, Math.PI * 2));
    leafPath(ctx, h * rng.float(0.06, 0.14), h * rng.float(0.02, 0.04));
    ctx.fillStyle = `rgba(150, 118, 76, ${rng.float(0.3, 0.5).toFixed(3)})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Warmth where the sun falls: a soft-light glow inside the panes. */
export function paintSunroomLight(ctx: Ctx2D, w: number, h: number): void {
  ctx.save();
  ctx.filter = `blur(${Math.round(h * 0.012)}px)`;
  ctx.setTransform(1, 0, -SHEAR, 1, 0, 0);
  for (const p of panes(w, h)) {
    ctx.fillStyle = `rgba(255, 214, 140, ${(p.alpha * 0.55).toFixed(3)})`;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  ctx.restore();
}

// —— Observatory: the sky ——

export const SKY_GRADIENT =
  'radial-gradient(ellipse 120% 90% at 55% -30%, #2a347f 0%, #141b4c 40%, #090c27 76%, #05071a 100%)';

export interface Star {
  /** Polar position about the celestial pole, in screen heights. */
  radius: number;
  angle: number;
  size: number;
  brightness: number;
  twinkle: number;
  warm: boolean;
}

/** Stars spread evenly over the ring of sky the screen can ever show as it turns. */
export function makeStars(
  count: number,
  seed = 'observatory-sky',
  inner = 0.4,
  outer = 1.25,
): Star[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => {
    const bright = rng.chance(0.05);
    return {
      radius: Math.sqrt(inner * inner + rng.next() * (outer * outer - inner * inner)),
      angle: rng.float(0, Math.PI * 2),
      size: bright ? rng.float(1.4, 2.3) : rng.float(0.5, 1.2),
      brightness: bright ? rng.float(0.85, 1) : rng.float(0.3, 0.8),
      twinkle: rng.float(0, Math.PI * 2),
      warm: rng.chance(0.18),
    };
  });
}

/** Where the sky turns about: above the top of the screen, a little right of centre. */
export function polePosition(w: number, h: number): { x: number; y: number } {
  return { x: w * 0.56, y: -h * 0.42 };
}

/** One revolution in about twenty minutes: the turning is felt rather than watched. */
export const SKY_TURN_PER_SECOND = (Math.PI * 2) / 1200;

function drawStar(ctx: Ctx2D, x: number, y: number, star: Star, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = star.warm ? '#ffe2b0' : '#f4f6ff';
  if (star.size > 1.3) {
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, star.size * 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
  }
}

/** The star mirror's circle, where the table opens on the sky. */
export function mirrorOf(decor: Decor): { x: number; y: number; r: number } {
  return {
    x: decor.x + decor.w * 0.5,
    y: decor.y + decor.h * 0.5,
    r: Math.min(decor.w, decor.h) * 0.36,
  };
}

/** Original star figures in the mirror, as offsets in mirror radii. */
const MIRROR_FIGURES: readonly (readonly [number, number])[][] = [
  [
    [-0.62, -0.18],
    [-0.42, -0.34],
    [-0.2, -0.28],
    [-0.08, -0.48],
    [0.14, -0.4],
  ],
  [
    [0.18, 0.22],
    [0.36, 0.1],
    [0.56, 0.2],
    [0.46, 0.42],
    [0.26, 0.44],
    [0.18, 0.22],
  ],
  [
    [-0.4, 0.3],
    [-0.28, 0.5],
    [-0.06, 0.58],
  ],
];

export interface Sky {
  stars: Star[];
  mirrorStars: Star[];
}

export function makeSky(): Sky {
  return {
    stars: makeStars(2400),
    mirrorStars: makeStars(260, 'observatory-mirror', 0, 1),
  };
}

export function paintStars(
  ctx: Ctx2D,
  w: number,
  h: number,
  sky: Sky,
  decor: Decor,
  time: number,
  twinkle: boolean,
  /** False when the stars are laid over a sky already painted on the same canvas. */
  clear = true,
): void {
  if (clear) ctx.clearRect(0, 0, w, h);
  const pole = polePosition(w, h);
  const turn = time * SKY_TURN_PER_SECOND;
  for (const star of sky.stars) {
    const a = star.angle + turn;
    const x = pole.x + Math.cos(a) * star.radius * h;
    const y = pole.y + Math.sin(a) * star.radius * h;
    if (x < -6 || x > w + 6 || y < -6 || y > h + 6) continue;
    const flicker = twinkle ? 0.75 + 0.25 * Math.sin(time * 1.3 + star.twinkle) : 1;
    drawStar(ctx, x, y, star, star.brightness * flicker);
  }
  // The mirror shows the sky straight overhead, turning about its own centre.
  const mirror = mirrorOf(decor);
  ctx.save();
  ctx.beginPath();
  ctx.arc(mirror.x, mirror.y, mirror.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 1;
  const deep = ctx.createRadialGradient(mirror.x, mirror.y, 0, mirror.x, mirror.y, mirror.r);
  deep.addColorStop(0, '#1d2766');
  deep.addColorStop(1, '#070a22');
  ctx.fillStyle = deep;
  ctx.fillRect(mirror.x - mirror.r, mirror.y - mirror.r, mirror.r * 2, mirror.r * 2);
  ctx.translate(mirror.x, mirror.y);
  ctx.rotate(turn * 4);
  const haze = ctx.createLinearGradient(-mirror.r, -mirror.r * 0.3, mirror.r, mirror.r * 0.3);
  haze.addColorStop(0, 'rgba(160, 170, 255, 0)');
  haze.addColorStop(0.5, 'rgba(170, 180, 255, 0.16)');
  haze.addColorStop(1, 'rgba(160, 170, 255, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(-mirror.r, -mirror.r * 0.35, mirror.r * 2, mirror.r * 0.7);
  for (const star of sky.mirrorStars) {
    const flicker = twinkle ? 0.7 + 0.3 * Math.sin(time * 1.7 + star.twinkle) : 1;
    drawStar(
      ctx,
      Math.cos(star.angle) * star.radius * mirror.r,
      Math.sin(star.angle) * star.radius * mirror.r,
      star,
      star.brightness * flicker,
    );
  }
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#d9b45a';
  ctx.lineWidth = 1;
  for (const figure of MIRROR_FIGURES) {
    ctx.beginPath();
    figure.forEach(([u, v], i) => {
      if (i === 0) ctx.moveTo(u * mirror.r, v * mirror.r);
      else ctx.lineTo(u * mirror.r, v * mirror.r);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffe7b0';
  for (const figure of MIRROR_FIGURES)
    for (const [u, v] of figure) {
      ctx.beginPath();
      ctx.arc(u * mirror.r, v * mirror.r, Math.max(1.4, mirror.r * 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// —— Observatory: the room ——

/** The table's rectangle in the Observatory: inset so the sky shows round it. */
export function observatoryTable(w: number, h: number) {
  const top = Math.round(h * 0.083);
  const side = Math.round(Math.max(14, w * 0.018));
  return { x: side, y: top, w: w - side * 2, h: h - top - Math.round(h * 0.014), r: h * 0.03 };
}

function roundedRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The dome's ribs against the sky, catching a little of the lamp. */
function paintDomeRibs(ctx: Ctx2D, w: number, h: number): void {
  const pole = polePosition(w, h);
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / 11);
    const x = pole.x + Math.cos(a) * h * 3;
    const y = pole.y + Math.sin(a) * h * 3;
    ctx.beginPath();
    ctx.moveTo(pole.x, pole.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(4, 6, 20, 0.85)';
    ctx.lineWidth = h * 0.006;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214, 168, 96, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(pole.x, pole.y, h * 0.55, 0, Math.PI);
  ctx.strokeStyle = 'rgba(4, 6, 20, 0.8)';
  ctx.lineWidth = h * 0.005;
  ctx.stroke();
  ctx.restore();
}

function paintLeather(ctx: Ctx2D, table: ReturnType<typeof observatoryTable>, rng: Rng): void {
  const { x, y, w, h, r } = table;
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const base = ctx.createRadialGradient(
    x + w * 0.35,
    y + h * 0.3,
    h * 0.1,
    x + w * 0.5,
    y + h * 0.5,
    w * 0.72,
  );
  base.addColorStop(0, '#2a4180');
  base.addColorStop(0.55, '#1c2d62');
  base.addColorStop(1, '#101c45');
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 1400; i++) {
    const gx = x + rng.float(0, w);
    const gy = y + rng.float(0, h);
    ctx.beginPath();
    ctx.arc(gx, gy, rng.float(1.5, 8), 0, Math.PI * 2);
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.055)';
    ctx.fill();
  }
  const inset = h * 0.024;
  ctx.strokeStyle = 'rgba(214, 178, 96, 0.6)';
  ctx.lineWidth = 1.6;
  roundedRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, r * 0.6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(214, 178, 96, 0.3)';
  ctx.lineWidth = 1;
  const inner = inset + 7;
  roundedRectPath(ctx, x + inner, y + inner, w - inner * 2, h - inner * 2, r * 0.45);
  ctx.stroke();
  // A tooled Deco fan in each corner of the border.
  const fan = h * 0.07;
  const corners = [
    { cx: x + inner, cy: y + inner, from: 0 },
    { cx: x + w - inner, cy: y + inner, from: Math.PI / 2 },
    { cx: x + w - inner, cy: y + h - inner, from: Math.PI },
    { cx: x + inner, cy: y + h - inner, from: Math.PI * 1.5 },
  ];
  ctx.strokeStyle = 'rgba(214, 178, 96, 0.42)';
  for (const { cx, cy, from } of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = from + (Math.PI / 2) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * fan * 0.25, cy + Math.sin(a) * fan * 0.25);
      ctx.lineTo(
        cx + Math.cos(a) * fan * (i % 2 === 0 ? 1 : 0.78),
        cy + Math.sin(a) * fan * (i % 2 === 0 ? 1 : 0.78),
      );
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const k of [0.45, 1.08]) {
      ctx.beginPath();
      ctx.arc(cx, cy, fan * k, from, from + Math.PI / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintBrassRail(ctx: Ctx2D, table: ReturnType<typeof observatoryTable>, h: number): void {
  const rail = Math.max(6, h * 0.01);
  const { x, y, w, r } = table;
  const brass = ctx.createLinearGradient(0, y, 0, y + table.h);
  brass.addColorStop(0, '#f1d08a');
  brass.addColorStop(0.06, '#b58a3e');
  brass.addColorStop(0.5, '#7e5a22');
  brass.addColorStop(0.94, '#c49548');
  brass.addColorStop(1, '#6e4e1d');
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = h * 0.03;
  ctx.shadowOffsetY = h * 0.008;
  roundedRectPath(ctx, x - rail, y - rail, w + rail * 2, table.h + rail * 2, r + rail);
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 236, 190, 0.5)';
  ctx.lineWidth = 1;
  roundedRectPath(
    ctx,
    x - rail + 1,
    y - rail + 1,
    w + rail * 2 - 2,
    table.h + rail * 2 - 2,
    r + rail,
  );
  ctx.stroke();
}

/** The star mirror: a brass-rimmed opening on the sky, its rim graduated like an astrolabe. */
function paintMirrorRim(ctx: Ctx2D, decor: Decor): void {
  const { x, y, r } = mirrorOf(decor);
  ctx.save();
  // Open the table here: the sky layer below shows through.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const rim = r * 0.13;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 10, 0.6)';
  ctx.shadowBlur = r * 0.12;
  ctx.shadowOffsetY = r * 0.03;
  const brass = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  brass.addColorStop(0, '#f3d692');
  brass.addColorStop(0.45, '#a77b33');
  brass.addColorStop(1, '#6a4a1a');
  ctx.beginPath();
  ctx.arc(x, y, r + rim, 0, Math.PI * 2);
  ctx.arc(x, y, r, 0, Math.PI * 2, true);
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(40, 24, 6, 0.75)';
  for (let i = 0; i < 72; i++) {
    const a = (Math.PI * 2 * i) / 72;
    const long = i % 6 === 0;
    ctx.beginPath();
    ctx.moveTo(
      x + Math.cos(a) * (r + rim * (long ? 0.2 : 0.45)),
      y + Math.sin(a) * (r + rim * (long ? 0.2 : 0.45)),
    );
    ctx.lineTo(x + Math.cos(a) * (r + rim * 0.85), y + Math.sin(a) * (r + rim * 0.85));
    ctx.lineWidth = long ? 1.4 : 0.8;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r + rim, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 236, 190, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Four Deco brackets holding the rim to the table.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (Math.PI / 2) * i;
    const bx = x + Math.cos(a) * (r + rim);
    const by = y + Math.sin(a) * (r + rim);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -rim * 0.7);
    ctx.lineTo(rim * 1.4, -rim * 0.35);
    ctx.lineTo(rim * 1.4, rim * 0.35);
    ctx.lineTo(0, rim * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#b8883c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 24, 6, 0.6)';
    ctx.stroke();
    ctx.restore();
  }
}

/** The dome's ribs, the brass-railed leather table and its star mirror: all that stays still. */
export function paintObservatoryBase(ctx: Ctx2D, w: number, h: number, decor: Decor): void {
  const rng = createRng(`observatory:${w}x${h}`);
  ctx.clearRect(0, 0, w, h);
  paintDomeRibs(ctx, w, h);
  const table = observatoryTable(w, h);
  paintBrassRail(ctx, table, h);
  paintLeather(ctx, table, rng);
  if (Math.min(decor.w, decor.h) > 120) paintMirrorRim(ctx, decor);
}

/**
 * The lamp, multiplied over the table and cards: warm, nearly white where it shines from the
 * upper left, deepening and cooling into the corners of the room.
 */
export function paintObservatoryShade(ctx: Ctx2D, w: number, h: number): void {
  const lamp = ctx.createRadialGradient(w * 0.22, h * 0.08, h * 0.05, w * 0.4, h * 0.4, w * 0.86);
  lamp.addColorStop(0, 'rgb(255, 236, 204)');
  lamp.addColorStop(0.5, 'rgb(252, 238, 220)');
  lamp.addColorStop(0.8, 'rgb(214, 206, 222)');
  lamp.addColorStop(1, 'rgb(130, 124, 160)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);
}

/** A glint across the star mirror's glass. */
export function paintObservatoryLight(ctx: Ctx2D, w: number, h: number, decor: Decor): void {
  ctx.clearRect(0, 0, w, h);
  const { x, y, r } = mirrorOf(decor);
  if (r <= 40) return;
  const glint = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  glint.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
  glint.addColorStop(0.42, 'rgba(255, 255, 255, 0.5)');
  glint.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = glint;
  ctx.fill();
}
