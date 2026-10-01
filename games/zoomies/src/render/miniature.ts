import type { RoomSpec } from '../engine/room';
import { createLayout } from '../engine/layout';
import { paintStatic } from './floor';
import { cellCenter, fitGeometry } from './geometry';
import { type Coat, LOOKS, type Look, type SceneTheme, vacuumColors } from './palette';
import { circle, ellipse } from './shapes';

/**
 * A room in miniature for the house map: its floor and furniture as they really are, with the
 * vacuums as little discs and the cat as an orange dot, the way a floor plan would show them.
 */
export function paintMiniature(
  canvas: HTMLCanvasElement,
  spec: RoomSpec,
  theme: SceneTheme,
  look: Look,
  coat: Coat,
  width: number,
  height: number,
) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const layout = createLayout(spec.width, spec.height, spec.furniture ?? []);
  const geo = fitGeometry(layout.width, layout.height, width, height, {
    margin: 0.35,
    maxCell: 40,
  });
  paintStatic(canvas, geo, LOOKS[theme][look], layout.furniture, look, ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  const s = geo.cell;
  for (const thing of spec.clutter ?? []) {
    const c = cellCenter(geo, thing.x, thing.y);
    ellipse(ctx, c.x, c.y, s * 0.28, s * 0.16, thing.kind === 'sock' ? '#e86f6a' : '#4a4650');
  }
  if (spec.dock) {
    const c = cellCenter(geo, spec.dock.x, spec.dock.y);
    ctx.fillStyle = look === 'day' ? '#f4f1ea' : '#45434f';
    ctx.fillRect(c.x - s * 0.32, c.y - s * 0.32, s * 0.64, s * 0.64);
  }
  for (const v of spec.vacuums) {
    const c = cellCenter(geo, v.x, v.y);
    const colors = vacuumColors(v.kind, look);
    circle(ctx, c.x, c.y + s * 0.06, s * 0.36, colors.rim);
    circle(ctx, c.x, c.y, s * 0.34, colors.body);
    circle(ctx, c.x, c.y + s * 0.08, s * 0.12, look === 'day' ? '#262a35' : colors.led);
  }
  const cat = cellCenter(geo, spec.cat.x, spec.cat.y);
  circle(ctx, cat.x, cat.y, s * 0.4, coat.fur);
  circle(ctx, cat.x - s * 0.13, cat.y - s * 0.05, s * 0.07, '#2a1d16');
  circle(ctx, cat.x + s * 0.13, cat.y - s * 0.05, s * 0.07, '#2a1d16');
}
