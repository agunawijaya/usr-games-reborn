import type { BeachLayout } from './layout';
import { type BeachPalette, mixHex, rgba } from './palette';

/**
 * What keeps the beach alive: crabs scuttling sideways, gulls gliding past, a trail of
 * footprints fading in the sand. Everything moves on paths computed from the clock, so any
 * moment can be drawn again exactly (stills, posters, the attract loop).
 */
export interface BeachLife {
  crabs: boolean;
  gulls: boolean;
  footprints: boolean;
  /** 0 to 1: crabs ducking into their burrows as a surge comes. */
  shelter: number;
}

export const FULL_LIFE: BeachLife = { crabs: true, gulls: true, footprints: true, shelter: 0 };

interface CrabPath {
  x: number;
  y: number;
  /** Half the stretch of sand it patrols, in pixels. */
  range: number;
  period: number;
  phase: number;
  size: number;
}

/**
 * Crabs keep to open sand: one on each side of the castle, one far off to the left, never on
 * the castle, the word or the keyboard, wherever the layout puts them.
 */
function crabPaths(layout: BeachLayout): CrabPath[] {
  const { castle, shoreY, width, height, scale } = layout;
  const besideCastle = shoreY + (castle.baseY - shoreY) * 0.45;
  return [
    {
      x: castle.x - castle.width * 0.92,
      y: besideCastle + 30 * scale,
      range: 70 * scale,
      period: 9,
      phase: 0.1,
      size: 1,
    },
    {
      x: Math.min(width * 0.2, Math.max(width * 0.1, castle.x - castle.width * 1.35)),
      y: height * 0.585,
      range: 60 * scale,
      period: 13,
      phase: 0.8,
      size: 0.7,
    },
    {
      x: castle.x + castle.width * 0.72,
      y: shoreY + 26 * scale,
      range: 40 * scale,
      period: 11,
      phase: 0.55,
      size: 0.75,
    },
  ];
}

/** Moves for 40 % of its cycle, then rests, eased at both ends so it scuttles and stops. */
function scuttle(time: number, path: CrabPath): { offset: number; moving: number } {
  const t = (time / path.period + path.phase) % 1;
  const leg = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const direction = t < 0.5 ? 1 : -1;
  const walk = Math.min(1, leg / 0.4);
  const eased = walk * walk * (3 - 2 * walk);
  const offset = direction > 0 ? eased : 1 - eased;
  return { offset: (offset - 0.5) * 2, moving: walk < 1 ? 1 : 0 };
}

export function paintLife(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  life: BeachLife,
  time: number,
  layer: 'behind' | 'front',
) {
  if (layer === 'behind') {
    if (life.footprints) paintFootprints(ctx, layout, palette);
    if (life.gulls) paintGulls(ctx, layout, palette, time);
  } else if (life.crabs) {
    for (const path of crabPaths(layout)) {
      const { offset, moving } = scuttle(time, path);
      const x = path.x + offset * path.range;
      const y = path.y;
      paintCrab(ctx, x, y, layout.scale * path.size, palette, time, moving, life.shelter);
    }
  }
}

// ——— crabs ———

/**
 * A crab seen from the front and a little above: a broad shell, two eyes on stalks, a claw on
 * each side held up, and four walking legs a side.
 */
export function paintCrab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  palette: BeachPalette,
  time: number,
  moving: number,
  shelter: number,
) {
  const s = scale * 1.15;
  const duck = 1 - shelter * 0.85;
  ctx.save();
  ctx.translate(x, y);
  // Shadow and burrow.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 4 * s, 30 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(1, duck);

  const body = palette.crab;
  const shade = palette.crabShade;
  ctx.strokeStyle = shade;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Walking legs: four a side, each with a knee, stepping in turn while it moves.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const step = moving * Math.sin(time * 18 + i * 1.6 + (side > 0 ? Math.PI : 0)) * 3 * s;
      const hipX = side * (9 + i * 3) * s;
      const hipY = (-4 + i * 2.5) * s;
      const kneeX = side * (20 + i * 3) * s;
      const kneeY = (-10 + i * 3) * s - step;
      const footX = side * (25 + i * 2.5) * s;
      const footY = 3 * s;
      ctx.lineWidth = 2.6 * s;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
    }
  }
  // Claws: an arm up and out, then a pincer of two fingers.
  for (const side of [-1, 1]) {
    const lift = Math.sin(time * 1.3 + side) * 1.5 * s;
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(side * 10 * s, -6 * s);
    ctx.quadraticCurveTo(side * 22 * s, -12 * s, side * 22 * s, -22 * s + lift);
    ctx.stroke();
    ctx.save();
    ctx.translate(side * 22 * s, -25 * s + lift);
    ctx.rotate(side * -0.25);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5 * s, 7.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // The gap between the fingers.
    ctx.strokeStyle = mixHex(shade, '#000000', 0.3);
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(0, -7 * s);
    ctx.lineTo(side * -1 * s, -1 * s);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = shade;
  }
  // Eyes on stalks.
  for (const side of [-1, 1]) {
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(side * 4 * s, -10 * s);
    ctx.lineTo(side * 6 * s, -18 * s);
    ctx.stroke();
    ctx.fillStyle = '#1b1b22';
    ctx.beginPath();
    ctx.arc(side * 6 * s, -19.5 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(side * 6 * s - 0.8 * s, -20.3 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // The shell, wider than tall, lit from above.
  const shell = ctx.createLinearGradient(0, -14 * s, 0, 4 * s);
  shell.addColorStop(0, mixHex(body, '#ffffff', 0.25));
  shell.addColorStop(1, shade);
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.moveTo(-15 * s, -2 * s);
  ctx.bezierCurveTo(-15 * s, -14 * s, 15 * s, -14 * s, 15 * s, -2 * s);
  ctx.bezierCurveTo(13 * s, 4 * s, -13 * s, 4 * s, -15 * s, -2 * s);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.35);
  ctx.beginPath();
  ctx.ellipse(-4 * s, -8 * s, 5 * s, 2 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ——— gulls ———

interface GullPath {
  y: number;
  period: number;
  phase: number;
  size: number;
  direction: 1 | -1;
}

const GULLS: GullPath[] = [
  { y: 0.1, period: 34, phase: 0.15, size: 1, direction: 1 },
  { y: 0.14, period: 41, phase: 0.62, size: 0.75, direction: -1 },
];

function paintGulls(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  time: number,
) {
  const night = palette.look === 'moonlit';
  for (const [index, path] of GULLS.entries()) {
    if (night && index > 0) continue;
    const t = (time / path.period + path.phase) % 1;
    const across = path.direction > 0 ? t : 1 - t;
    const x = -0.1 * layout.width + across * 1.2 * layout.width;
    const y = (path.y + Math.sin(time * 0.4 + index) * 0.015) * layout.height;
    // Long glides with a few slow flaps.
    const flapping = Math.sin(time * 0.5 + index * 2) > 0.55 ? 1 : 0.15;
    const flap = Math.sin(time * 7 + index) * flapping;
    paintGull(ctx, x, y, layout.scale * path.size, path.direction, flap, palette);
  }
}

/**
 * A gull gliding past, seen from the beach: the bent-wing "M" every child draws, with a white
 * body and head, grey wings, black wingtips and a yellow bill pointing the way it flies.
 */
export function paintGull(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  direction: 1 | -1,
  flap: number,
  palette: BeachPalette,
) {
  const s = scale * 1.25;
  const lift = flap * 8 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const wrist: [number, number] = [side * 16 * s, -9 * s - lift];
    const tip: [number, number] = [side * 34 * s, -1 * s - lift * 0.4];
    ctx.beginPath();
    ctx.moveTo(side * 4 * s, 0);
    ctx.quadraticCurveTo(side * 9 * s, -8 * s - lift, ...wrist);
    ctx.quadraticCurveTo(side * 25 * s, -9 * s - lift * 0.8, ...tip);
    ctx.quadraticCurveTo(side * 24 * s, -3 * s - lift * 0.6, wrist[0], wrist[1] + 6 * s);
    ctx.quadraticCurveTo(side * 9 * s, -1 * s - lift * 0.5, side * 3 * s, 4 * s);
    ctx.closePath();
    ctx.fillStyle = palette.gullWing;
    ctx.fill();
    // Black tips on the outer third of each wing.
    ctx.beginPath();
    ctx.moveTo(side * 27 * s, -7.5 * s - lift * 0.7);
    ctx.quadraticCurveTo(side * 31 * s, -5 * s - lift * 0.5, ...tip);
    ctx.quadraticCurveTo(side * 29 * s, -2 * s - lift * 0.5, side * 25 * s, -3.5 * s - lift * 0.6);
    ctx.closePath();
    ctx.fillStyle = palette.look === 'moonlit' ? '#272d4a' : '#2b2f36';
    ctx.fill();
  }
  // Body, head and bill.
  ctx.fillStyle = palette.gull;
  ctx.beginPath();
  ctx.ellipse(0, 1 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(direction * 3 * s, -5 * s, 3.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.look === 'moonlit' ? '#c6a85a' : '#ffc928';
  ctx.beginPath();
  ctx.moveTo(direction * 5.5 * s, -6 * s);
  ctx.lineTo(direction * 10 * s, -4.5 * s);
  ctx.lineTo(direction * 5.5 * s, -3.6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1b1b22';
  ctx.beginPath();
  ctx.arc(direction * 4.2 * s, -6 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ——— footprints ———

/** A walker's trail from the bottom left towards the water, older prints fainter. */
function paintFootprints(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
) {
  const s = layout.scale;
  const steps = 16;
  const shade = palette.look === 'moonlit' ? '#2d2b3d' : '#c9ad7f';
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const fx = 0.035 + t * 0.29 + Math.sin(t * 3) * 0.015;
    const fy = 0.97 - t * 0.42;
    const perspective = 1 - t * 0.45;
    const side = i % 2 === 0 ? -1 : 1;
    const x = fx * layout.width + side * 9 * s * perspective;
    const y = fy * layout.height;
    const alpha = (0.55 - t * 0.35) * (palette.look === 'moonlit' ? 0.9 : 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.55);
    ctx.scale(perspective, perspective * 0.7);
    ctx.fillStyle = rgba(shade, alpha);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let toe = 0; toe < 4; toe++) {
      ctx.beginPath();
      ctx.arc(
        (-4 + toe * 2.8) * s * side * -1,
        -16 * s + Math.abs(toe - 1) * 1.2 * s,
        1.9 * s,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }
}
