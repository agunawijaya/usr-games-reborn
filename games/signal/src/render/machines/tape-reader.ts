import { bitsOf, HOLES_BEFORE_SPROCKET } from '../../codecs/ppt';
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
 * Paper tape and its reader. A row is eight data holes across the tape with the small sprocket
 * hole between the fifth and sixth; the reader's head shines a lamp through the tape and the
 * sprocket wheel pulls it along.
 */
export interface TapeLook {
  rows: readonly number[];
  /** Rows scrolled past the strip's start (fractional while the tape runs). */
  offset: number;
  /** Row under the read head, ringed with light, or null. */
  cursor?: number | null;
  /** Draw the bit columns' place values beside the tape (help on). */
  legend?: boolean;
  /** What shows through a hole. */
  behind?: string;
  /** Row spacing as a multiple of the real tenth of an inch, for close-ups that need room. */
  pitchScale?: number;
}

/**
 * Draws a straight run of tape from `from` to `to`, `width` across. Rows advance along the run;
 * the first data hole (bit 7) is on the left of the direction of travel.
 */
export function paintTapeStrip(
  ctx: Ctx,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  pal: DeskPalette,
  look: TapeLook,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(from.x, from.y);
  ctx.rotate(angle);
  // The strip.
  ctx.fillStyle = linear(ctx, 0, -width / 2, 0, width / 2, [
    [0, mix(pal.tape, '#ffffff', 0.25)],
    [0.5, pal.tape],
    [1, pal.tapeShade],
  ]);
  ctx.fillRect(0, -width / 2, length, width);
  ctx.strokeStyle = alpha(pal.tapeShade, 0.9);
  ctx.lineWidth = Math.max(0.5, width * 0.012);
  ctx.strokeRect(0, -width / 2, length, width);
  // Rows: pitch is the tenth of an inch on a one-inch tape.
  const pitch = width * 0.1 * (look.pitchScale ?? 1);
  const across = (slot: number) => -width / 2 + width * (0.12 + slot * 0.085);
  const holeR = width * 0.034;
  const behind = look.behind ?? mix(pal.woodDark, '#000000', 0.4);
  const first = Math.floor(look.offset);
  const shift = (look.offset - first) * pitch;
  for (let i = 0; i * pitch - shift < length + pitch; i++) {
    const along = i * pitch - shift + pitch / 2;
    if (along < 0 || along > length) continue;
    const rowIndex = first + i;
    // Sprocket holes run the whole tape, punched or not.
    ctx.fillStyle = behind;
    ctx.beginPath();
    ctx.arc(along, across(HOLES_BEFORE_SPROCKET), holeR * 0.6, 0, Math.PI * 2);
    ctx.fill();
    const byte = look.rows[rowIndex];
    if (byte === undefined) continue;
    bitsOf(byte).forEach((hole, bit) => {
      if (!hole) return;
      const slot = bit < HOLES_BEFORE_SPROCKET ? bit : bit + 1;
      ctx.fillStyle = behind;
      ctx.beginPath();
      ctx.arc(along, across(slot), holeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.3);
      ctx.beginPath();
      ctx.arc(along, across(slot), holeR, 0.2, Math.PI - 0.2);
      ctx.lineWidth = Math.max(0.5, holeR * 0.3);
      ctx.strokeStyle = alpha('#ffffff', 0.25);
      ctx.stroke();
    });
    if (look.cursor === rowIndex) {
      ctx.strokeStyle = pal.inkRed;
      ctx.lineWidth = Math.max(1, pitch * 0.12);
      roundRect(
        ctx,
        along - pitch * 0.48,
        -width / 2 - pitch * 0.2,
        pitch * 0.96,
        width + pitch * 0.4,
        pitch * 0.2,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

export interface ReaderState {
  tape: TapeLook;
  /** 0–1 the read lamp. */
  lamp: number;
  /** Sprocket wheel angle in radians. */
  sprocket: number;
}

/**
 * The reader, 460 × 200 at scale 1, `x`, `y` at its front-left foot: an olive enamel case with a
 * chrome head, a sprocket wheel and tape running across its top from a loose curl on the left to
 * another on the right.
 */
export function paintTapeReader(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  state: ReaderState,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  contactShadow(ctx, 220, 0, 250, 20, 0.45);
  const body = pal.look === 'night' ? '#3c4a3c' : '#5f7259';
  // Case front.
  ctx.fillStyle = linear(ctx, 0, -110, 0, 0, [
    [0, mix(body, '#ffffff', 0.1)],
    [1, mix(body, '#000000', 0.25)],
  ]);
  roundRect(ctx, 60, -110, 320, 110, 10);
  ctx.fill();
  // Top deck.
  ctx.fillStyle = linear(ctx, 0, -168, 0, -108, [
    [0, mix(body, '#ffffff', 0.22)],
    [1, mix(body, '#ffffff', 0.08)],
  ]);
  ctx.beginPath();
  ctx.moveTo(74, -166);
  ctx.lineTo(366, -166);
  ctx.lineTo(380, -108);
  ctx.lineTo(60, -108);
  ctx.closePath();
  ctx.fill();
  // Name strip and switches on the front.
  ctx.fillStyle = mix(body, '#000000', 0.4);
  roundRect(ctx, 84, -82, 170, 30, 5);
  ctx.fill();
  for (const sx of [292, 334]) {
    ctx.fillStyle = pal.steelLight;
    ctx.beginPath();
    ctx.arc(sx, -66, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.steelDeep;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, -66);
    ctx.lineTo(sx + 6, -80);
    ctx.stroke();
  }
  for (const [sx, sy] of [
    [72, -98],
    [368, -98],
    [72, -12],
    [368, -12],
  ] as const) {
    screw(ctx, sx, sy, 4, pal.steelLight, pal.steelDeep);
  }
  // Tape: off the supply reel, across the deck, out to a curl on the right.
  paintReel(ctx, 34, -110, 70, pal, state.sprocket * 0.5);
  paintTapeStrip(ctx, { x: 44, y: -142 }, { x: 420, y: -142 }, 38, pal, {
    ...state.tape,
    behind: mix(body, '#000000', 0.45),
  });
  paintCurl(ctx, 420, -36, 46, pal, 1);
  // Chrome read head bridging the tape.
  ctx.fillStyle = linear(ctx, 0, -186, 0, -128, [
    [0, pal.steelLight],
    [0.6, pal.steel],
    [1, pal.steelDeep],
  ]);
  roundRect(ctx, 200, -188, 66, 44, 8);
  ctx.fill();
  ctx.fillStyle = mix(pal.steelDeep, '#000000', 0.3);
  ctx.fillRect(206, -132, 54, 6);
  // Read lamp on the head.
  const lit = Math.max(0, Math.min(1, state.lamp));
  ctx.fillStyle = radial(ctx, 233, -176, 9, [
    [0, mix('#3a2a12', '#ffffff', lit)],
    [1, mix('#2a1a08', '#ffd27a', lit)],
  ]);
  ctx.beginPath();
  ctx.arc(233, -174, 7, 0, Math.PI * 2);
  ctx.fill();
  // Sprocket wheel just past the head.
  const wx = 300;
  const wy = -142;
  ctx.fillStyle = linear(ctx, wx - 18, wy - 18, wx + 18, wy + 18, [
    [0, pal.steelLight],
    [1, pal.steelDeep],
  ]);
  ctx.beginPath();
  ctx.arc(wx, wy - 22, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(pal.steelDeep, '#000000', 0.3);
  for (let k = 0; k < 10; k++) {
    const a = state.sprocket + (k / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(wx + Math.cos(a) * 13, wy - 22 + Math.sin(a) * 13, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal.steelLight;
  ctx.beginPath();
  ctx.arc(wx, wy - 22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The supply reel, standing on its spindle at the reader's left, wound with tape. */
function paintReel(ctx: Ctx, cx: number, cy: number, r: number, pal: DeskPalette, turn: number) {
  ctx.save();
  ctx.fillStyle = pal.steelDeep;
  ctx.fillRect(cx - 5, cy, 10, 110);
  // Wound tape between the flanges.
  ctx.fillStyle = radial(ctx, cx, cy, r * 0.82, [
    [0.3, mix(pal.tape, '#000000', 0.15)],
    [1, pal.tape],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha(pal.tapeShade, 0.7);
  ctx.lineWidth = 1;
  for (let ring = 0.4; ring < 0.8; ring += 0.07) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Open metal flange with spokes.
  ctx.strokeStyle = pal.steelLight;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  for (let k = 0; k < 3; k++) {
    const a = turn + (k / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.22);
    ctx.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  ctx.fillStyle = pal.steel;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.steelDeep;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A loose curl of tape lying on the desk: loops of ribbon fallen over each other, each seen
 * nearly edge-on at the back and face-on at the front.
 */
function paintCurl(ctx: Ctx, cx: number, cy: number, r: number, pal: DeskPalette, side: -1 | 1) {
  ctx.save();
  const loops = [
    [0, 0, 1, 0.34],
    [side * 10, -6, 0.86, 0.3],
    [side * 18, -2, 0.7, 0.36],
    [side * 4, -12, 0.62, 0.26],
  ] as const;
  ctx.fillStyle = alpha('#000000', 0.18);
  ctx.beginPath();
  ctx.ellipse(cx + side * 8, cy + 8, r * 1.1, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [ox, oy, size, squash] of loops) {
    const rx = r * size;
    const ry = rx * squash;
    // Back half: the tape's edge, thin and in shade.
    ctx.strokeStyle = pal.tapeShade;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, rx, ry, side * 0.12, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Front half: the tape's face, wide and lit.
    ctx.strokeStyle = pal.tape;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, rx, ry, side * 0.12, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.strokeStyle = alpha(pal.tapeShade, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy + 5, rx, ry, side * 0.12, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

export function tapeReaderLamp(x: number, y: number, scale: number) {
  return { x: x + 233 * scale, y: y - 174 * scale, r: 7 * scale };
}

export function paintTapeReaderGlow(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  lamp: number,
) {
  if (lamp <= 0.02) return;
  const at = tapeReaderLamp(x, y, scale);
  glow(ctx, at.x, at.y, at.r * 8, pal.indicatorGlow, lamp);
}
