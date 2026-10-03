import { type BoardGeometry, type Rect, starPoints } from './geometry';
import type { Look } from './look';
import { seeded } from './noise';

/**
 * Zen Sand's still scenery: a stone garden of pale raked sand in the morning sun (from the upper
 * left), rocks with caps of moss and rings raked around them, and the board as a bed of smoothed
 * sand inside a granite kerb, its grid raked in as grooves. Drawn once into a cache per size.
 */

interface RockGroup {
  x: number;
  y: number;
  r: number;
  /** Smaller rocks beside the main one, as offsets in its radius. */
  companions: { dx: number; dy: number; r: number }[];
  rings: number;
}

const LETTERS = 'ABCDEFGHJKLMNOPQRST';

/** Where the rocks go: beside the board, round a page's head, or clear of the game menu's column. */
export type RockLayout = 'board' | 'page' | 'menu';

function rockGroups(
  width: number,
  height: number,
  slot: Rect | null,
  layout: RockLayout,
): RockGroup[] {
  if (layout === 'menu') {
    const unit = height * 0.075;
    return [
      {
        x: width * 0.88,
        y: height * 0.17,
        r: unit,
        companions: [{ dx: -1.05, dy: 0.45, r: 0.42 }],
        rings: 4,
      },
      {
        x: width * 0.47,
        y: height * 0.13,
        r: unit * 0.62,
        companions: [{ dx: 1.1, dy: 0.4, r: 0.45 }],
        rings: 3,
      },
    ];
  }
  if (!slot) {
    const unit = height * 0.085;
    return [
      {
        x: width * 0.12,
        y: height * 0.3,
        r: unit,
        companions: [
          { dx: 1.1, dy: 0.45, r: 0.45 },
          { dx: -0.9, dy: 0.55, r: 0.28 },
        ],
        rings: 4,
      },
      {
        x: width * 0.86,
        y: height * 0.26,
        r: unit * 0.85,
        companions: [{ dx: -1.05, dy: 0.4, r: 0.4 }],
        rings: 4,
      },
    ];
  }
  const leftRoom = slot.x;
  const rightRoom = width - slot.x - slot.width;
  const unit = Math.min(height * 0.1, Math.max(leftRoom, rightRoom) * 0.22);
  // No room beside the board (a narrow window): no rocks.
  if (unit < 16) return [];
  return [
    {
      x: leftRoom * 0.46,
      y: height * 0.8,
      r: unit,
      companions: [
        { dx: 1.05, dy: 0.5, r: 0.48 },
        { dx: -0.85, dy: 0.62, r: 0.3 },
      ],
      rings: 4,
    },
    {
      x: width - rightRoom * 0.5,
      y: height * 0.74,
      r: unit * 0.82,
      companions: [{ dx: -1.0, dy: 0.42, r: 0.42 }],
      rings: 4,
    },
  ];
}

/** An uneven closed outline around (x, y): a rock or a pebble. */
export function lumpyPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  random: () => number,
  roughness = 0.12,
  points = 9,
): void {
  const radii = Array.from({ length: points }, () => 1 - roughness / 2 + random() * roughness);
  const spin = random() * Math.PI * 2;
  const at = (i: number) => {
    const a = spin + (i / points) * Math.PI * 2;
    const k = radii[((i % points) + points) % points]!;
    return { x: x + Math.cos(a) * rx * k, y: y + Math.sin(a) * ry * k };
  };
  ctx.beginPath();
  const start = at(0);
  const next = at(1);
  ctx.moveTo((start.x + next.x) / 2, (start.y + next.y) / 2);
  for (let i = 1; i <= points; i++) {
    const p = at(i);
    const q = at(i + 1);
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

function sprinkleGrain(ctx: CanvasRenderingContext2D, area: Rect, density: number, seed: number) {
  const random = seeded(seed);
  const count = Math.round((area.width * area.height) / density);
  for (let i = 0; i < count; i++) {
    const light = random() < 0.5;
    ctx.fillStyle = light
      ? `rgba(255, 252, 244, ${0.18 + random() * 0.3})`
      : `rgba(120, 96, 60, ${0.06 + random() * 0.12})`;
    const size = random() < 0.92 ? 1 : 1.6;
    ctx.fillRect(area.x + random() * area.width, area.y + random() * area.height, size, size);
  }
}

/** One raked groove: a shadowed trough with a sunlit lip below it. */
function strokeGroove(ctx: CanvasRenderingContext2D, look: Look, path: Path2D, width: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(0, width * 0.55);
  ctx.strokeStyle = look.grooveLight;
  ctx.lineWidth = width * 0.8;
  ctx.stroke(path);
  ctx.translate(0, -width * 0.95);
  ctx.strokeStyle = look.groove;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
}

function ringRadius(group: RockGroup, k: number, spacing: number): number {
  return group.r * 1.75 + k * spacing;
}

function drawRakedSand(
  ctx: CanvasRenderingContext2D,
  look: Look,
  width: number,
  height: number,
  bed: Rect | null,
  groups: RockGroup[],
  spacing: number,
) {
  const keepOut = (x: number, y: number) => {
    const m = spacing * 0.9;
    if (
      bed &&
      x > bed.x - m &&
      x < bed.x + bed.width + m &&
      y > bed.y - m &&
      y < bed.y + bed.height + m
    )
      return true;
    return groups.some(
      (g) =>
        Math.hypot(x - g.x, (y - g.y) * 1.12) < ringRadius(g, g.rings, spacing) + spacing * 0.6,
    );
  };
  const lines = new Path2D();
  for (let y = spacing * 0.6, row = 0; y < height + spacing; y += spacing, row++) {
    let drawing = false;
    for (let x = -4; x <= width + 4; x += 4) {
      const wave = y + Math.sin(x * 0.0042 + row * 0.7) * spacing * 0.08;
      if (keepOut(x, wave)) {
        drawing = false;
        continue;
      }
      if (!drawing) lines.moveTo(x, wave);
      else lines.lineTo(x, wave);
      drawing = true;
    }
  }
  for (const g of groups)
    for (let k = 1; k <= g.rings; k++) {
      const r = ringRadius(g, k, spacing);
      const ring = new Path2D();
      ring.ellipse(g.x, g.y, r, r / 1.12, 0, 0, Math.PI * 2);
      lines.addPath(ring);
    }
  strokeGroove(ctx, look, lines, Math.max(1.6, spacing * 0.13));
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  look: Look,
  x: number,
  y: number,
  r: number,
  random: () => number,
  mossy: boolean,
) {
  const [base, shade, light] = look.rock;
  // The morning shadow, cast to the lower right.
  ctx.save();
  ctx.filter = `blur(${Math.max(2, r * 0.12)}px)`;
  ctx.fillStyle = look.shadow;
  lumpyPath(ctx, x + r * 0.2, y + r * 0.24, r * 1.02, r * 0.86, seeded(Math.round(r * 97)), 0.16);
  ctx.fill();
  ctx.restore();

  ctx.save();
  lumpyPath(ctx, x, y, r, r * 0.84, random, 0.2, 10);
  const body = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.1);
  body.addColorStop(0, light);
  body.addColorStop(0.45, base);
  body.addColorStop(1, shade);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  // Weathering: faint speckles and a crack or two.
  for (let i = 0; i < r * 2.2; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(40,36,30,0.14)';
    const s = 1 + random() * 2.2;
    ctx.fillRect(x - r + random() * r * 2, y - r + random() * r * 2, s, s);
  }
  ctx.strokeStyle = 'rgba(40, 36, 30, 0.28)';
  ctx.lineWidth = Math.max(1, r * 0.025);
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    let cx = x - r * 0.5 + random() * r;
    let cy = y - r * 0.2 + random() * r * 0.6;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (random() - 0.3) * r * 0.25;
      cy += (random() - 0.5) * r * 0.2;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  if (mossy) {
    const [moss, mossShade] = look.moss;
    for (let patch = 0; patch < 4; patch++) {
      const px = x - r * 0.45 + random() * r * 0.7;
      const py = y - r * 0.62 + random() * r * 0.4;
      const pr = r * (0.22 + random() * 0.22);
      const blob = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
      blob.addColorStop(0, moss);
      blob.addColorStop(0.75, mossShade);
      blob.addColorStop(1, 'rgba(92, 111, 53, 0)');
      ctx.fillStyle = blob;
      lumpyPath(ctx, px, py, pr, pr * 0.7, random, 0.5, 11);
      ctx.fill();
    }
    for (let i = 0; i < r * 2.2; i++) {
      ctx.fillStyle = random() < 0.5 ? 'rgba(206, 222, 150, 0.28)' : 'rgba(44, 60, 22, 0.25)';
      ctx.beginPath();
      ctx.arc(
        x - r * 0.45 + random() * r * 0.8,
        y - r * 0.65 + random() * r * 0.5,
        0.8 + random() * 1.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * The bed's kerb: a low border of cut granite, lit from the upper left, so its outer faces on the
 * lower and right sides fall in shade and it casts a soft shadow onto the garden there.
 */
function drawKerb(ctx: CanvasRenderingContext2D, look: Look, bed: Rect, cell: number) {
  const band = Math.max(8, cell * 0.2);
  const outer = {
    x: bed.x - band,
    y: bed.y - band,
    w: bed.width + band * 2,
    h: bed.height + band * 2,
  };
  ctx.save();
  ctx.filter = `blur(${Math.max(2, band * 0.4)}px)`;
  ctx.fillStyle = look.shadow;
  ctx.fillRect(outer.x + band * 0.35, outer.y + band * 0.45, outer.w, outer.h);
  ctx.restore();

  const stone = new Path2D();
  stone.rect(outer.x, outer.y, outer.w, outer.h);
  stone.rect(bed.x, bed.y + bed.height, bed.width, -bed.height);
  const face = ctx.createLinearGradient(outer.x, outer.y, outer.x + outer.w, outer.y + outer.h);
  face.addColorStop(0, '#d3cec2');
  face.addColorStop(1, '#b0aa9d');
  ctx.fillStyle = face;
  ctx.fill(stone, 'evenodd');

  ctx.save();
  ctx.clip(stone, 'evenodd');
  const random = seeded(1729);
  for (let i = 0; i < (outer.w + outer.h) * 1.6; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(60,56,48,0.2)';
    const onTop = random() < 0.5;
    const t = random();
    const across = random() * band;
    const x = onTop
      ? outer.x + t * outer.w
      : random() < 0.5
        ? outer.x + across
        : bed.x + bed.width + across;
    const y = onTop
      ? random() < 0.5
        ? outer.y + across
        : bed.y + bed.height + across
      : outer.y + t * outer.h;
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  // The joints between the blocks.
  ctx.strokeStyle = 'rgba(80, 74, 64, 0.45)';
  ctx.lineWidth = 1;
  const step = cell * 3.1;
  for (let x = outer.x + step; x < outer.x + outer.w - band; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, outer.y);
    ctx.lineTo(x, bed.y);
    ctx.moveTo(x + step * 0.4, bed.y + bed.height);
    ctx.lineTo(x + step * 0.4, outer.y + outer.h);
    ctx.stroke();
  }
  for (let y = outer.y + step; y < outer.y + outer.h - band; y += step) {
    ctx.beginPath();
    ctx.moveTo(outer.x, y);
    ctx.lineTo(bed.x, y);
    ctx.moveTo(bed.x + bed.width, y + step * 0.4);
    ctx.lineTo(outer.x + outer.w, y + step * 0.4);
    ctx.stroke();
  }
  ctx.restore();

  // Sunlit top edges, shaded lower edges.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 253, 246, 0.85)';
  ctx.beginPath();
  ctx.moveTo(outer.x, outer.y + outer.h);
  ctx.lineTo(outer.x, outer.y);
  ctx.lineTo(outer.x + outer.w, outer.y);
  ctx.moveTo(bed.x + bed.width, bed.y);
  ctx.lineTo(bed.x + bed.width, bed.y + bed.height);
  ctx.lineTo(bed.x, bed.y + bed.height);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70, 64, 54, 0.55)';
  ctx.beginPath();
  ctx.moveTo(outer.x + outer.w, outer.y);
  ctx.lineTo(outer.x + outer.w, outer.y + outer.h);
  ctx.lineTo(outer.x, outer.y + outer.h);
  ctx.moveTo(bed.x, bed.y + bed.height);
  ctx.lineTo(bed.x, bed.y);
  ctx.lineTo(bed.x + bed.width, bed.y);
  ctx.stroke();
}

/** The grid as grooves raked into the bed, the marked points pressed in, the coordinates. */
export function drawSandGrid(ctx: CanvasRenderingContext2D, look: Look, g: BoardGeometry) {
  const span = g.cell * (g.size - 1);
  const width = Math.max(1.6, g.cell * 0.045);
  const across = new Path2D();
  const down = new Path2D();
  for (let i = 0; i < g.size; i++) {
    across.moveTo(g.left, g.top + i * g.cell);
    across.lineTo(g.left + span, g.top + i * g.cell);
    down.moveTo(g.left + i * g.cell, g.top);
    down.lineTo(g.left + i * g.cell, g.top + span);
  }
  ctx.save();
  ctx.lineCap = 'round';
  // Lit from the upper left: each groove's upper (or left) wall in shade, its far lip in sun.
  ctx.strokeStyle = look.lineShade;
  ctx.lineWidth = width * 0.85;
  ctx.translate(width * 0.5, width * 0.6);
  ctx.stroke(across);
  ctx.stroke(down);
  ctx.translate(-width * 0.9, -width * 1.0);
  ctx.strokeStyle = look.line;
  ctx.lineWidth = width;
  ctx.stroke(across);
  ctx.stroke(down);
  ctx.restore();

  for (const p of starPoints(g.size)) {
    const x = g.left + (p % g.size) * g.cell;
    const y = g.top + Math.floor(p / g.size) * g.cell;
    const r = Math.max(3, g.cell * 0.075);
    ctx.fillStyle = look.lineShade;
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y + r * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.starPoint;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCoordinates(ctx, look, g);
}

export function drawCoordinates(ctx: CanvasRenderingContext2D, look: Look, g: BoardGeometry) {
  const span = g.cell * (g.size - 1);
  const size = Math.max(11, Math.round(g.cell * 0.25));
  const gap = g.cell * 0.6;
  ctx.save();
  ctx.fillStyle = look.coordinate;
  ctx.font = `500 ${size}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < g.size; i++) {
    const letter = LETTERS[i]!;
    const number = String(g.size - i);
    const x = g.left + i * g.cell;
    const y = g.top + i * g.cell;
    ctx.fillText(letter, x, g.top - gap);
    ctx.fillText(letter, x, g.top + span + gap);
    ctx.fillText(number, g.left - gap, y);
    ctx.fillText(number, g.left + span + gap, y);
  }
  ctx.restore();
}

/**
 * The garden around the board: raked sand, rocks and their rings. The raking stops short of `bed`
 * (the board's place), or covers everything when there is no board on the screen.
 */
export function drawGardenBackdrop(
  ctx: CanvasRenderingContext2D,
  look: Look,
  width: number,
  height: number,
  bed: Rect | null,
  spacing: number,
  layout: RockLayout = bed ? 'board' : 'page',
) {
  const ground = ctx.createLinearGradient(0, 0, width, height);
  ground.addColorStop(0, look.ground[0]);
  ground.addColorStop(1, look.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);
  sprinkleGrain(ctx, { x: 0, y: 0, width, height }, 38, 11);

  const groups = rockGroups(width, height, bed, layout);
  drawRakedSand(ctx, look, width, height, bed, groups, spacing);
  const random = seeded(4242);
  for (const group of groups) {
    for (const c of group.companions)
      drawRock(
        ctx,
        look,
        group.x + c.dx * group.r,
        group.y + c.dy * group.r,
        group.r * c.r,
        random,
        false,
      );
    drawRock(ctx, look, group.x, group.y, group.r, random, true);
  }
}

/** The board: a bed of smoothed sand a step down from the garden, inside its kerb. */
export function drawGardenBoard(ctx: CanvasRenderingContext2D, look: Look, g: BoardGeometry) {
  const bed = g.slot;
  drawKerb(ctx, look, bed, g.cell);
  ctx.fillStyle = look.bed;
  ctx.fillRect(bed.x, bed.y, bed.width, bed.height);
  sprinkleGrain(ctx, bed, 44, 23);
  // The edging shades the bed's upper and left sides in the morning sun.
  const inset = g.cell * 0.5;
  const top = ctx.createLinearGradient(0, bed.y, 0, bed.y + inset);
  top.addColorStop(0, 'rgba(120, 96, 60, 0.18)');
  top.addColorStop(1, 'rgba(120, 96, 60, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(bed.x, bed.y, bed.width, inset);
  const left = ctx.createLinearGradient(bed.x, 0, bed.x + inset, 0);
  left.addColorStop(0, 'rgba(120, 96, 60, 0.18)');
  left.addColorStop(1, 'rgba(120, 96, 60, 0)');
  ctx.fillStyle = left;
  ctx.fillRect(bed.x, bed.y, inset, bed.height);
  drawSandGrid(ctx, look, g);
}
