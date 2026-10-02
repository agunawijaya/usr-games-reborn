import { type BoardFrame, RIM } from './frame';
import type { Look } from './look';
import { hash, rgba } from './noise';
import { glow } from './shapes';

/**
 * Light and life that carry no information: sun dapples drifting over the stones by day; by
 * night, moonlight, stone lanterns on the rim and glow-worms wandering the hedges. Under reduced
 * motion all of it holds still.
 */
export interface AmbienceDraw {
  readonly frame: BoardFrame;
  readonly width: number;
  readonly height: number;
  readonly look: Look;
  readonly time: number;
  readonly seed: number;
}

export function lanternSpots(frame: BoardFrame): Array<{ x: number; y: number }> {
  const rim = RIM * frame.cell;
  const w = frame.columns * frame.cell;
  const h = frame.rows * frame.cell;
  const left = frame.x - rim / 2;
  const right = frame.x + w + rim / 2;
  const top = frame.y - rim / 2;
  const bottom = frame.y + h + rim / 2;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
    { x: frame.x + w / 2, y: top },
    { x: frame.x + w / 2, y: bottom },
  ];
}

/**
 * Stone garden lanterns standing on the rim, seen from above: a square foot, a light box with
 * four windows and a pyramid roof with upturned eaves. They are lit only by moonlight.
 */
export function drawLanterns(ctx: CanvasRenderingContext2D, a: AmbienceDraw) {
  const s = a.frame.cell;
  const sun = a.look === 'sun';
  lanternSpots(a.frame).forEach((spot, i) => {
    const flicker = 0.88 + 0.12 * Math.sin(a.time * (9 + i) + i) * Math.sin(a.time * 5.3 + i * 2);
    const size = s * 0.5;
    const x = spot.x;
    const y = spot.y - size * 0.25;
    if (!sun) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, spot.y, s * 3.4 * flicker, 'rgba(255, 170, 80, 0.14)');
      ctx.restore();
    }
    // Shadow, foot and post.
    ctx.fillStyle = rgba('#000000', sun ? 0.25 : 0.45);
    ctx.beginPath();
    ctx.ellipse(
      x + size * 0.35,
      spot.y + size * 0.45,
      size * 0.75,
      size * 0.42,
      0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = sun ? '#b9a17c' : '#4b5975';
    ctx.beginPath();
    ctx.roundRect(x - size * 0.42, spot.y - size * 0.05, size * 0.84, size * 0.5, size * 0.08);
    ctx.fill();
    // The light box.
    ctx.fillStyle = sun ? '#cdb791' : '#5a6987';
    ctx.beginPath();
    ctx.roundRect(x - size * 0.4, y - size * 0.35, size * 0.8, size * 0.62, size * 0.06);
    ctx.fill();
    ctx.fillStyle = sun ? '#6b5636' : `rgba(255, 214, 140, ${0.95 * flicker})`;
    ctx.beginPath();
    ctx.roundRect(x - size * 0.24, y - size * 0.22, size * 0.48, size * 0.36, size * 0.04);
    ctx.fill();
    if (!sun) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y - size * 0.05, size * 1.4, `rgba(255, 210, 130, ${0.55 * flicker})`);
      ctx.restore();
    }
    ctx.strokeStyle = sun ? '#a68e68' : '#3c4860';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.22);
    ctx.lineTo(x, y + size * 0.14);
    ctx.stroke();
    // Roof: a pyramid with upturned eaves, lit on its north-west faces.
    const roofY = y - size * 0.45;
    const eave = size * 0.72;
    const faces: Array<[number, number, string]> = [
      [-1, -1, sun ? '#ddc9a2' : '#6f7fa0'],
      [1, -1, sun ? '#cbb48c' : '#5e6d8c'],
      [1, 1, sun ? '#a99170' : '#3f4b66'],
      [-1, 1, sun ? '#bba37f' : '#4d5a78'],
    ];
    const corners = [
      { x: x - eave, y: roofY - eave * 0.55 },
      { x: x + eave, y: roofY - eave * 0.55 },
      { x: x + eave, y: roofY + eave * 0.55 },
      { x: x - eave, y: roofY + eave * 0.55 },
    ];
    const apex = { x, y: roofY - size * 0.05 };
    faces.forEach((face, k) => {
      const c1 = corners[k]!;
      const c2 = corners[(k + 1) % 4]!;
      ctx.fillStyle = face[2];
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(apex.x, apex.y);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = sun ? '#e7d7b5' : '#8292b3';
    ctx.beginPath();
    ctx.arc(apex.x, apex.y, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Over everything: dapples or moonlight, glow-worms, then the vignette. */
export function drawAtmosphere(ctx: CanvasRenderingContext2D, a: AmbienceDraw) {
  const { width, height, frame, time, look } = a;
  const s = frame.cell;
  ctx.save();
  if (look === 'sun') {
    ctx.globalCompositeOperation = 'soft-light';
    const sun = ctx.createRadialGradient(
      width * 0.15,
      -height * 0.1,
      0,
      width * 0.15,
      -height * 0.1,
      width * 0.9,
    );
    sun.addColorStop(0, 'rgba(255, 236, 180, 0.7)');
    sun.addColorStop(1, 'rgba(255, 236, 180, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const drift = Math.sin(time * 0.25 + i * 1.3) * s * 0.6;
      const x = frame.x + hash(i, 1, a.seed) * frame.columns * s + drift;
      const y = frame.y + hash(i, 2, a.seed) * frame.rows * s + Math.cos(time * 0.2 + i) * s * 0.4;
      glow(ctx, x, y, s * (1.2 + hash(i, 3, a.seed) * 1.4), 'rgba(255, 244, 205, 0.08)');
    }
  } else {
    ctx.globalCompositeOperation = 'lighter';
    const moon = ctx.createRadialGradient(
      width * 0.85,
      -height * 0.15,
      0,
      width * 0.85,
      -height * 0.15,
      width * 0.8,
    );
    moon.addColorStop(0, 'rgba(150, 180, 255, 0.22)');
    moon.addColorStop(1, 'rgba(150, 180, 255, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 26; i++) {
      const bx = hash(i, 11, a.seed);
      const by = hash(i, 12, a.seed);
      const x = frame.x + bx * frame.columns * s + Math.sin(time * (0.4 + bx * 0.3) + i) * s * 0.8;
      const y =
        frame.y + by * frame.rows * s + Math.cos(time * (0.35 + by * 0.3) + i * 2) * s * 0.6;
      const blink = 0.4 + 0.6 * Math.max(0, Math.sin(time * (1.3 + bx) + i * 3));
      glow(ctx, x, y, s * 0.42, `rgba(200, 255, 170, ${0.22 * blink})`);
      glow(ctx, x, y, s * 0.08, `rgba(235, 255, 200, ${0.9 * blink})`);
    }
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, look === 'sun' ? rgba('#62461f', 0.32) : rgba('#02040e', 0.6));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/** Moving light on the pools: ripples and a glint of sky. */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  frame: BoardFrame,
  pool: Path2D,
  cells: ReadonlyArray<{ x: number; y: number }>,
  look: Look,
  time: number,
) {
  const s = frame.cell;
  ctx.save();
  ctx.clip(pool);
  ctx.globalCompositeOperation = look === 'moon' ? 'lighter' : 'source-over';
  cells.forEach((c, i) => {
    const x = frame.x + (c.x + 0.5) * s;
    const y = frame.y + (c.y + 0.5) * s;
    const phase = (time * 0.5 + hash(c.x, c.y, 3)) % 1;
    ctx.strokeStyle =
      look === 'sun'
        ? `rgba(255, 255, 245, ${0.45 * (1 - phase)})`
        : `rgba(190, 215, 255, ${0.35 * (1 - phase)})`;
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.ellipse(
      x + (hash(c.x, c.y, 9) - 0.5) * s * 0.5,
      y,
      s * (0.1 + phase * 0.35),
      s * (0.05 + phase * 0.16),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    if (i % 3 === 0) {
      const shimmer = 0.5 + 0.5 * Math.sin(time * 2 + i);
      ctx.fillStyle =
        look === 'sun'
          ? `rgba(255, 255, 240, ${0.35 * shimmer})`
          : `rgba(230, 240, 255, ${0.5 * shimmer})`;
      ctx.beginPath();
      ctx.ellipse(x - s * 0.15, y - s * 0.2, s * 0.18, s * 0.035, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}
