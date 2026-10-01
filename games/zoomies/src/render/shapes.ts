/** Small drawing helpers shared by every sprite. */

export type Ctx = CanvasRenderingContext2D;

export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rotation = 0,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ellipse(ctx, x, y, r, r, fill);
}

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number],
  fill?: string,
  stroke?: string,
  lineWidth = 1,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function line(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function withAlpha(ctx: Ctx, alpha: number, draw: () => void) {
  if (alpha <= 0) return;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = before * Math.min(1, alpha);
  draw();
  ctx.globalAlpha = before;
}

/**
 * A soft glow around whatever `draw` paints. Shadow blur is costly, and on small squares (the
 * Long Night's field) it is barely visible, so below a few pixels it is simply left out.
 */
export function glow(ctx: Ctx, color: string, blur: number, draw: () => void) {
  if (blur < 14) {
    draw();
    return;
  }
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

const shadowCache = new Map<string, HTMLCanvasElement>();

/** A soft round shadow on the floor under something standing on it, drawn once per size. */
export function floorShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  const w = Math.max(2, Math.round(rx * 2));
  const h = Math.max(2, Math.round(ry * 2));
  const key = `${w}x${h}:${color}`;
  let sprite = shadowCache.get(key);
  if (!sprite) {
    if (shadowCache.size > 200) shadowCache.clear();
    sprite = document.createElement('canvas');
    sprite.width = w * 2;
    sprite.height = h * 2;
    const c = sprite.getContext('2d')!;
    c.scale(2, (2 * h) / w);
    const gradient = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gradient;
    c.beginPath();
    c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    c.fill();
    shadowCache.set(key, sprite);
  }
  ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
}

/** A deterministic 0–1 value for a position, for texture that never flickers between frames. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
