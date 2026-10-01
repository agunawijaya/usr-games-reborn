import type { VacuumKind } from '../engine/types';
import type { Coat, Look } from './palette';
import { drawCat } from './sprites/cat';
import { drawDock, drawTangle } from './sprites/things';
import { drawVacuum } from './sprites/vacuum';

/** Small still drawings for menus, intro cards, the legend and the coat picker. */

export type IconSubject =
  VacuumKind | 'sock' | 'cable' | 'dock' | 'loaf' | 'tangle' | 'cat' | 'zoom';

export function iconCanvas(
  subject: IconSubject,
  look: Look,
  coat: Coat,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  paintIcon(canvas, subject, look, coat, width, height);
  return canvas;
}

export function paintIcon(
  canvas: HTMLCanvasElement,
  subject: IconSubject,
  look: Look,
  coat: Coat,
  width: number,
  height: number,
) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const s = Math.min(width, height) * 0.82;
  const cx = width / 2;
  const cy = height / 2 + s * 0.06;
  const time = 1.3;
  switch (subject) {
    case 'cat':
      return drawCat(ctx, cx, cy, s, {
        coat,
        pose: 'sit',
        facing: 1,
        gaze: { x: 0.3, y: 0.4 },
        time,
        look,
      });
    case 'loaf':
      return drawCat(ctx, cx, cy, s, {
        coat,
        pose: 'loaf',
        facing: 1,
        gaze: { x: 0, y: 0 },
        time,
        look,
      });
    case 'zoom':
      return drawCat(ctx, cx, cy, s, {
        coat,
        pose: 'zoom',
        facing: 1,
        gaze: { x: 1, y: 0 },
        time,
        look,
      });
    case 'sock':
      return drawTangle(ctx, cx, cy, s, look, 'sock', 0, [], time, 3);
    case 'cable':
      return drawTangle(ctx, cx, cy, s, look, 'cable', 0, [], time, 5);
    case 'tangle':
      return drawTangle(ctx, cx, cy, s, look, 'wreck', 2, ['basic', 'basic'], time, 7);
    case 'dock':
      return drawDock(ctx, cx, cy, s, look, 3, false, time);
    default:
      return drawVacuum(ctx, cx, cy - s * 0.05, s * 0.95, {
        kind: subject,
        look,
        heading: { x: 0, y: 1 },
        mood: 'calm',
        resting: false,
        full: false,
        time,
        hop: 0,
      });
  }
}
