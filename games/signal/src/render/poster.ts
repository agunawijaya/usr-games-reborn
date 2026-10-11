import type { PosterHandle, PosterOptions } from '@usr-games/kit';
import { printBanner } from '../codecs/banner';
import { CELL_ASPECT, paintSheet } from './machines/printer';
import { paintTelegraph, paintTelegraphGlow } from './machines/telegraph';
import { paletteFor } from './palette';
import { alpha, glow } from './paint';
import { paintCloseDesk, paintStationLight } from './room';

/**
 * Key art for the Hall: the brass key pressed mid-tap, its lamp lit, and behind it a banner of
 * the game's name, printed with the original program's glyphs, unfurling upright.
 */
export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle | void {
  const pal = paletteFor(options.appearance === 'dark' ? 'night' : 'morning');
  const ctx = canvas.getContext('2d')!;
  const ratio = canvas.width / Math.max(1, options.width);
  const print = printBanner('DITS & DAWS');
  let frame = 0;
  const paint = (time: number) => {
    const scale = Math.max(options.width / 1920, options.height / 1080);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.translate((options.width - 1920 * scale) / 2, (options.height - 1080 * scale) / 2);
    ctx.scale(scale, scale);
    const span = { left: 0, right: 1920, top: 0 };
    paintCloseDesk(ctx, span, pal, time);
    // The banner across the back, upright, with a curl at its leading end.
    const across = 300;
    const lineStep = ((across * 0.86) / print.width) * CELL_ASPECT;
    const length = print.rows.length * lineStep + 120;
    const unfurl = options.animate ? Math.min(1, time / 3) : 1;
    ctx.save();
    ctx.translate(960 - length / 2, 110);
    ctx.fillStyle = alpha('#000000', 0.3);
    ctx.fillRect(14, 20, length * unfurl, across);
    ctx.beginPath();
    ctx.rect(0, 0, length * unfurl, across);
    ctx.clip();
    paintSheet(ctx, 0, 0, length, across, pal, {
      print,
      printed: print.rows.length,
      upright: true,
      fromLine: -14,
    });
    ctx.restore();
    paintTelegraph(ctx, 450, 1000, 1.95, pal, { keyDown: 1, armature: 1, lamp: 1 });
    paintStationLight(ctx, span, pal, { x: 700, y: 300, r: 1700 });
    paintTelegraphGlow(ctx, 450, 1000, 1.95, pal, 1);
    // A spark at the contact, where the key closes the circuit.
    glow(ctx, 450 + (250 + 120 + 70) * 1.95, 1000 - 70 * 1.95, 60, alpha('#fff2c4', 0.8), 0.8);
  };
  paint(0);
  if (!options.animate) return;
  const start = performance.now();
  const tick = () => {
    paint((performance.now() - start) / 1000);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(frame) };
}
