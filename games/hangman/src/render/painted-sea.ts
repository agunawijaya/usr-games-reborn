import type { BeachLayout } from './layout';
import { type BeachPalette, rgba } from './palette';
import type { SeaState } from './sea';

/**
 * The beach without WebGL: the same sky, sea and sand as smooth gradients with a moving foam
 * line, so the game stays complete and readable on a browser that cannot run the shader.
 */
export function paintPaintedSea(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  sea: SeaState,
) {
  const { width, height, horizonY, shoreY } = layout;
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY);

  const water = ctx.createLinearGradient(0, horizonY, 0, shoreY);
  water.addColorStop(0, palette.seaDeep);
  water.addColorStop(0.6, palette.seaMid);
  water.addColorStop(1, palette.seaShallow);
  ctx.fillStyle = water;
  ctx.fillRect(0, horizonY, width, shoreY - horizonY);

  const sand = ctx.createLinearGradient(0, shoreY, 0, height);
  sand.addColorStop(0, palette.sandWet);
  sand.addColorStop(0.15, palette.sandDry);
  sand.addColorStop(1, palette.sandShade);
  ctx.fillStyle = sand;
  ctx.fillRect(0, shoreY, width, height - shoreY);

  const breath = (Math.sin((sea.time / 7) * Math.PI * 2) + 1) / 2;
  const reach =
    shoreY + (8 + 18 * breath) * layout.scale + sea.surge * (layout.castle.baseY - shoreY);
  ctx.fillStyle = rgba(palette.seaShallow, 0.55);
  ctx.fillRect(0, shoreY, width, reach - shoreY);
  ctx.fillStyle = rgba(palette.look === 'moonlit' ? palette.glow : palette.foam, 0.7);
  ctx.fillRect(0, reach - 2 * layout.scale, width, 3 * layout.scale);
}
