import { type BeachPalette, mixHex, rgba } from './palette';

/**
 * Small beach treasures drawn at the origin: shells, a starfish and sea glass. The castle
 * presses them into its walls; the props strew them on the sand.
 */
export function paintScallop(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  palette: BeachPalette,
) {
  ctx.beginPath();
  ctx.moveTo(0, size * 0.55);
  ctx.bezierCurveTo(-size * 1.1, size * 0.1, -size * 0.9, -size * 0.85, 0, -size * 0.8);
  ctx.bezierCurveTo(size * 0.9, -size * 0.85, size * 1.1, size * 0.1, 0, size * 0.55);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, -size, 0, size);
  fill.addColorStop(0, mixHex(color, '#ffffff', 0.4));
  fill.addColorStop(1, color);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = rgba(palette.castleDeep, 0.45);
  ctx.lineWidth = Math.max(1, size * 0.07);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.5);
    ctx.lineTo(i * size * 0.32, -size * 0.7 + Math.abs(i) * size * 0.12);
    ctx.stroke();
  }
  // The hinge.
  ctx.fillStyle = mixHex(color, palette.castleDeep, 0.25);
  ctx.fillRect(-size * 0.22, size * 0.42, size * 0.44, size * 0.18);
}

export function paintStarfish(ctx: CanvasRenderingContext2D, size: number, palette: BeachPalette) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.62;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = palette.look === 'moonlit' ? '#c07a6e' : '#ff9a5c';
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.5);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.31, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintSeaGlass(ctx: CanvasRenderingContext2D, size: number, palette: BeachPalette) {
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.62, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = palette.look === 'moonlit' ? 'rgba(110,220,200,0.85)' : 'rgba(80,200,170,0.85)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.3, -size * 0.2, size * 0.3, size * 0.14, 0.4, 0, Math.PI * 2);
  ctx.fill();
}
