import type { Look } from './look';
import { mix, rgba } from './noise';
import { glow } from './shapes';

/**
 * You: a small explorer in a sun helmet with a leather satchel on the hip that bulges as it
 * fills. By moonlight a little lantern hangs from the belt.
 */
export type ExplorerPose = 'idle' | 'walk' | 'startled' | 'pour' | 'cheer';

export interface ExplorerDraw {
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  readonly look: Look;
  readonly time: number;
  /** 0 empty pockets, 1 bursting. */
  readonly fullness: number;
  /** 1 faces east, -1 west: the satchel hangs on the side you face. */
  readonly facing: 1 | -1;
  readonly pose: ExplorerPose;
  /** The satchel has burst open and lies flat (the spill). */
  readonly spilled?: boolean;
  /** Standing in a lily pool: the water comes up to the knees. */
  readonly wading?: boolean;
}

interface Kit {
  readonly shirt: string;
  readonly shirtShade: string;
  readonly skin: string;
  readonly cheek: string;
  readonly helmet: string;
  readonly helmetShade: string;
  readonly band: string;
  readonly scarf: string;
  readonly boots: string;
  readonly satchel: string;
  readonly satchelShade: string;
  readonly ink: string;
}

const KIT: Readonly<Record<Look, Kit>> = {
  sun: {
    shirt: '#d7b77a',
    shirtShade: '#b08d52',
    skin: '#f2c7a0',
    cheek: '#ef9a8a',
    helmet: '#efe3c0',
    helmetShade: '#c9b88e',
    band: '#7c5a2c',
    scarf: '#d9483b',
    boots: '#5a3b20',
    satchel: '#9a5f2a',
    satchelShade: '#6e3f17',
    ink: '#3a2614',
  },
  moon: {
    shirt: '#b8a27a',
    shirtShade: '#8a7552',
    skin: '#e2b896',
    cheek: '#e08f8f',
    helmet: '#dcd2b2',
    helmetShade: '#a99d7c',
    band: '#5e4527',
    scarf: '#c7404f',
    boots: '#3c2817',
    satchel: '#83512a',
    satchelShade: '#55321a',
    ink: '#24170c',
  },
};

export function drawExplorer(ctx: CanvasRenderingContext2D, e: ExplorerDraw) {
  const k = KIT[e.look];
  const s = e.cell;
  const bob =
    e.pose === 'walk'
      ? Math.abs(Math.sin(e.time * 9)) * s * 0.04
      : Math.sin(e.time * 2) * s * 0.008;
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.wading) {
    // Below the waterline nothing shows: clip the figure at the knees.
    ctx.beginPath();
    ctx.rect(-s, -s * 1.2, s * 2, s * 1.42);
    ctx.clip();
  } else {
    ctx.fillStyle = rgba('#000000', e.look === 'sun' ? 0.25 : 0.4);
    ctx.beginPath();
    ctx.ellipse(s * 0.02, s * 0.38, s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (e.look === 'moon') drawLantern(ctx, s, e.time, -e.facing);

  ctx.translate(0, -bob);
  ctx.scale(e.facing, 1);

  // Boots.
  ctx.fillStyle = k.boots;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * s * 0.1 - s * 0.06, s * 0.27, s * 0.12, s * 0.11, s * 0.04);
    ctx.fill();
  }

  // Torso.
  const torso = ctx.createLinearGradient(-s * 0.2, 0, s * 0.2, 0);
  torso.addColorStop(0, k.shirt);
  torso.addColorStop(1, k.shirtShade);
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.moveTo(-s * 0.17, -s * 0.06);
  ctx.quadraticCurveTo(-s * 0.21, s * 0.18, -s * 0.15, s * 0.3);
  ctx.lineTo(s * 0.15, s * 0.3);
  ctx.quadraticCurveTo(s * 0.21, s * 0.18, s * 0.17, -s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = k.band;
  ctx.fillRect(-s * 0.18, s * 0.17, s * 0.36, s * 0.045);

  // The strap across the chest.
  ctx.strokeStyle = k.satchelShade;
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, -s * 0.05);
  ctx.lineTo(s * 0.17, s * 0.15);
  ctx.stroke();

  drawArms(ctx, e, k.shirt, k.skin);
  if (e.pose !== 'pour') drawSatchel(ctx, e, k);

  // Scarf, head and helmet.
  ctx.fillStyle = k.scarf;
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, -s * 0.08);
  ctx.lineTo(s * 0.13, -s * 0.08);
  ctx.lineTo(s * 0.02, s * 0.06);
  ctx.closePath();
  ctx.fill();
  drawHead(ctx, e, k);
  ctx.restore();
}

function drawArms(ctx: CanvasRenderingContext2D, e: ExplorerDraw, shirt: string, skin: string) {
  const s = e.cell;
  const raise = e.pose === 'pour' || e.pose === 'cheer' ? 1 : e.pose === 'startled' ? 0.6 : 0;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const shoulder = { x: side * s * 0.16, y: -s * 0.03 };
    // Pouring, both hands reach up and out toward the satchel held over the vault.
    const pour = e.pose === 'pour';
    const hand = {
      x: pour ? s * (0.3 + side * 0.08) : side * s * (0.24 + raise * 0.06),
      y: pour ? -s * (0.34 + side * 0.04) : s * 0.16 - raise * s * 0.42,
    };
    ctx.strokeStyle = shirt;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The satchel held out upside down, its mouth at (x, y): banking pours from here. */
export function drawHeldSatchel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  look: Look,
  fullness: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI * 0.88);
  ctx.translate(0, cell * 0.12);
  drawSatchel(
    ctx,
    { x: 0, y: 0, cell, look, time: 0, fullness, facing: 1, pose: 'idle' },
    KIT[look],
    true,
  );
  ctx.restore();
}

function drawSatchel(ctx: CanvasRenderingContext2D, e: ExplorerDraw, k: Kit, held = false) {
  const s = e.cell;
  const full = Math.max(0, Math.min(1, e.fullness));
  ctx.save();
  if (!held) ctx.translate(s * (0.21 + full * 0.05), s * 0.17);
  const w = s * (0.22 + full * 0.2);
  const h = s * (0.17 + full * 0.14);
  if (e.spilled) {
    ctx.fillStyle = k.satchelShade;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.2, w * 0.62, h * 0.32, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = k.satchel;
    ctx.beginPath();
    ctx.ellipse(-w * 0.1, h * 0.05, w * 0.5, h * 0.24, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  body.addColorStop(0, mix(k.satchel, '#ffffff', 0.18));
  body.addColorStop(1, k.satchelShade);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.3);
  ctx.quadraticCurveTo(-w * (0.55 + full * 0.12), h * 0.55, 0, h * (0.5 + full * 0.1));
  ctx.quadraticCurveTo(w * (0.55 + full * 0.12), h * 0.55, w / 2, -h * 0.3);
  ctx.closePath();
  ctx.fill();
  // Glints peeking out of a full satchel.
  if (full > 0.3) {
    const peeking = ['#2fbf71', '#e8b52c', '#e23b5a', '#7cc8ff', '#e8b52c'];
    const count = Math.round(1 + full * 4);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = peeking[i % peeking.length]!;
      ctx.beginPath();
      ctx.arc(
        -w * 0.32 + (i / Math.max(1, count - 1)) * w * 0.64,
        -h * (0.34 + (i % 2) * 0.08),
        s * 0.045,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.7);
      ctx.beginPath();
      ctx.arc(
        -w * 0.32 + (i / Math.max(1, count - 1)) * w * 0.64 - s * 0.012,
        -h * (0.34 + (i % 2) * 0.08) - s * 0.012,
        s * 0.014,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  // The flap, its stitching and a brass buckle.
  ctx.fillStyle = k.satchelShade;
  ctx.beginPath();
  ctx.moveTo(-w * 0.52, -h * 0.32);
  ctx.quadraticCurveTo(0, h * (0.12 - full * 0.12), w * 0.52, -h * 0.32);
  ctx.lineTo(w * 0.46, -h * 0.42);
  ctx.lineTo(-w * 0.46, -h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e7c35a';
  ctx.beginPath();
  ctx.roundRect(-s * 0.025, -h * 0.1 - full * h * 0.06, s * 0.05, s * 0.05, s * 0.01);
  ctx.fill();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, e: ExplorerDraw, k: Kit) {
  const s = e.cell;
  const hy = -s * 0.24;
  ctx.fillStyle = k.skin;
  ctx.beginPath();
  ctx.arc(0, hy, s * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(k.cheek, 0.55);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * 0.095, hy + s * 0.055, s * 0.035, s * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = k.ink;
  ctx.strokeStyle = k.ink;
  ctx.lineWidth = s * 0.022;
  ctx.lineCap = 'round';
  if (e.pose === 'cheer') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * s * 0.06, hy + s * 0.01, s * 0.03, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, hy + s * 0.06, s * 0.05, 0.1, Math.PI - 0.1);
    ctx.fill();
  } else if (e.pose === 'startled') {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(side * s * 0.06, hy + s * 0.005, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = k.ink;
      ctx.beginPath();
      ctx.arc(side * s * 0.06, hy + s * 0.012, s * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, hy + s * 0.085, s * 0.022, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * s * 0.06, hy + s * 0.01, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, hy + s * 0.055, s * 0.035, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  // Sun helmet: brim, dome, band.
  ctx.fillStyle = k.helmetShade;
  ctx.beginPath();
  ctx.ellipse(0, hy - s * 0.08, s * 0.26, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  const dome = ctx.createLinearGradient(-s * 0.2, hy - s * 0.3, s * 0.2, hy);
  dome.addColorStop(0, mix(k.helmet, '#ffffff', 0.3));
  dome.addColorStop(1, k.helmetShade);
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(0, hy - s * 0.1, s * 0.18, s * 0.16, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(0, hy - s * 0.1, s * 0.18, s * 0.05, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = k.band;
  ctx.fillRect(-s * 0.18, hy - s * 0.13, s * 0.36, s * 0.035);
  ctx.fillStyle = rgba('#ffffff', 0.45);
  ctx.beginPath();
  ctx.ellipse(-s * 0.07, hy - s * 0.2, s * 0.05, s * 0.025, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawLantern(ctx: CanvasRenderingContext2D, s: number, time: number, side: number) {
  const x = side * s * 0.25;
  const y = s * 0.16;
  const flicker = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, s * 1.15 * flicker, 'rgba(255, 190, 100, 0.16)');
  glow(ctx, x, y, s * 0.35, 'rgba(255, 230, 160, 0.8)');
  ctx.restore();
  ctx.fillStyle = '#3c2817';
  ctx.fillRect(x - s * 0.04, y - s * 0.08, s * 0.08, s * 0.025);
  ctx.fillStyle = 'rgba(255, 226, 150, 0.95)';
  ctx.beginPath();
  ctx.roundRect(x - s * 0.035, y - s * 0.055, s * 0.07, s * 0.09, s * 0.015);
  ctx.fill();
}

/** Rings on the water round a wading explorer. */
export function drawWadingRipples(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  look: Look,
  time: number,
) {
  ctx.save();
  ctx.translate(x, y + cell * 0.22);
  for (let k = 0; k < 2; k++) {
    const phase = (time * 0.8 + k / 2) % 1;
    ctx.strokeStyle =
      look === 'sun'
        ? `rgba(255, 255, 245, ${0.8 * (1 - phase)})`
        : `rgba(200, 220, 255, ${0.7 * (1 - phase)})`;
    ctx.lineWidth = Math.max(1.2, cell * 0.025);
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      cell * (0.26 + phase * 0.25),
      cell * (0.08 + phase * 0.08),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}
