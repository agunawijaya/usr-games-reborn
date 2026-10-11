import type { DeskPalette } from './palette';
import { alpha, type Ctx, linear, mix, radial } from './paint';

/**
 * The signaller: our own character, a young operator in a pea coat, knitted cap and scarf, who
 * stands facing us with a flag in each hand. Poses must read at a glance, so the arms are long,
 * straight and stiff, and each flag continues its arm's line; the flag cloth always flies to the
 * outside, never across the body.
 *
 * Angles are on screen, seen by the observer: 0 points right, π/2 down. `left` is the arm on the
 * observer's left (the signaller's right hand).
 */
export interface SignallerPose {
  left: number;
  right: number;
}

export interface SignallerOptions {
  /** Land flags are white and blue; sea flags red and yellow. */
  flags: 'land' | 'sea';
  /** Seconds, for the ripple and the scarf. */
  time: number;
  /** Faces and fingers only when large. */
  detail: 'far' | 'near';
  /** Night rim light from the roof lamp. */
  rimLight?: string;
  /** Wind strength 0–1. */
  wind?: number;
}

/** The figure's proportions, in units of its height (feet at 0, the top of the cap at −1). */
const BODY = {
  shoulderY: -0.69,
  shoulderX: 0.13,
  hipY: -0.42,
  headY: -0.815,
  headR: 0.095,
  armLength: 0.33,
  armWidth: 0.072,
  staff: 0.2,
  flag: 0.16,
};

/** Where an arm's hand ends up, for hit-testing drags and placing labels. */
export function handPosition(
  x: number,
  y: number,
  height: number,
  side: 'left' | 'right',
  angle: number,
): { x: number; y: number } {
  const shoulder = shoulderPosition(x, y, height, side);
  return {
    x: shoulder.x + Math.cos(angle) * BODY.armLength * height,
    y: shoulder.y + Math.sin(angle) * BODY.armLength * height,
  };
}

export function shoulderPosition(
  x: number,
  y: number,
  height: number,
  side: 'left' | 'right',
): { x: number; y: number } {
  return {
    x: x + (side === 'left' ? -1 : 1) * BODY.shoulderX * height,
    y: y + BODY.shoulderY * height,
  };
}

/** The reach of an arm with its flag, for laying out targets around the figure. */
export function reach(height: number): number {
  return (BODY.armLength + BODY.staff + BODY.flag * 0.6) * height;
}

export function paintSignaller(
  ctx: Ctx,
  x: number,
  y: number,
  height: number,
  pose: SignallerPose,
  pal: DeskPalette,
  options: SignallerOptions,
) {
  const u = height;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (options.rimLight) {
    ctx.fillStyle = radial(ctx, 0, -0.55 * u, 0.75 * u, [
      [0, alpha(options.rimLight, 0.32)],
      [1, alpha(options.rimLight, 0)],
    ]);
    ctx.fillRect(-0.8 * u, -1.4 * u, 1.6 * u, 1.5 * u);
  }
  paintLegs(ctx, u, pal);
  paintCoat(ctx, u, pal);
  paintHead(ctx, u, pal, options);
  paintScarfTail(ctx, u, pal, options);
  // The arm that points lower is drawn first, so a raised arm passes in front of it.
  const arms: Array<['left' | 'right', number]> = [
    ['left', pose.left],
    ['right', pose.right],
  ];
  arms.sort((a, b) => Math.sin(b[1]) - Math.sin(a[1]));
  for (const [side, angle] of arms) paintArm(ctx, u, side, angle, pal, options);
  ctx.restore();
}

function paintLegs(ctx: Ctx, u: number, pal: DeskPalette) {
  ctx.fillStyle = pal.trousers;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.025 * u, BODY.hipY * u + 0.04 * u);
    ctx.lineTo(side * 0.115 * u, BODY.hipY * u + 0.02 * u);
    ctx.lineTo(side * 0.105 * u, -0.06 * u);
    ctx.lineTo(side * 0.035 * u, -0.06 * u);
    ctx.closePath();
    ctx.fill();
    // Boots, turned slightly outwards.
    ctx.fillStyle = pal.boots;
    ctx.beginPath();
    ctx.ellipse(side * 0.085 * u, -0.03 * u, 0.06 * u, 0.034 * u, side * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(side > 0 ? 0.035 * u : -0.105 * u, -0.075 * u, 0.07 * u, 0.045 * u);
    ctx.fillStyle = pal.trousers;
  }
  // A shadow between the legs keeps them apart at small sizes.
  ctx.fillStyle = alpha('#000000', 0.18);
  ctx.fillRect(-0.025 * u, BODY.hipY * u + 0.05 * u, 0.05 * u, 0.3 * u);
}

function paintCoat(ctx: Ctx, u: number, pal: DeskPalette) {
  const top = BODY.shoulderY * u - 0.02 * u;
  const hem = BODY.hipY * u + 0.075 * u;
  ctx.fillStyle = linear(ctx, -0.16 * u, 0, 0.16 * u, 0, [
    [0, mix(pal.coat, '#ffffff', 0.12)],
    [0.55, pal.coat],
    [1, pal.coatShade],
  ]);
  ctx.beginPath();
  ctx.moveTo(-0.115 * u, top + 0.01 * u);
  ctx.quadraticCurveTo(-0.16 * u, top + 0.02 * u, -0.155 * u, top + 0.08 * u);
  ctx.lineTo(-0.15 * u, hem);
  ctx.quadraticCurveTo(0, hem + 0.025 * u, 0.15 * u, hem);
  ctx.lineTo(0.155 * u, top + 0.08 * u);
  ctx.quadraticCurveTo(0.16 * u, top + 0.02 * u, 0.115 * u, top + 0.01 * u);
  ctx.quadraticCurveTo(0, top - 0.03 * u, -0.115 * u, top + 0.01 * u);
  ctx.closePath();
  ctx.fill();
  // Double-breasted buttons and the lapel line.
  ctx.strokeStyle = alpha('#000000', 0.25);
  ctx.lineWidth = 0.008 * u;
  ctx.beginPath();
  ctx.moveTo(0.01 * u, top + 0.05 * u);
  ctx.lineTo(0.03 * u, hem - 0.01 * u);
  ctx.stroke();
  ctx.fillStyle = pal.brassLight;
  for (let i = 0; i < 3; i++) {
    for (const side of [-0.035, 0.07]) {
      ctx.beginPath();
      ctx.arc(side * u, top + (0.09 + i * 0.075) * u, 0.011 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The belt line where the coat meets the hips.
  ctx.fillStyle = alpha('#000000', 0.16);
  ctx.fillRect(-0.15 * u, BODY.hipY * u - 0.005 * u, 0.3 * u, 0.018 * u);
}

function paintHead(ctx: Ctx, u: number, pal: DeskPalette, options: SignallerOptions) {
  const cy = BODY.headY * u;
  const r = BODY.headR * u;
  // Neck and scarf.
  ctx.fillStyle = pal.skinShade;
  ctx.fillRect(-0.03 * u, cy + r * 0.6, 0.06 * u, 0.05 * u);
  ctx.fillStyle = pal.scarf;
  ctx.beginPath();
  ctx.ellipse(0, BODY.shoulderY * u - 0.025 * u, 0.085 * u, 0.032 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#000000', 0.15);
  ctx.beginPath();
  ctx.ellipse(0, BODY.shoulderY * u - 0.012 * u, 0.08 * u, 0.016 * u, 0, 0, Math.PI);
  ctx.fill();
  // Face.
  ctx.fillStyle = radial(ctx, -r * 0.3, cy - r * 0.2, r * 1.4, [
    [0, mix(pal.skin, '#ffffff', 0.12)],
    [0.7, pal.skin],
    [1, pal.skinShade],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, cy, r * 0.92, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.fillStyle = pal.skinShade;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.92, cy + r * 0.05, r * 0.16, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hair under the cap.
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.ellipse(0, cy - r * 0.45, r * 0.95, r * 0.5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Knitted cap with a folded brim and a bobble.
  const capTop = cy - r * 1.55;
  ctx.fillStyle = pal.scarf;
  ctx.beginPath();
  ctx.moveTo(-r * 1.02, cy - r * 0.42);
  ctx.quadraticCurveTo(-r * 1.05, capTop, 0, capTop);
  ctx.quadraticCurveTo(r * 1.05, capTop, r * 1.02, cy - r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix(pal.scarf, '#000000', 0.18);
  ctx.fillRect(-r * 1.05, cy - r * 0.62, r * 2.1, r * 0.3);
  ctx.fillStyle = mix(pal.scarf, '#ffffff', 0.3);
  ctx.beginPath();
  ctx.arc(0, capTop - r * 0.12, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  if (options.detail === 'near') {
    // Ribbing on the brim.
    ctx.strokeStyle = alpha('#000000', 0.18);
    ctx.lineWidth = r * 0.05;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.23, cy - r * 0.62);
      ctx.lineTo(i * r * 0.23, cy - r * 0.32);
      ctx.stroke();
    }
  }
  // Eyes, cheeks and a small smile.
  ctx.fillStyle = pal.ink;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.36, cy + r * 0.05, r * 0.1, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (options.detail === 'near') {
    ctx.fillStyle = alpha('#e2614a', 0.35);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.55, cy + r * 0.35, r * 0.18, r * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, cy + r * 0.32, r * 0.24, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.strokeStyle = alpha(pal.ink, 0.7);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.5, cy - r * 0.2);
      ctx.lineTo(side * r * 0.22, cy - r * 0.24);
      ctx.stroke();
    }
  }
}

function paintScarfTail(ctx: Ctx, u: number, pal: DeskPalette, options: SignallerOptions) {
  const wind = options.wind ?? 0.6;
  const t = options.time;
  const startX = 0.05 * u;
  const startY = BODY.shoulderY * u - 0.01 * u;
  ctx.fillStyle = mix(pal.scarf, '#000000', 0.1);
  ctx.beginPath();
  ctx.moveTo(startX, startY - 0.015 * u);
  const length = 0.17 * u;
  const lift = Math.sin(t * 3.1) * 0.02 * u * wind;
  ctx.quadraticCurveTo(
    startX + length * 0.5,
    startY + 0.02 * u + lift,
    startX + length,
    startY + 0.05 * u + lift * 1.6 - wind * 0.03 * u,
  );
  ctx.lineTo(startX + length - 0.01 * u, startY + 0.085 * u + lift * 1.6 - wind * 0.03 * u);
  ctx.quadraticCurveTo(startX + length * 0.45, startY + 0.06 * u + lift, startX, startY + 0.03 * u);
  ctx.closePath();
  ctx.fill();
}

function paintArm(
  ctx: Ctx,
  u: number,
  side: 'left' | 'right',
  angle: number,
  pal: DeskPalette,
  options: SignallerOptions,
) {
  const sx = (side === 'left' ? -1 : 1) * BODY.shoulderX * u;
  const sy = BODY.shoulderY * u;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const handX = sx + dx * BODY.armLength * u;
  const handY = sy + dy * BODY.armLength * u;
  const staffX = handX + dx * BODY.staff * u;
  const staffY = handY + dy * BODY.staff * u;

  // Staff first, so the hand grips it.
  ctx.strokeStyle = pal.staff;
  ctx.lineWidth = 0.016 * u;
  ctx.beginPath();
  ctx.moveTo(handX - dx * 0.02 * u, handY - dy * 0.02 * u);
  ctx.lineTo(staffX, staffY);
  ctx.stroke();
  paintFlag(ctx, u, side, angle, handX, handY, pal, options);

  // The sleeve, with a darker underside so the arm reads against the coat.
  ctx.strokeStyle = pal.coatShade;
  ctx.lineWidth = BODY.armWidth * u;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(handX - dx * 0.035 * u, handY - dy * 0.035 * u);
  ctx.stroke();
  ctx.strokeStyle = pal.coat;
  ctx.lineWidth = BODY.armWidth * u * 0.72;
  ctx.beginPath();
  ctx.moveTo(sx - dy * 0.008 * u, sy + dx * 0.008 * u);
  ctx.lineTo(handX - dx * 0.04 * u - dy * 0.008 * u, handY - dy * 0.04 * u + dx * 0.008 * u);
  ctx.stroke();
  // Cuff and hand.
  ctx.strokeStyle = mix(pal.coatShade, '#000000', 0.2);
  ctx.lineWidth = BODY.armWidth * u * 1.04;
  ctx.beginPath();
  ctx.moveTo(handX - dx * 0.05 * u, handY - dy * 0.05 * u);
  ctx.lineTo(handX - dx * 0.035 * u, handY - dy * 0.035 * u);
  ctx.stroke();
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(handX, handY, 0.027 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(pal.skinShade, 0.8);
  ctx.beginPath();
  ctx.arc(handX + dx * 0.008 * u, handY + dy * 0.008 * u, 0.017 * u, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The flag sits on the outer part of the staff, its hoist along the staff and its fly out to
 * the side of the arm away from the body, rippling in the wind.
 */
function paintFlag(
  ctx: Ctx,
  u: number,
  side: 'left' | 'right',
  angle: number,
  handX: number,
  handY: number,
  pal: DeskPalette,
  options: SignallerOptions,
) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const outward = side === 'left' ? -1 : 1;
  // The two perpendiculars; prefer the one that points outwards and, less, downwards.
  const perpA = { x: -dy, y: dx };
  const perpB = { x: dy, y: -dx };
  const score = (p: { x: number; y: number }) => p.x * outward * 0.6 + p.y * 0.4;
  const fly = score(perpA) >= score(perpB) ? perpA : perpB;
  const size = BODY.flag * u;
  const hoistStart = BODY.staff * u - size;
  const ax = handX + dx * hoistStart;
  const ay = handY + dy * hoistStart;
  const bx = handX + dx * BODY.staff * u;
  const by = handY + dy * BODY.staff * u;
  const wind = options.wind ?? 0.6;
  const t = options.time * 4.2;
  const wave = (k: number) => Math.sin(t + k * 2.6) * size * 0.08 * wind * k;
  const point = (along: number, across: number) => {
    const w = wave(across);
    return {
      x: ax + (bx - ax) * along + fly.x * across * size + dx * w,
      y: ay + (by - ay) * along + fly.y * across * size + dy * w,
    };
  };
  const [colorA, colorB] =
    options.flags === 'land' ? [pal.flagA, pal.flagB] : ['#e23b2e', '#f6c63a'];
  // Two triangles split on the diagonal, as on a real semaphore flag.
  const outline = (corners: Array<[number, number]>) => {
    ctx.beginPath();
    corners.forEach(([along, across], i) => {
      const p = point(along, across);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  };
  const steps = 6;
  const edge = (from: [number, number], to: [number, number]): Array<[number, number]> =>
    Array.from({ length: steps + 1 }, (_, i) => [
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    ]);
  ctx.fillStyle = colorA;
  outline([
    ...edge([0, 0], [1, 0]),
    ...edge([1, 0], [1, 1]).slice(1),
    ...edge([1, 1], [0, 0]).slice(1),
  ]);
  ctx.fill();
  ctx.fillStyle = colorB;
  outline([
    ...edge([0, 0], [1, 1]),
    ...edge([1, 1], [0, 1]).slice(1),
    ...edge([0, 1], [0, 0]).slice(1),
  ]);
  ctx.fill();
  // A fold of shade across the cloth.
  ctx.fillStyle = alpha('#000000', 0.12 + 0.08 * Math.sin(t + 1.3));
  outline([...edge([0.45, 0.35], [0.65, 0.35]), ...edge([0.65, 1], [0.45, 1])]);
  ctx.fill();
  ctx.strokeStyle = alpha('#000000', 0.22);
  ctx.lineWidth = Math.max(0.6, 0.004 * u);
  outline([
    ...edge([0, 0], [1, 0]),
    ...edge([1, 0], [1, 1]).slice(1),
    ...edge([1, 1], [0, 1]).slice(1),
  ]);
  ctx.stroke();
}
