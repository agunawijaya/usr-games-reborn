import { PALETTES, type Look } from '../src/render/palette';
import { drawShip } from '../src/render/sprites';

/**
 * `?scene=ships`: the Lantern and the Ember drawn large and at game size, in both looks, for
 * critiquing the art. Not part of the game.
 */
export function shipScene(stage: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  stage.append(canvas);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ratio, ratio);
  const half = width / 2;
  (['night', 'chart'] as Look[]).forEach((look, i) => {
    const p = PALETTES[look];
    ctx.fillStyle = p.bg;
    ctx.fillRect(i * half, 0, half, height);
    const base = { shieldUp: false, shieldFraction: 1, shrouded: false, moored: false };
    drawShip(ctx, i * half + half * 0.28, height * 0.42, 230, p, look, 1.3, {
      ...base,
      heading: 0,
      ember: false,
    });
    drawShip(ctx, i * half + half * 0.72, height * 0.42, 200, p, look, 1.3, {
      ...base,
      heading: 0,
      ember: true,
    });
    const row = height * 0.86;
    [0, Math.PI / 4, Math.PI / 2, Math.PI].forEach((heading, k) => {
      drawShip(ctx, i * half + half * (0.12 + k * 0.17), row, 52, p, look, 1.3, {
        ...base,
        heading,
        ember: false,
        shieldUp: k === 2,
      });
    });
    drawShip(ctx, i * half + half * 0.86, row, 52, p, look, 1.3, {
      ...base,
      heading: Math.PI / 2,
      ember: true,
    });
  });
}
