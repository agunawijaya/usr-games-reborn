import { drawDrifters } from './drifters';
import { drawGardenBackdrop } from './garden';
import { drawLakeBackdrop, drawMoonPath, type LakeFrame } from './lake';
import type { Look } from './look';
import { hash01 } from './noise';
import { makePieceSprites, PEBBLE_VARIANTS, type PieceSprites } from './pieces';

/**
 * The garden or the lake with no board on it, behind the menus and the ladder. By night the
 * horizon sits higher, so more of the sky shows. The game menu adds its motif: five in a row — by
 * day five slate pebbles in a raked ring, by night five amber lanterns afloat under five stars.
 */
export class SceneryView {
  private readonly ctx: CanvasRenderingContext2D;
  private backdrop: HTMLCanvasElement | null = null;
  private sprites: PieceSprites | null = null;
  private width = 0;
  private height = 0;
  private scale = 1;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private look: Look,
    private readonly motif: 'five' | null = null,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  setLook(look: Look): void {
    if (look.id === this.look.id) return;
    this.look = look;
    this.rebuild();
  }

  resize(width: number, height: number, scale: number): void {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.rebuild();
  }

  private frame(): LakeFrame {
    return {
      width: this.width,
      height: this.height,
      horizon: Math.round(this.height * 0.3),
      moonX: this.width * 0.78,
    };
  }

  /** The size of a board cell the menus' pieces are drawn for. */
  private cell(): number {
    return Math.max(40, this.height * 0.07);
  }

  /** Where the motif's five sit: a rising diagonal right of the menu. */
  private fivePoints(): { x: number; y: number }[] {
    const c = this.cell() * 1.05;
    const x0 = this.width * 0.64;
    const y0 = this.height * 0.8;
    return [0, 1, 2, 3, 4].map((i) => ({ x: x0 + i * c, y: y0 - i * c }));
  }

  private rebuild(): void {
    if (this.width === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.scale, this.scale);
    if (this.look.dark) drawLakeBackdrop(ctx, this.look, this.frame());
    else {
      drawGardenBackdrop(
        ctx,
        this.look,
        this.width,
        this.height,
        null,
        15,
        this.motif ? 'menu' : 'page',
      );
      if (this.motif) this.rakeRingsForFive(ctx);
    }
    this.backdrop = canvas;
    this.sprites = makePieceSprites(this.look, this.cell(), this.scale);
  }

  /** By day the sand round the five is smoothed and raked in rings, as round a rock. */
  private rakeRingsForFive(ctx: CanvasRenderingContext2D): void {
    const points = this.fivePoints();
    const mid = points[2]!;
    const c = this.cell();
    const reach = c * 3.6;
    const smooth = ctx.createRadialGradient(mid.x, mid.y, reach * 0.8, mid.x, mid.y, reach * 1.25);
    smooth.addColorStop(0, this.look.ground[0]);
    smooth.addColorStop(1, 'rgba(233, 223, 202, 0)');
    ctx.fillStyle = smooth;
    ctx.fillRect(mid.x - reach * 1.3, mid.y - reach * 1.3, reach * 2.6, reach * 2.6);
    ctx.lineWidth = Math.max(1.6, c * 0.05);
    for (let k = 0; k < 4; k++) {
      const r = c * 3.05 + k * c * 0.42;
      ctx.strokeStyle = this.look.grooveLight;
      ctx.beginPath();
      ctx.arc(mid.x + 0.8, mid.y + 1, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = this.look.groove;
      ctx.beginPath();
      ctx.arc(mid.x - 0.5, mid.y - 0.6, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  draw(time: number): void {
    if (!this.backdrop || !this.sprites) return;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.look.dark) {
      const frame = this.frame();
      drawMoonPath(ctx, frame, time);
      const water = {
        x: 0,
        y: frame.horizon + this.height * 0.06,
        width: this.motif ? this.width * 0.55 : this.width,
        height: this.height * 0.3,
      };
      const cell = this.cell();
      drawDrifters(
        ctx,
        this.sprites,
        cell,
        [water],
        { horizon: frame.horizon, height: this.height },
        time,
      );
    }
    if (this.motif) this.drawFive(time);
  }

  private drawFive(time: number): void {
    const { ctx, look } = this;
    const sprites = this.sprites!;
    const size = sprites.size;
    const c = this.cell();
    const points = this.fivePoints();
    if (!look.dark) {
      points.forEach((p, i) => {
        const image = sprites.pieces[0]![Math.floor(hash01(i + 3) * PEBBLE_VARIANTS)]!;
        ctx.drawImage(image, p.x - size / 2, p.y - size / 2, size, size);
      });
      return;
    }
    // Five new stars over the five lanterns: the win's moment, remembered.
    const horizon = this.frame().horizon;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(228, 236, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((p, i) => {
      const sx = this.width * 0.62 + (p.x - points[0]!.x) * 0.32;
      const sy = horizon * 0.62 + (p.y - points[0]!.y) * 0.32;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
    points.forEach((p, i) => {
      const sx = this.width * 0.62 + (p.x - points[0]!.x) * 0.32;
      const sy = horizon * 0.62 + (p.y - points[0]!.y) * 0.32;
      const r = 5 + 1.5 * Math.sin(time * 1.7 + i * 2.1);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
      glow.addColorStop(0, 'rgba(255, 250, 230, 0.95)');
      glow.addColorStop(1, 'rgba(255, 230, 170, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r * 3, sy - r * 3, r * 6, r * 6);
    });
    points.forEach((p, i) => {
      const bob = Math.sin(time * 1.1 + i * 1.3) * c * 0.03;
      ctx.drawImage(
        sprites.reflections![0]!,
        p.x - size / 2,
        p.y + c * 0.55 - size / 2,
        size,
        size,
      );
      const halo = sprites.haloSize;
      ctx.drawImage(sprites.halos![0]!, p.x - halo / 2, p.y + bob - halo / 2, halo, halo);
    });
    ctx.restore();
    points.forEach((p, i) => {
      const bob = Math.sin(time * 1.1 + i * 1.3) * c * 0.03;
      ctx.drawImage(sprites.pieces[0]![0]!, p.x - size / 2, p.y + bob - size / 2, size, size);
    });
  }
}
