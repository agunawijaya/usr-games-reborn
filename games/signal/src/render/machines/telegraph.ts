import type { DeskPalette } from '../palette';
import {
  alpha,
  contactShadow,
  type Ctx,
  glow,
  linear,
  mix,
  radial,
  roundRect,
  screw,
} from '../paint';

/**
 * The telegraph: a brass straight key on a mahogany base, and beside it the sounder, two coils
 * under a brass armature that snaps down with every mark, with an amber lamp that lights while
 * a message is on the wire. Drawn three-quarter on, in local units (the pair is 520 × 220 at
 * scale 1); `x`, `y` is the front-left foot of the key's base.
 */
export interface TelegraphState {
  /** 0 = up, 1 = fully down. */
  keyDown: number;
  /** 0 = armature up, 1 = down on the coils. */
  armature: number;
  /** 0–1 brightness of the message lamp. */
  lamp: number;
}

export const TELEGRAPH_SIZE = { width: 520, height: 230 };

export function paintTelegraph(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  state: TelegraphState,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  paintSounder(ctx, 0, 0, pal, state);
  paintKey(ctx, 250, 6, pal, state);
  ctx.restore();
}

/** Where the message lamp sits, in the same frame as `paintTelegraph`'s origin and scale. */
export function telegraphLamp(
  x: number,
  y: number,
  scale: number,
): { x: number; y: number; r: number } {
  return { x: x + 196 * scale, y: y - 106 * scale, r: 13 * scale };
}

function woodBlock(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  depth: number,
  height: number,
  pal: DeskPalette,
) {
  // Front face.
  ctx.fillStyle = linear(ctx, 0, y - height, 0, y, [
    [0, pal.bakeliteLight],
    [1, pal.bakelite],
  ]);
  ctx.fillRect(x, y - height, w, height);
  // Top face, foreshortened.
  ctx.fillStyle = linear(ctx, 0, y - height - depth, 0, y - height, [
    [0, mix(pal.bakeliteLight, '#ffffff', 0.08)],
    [1, mix(pal.bakeliteLight, '#ffffff', 0.18)],
  ]);
  ctx.beginPath();
  ctx.moveTo(x + 10, y - height - depth);
  ctx.lineTo(x + w - 10, y - height - depth);
  ctx.lineTo(x + w, y - height);
  ctx.lineTo(x, y - height);
  ctx.closePath();
  ctx.fill();
  // Polished edge highlight.
  ctx.strokeStyle = alpha('#ffffff', 0.18);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + w, y - height);
  ctx.stroke();
}

function paintKey(ctx: Ctx, x: number, y: number, pal: DeskPalette, state: TelegraphState) {
  contactShadow(ctx, x + 130, y + 2, 150, 20, 0.45);
  woodBlock(ctx, x, y, 262, 50, 26, pal);
  const top = y - 26;
  // Brass bed plate.
  ctx.fillStyle = linear(ctx, 0, top - 44, 0, top - 4, [
    [0, pal.brassLight],
    [1, pal.brass],
  ]);
  ctx.beginPath();
  ctx.moveTo(x + 26, top - 42);
  ctx.lineTo(x + 226, top - 42);
  ctx.lineTo(x + 240, top - 6);
  ctx.lineTo(x + 16, top - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha(pal.brassShine, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const [sx, sy] of [
    [34, -34],
    [218, -34],
    [26, -13],
    [228, -13],
  ] as const) {
    screw(ctx, x + sx, top + sy, 3.6, pal.brassShine, pal.brassDeep);
  }
  // Binding posts at the back, with a twist of wire.
  for (const px of [44, 78]) {
    ctx.fillStyle = linear(ctx, x + px - 8, 0, x + px + 8, 0, [
      [0, pal.brassDeep],
      [0.45, pal.brassShine],
      [1, pal.brassDeep],
    ]);
    ctx.fillRect(x + px - 8, top - 66, 16, 30);
    ctx.beginPath();
    ctx.ellipse(x + px, top - 66, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha('#000000', 0.3);
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x + px - 8, top - 62 + k * 5);
      ctx.lineTo(x + px + 8, top - 62 + k * 5);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = pal.copper;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 44, top - 70);
  ctx.bezierCurveTo(x + 30, top - 110, x - 20, top - 70, x - 60, top - 40);
  ctx.moveTo(x + 78, top - 70);
  ctx.bezierCurveTo(x + 66, top - 120, x - 10, top - 90, x - 56, top - 50);
  ctx.stroke();
  // Trunnion: two posts holding the pivot.
  const pivotX = x + 120;
  const pivotY = top - 62;
  for (const dx of [-14, 14]) {
    ctx.fillStyle = linear(ctx, pivotX + dx - 6, 0, pivotX + dx + 6, 0, [
      [0, pal.brassDeep],
      [0.5, pal.brassLight],
      [1, pal.brassDeep],
    ]);
    ctx.fillRect(pivotX + dx - 6, pivotY, 12, 22);
  }
  screw(ctx, pivotX + 18, pivotY + 6, 5, pal.brassShine, pal.brassDeep, 0);
  // The lever: thick at the pivot, tapering to the knob, dipping when keyed.
  const dip = state.keyDown * 0.08;
  ctx.save();
  ctx.translate(pivotX, pivotY + 4);
  ctx.rotate(dip);
  ctx.fillStyle = linear(ctx, 0, -12, 0, 10, [
    [0, pal.brassShine],
    [0.3, pal.brassLight],
    [0.7, pal.brass],
    [1, pal.brassDeep],
  ]);
  ctx.beginPath();
  ctx.moveTo(-64, -9);
  ctx.quadraticCurveTo(0, -13, 128, -8);
  ctx.lineTo(128, 4);
  ctx.quadraticCurveTo(0, 8, -64, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha(pal.brassShine, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-60, -8);
  ctx.quadraticCurveTo(0, -12, 126, -7);
  ctx.stroke();
  // Spring under the back of the lever and the tension screw through it.
  ctx.strokeStyle = pal.steelLight;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) {
    const sx = -44 + (k % 2 === 0 ? -5 : 5);
    const sy = 7 + k * 2.6;
    if (k === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.fillStyle = linear(ctx, -50, 0, -38, 0, [
    [0, pal.brassDeep],
    [0.5, pal.brassShine],
    [1, pal.brassDeep],
  ]);
  ctx.fillRect(-50, -24, 12, 16);
  screw(ctx, -44, -26, 7, pal.brassShine, pal.brassDeep, 0.2);
  // Silver contact under the lever's middle.
  ctx.fillStyle = pal.steelLight;
  ctx.fillRect(70, 4, 10, 6);
  // The knob: a broad black mushroom on a short stem.
  ctx.fillStyle = pal.enamel;
  ctx.fillRect(116, -18, 18, 14);
  ctx.fillStyle = linear(ctx, 0, -34, 0, -16, [
    [0, pal.enamelLight],
    [1, pal.enamel],
  ]);
  ctx.beginPath();
  ctx.ellipse(125, -20, 40, 8, 0, 0, Math.PI);
  ctx.lineTo(85, -30);
  ctx.ellipse(125, -30, 40, 10, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(165, -20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = radial(ctx, 112, -36, 44, [
    [0, mix(pal.enamelLight, '#ffffff', 0.3)],
    [0.6, pal.enamelLight],
    [1, pal.enamel],
  ]);
  ctx.beginPath();
  ctx.ellipse(125, -30, 40, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.28);
  ctx.beginPath();
  ctx.ellipse(110, -33, 15, 3.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The anvil the contact closes on.
  ctx.fillStyle = pal.steelLight;
  ctx.fillRect(pivotX + 70, top - 44, 12, 8);
}

function paintSounder(ctx: Ctx, x: number, y: number, pal: DeskPalette, state: TelegraphState) {
  contactShadow(ctx, x + 115, y + 2, 132, 18, 0.45);
  woodBlock(ctx, x, y, 228, 44, 22, pal);
  const top = y - 22;
  // Two coils standing on the base.
  for (const cx of [70, 118]) {
    ctx.fillStyle = linear(ctx, cx - 18, 0, cx + 18, 0, [
      [0, pal.enamel],
      [0.4, pal.enamelLight],
      [1, pal.enamel],
    ]);
    ctx.fillRect(cx - 18, top - 96, 36, 72);
    ctx.beginPath();
    ctx.ellipse(cx, top - 96, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Copper winding showing at the bottom.
    ctx.fillStyle = linear(ctx, cx - 18, 0, cx + 18, 0, [
      [0, mix(pal.copper, '#000000', 0.3)],
      [0.45, mix(pal.copper, '#ffffff', 0.3)],
      [1, mix(pal.copper, '#000000', 0.35)],
    ]);
    ctx.fillRect(cx - 18, top - 38, 36, 12);
    ctx.fillStyle = alpha('#000000', 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, top - 24, 18, 6, 0, 0, Math.PI);
    ctx.fill();
  }
  // The brass yoke and the pillar the armature hinges on.
  ctx.fillStyle = linear(ctx, 0, top - 30, 0, top - 18, [
    [0, pal.brassLight],
    [1, pal.brassDeep],
  ]);
  ctx.fillRect(40, top - 28, 110, 10);
  ctx.fillStyle = linear(ctx, 160, 0, 182, 0, [
    [0, pal.brassDeep],
    [0.5, pal.brassShine],
    [1, pal.brassDeep],
  ]);
  ctx.fillRect(160, top - 132, 22, 112);
  // The armature: a bar that hinges at the pillar and comes down on the coils.
  const drop = state.armature * 0.09;
  ctx.save();
  ctx.translate(170, top - 120);
  ctx.rotate(-drop);
  ctx.fillStyle = linear(ctx, 0, -8, 0, 10, [
    [0, pal.brassShine],
    [0.4, pal.brassLight],
    [1, pal.brassDeep],
  ]);
  roundRect(ctx, -150, -6, 168, 16, 4);
  ctx.fill();
  ctx.fillStyle = pal.steel;
  ctx.fillRect(-114, 10, 72, 7);
  ctx.restore();
  // The back-stop screw that makes the click.
  screw(ctx, 171, top - 136, 6, pal.brassShine, pal.brassDeep, 1.2);
  // The message lamp on its little post.
  ctx.fillStyle = pal.brassDeep;
  ctx.fillRect(190, top - 64, 12, 42);
  ctx.fillStyle = linear(ctx, 180, 0, 212, 0, [
    [0, pal.brassDeep],
    [0.5, pal.brassLight],
    [1, pal.brassDeep],
  ]);
  ctx.fillRect(184, top - 76, 24, 14);
  const lit = Math.max(0, Math.min(1, state.lamp));
  ctx.fillStyle = radial(ctx, 192, top - 92, 16, [
    [0, mix('#7a3a12', '#fff3c4', lit)],
    [0.6, mix('#5a2a0e', pal.indicator, lit)],
    [1, mix('#3a1a08', mix(pal.indicator, '#7a3a12', 0.4), lit)],
  ]);
  ctx.beginPath();
  ctx.arc(196, top - 86, 13, Math.PI, Math.PI * 2);
  ctx.lineTo(209, top - 76);
  ctx.lineTo(183, top - 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.4);
  ctx.beginPath();
  ctx.ellipse(191, top - 92, 4, 2.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The lamp's light, drawn in the glow pass. */
export function paintTelegraphGlow(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  lamp: number,
) {
  if (lamp <= 0.02) return;
  const at = telegraphLamp(x, y, scale);
  glow(ctx, at.x, at.y, at.r * 6, pal.indicatorGlow, lamp);
  glow(ctx, at.x, at.y, at.r * 2, alpha('#fff4cc', 0.8), lamp);
}
