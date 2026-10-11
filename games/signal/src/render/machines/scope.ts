import type { DeskPalette } from '../palette';
import {
  alpha,
  contactShadow,
  type Ctx,
  FONT_MONO,
  glow,
  linear,
  mix,
  radial,
  roundRect,
  screw,
} from '../paint';

/**
 * The frequency scope: a small cathode-ray screen in a steel case that draws the message's
 * letter histogram as bright bars over English's own (from the original's table) as a dim
 * outline. When a rotation lines the two up, the bars and the readout light.
 */
export interface ScopeState {
  /** The message's letter shares A–Z in percent, as currently turned. */
  shares: readonly number[];
  /** English's shares A–Z in percent. */
  english: readonly number[];
  /** The rotation the wheel is at, for the readout. */
  rotation: number;
  /** 0–1 how well the current rotation fits English. */
  fit: number;
  /** 0–1 the alignment flash when the best rotation is reached. */
  lit: number;
  /** Labels and the readout only when large enough to read. */
  detail: 'far' | 'near';
  time: number;
}

export function paintScope(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
  state: ScopeState,
) {
  ctx.save();
  contactShadow(ctx, x + w / 2, y + h, w * 0.6, h * 0.08, 0.45);
  // Case: grey hammered steel with a darker bezel.
  ctx.fillStyle = linear(ctx, x, y, x, y + h, [
    [0, mix(pal.steel, '#ffffff', 0.1)],
    [1, pal.steelDeep],
  ]);
  roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.06);
  ctx.fill();
  ctx.strokeStyle = alpha('#ffffff', 0.25);
  ctx.lineWidth = Math.max(1, w * 0.004);
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.min(w, h) * 0.055);
  ctx.stroke();
  const pad = Math.min(w, h) * 0.07;
  const knobRow = state.detail === 'near' ? h * 0.16 : h * 0.2;
  const sx = x + pad;
  const sy = y + pad;
  const sw = w - pad * 2;
  const sh = h - pad * 2 - knobRow;
  // Bezel and the curved glass.
  ctx.fillStyle = mix(pal.steelDeep, '#000000', 0.5);
  roundRect(ctx, sx - pad * 0.35, sy - pad * 0.35, sw + pad * 0.7, sh + pad * 0.7, pad * 0.8);
  ctx.fill();
  ctx.fillStyle = radial(ctx, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.75, [
    [0, mix(pal.scopeGlass, '#1d4a32', 0.4)],
    [1, pal.scopeGlass],
  ]);
  roundRect(ctx, sx, sy, sw, sh, pad * 0.6);
  ctx.fill();
  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, pad * 0.6);
  ctx.clip();
  paintTrace(ctx, sx, sy, sw, sh, pal, state);
  // Scan lines and the glass curvature highlight.
  ctx.fillStyle = alpha('#000000', 0.18);
  for (let ly = sy; ly < sy + sh; ly += 3) ctx.fillRect(sx, ly, sw, 1);
  ctx.fillStyle = radial(ctx, sx + sw * 0.3, sy + sh * 0.2, sw * 0.5, [
    [0, alpha('#ffffff', 0.1)],
    [1, alpha('#ffffff', 0)],
  ]);
  ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();
  // Knobs and the maker's plate.
  const ky = y + h - pad - knobRow / 2;
  const kr = Math.min(knobRow * 0.32, w * 0.04);
  for (const kx of [x + w * 0.12, x + w * 0.24]) {
    ctx.fillStyle = radial(ctx, kx - kr * 0.3, ky - kr * 0.3, kr * 1.4, [
      [0, pal.enamelLight],
      [1, pal.enamel],
    ]);
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha('#ffffff', 0.5);
    ctx.lineWidth = Math.max(1, kr * 0.12);
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(kx + Math.cos(-1.1) * kr * 0.8, ky + Math.sin(-1.1) * kr * 0.8);
    ctx.stroke();
  }
  // Power lamp.
  const lampX = x + w * 0.88;
  ctx.fillStyle = radial(ctx, lampX, ky, kr * 0.6, [
    [0, '#f2fff6'],
    [0.5, pal.phosphor],
    [1, mix(pal.phosphor, '#000000', 0.5)],
  ]);
  ctx.beginPath();
  ctx.arc(lampX, ky, kr * 0.5, 0, Math.PI * 2);
  ctx.fill();
  if (state.detail === 'near') {
    ctx.fillStyle = alpha(pal.steelLight, 0.85);
    ctx.font = `600 ${Math.max(10, h * 0.035)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LETTER FREQUENCY SCOPE', x + w * 0.56, ky);
  }
  for (const [px, py] of [
    [x + pad * 0.5, y + pad * 0.5],
    [x + w - pad * 0.5, y + pad * 0.5],
    [x + pad * 0.5, y + h - pad * 0.5],
    [x + w - pad * 0.5, y + h - pad * 0.5],
  ] as const) {
    screw(ctx, px, py, Math.max(2, pad * 0.18), pal.steelLight, pal.steelDeep);
  }
  ctx.restore();
}

function paintTrace(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
  state: ScopeState,
) {
  const near = state.detail === 'near';
  const labelH = near ? h * 0.12 : 0;
  const readoutH = near ? h * 0.13 : 0;
  const left = x + w * 0.04;
  const right = x + w * 0.96;
  const bottom = y + h - labelH - h * 0.03;
  const top = y + readoutH + h * 0.05;
  const peak = 14;
  const columnW = (right - left) / 26;
  // Graticule.
  ctx.strokeStyle = alpha(pal.phosphor, 0.12);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = bottom - ((bottom - top) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(left, gy);
    ctx.lineTo(right, gy);
    ctx.stroke();
  }
  // English: a dim stepped outline.
  ctx.strokeStyle = alpha(pal.phosphor, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.setLineDash([Math.max(2, w * 0.008), Math.max(2, w * 0.006)]);
  ctx.beginPath();
  state.english.forEach((share, i) => {
    const bx = left + i * columnW;
    const by = bottom - (Math.min(share, peak) / peak) * (bottom - top);
    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
    ctx.lineTo(bx + columnW, by);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  // The message: bright bars, brighter as the fit improves.
  const bright = 0.55 + 0.45 * state.fit;
  state.shares.forEach((share, i) => {
    const bw = columnW * 0.62;
    const bx = left + i * columnW + (columnW - bw) / 2;
    const bh = (Math.min(share, peak) / peak) * (bottom - top);
    const match = 1 - Math.min(1, Math.abs(share - (state.english[i] ?? 0)) / 6);
    ctx.fillStyle = alpha(pal.phosphor, bright * (0.55 + 0.45 * match * state.fit));
    ctx.fillRect(bx, bottom - bh, bw, bh);
    ctx.fillStyle = alpha('#eafff2', 0.55 * bright);
    ctx.fillRect(bx, bottom - bh, bw, Math.max(1, h * 0.006));
  });
  // Phosphor bloom over the bars.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(pal.phosphor, 0.06 + 0.1 * state.lit);
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.restore();
  if (!near) return;
  ctx.fillStyle = alpha(pal.phosphor, 0.85);
  ctx.font = `600 ${Math.max(9, labelH * 0.55)}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 26; i++) {
    ctx.fillText(String.fromCharCode(65 + i), left + (i + 0.5) * columnW, bottom + labelH * 0.55);
  }
  // Readout: rotation and a fit meter.
  ctx.textAlign = 'left';
  ctx.font = `600 ${Math.max(10, readoutH * 0.5)}px ${FONT_MONO}`;
  const ry = y + readoutH * 0.62;
  ctx.fillStyle = alpha(pal.phosphor, 0.95);
  ctx.fillText(`ROT ${String(state.rotation).padStart(2, '0')}`, left, ry);
  const meterX = left + w * 0.2;
  const meterW = w * 0.42;
  ctx.fillText('FIT', meterX, ry);
  const cells = 16;
  const cellW = (meterW - w * 0.07) / cells;
  for (let i = 0; i < cells; i++) {
    const on = i < Math.round(state.fit * cells);
    ctx.fillStyle = alpha(pal.phosphor, on ? 0.95 : 0.15);
    ctx.fillRect(meterX + w * 0.06 + i * cellW, ry - readoutH * 0.22, cellW * 0.7, readoutH * 0.44);
  }
  ctx.fillStyle = alpha(pal.phosphor, state.lit > 0.5 ? 1 : 0.35);
  ctx.textAlign = 'right';
  ctx.fillText(state.lit > 0.5 ? 'ENGLISH ◆ LOCKED' : 'SEARCHING', right, ry);
  if (state.lit > 0.05)
    glow(ctx, x + w / 2, y + h / 2, w * 0.6, alpha(pal.phosphor, 0.12), state.lit);
}
