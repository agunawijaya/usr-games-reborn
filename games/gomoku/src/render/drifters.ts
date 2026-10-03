import type { Rect } from './geometry';
import { seeded } from './noise';
import type { PieceSprites } from './pieces';

/**
 * Lanterns far out on the lake, smaller with distance, drifting slowly and fading at the edges
 * of their stretch of water (by night only). The same few every time: seeded.
 */
export function drawDrifters(
  ctx: CanvasRenderingContext2D,
  sprites: PieceSprites,
  cell: number,
  regions: readonly Rect[],
  view: { horizon: number; height: number },
  time: number,
): void {
  if (!sprites.halos || !sprites.reflections) return;
  const random = seeded(808);
  for (const region of regions) {
    if (region.width < cell * 2 || region.height <= 0) continue;
    const count = Math.round((region.width * region.height) / (cell * cell * 13));
    for (let i = 0; i < count; i++) {
      const speed = (random() - 0.5) * cell * 0.12;
      const x =
        region.x +
        ((((random() * region.width + time * speed) % region.width) + region.width) % region.width);
      const y = region.y + random() * region.height;
      const side = random() < 0.62 ? 0 : 1;
      const phase = random() * 6.28;
      const scale = 0.42 + ((y - view.horizon) / (view.height - view.horizon)) * 0.3;
      const edge = Math.min(1, Math.min(x - region.x, region.x + region.width - x) / cell);
      const bob = Math.sin(time * 1.1 + phase) * cell * 0.02;
      const size = sprites.size * scale;
      ctx.save();
      ctx.globalAlpha = 0.8 * edge;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(
        sprites.reflections[side]!,
        x - size / 2,
        y + cell * 0.55 * scale - size / 2,
        size,
        size,
      );
      const halo = sprites.haloSize * scale;
      ctx.drawImage(sprites.halos[side]!, x - halo / 2, y + bob - halo / 2, halo, halo);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(sprites.pieces[side]![0]!, x - size / 2, y + bob - size / 2, size, size);
      ctx.restore();
    }
  }
}
