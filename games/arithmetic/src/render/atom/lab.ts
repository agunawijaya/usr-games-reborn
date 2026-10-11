import type { Layout } from '../layout';
import { createLayer, glow, type Layer, roundRect, scatter } from '../paint';
import { type AtomPalette, primeHue } from './palette';

/**
 * The lab behind the molecules, painted once per size and look: a wall of glass panels on a grid,
 * the floor's soft reflection, the chamber ring the molecules float in, and the display frame the
 * problem text sits on.
 */
export function paintLab(layout: Layout, palette: AtomPalette, scale: number): Layer {
  const { width, height, s } = layout;
  const layer = createLayer(width, height, scale);
  const ctx = layer.ctx;
  const back = ctx.createLinearGradient(0, 0, 0, height);
  back.addColorStop(0, palette.background[0]);
  back.addColorStop(1, palette.background[1]);
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, width, height);
  paintGrid(ctx, layout, palette);
  paintPanels(ctx, layout, palette);
  paintFloor(ctx, layout, palette);
  if (layout.kind === 'play') {
    paintPrimeChart(ctx, layout, palette);
    paintScopeFrame(ctx, layout, palette);
  }
  paintChamber(ctx, layout, palette);
  if (layout.kind === 'play') paintReadout(ctx, layout, palette);
  const vignette = ctx.createRadialGradient(
    width / 2,
    height * 0.5,
    height * 0.35,
    width / 2,
    height * 0.5,
    width * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, palette.vignette);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  void s;
  return layer;
}

function paintGrid(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { width, height, s } = layout;
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 48 * s;
  for (let x = (width / 2) % step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height * 0.84);
  }
  for (let y = step; y < height * 0.84; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function paintPanels(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { width, height, s } = layout;
  const panels = 5;
  const gap = 18 * s;
  const panelWidth = (width - gap * (panels + 1)) / panels;
  const top = 40 * s;
  const bottom = height * 0.82;
  for (let i = 0; i < panels; i++) {
    const x = gap + i * (panelWidth + gap);
    roundRect(ctx, x, top, panelWidth, bottom - top, 14 * s);
    const fill = ctx.createLinearGradient(x, top, x + panelWidth, bottom);
    fill.addColorStop(0, palette.panel);
    fill.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = palette.panelRim;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
    // A diagonal sheen across the frosted glass.
    ctx.save();
    roundRect(ctx, x, top, panelWidth, bottom - top, 14 * s);
    ctx.clip();
    const sheen = ctx.createLinearGradient(x, top, x + panelWidth * 0.6, top + panelWidth * 0.9);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, palette.glow ? 'rgba(170,160,255,0.06)' : 'rgba(255,255,255,0.45)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, top, panelWidth, bottom - top);
    ctx.restore();
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { width, height } = layout;
  const top = height * 0.84;
  const floor = ctx.createLinearGradient(0, top, 0, height);
  floor.addColorStop(0, palette.glow ? 'rgba(60, 50, 160, 0.25)' : 'rgba(255, 255, 255, 0.7)');
  floor.addColorStop(1, palette.glow ? 'rgba(0, 0, 0, 0.2)' : 'rgba(200, 235, 222, 0.6)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, top, width, height - top);
  ctx.fillStyle = palette.panelRim;
  ctx.fillRect(0, top, width, 2);
}

function paintChamber(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { chamber, s } = layout;
  const { x, y, r } = chamber;
  ctx.save();
  if (palette.glow) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * 1.6, palette.ringGlow);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Inside the ring the air is clearer, and the wall behind it is out of sight.
  ctx.fillStyle = palette.glow ? '#0b0926' : '#f4fbf8';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const inside = ctx.createRadialGradient(x, y, 0, x, y, r);
  inside.addColorStop(0, palette.glow ? 'rgba(70, 60, 200, 0.18)' : 'rgba(255,255,255,0.65)');
  inside.addColorStop(1, palette.glow ? 'rgba(70, 60, 200, 0.02)' : 'rgba(255,255,255,0.15)');
  ctx.fillStyle = inside;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  for (const [radius, width] of [
    [r, 3],
    [r * 1.06, 1.2],
  ] as const) {
    ctx.strokeStyle = palette.ring;
    ctx.lineWidth = width * s;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = palette.tick;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const inner = r * (i % 6 === 0 ? 1.08 : 1.09);
    const outer = r * (i % 6 === 0 ? 1.16 : 1.12);
    ctx.moveTo(x + Math.cos(t) * inner, y + Math.sin(t) * inner);
    ctx.lineTo(x + Math.cos(t) * outer, y + Math.sin(t) * outer);
  }
  ctx.stroke();
  // Indicator lamps around the ring.
  const random = scatter(13);
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const lx = x + Math.cos(t) * r * 1.2;
    const ly = y + Math.sin(t) * r * 1.2;
    const hue = [172, 192, 266, 38][Math.floor(random() * 4)]!;
    ctx.fillStyle = `hsl(${hue} 80% ${palette.glow ? 70 : 45}%)`;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    if (palette.glow) glow(ctx, lx, ly, 14 * s, `hsla(${hue}, 90%, 70%, 0.5)`);
  }
  ctx.restore();
}

function paintReadout(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { board, s } = layout;
  const pad = 14 * s;
  ctx.save();
  if (!palette.glow) {
    ctx.shadowColor = 'rgba(30, 90, 75, 0.18)';
    ctx.shadowBlur = 30 * s;
    ctx.shadowOffsetY = 10 * s;
  }
  roundRect(ctx, board.x - pad, board.y - pad, board.w + pad * 2, board.h + pad * 2, 26 * s);
  ctx.fillStyle = palette.readoutFace;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, board.x - pad, board.y - pad, board.w + pad * 2, board.h + pad * 2, 26 * s);
  ctx.strokeStyle = palette.readoutRim;
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  if (palette.glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(140, 130, 255, 0.6)';
    ctx.shadowBlur = 22 * s;
    ctx.stroke();
    ctx.restore();
  }
  // Brackets in the corners, like a lab instrument's sight.
  ctx.strokeStyle = palette.readoutRim;
  ctx.lineWidth = 3 * s;
  const c = 22 * s;
  const x0 = board.x;
  const y0 = board.y;
  const x1 = board.x + board.w;
  const y1 = board.y + board.h;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + c);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + c, y0);
  ctx.moveTo(x1 - c, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y0 + c);
  ctx.moveTo(x1, y1 - c);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - c, y1);
  ctx.moveTo(x0 + c, y1);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0, y1 - c);
  ctx.stroke();
}

/** The wall chart under the status panel: the primes below 100, each in its own colour. */
function paintPrimeChart(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { s, hud } = layout;
  const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  ];
  const columns = 5;
  const cell = 66 * s;
  const gap = 8 * s;
  const left = hud.x + (hud.w - (columns * cell + (columns - 1) * gap)) / 2;
  const top = hud.y + hud.h + 110 * s;
  ctx.save();
  ctx.globalAlpha = palette.glow ? 0.55 : 0.6;
  primes.forEach((prime, i) => {
    const x = left + (i % columns) * (cell + gap);
    const y = top + Math.floor(i / columns) * (cell + gap);
    roundRect(ctx, x, y, cell, cell, 10 * s);
    ctx.fillStyle = palette.tile;
    ctx.fill();
    ctx.strokeStyle = `hsl(${primeHueOf(prime)} 70% ${palette.glow ? 70 : 45}% / 0.7)`;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.fillStyle = `hsl(${primeHueOf(prime)} 70% ${palette.glow ? 72 : 32}%)`;
    ctx.font = `700 ${Math.round(24 * s)}px "Fredoka Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(prime), x + cell / 2, y + cell / 2 + 1 * s);
  });
  ctx.restore();
}

function primeHueOf(prime: number): string {
  return primeHue(prime).toFixed(1);
}

/** Where the oscilloscope sits: the lower right, below the tutor's panel. */
function scopeRect(layout: Layout) {
  const { s, width, height } = layout;
  const w = 330 * s;
  const h = 170 * s;
  return { x: width - 40 * s - w, y: height * 0.84 - 40 * s - h, w, h };
}

function paintScopeFrame(ctx: CanvasRenderingContext2D, layout: Layout, palette: AtomPalette) {
  const { s } = layout;
  const rect = scopeRect(layout);
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18 * s);
  ctx.fillStyle = palette.readoutFace;
  ctx.fill();
  ctx.strokeStyle = palette.readoutRim;
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    const gx = rect.x + (rect.w / 6) * i;
    ctx.moveTo(gx, rect.y + 10 * s);
    ctx.lineTo(gx, rect.y + rect.h - 10 * s);
  }
  for (let i = 1; i < 4; i++) {
    const gy = rect.y + (rect.h / 4) * i;
    ctx.moveTo(rect.x + 10 * s, gy);
    ctx.lineTo(rect.x + rect.w - 10 * s, gy);
  }
  ctx.stroke();
}

/** The live trace on the oscilloscope: the chamber's hum, a slow beat of two waves. */
export function drawScope(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: AtomPalette,
  time: number,
) {
  const { s } = layout;
  const rect = scopeRect(layout);
  const mid = rect.y + rect.h / 2;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    const x = rect.x + 14 * s + u * (rect.w - 28 * s);
    const wave = Math.sin(u * 14 + time * 3) * 0.55 + Math.sin(u * 31 - time * 5) * 0.25;
    const y = mid + wave * rect.h * 0.3 * Math.sin(u * Math.PI);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2.5 * s;
  ctx.strokeStyle = palette.glow ? 'rgba(111, 240, 196, 0.95)' : 'rgba(11, 122, 96, 0.85)';
  if (palette.glow) {
    ctx.shadowColor = 'rgba(111, 240, 196, 0.8)';
    ctx.shadowBlur = 10 * s;
  }
  ctx.stroke();
  ctx.restore();
}
