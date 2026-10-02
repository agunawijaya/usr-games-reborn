import { type Look, PALETTES } from './look';
import { rgba } from './noise';
import { glow } from './shapes';

/**
 * The door: a round bronze vault hatch set into the flagstones, where you bank your haul (the
 * original's `#`). It glows a little when you are near, and slides open for the cascade.
 */
export interface DoorDraw {
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  readonly look: Look;
  readonly time: number;
  /** 0 shut, 1 wide open. */
  readonly open: number;
  /** 0–1: how strongly it beckons (you are near, or carrying a lot). */
  readonly beckon: number;
}

const BRASS = ['#f3d27a', '#b7862c'] as const;

export function drawDoor(ctx: CanvasRenderingContext2D, d: DoorDraw) {
  const p = PALETTES[d.look];
  const r = d.cell * 0.46;
  const pulse = 0.5 + 0.5 * Math.sin(d.time * 2.4);
  if (d.beckon > 0 || d.look === 'moon') {
    ctx.save();
    ctx.globalCompositeOperation = d.look === 'moon' ? 'lighter' : 'source-over';
    const strength = (d.look === 'moon' ? 0.22 : 0.12) + d.beckon * (0.18 + 0.12 * pulse);
    glow(ctx, d.x, d.y, d.cell * (1.1 + d.beckon * 0.4), rgba('#ffd27a', strength));
    ctx.restore();
  }
  // The vault below, glowing with what is already inside.
  const inside = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
  inside.addColorStop(0, d.open > 0 ? '#ffe9a8' : p.vault);
  inside.addColorStop(0.55, d.open > 0 ? '#e0a23a' : p.vault);
  inside.addColorStop(1, p.vault);
  ctx.fillStyle = inside;
  ctx.beginPath();
  ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
  ctx.fill();

  // The hatch slides away to the north-east as it opens.
  const slide = d.open * r * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.arc(d.x, d.y, r * 1.02, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(d.x + slide * 0.7, d.y - slide * 0.7);
  const face = ctx.createLinearGradient(-r, -r, r, r);
  face.addColorStop(0, p.bronze[2]);
  face.addColorStop(0.5, p.bronze[0]);
  face.addColorStop(1, p.bronze[1]);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // A brass ring and a brass wheel handle on the dark iron.
  ctx.strokeStyle = BRASS[1];
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = BRASS[0];
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();
  ctx.lineCap = 'round';
  for (const [colour, width, shift] of [
    [BRASS[1], 0.11, 0],
    [BRASS[0], 0.045, -0.05],
  ] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = r * width;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + d.open * 2 + shift;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
      ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The keystone: a cut gem at the hub, so the door reads as the place for treasure.
  const gem = ctx.createLinearGradient(-r * 0.2, -r * 0.2, r * 0.2, r * 0.2);
  gem.addColorStop(0, '#b8f5c9');
  gem.addColorStop(1, '#0e6b3a');
  ctx.fillStyle = BRASS[1];
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = gem;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.7);
  ctx.beginPath();
  ctx.arc(-r * 0.05, -r * 0.06, r * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
