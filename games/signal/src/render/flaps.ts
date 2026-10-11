import type { DeskPalette } from './palette';
import { alpha, type Ctx, FONT_MONO, linear, mix, roundRect } from './paint';

/**
 * A split-flap board, like a station's departure board: each character sits on two hinged
 * flaps, and changing it drops the top flap over to show the next one. Cracking a cipher
 * resolves the message this way, letter by letter.
 */
export interface Flap {
  /** What the tile shows now. */
  char: string;
  /** What it is turning to, while `flip` runs from 0 to 1. */
  next?: string;
  flip?: number;
  /** Resolved tiles read as plain text; unresolved ones are dimmer cipher. */
  resolved: boolean;
}

export function paintFlapTile(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  flap: Flap,
  pal: DeskPalette,
) {
  const radius = w * 0.12;
  const face = pal.look === 'night' ? '#16120f' : '#26211c';
  const ink = flap.resolved ? (pal.look === 'night' ? '#fff1cf' : '#fdf5e2') : '#9e9486';
  ctx.save();
  // Housing.
  ctx.fillStyle = alpha('#000000', 0.35);
  roundRect(ctx, x + w * 0.04, y + h * 0.05, w, h, radius);
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [
    [0, mix(face, '#ffffff', 0.08)],
    [0.5, face],
    [0.5, mix(face, '#000000', 0.25)],
    [1, mix(face, '#000000', 0.1)],
  ]);
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  const flip = flap.flip ?? 0;
  const next = flap.next ?? flap.char;
  const glyph = (char: string, clipTop: boolean, squash = 1) => {
    ctx.save();
    ctx.beginPath();
    if (clipTop) ctx.rect(x, y, w, h / 2);
    else ctx.rect(x, y + h / 2, w, h / 2);
    ctx.clip();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(1, squash);
    ctx.fillStyle = ink;
    ctx.font = `600 ${h * 0.72}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 0, h * 0.04);
    ctx.restore();
  };
  if (flip <= 0 || flip >= 1) {
    const shown = flip >= 1 ? next : flap.char;
    glyph(shown, true);
    glyph(shown, false);
  } else {
    // Behind: the next character's top, and the current one's bottom until the flap lands.
    glyph(next, true);
    if (flip < 0.5) {
      glyph(flap.char, false);
      // The falling flap: the current top half folding down towards the hinge.
      const squash = Math.cos(flip * Math.PI);
      ctx.save();
      ctx.translate(0, y + h / 2);
      ctx.scale(1, squash);
      ctx.translate(0, -(y + h / 2));
      ctx.fillStyle = linear(ctx, 0, y, 0, y + h / 2, [
        [0, mix(face, '#ffffff', 0.12)],
        [1, face],
      ]);
      roundRect(ctx, x, y, w, h / 2, radius);
      ctx.fill();
      glyph(flap.char, true);
      ctx.restore();
      ctx.fillStyle = alpha('#000000', 0.35 * flip);
      ctx.fillRect(x, y + h / 2, w, h / 2);
    } else {
      // The flap has passed the hinge: it shows the next character's bottom, unfolding.
      const squash = -Math.cos(flip * Math.PI);
      glyph(flap.char, false);
      ctx.save();
      ctx.translate(0, y + h / 2);
      ctx.scale(1, squash);
      ctx.translate(0, -(y + h / 2));
      ctx.fillStyle = mix(face, '#000000', 0.2);
      ctx.fillRect(x, y + h / 2, w, h / 2);
      glyph(next, false);
      ctx.restore();
    }
  }
  // The hinge line and a glint.
  ctx.fillStyle = alpha('#000000', 0.6);
  ctx.fillRect(x, y + h / 2 - Math.max(1, h * 0.012), w, Math.max(1.5, h * 0.024));
  ctx.fillStyle = alpha('#ffffff', 0.06);
  roundRect(ctx, x + w * 0.06, y + h * 0.04, w * 0.88, h * 0.18, radius * 0.6);
  ctx.fill();
  ctx.restore();
}

/** Lays out a line of tiles; returns where each tile went. */
export function paintFlapRow(
  ctx: Ctx,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  gap: number,
  flaps: readonly Flap[],
  pal: DeskPalette,
) {
  flaps.forEach((flap, i) => {
    if (flap.char === ' ' && (flap.next ?? ' ') === ' ') return;
    paintFlapTile(ctx, x + i * (tileW + gap), y, tileW, tileH, flap, pal);
  });
}
