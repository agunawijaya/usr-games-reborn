import type { DeskPalette } from './palette';
import { alpha, type Ctx, glow, linear, mix, radial, scatter } from './paint';
import { paintSignaller, type SignallerPose } from './signaller';

/**
 * The world outside: a sky, a skyline in three hazy layers and the flat roof across the street
 * where the signaller stands; at sea, a ship's deck and rail instead. Drawn into any rectangle,
 * so the same view fills the window on the desk and the whole screen at the semaphore.
 */
export interface OutsideView {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the roof's parapet sits, as a share of the height from the top. */
  roofLine: number;
  /** The signaller's feet, as shares of the rectangle, and height in pixels. */
  signaller: { x: number; y: number; height: number } | null;
  pose: SignallerPose;
  scene: 'rooftop' | 'ship';
  time: number;
  detail: 'far' | 'near';
}

export function paintOutside(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  paintOutsideSky(ctx, view, pal);
  paintOutsideGround(ctx, view, pal);
  paintOutsideFigure(ctx, view, pal);
}

/** The sky alone: gradient, sun or moon, stars and drifting clouds (it moves, so never cached). */
export function paintOutsideSky(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.width, view.height);
  ctx.clip();
  paintSky(ctx, view, pal);
  ctx.restore();
}

/** The skyline (or the sea) and the roof: still, so a screen can cache them. */
export function paintOutsideGround(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.width, view.height);
  ctx.clip();
  if (view.scene === 'ship') paintSea(ctx, view, pal);
  else paintSkyline(ctx, view, pal);
  paintRoof(ctx, view, pal);
  ctx.restore();
}

/** The signaller with their shadow and, at night, the lamp-lit wall behind them. */
export function paintOutsideFigure(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  const { x, y, width, height } = view;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  if (view.signaller) {
    const s = view.signaller;
    const sx = x + width * s.x;
    const sy = y + height * s.y;
    // A soft pool of light from the roof lamp at night; a ground shadow by day.
    // At night the roof lamp lights the wall behind, so the figure reads as a clean silhouette.
    if (pal.look === 'night') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = radial(ctx, sx, sy - s.height * 0.55, s.height * 1.25, [
        [0, alpha('#ffcf86', 0.5)],
        [0.5, alpha('#ffcf86', 0.2)],
        [1, alpha('#ffcf86', 0)],
      ]);
      ctx.fillRect(sx - s.height * 1.4, sy - s.height * 1.9, s.height * 2.8, s.height * 2.1);
      ctx.restore();
    }
    ctx.fillStyle = alpha('#000000', pal.look === 'night' ? 0.35 : 0.22);
    ctx.beginPath();
    ctx.ellipse(sx + s.height * 0.08, sy, s.height * 0.26, s.height * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    paintSignaller(ctx, sx, sy, s.height, view.pose, pal, {
      flags: view.scene === 'ship' ? 'sea' : 'land',
      time: view.time,
      detail: view.detail,
      rimLight: pal.look === 'night' ? '#ffcf86' : undefined,
      wind: 0.7,
    });
  }
  ctx.restore();
}

function paintSky(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  const { x, y, width, height } = view;
  ctx.fillStyle = linear(ctx, 0, y, 0, y + height * view.roofLine, [
    [0, pal.skyTop],
    [1, pal.skyLow],
  ]);
  ctx.fillRect(x, y, width, height);
  const random = scatter(17);
  if (pal.look === 'night') {
    for (let i = 0; i < 160; i++) {
      const sx = x + random() * width;
      const sy = y + random() * height * view.roofLine * 0.8;
      const twinkle = 0.55 + 0.45 * Math.sin(view.time * (0.6 + random()) + i);
      ctx.fillStyle = alpha('#fdf6dc', (0.25 + random() * 0.6) * twinkle);
      const r = random() < 0.08 ? 1.6 : 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (view.detail === 'near' ? 1.4 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    // The moon, high on the right.
    const mx = x + width * 0.82;
    const my = y + height * 0.2;
    const mr = Math.max(10, height * 0.05);
    glow(ctx, mx, my, mr * 5, alpha('#cfd9ff', 0.35), 1);
    ctx.fillStyle = '#f4efd9';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha('#c9c2a6', 0.5);
    for (const [ox, oy, rr] of [
      [-0.3, -0.2, 0.22],
      [0.25, 0.15, 0.16],
      [-0.05, 0.38, 0.12],
    ] as const) {
      ctx.beginPath();
      ctx.arc(mx + ox * mr, my + oy * mr, rr * mr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // A low morning sun beyond the right edge, and a few slow clouds.
    glow(ctx, x + width * 0.95, y + height * 0.32, height * 0.9, alpha('#fff4cf', 0.55), 1);
    for (let i = 0; i < 5; i++) {
      const cx = x + ((random() * width + view.time * (4 + i)) % (width + 300)) - 150;
      const cy = y + height * (0.1 + random() * 0.25);
      const cw = width * (0.12 + random() * 0.14);
      ctx.fillStyle = alpha('#ffffff', 0.55);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(
          cx + (k - 1.5) * cw * 0.28,
          cy - Math.sin(k) * cw * 0.06,
          cw * 0.26,
          cw * 0.11,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
}

function paintSkyline(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  const { x, y, width, height } = view;
  const roofY = y + height * view.roofLine;
  // Distance is told by colour: far blocks sink into the sky, near ones keep their weight.
  const haze = pal.look === 'night' ? 0.18 : 0.42;
  const layers: Array<[string, number, number, number]> = [
    [mix(pal.cityFar, pal.skyLow, haze), 0.55, 0.32, 21],
    [mix(pal.cityMid, pal.skyLow, haze * 0.5), 0.72, 0.24, 33],
    [pal.cityNear, 0.86, 0.16, 47],
  ];
  for (const [color, base, rise, seed] of layers) {
    const random = scatter(seed);
    const groundY = y + height * view.roofLine * base + height * 0.1;
    let bx = x - 20;
    while (bx < x + width) {
      const bw = width * (0.04 + random() * 0.07);
      const bh = height * (rise * (0.35 + random() * 0.65));
      const top = Math.min(groundY, roofY) - bh;
      ctx.fillStyle = color;
      ctx.fillRect(bx, top, bw + 1, roofY - top + 2);
      // Water tanks and chimneys on some roofs.
      if (random() < 0.3) {
        const tw = bw * 0.35;
        ctx.fillRect(bx + bw * 0.3, top - tw * 0.9, tw, tw * 0.9);
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.3 - 2, top - tw * 0.9);
        ctx.lineTo(bx + bw * 0.3 + tw / 2, top - tw * 1.4);
        ctx.lineTo(bx + bw * 0.3 + tw + 2, top - tw * 0.9);
        ctx.fill();
        ctx.fillRect(bx + bw * 0.3 + tw * 0.15, top - 2, 2, 4);
      } else if (random() < 0.4) {
        ctx.fillRect(bx + bw * 0.7, top - bw * 0.25, bw * 0.12, bw * 0.25);
      }
      // Windows: lit at night, glinting at dawn.
      const rows = Math.floor(bh / Math.max(6, height * 0.035));
      const cols = Math.max(1, Math.floor(bw / Math.max(5, width * 0.016)));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = random();
          if (pal.look === 'night' ? lit > 0.72 : lit > 0.9) {
            const wx = bx + (c + 0.3) * (bw / cols);
            const wy = top + (r + 0.4) * (bh / rows);
            ctx.fillStyle =
              pal.look === 'night'
                ? alpha(pal.windowLit, 0.5 + random() * 0.5)
                : alpha('#fff6dc', 0.35);
            ctx.fillRect(
              wx,
              wy,
              Math.max(1.5, (bw / cols) * 0.4),
              Math.max(1.5, (bh / rows) * 0.45),
            );
          }
        }
      }
      bx += bw + width * 0.004;
    }
  }
}

function paintSea(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  const { x, y, width, height } = view;
  const horizon = y + height * view.roofLine * 0.7;
  ctx.fillStyle = linear(ctx, 0, horizon, 0, y + height, [
    [0, pal.look === 'night' ? '#14244a' : '#6f9cb8'],
    [1, pal.look === 'night' ? '#070d1e' : '#2f5f80'],
  ]);
  ctx.fillRect(x, horizon, width, y + height - horizon);
  ctx.strokeStyle = alpha('#ffffff', pal.look === 'night' ? 0.12 : 0.25);
  ctx.lineWidth = 1;
  const random = scatter(5);
  for (let i = 0; i < 40; i++) {
    const wy = horizon + random() * (y + height - horizon);
    const wx = x + random() * width;
    const ww = 10 + random() * 40;
    ctx.beginPath();
    ctx.moveTo(wx + Math.sin(view.time + i) * 4, wy);
    ctx.lineTo(wx + ww + Math.sin(view.time + i) * 4, wy);
    ctx.stroke();
  }
}

/** The roof (or the deck): a parapet with coping stones, a chimney stack and a lamp at night. */
function paintRoof(ctx: Ctx, view: OutsideView, pal: DeskPalette) {
  const { x, y, width, height } = view;
  const roofY = y + height * view.roofLine;
  if (view.scene === 'ship') {
    ctx.fillStyle = mix(pal.roof, '#5a4a3a', 0.5);
    ctx.fillRect(x, roofY, width, y + height - roofY);
    ctx.strokeStyle = alpha('#000000', 0.25);
    for (let i = 0; i < 14; i++) {
      const py = roofY + (i / 14) * (y + height - roofY);
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + width, py);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.look === 'night' ? '#b9bfc6' : '#eef1f3';
    ctx.lineWidth = Math.max(2, height * 0.008);
    for (const ry of [roofY - height * 0.08, roofY - height * 0.04]) {
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + width, ry);
      ctx.stroke();
    }
    return;
  }
  // Roof surface: tar paper fading back.
  ctx.fillStyle = linear(ctx, 0, roofY, 0, y + height, [
    [0, mix(pal.roof, '#000000', 0.15)],
    [1, pal.roof],
  ]);
  ctx.fillRect(x, roofY, width, y + height - roofY);
  // The parapet behind the signaller.
  const parapetH = height * 0.06;
  ctx.fillStyle = mix(pal.roof, pal.cityNear, 0.3);
  ctx.fillRect(x, roofY - parapetH, width, parapetH);
  ctx.fillStyle = mix(pal.roofEdge, '#ffffff', pal.look === 'night' ? 0.05 : 0.25);
  ctx.fillRect(x, roofY - parapetH - height * 0.012, width, height * 0.014);
  // Brick courses on the parapet.
  ctx.strokeStyle = alpha('#000000', 0.18);
  ctx.lineWidth = 1;
  const course = Math.max(4, parapetH / 3);
  for (let r = 0; r < 3; r++) {
    const ly = roofY - parapetH + r * course;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + width, ly);
    ctx.stroke();
    for (let bx = x + (r % 2) * course; bx < x + width; bx += course * 2.2) {
      ctx.beginPath();
      ctx.moveTo(bx, ly);
      ctx.lineTo(bx, ly + course);
      ctx.stroke();
    }
  }
  // A chimney stack with pots on the left.
  const cx = x + width * 0.12;
  const cw = width * 0.09;
  const ch = height * 0.22;
  ctx.fillStyle = mix(pal.roof, '#8a4b35', 0.4);
  ctx.fillRect(cx, roofY - parapetH - ch, cw, ch);
  ctx.fillStyle = alpha('#000000', 0.2);
  ctx.fillRect(cx + cw * 0.6, roofY - parapetH - ch, cw * 0.4, ch);
  ctx.fillStyle = mix(pal.roof, '#b26a45', 0.45);
  for (const px of [0.18, 0.55]) {
    ctx.fillRect(cx + cw * px, roofY - parapetH - ch - height * 0.045, cw * 0.24, height * 0.045);
  }
  paintRoofDetails(ctx, view, pal, roofY, parapetH);
  // At night, a caged lamp over the roof door, which lights the signaller.
  if (pal.look === 'night') {
    const lx = x + width * 0.9;
    const ly = roofY - parapetH - height * 0.14;
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(lx - 2, ly, 4, height * 0.14);
    glow(ctx, lx, ly, height * 0.18, alpha('#ffd28a', 0.6), 1);
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    ctx.arc(lx, ly, Math.max(2, height * 0.012), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Gravel, a skylight hatch, a vent with its cowl, and pigeons on the coping by day. */
function paintRoofDetails(
  ctx: Ctx,
  view: OutsideView,
  pal: DeskPalette,
  roofY: number,
  parapetH: number,
) {
  const { x, y, width, height } = view;
  const random = scatter(61);
  const bottom = y + height;
  // Gravel: denser and larger towards us.
  for (let i = 0; i < 900; i++) {
    const t = random();
    const gy = roofY + 4 + t * t * (bottom - roofY);
    const gx = x + random() * width;
    const size = 0.6 + t * 2.4 * (view.detail === 'near' ? 1 : 0.4);
    ctx.fillStyle = alpha(random() < 0.5 ? '#000000' : '#ffffff', 0.05 + random() * 0.08);
    ctx.fillRect(gx, gy, size, size * 0.7);
  }
  if (view.detail === 'far') return;
  // Seams in the roofing felt, running away from us.
  ctx.strokeStyle = alpha('#000000', 0.12);
  ctx.lineWidth = 2;
  for (let i = -6; i <= 6; i++) {
    const footX = x + width / 2 + i * width * 0.16;
    ctx.beginPath();
    ctx.moveTo(x + width / 2 + i * width * 0.05, roofY + 6);
    ctx.lineTo(footX, bottom);
    ctx.stroke();
  }
  // A skylight hatch in the left foreground.
  const hx = x + width * 0.08;
  const hy = roofY + (bottom - roofY) * 0.42;
  const hw = width * 0.14;
  const hh = (bottom - roofY) * 0.22;
  ctx.fillStyle = mix(pal.roof, '#000000', 0.3);
  ctx.fillRect(hx, hy + hh * 0.35, hw, hh * 0.65);
  ctx.fillStyle = mix(pal.roofEdge, '#ffffff', pal.look === 'night' ? 0.05 : 0.2);
  ctx.beginPath();
  ctx.moveTo(hx - 6, hy + hh * 0.38);
  ctx.lineTo(hx + hw * 0.12, hy);
  ctx.lineTo(hx + hw * 0.88, hy);
  ctx.lineTo(hx + hw + 6, hy + hh * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.look === 'night' ? '#26324d' : '#a9c6d8';
  ctx.beginPath();
  ctx.moveTo(hx + 8, hy + hh * 0.33);
  ctx.lineTo(hx + hw * 0.16, hy + 6);
  ctx.lineTo(hx + hw * 0.84, hy + 6);
  ctx.lineTo(hx + hw - 8, hy + hh * 0.33);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(pal.roofEdge, '#000000', 0.2);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + hw / 2, hy + 6);
  ctx.lineTo(hx + hw / 2, hy + hh * 0.33);
  ctx.stroke();
  // Pigeons on the coping, by day.
  if (pal.look === 'morning' && view.scene === 'rooftop') {
    const copingY = roofY - parapetH - height * 0.012;
    for (const [px, facing] of [
      [0.025, 1],
      [0.105, -1],
      [0.62, 1],
    ] as const) {
      paintPigeon(ctx, x + width * px, copingY, height * 0.03, facing, view.time + px * 10);
    }
  }
}

function paintPigeon(ctx: Ctx, px: number, py: number, s: number, facing: 1 | -1, time: number) {
  const bob = Math.sin(time * 1.7) > 0.92 ? s * 0.12 : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(facing, 1);
  ctx.fillStyle = '#7d8590';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.7, s * 1.1, s * 0.62, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5f6670';
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, -s * 0.8);
  ctx.lineTo(-s * 2, -s * 0.45);
  ctx.lineTo(-s * 0.7, -s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8d96a1';
  ctx.beginPath();
  ctx.arc(s * 0.85, -s * 1.35 + bob, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6fa58d';
  ctx.beginPath();
  ctx.ellipse(s * 0.65, -s * 1.0, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e1a35b';
  ctx.beginPath();
  ctx.moveTo(s * 1.25, -s * 1.38 + bob);
  ctx.lineTo(s * 1.6, -s * 1.3 + bob);
  ctx.lineTo(s * 1.25, -s * 1.24 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(s * 0.98, -s * 1.42 + bob, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c96a5a';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.15);
  ctx.lineTo(-s * 0.1, 0);
  ctx.moveTo(s * 0.3, -s * 0.15);
  ctx.lineTo(s * 0.25, 0);
  ctx.stroke();
  ctx.restore();
}
