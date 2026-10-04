import type { Geometry } from './geometry';
import type { Look, SceneLook } from './palette';
import { hash2 } from './shapes';

/**
 * The dust on the floor, and the clean stripes the vacuums leave in it. By the end of a room the
 * floor is a drawing of everything that happened: the signature of every run. At night the
 * vacuums' lights also leave a faint glow along their paths.
 */
export class DustLayer {
  readonly dust: HTMLCanvasElement;
  readonly glow: HTMLCanvasElement;
  private dustCtx: CanvasRenderingContext2D;
  private glowCtx: CanvasRenderingContext2D;

  constructor(
    private geo: Geometry,
    private scene: SceneLook,
    private look: Look,
    private ratio: number,
    seed: number,
  ) {
    this.dust = document.createElement('canvas');
    this.glow = document.createElement('canvas');
    for (const canvas of [this.dust, this.glow]) {
      canvas.width = Math.round(geo.width * ratio);
      canvas.height = Math.round(geo.height * ratio);
    }
    this.dustCtx = this.dust.getContext('2d')!;
    this.glowCtx = this.glow.getContext('2d')!;
    this.dustCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.glowCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.sprinkle(seed);
  }

  private sprinkle(seed: number) {
    const { geo } = this;
    const ctx = this.dustCtx;
    const x0 = geo.boardX;
    const y0 = geo.boardY;
    const w = geo.cols * geo.cell;
    const h = geo.rows * geo.cell;
    // An even film, then specks, then a few dust bunnies.
    ctx.fillStyle = this.scene.dust;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x0, y0, w, h);
    ctx.globalAlpha = 1;
    const specks = Math.round((w * h) / 26);
    for (let i = 0; i < specks; i++) {
      const size = 0.6 + hash2(i, seed, 2) * 1.6;
      ctx.fillRect(x0 + hash2(i, seed) * w, y0 + hash2(seed, i, 1) * h, size, size);
    }
    const bunnies = Math.round(geo.cols * geo.rows * 0.06);
    for (let i = 0; i < bunnies; i++) {
      const bx = x0 + hash2(i, seed, 5) * w;
      const by = y0 + hash2(i, seed, 6) * h;
      const r = geo.cell * (0.06 + hash2(i, seed, 7) * 0.07);
      for (let k = 0; k < 9; k++) {
        ctx.beginPath();
        ctx.arc(
          bx + (hash2(i, k, 8) - 0.5) * r * 2,
          by + (hash2(i, k, 9) - 0.5) * r * 1.4,
          r * 0.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  /**
   * A vacuum rolled from one point to another (canvas coordinates): clean the stripe. By day the
   * lane is narrow, so the combed trail the reveal draws on it stays clear where lanes cross.
   */
  sweep(x1: number, y1: number, x2: number, y2: number) {
    const width = this.geo.cell * (this.look === 'day' ? 0.36 : 0.62);
    const ctx = this.dustCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = 'rgba(0,0,0,0.92)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    if (this.scene.glow && this.look === 'night') {
      const glow = this.glowCtx;
      glow.save();
      glow.globalCompositeOperation = 'lighter';
      glow.lineCap = 'round';
      glow.lineWidth = this.geo.cell * 0.14;
      glow.strokeStyle = this.scene.glow;
      glow.beginPath();
      glow.moveTo(x1, y1);
      glow.lineTo(x2, y2);
      glow.stroke();
      glow.restore();
    }
  }

  /** Little paw prints where the cat walks. */
  paw(x: number, y: number, facing: number) {
    const ctx = this.dustCtx;
    const s = this.geo.cell;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    for (const side of [-1, 1]) {
      const px = x + side * s * 0.1 + facing * s * 0.04;
      const py = y + s * 0.18 + (side > 0 ? s * 0.05 : 0);
      ctx.beginPath();
      ctx.ellipse(px, py, s * 0.045, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let toe = -1; toe <= 1; toe++) {
        ctx.beginPath();
        ctx.arc(px + toe * s * 0.035, py - s * 0.05, s * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, glowStrength: number) {
    ctx.drawImage(this.dust, 0, 0, this.geo.width, this.geo.height);
    if (this.look === 'night' && glowStrength > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, glowStrength);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glow, 0, 0, this.geo.width, this.geo.height);
      ctx.restore();
    }
  }

  get pixelRatio(): number {
    return this.ratio;
  }
}
