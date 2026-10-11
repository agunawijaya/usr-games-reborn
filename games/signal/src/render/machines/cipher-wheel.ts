import type { DeskPalette } from '../palette';
import { alpha, contactShadow, type Ctx, FONT_DISPLAY, glow, linear, mix, radial } from '../paint';

/**
 * The cipher wheel: a brass ring engraved with the alphabet around an enamel disc carrying a
 * second alphabet. The outer ring is the message's letters; the disc turns, and whatever sits
 * under each outer letter is what it means. 26 detents click it from letter to letter.
 *
 * `rotation` is in letters (it may be fractional while the disc spins): at rotation k, the disc
 * letter under outer letter c is c + k, the same direction as `caesar k`.
 */
export interface WheelState {
  rotation: number;
  /** Outer letter to ring with light (the one being read), or null. */
  highlight: number | null;
  /** 0–1: how fast the disc is spinning, for motion blur. */
  spin: number;
  /** 0–1: the moment the right rotation clicks home. */
  lock: number;
  /** Draw on its wooden stand (the desk) or bare (the close-up). */
  stand: boolean;
}

export function paintCipherWheel(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  pal: DeskPalette,
  state: WheelState,
) {
  const R = radius;
  ctx.save();
  if (state.stand) paintStand(ctx, cx, cy, R, pal);
  else contactShadow(ctx, cx + R * 0.06, cy + R * 0.1, R * 1.08, R * 1.02, 0.4);
  // Outer brass ring.
  ctx.fillStyle = linear(ctx, cx - R, cy - R, cx + R, cy + R, [
    [0, pal.brassShine],
    [0.25, pal.brassLight],
    [0.6, pal.brass],
    [1, pal.brassDeep],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  // Detent notches around the rim.
  ctx.fillStyle = alpha(pal.brassDeep, 0.9);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 - Math.PI / 2 + Math.PI / 26;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R * 0.985, cy + Math.sin(a) * R * 0.985, R * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bevels.
  ctx.strokeStyle = alpha('#ffffff', 0.45);
  ctx.lineWidth = Math.max(1, R * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.955, Math.PI * 0.9, Math.PI * 1.6);
  ctx.stroke();
  ctx.strokeStyle = alpha('#000000', 0.35);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.955, Math.PI * 1.9, Math.PI * 2.6);
  ctx.stroke();
  // Outer alphabet, engraved: a dark cut with a bright lower lip.
  const outerR = R * 0.84;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 - Math.PI / 2;
    const lx = cx + Math.cos(a) * outerR;
    const ly = cy + Math.sin(a) * outerR;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.font = `700 ${R * 0.12}px ${FONT_DISPLAY}`;
    ctx.fillStyle = alpha(pal.brassShine, 0.7);
    ctx.fillText(String.fromCharCode(65 + i), R * 0.004, R * 0.006);
    ctx.fillStyle = state.highlight === i ? pal.inkRed : mix(pal.brassDeep, '#000000', 0.35);
    ctx.fillText(String.fromCharCode(65 + i), 0, 0);
    ctx.restore();
  }
  // The turning enamel disc.
  const discR = R * 0.71;
  ctx.fillStyle = alpha('#000000', 0.35);
  ctx.beginPath();
  ctx.arc(cx, cy + R * 0.012, discR + R * 0.012, 0, Math.PI * 2);
  ctx.fill();
  const enamel = pal.look === 'night' ? '#1c2a3a' : '#f3ead3';
  ctx.fillStyle = radial(ctx, cx - discR * 0.3, cy - discR * 0.35, discR * 1.5, [
    [0, mix(enamel, '#ffffff', 0.18)],
    [1, mix(enamel, '#000000', 0.12)],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, discR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.brassDeep;
  ctx.lineWidth = R * 0.014;
  ctx.stroke();
  const turn = (state.rotation / 26) * Math.PI * 2;
  const innerR = R * 0.6;
  const discInk = pal.look === 'night' ? '#e9f4ff' : pal.ink;
  for (let i = 0; i < 26; i++) {
    // The letter shown under outer letter i is i + rotation.
    const a = ((i - state.rotation) / 26) * Math.PI * 2 - Math.PI / 2;
    const letter = String.fromCharCode(65 + i);
    const lx = cx + Math.cos(a) * innerR;
    const ly = cy + Math.sin(a) * innerR;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.font = `600 ${R * 0.105}px ${FONT_DISPLAY}`;
    const blur = state.spin;
    if (blur > 0.05) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = discInk;
      for (const k of [-2, -1, 1, 2]) {
        ctx.save();
        ctx.translate(k * blur * R * 0.02, 0);
        ctx.fillText(letter, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1 - blur * 0.6;
    }
    // The disc's A is red, as on old cipher discs, so a turn can be read at a glance.
    ctx.fillStyle = i === 0 ? pal.inkRed : discInk;
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  }
  // Radial ticks between letters on the disc.
  ctx.strokeStyle = alpha(discInk, 0.25);
  ctx.lineWidth = Math.max(0.8, R * 0.005);
  for (let i = 0; i < 26; i++) {
    const a = ((i + 0.5 - state.rotation) / 26) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * discR * 0.72, cy + Math.sin(a) * discR * 0.72);
    ctx.lineTo(cx + Math.cos(a) * discR * 0.97, cy + Math.sin(a) * discR * 0.97);
    ctx.stroke();
  }
  // A guilloché rosette in the middle of the disc.
  ctx.strokeStyle = alpha(pal.look === 'night' ? '#7fb2ff' : pal.brassDeep, 0.35);
  ctx.lineWidth = Math.max(0.6, R * 0.003);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 - turn;
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * R * 0.12,
      cy + Math.sin(a) * R * 0.12,
      R * 0.26,
      R * 0.26,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  // Knurled centre knob.
  ctx.fillStyle = linear(ctx, cx - R * 0.16, cy - R * 0.16, cx + R * 0.16, cy + R * 0.16, [
    [0, pal.brassShine],
    [0.5, pal.brass],
    [1, pal.brassDeep],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha('#000000', 0.3);
  ctx.lineWidth = Math.max(0.6, R * 0.006);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2 - turn;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.12, cy + Math.sin(a) * R * 0.12);
    ctx.lineTo(cx + Math.cos(a) * R * 0.15, cy + Math.sin(a) * R * 0.15);
    ctx.stroke();
  }
  ctx.fillStyle = radial(ctx, cx - R * 0.03, cy - R * 0.03, R * 0.1, [
    [0, pal.brassShine],
    [1, pal.brass],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // The index pointer at the top, over both rings.
  ctx.fillStyle = pal.inkRed;
  ctx.beginPath();
  ctx.moveTo(cx, cy - R * 0.93);
  ctx.lineTo(cx - R * 0.05, cy - R * 1.04);
  ctx.lineTo(cx + R * 0.05, cy - R * 1.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha(pal.inkRed, 0.55);
  ctx.lineWidth = Math.max(1, R * 0.008);
  ctx.beginPath();
  ctx.moveTo(cx, cy - R * 0.93);
  ctx.lineTo(cx, cy - R * 0.5);
  ctx.stroke();
  // The lock flash: a ring of light when the right rotation clicks home.
  if (state.lock > 0.01) {
    // Gold in daylight, the scope's green at night.
    const flash = pal.look === 'night' ? pal.phosphor : pal.brassShine;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = alpha(flash, 0.6 * state.lock);
    ctx.lineWidth = R * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, discR + R * 0.02, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    glow(ctx, cx, cy, R * 1.2, alpha(flash, pal.look === 'night' ? 0.18 : 0.12), state.lock);
  }
  // A long highlight sweeping the brass.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = alpha('#ffffff', pal.look === 'night' ? 0.16 : 0.32);
  ctx.lineWidth = R * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.92, Math.PI * 1.08, Math.PI * 1.38);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function paintStand(ctx: Ctx, cx: number, cy: number, R: number, pal: DeskPalette) {
  const footY = cy + R * 1.12;
  contactShadow(ctx, cx + R * 0.05, footY, R * 1.05, R * 0.12, 0.5);
  // A walnut cradle the wheel sits in.
  ctx.fillStyle = linear(ctx, 0, cy + R * 0.6, 0, footY, [
    [0, pal.woodLight],
    [1, pal.woodDark],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.95, footY);
  ctx.lineTo(cx - R * 0.7, cy + R * 0.55);
  ctx.quadraticCurveTo(cx, cy + R * 1.05, cx + R * 0.7, cy + R * 0.55);
  ctx.lineTo(cx + R * 0.95, footY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix(pal.woodDark, '#000000', 0.3);
  ctx.fillRect(cx - R * 0.98, footY - R * 0.05, R * 1.96, R * 0.06);
  ctx.fillStyle = alpha('#ffffff', 0.12);
  ctx.fillRect(cx - R * 0.98, footY - R * 0.05, R * 1.96, R * 0.012);
}
