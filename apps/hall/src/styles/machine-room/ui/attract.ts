import { readToken, withAlpha } from '@usr-games/kit';
import type { CatalogEntry } from '../../../catalog/catalog';
import { drawStill, posterArtFor, posterStill } from '../../../core/art/art';
import { gameAccent, tokensFor, type ThemeState } from '../../../core/palette';
import type { RunningPreview } from './previews';

/**
 * The attract preview. A native game supplies its own silent demo. A hosted game cannot run
 * inside a tile, so once it has sent a snapshot of itself over the bridge the tile shows that;
 * until then (and for games without a demo) the Hall draws the emblem being traced on the
 * little screen, like a plotter warming up.
 */
export async function startPreview(
  entry: CatalogEntry,
  theme: ThemeState,
  host: HTMLElement,
): Promise<RunningPreview> {
  if (entry.loadModule) {
    const module = await entry.loadModule();
    const tokens = tokensFor(theme);
    const demo = module.demo(`attract:${entry.manifest.id}`, {
      appearance: theme.appearance,
      style: theme.style,
      theme: theme.theme,
      tokens,
      accent: gameAccent(entry.manifest.accent, theme),
      reducedMotion: theme.reducedMotion,
    });
    demo.setVisible(true);
    demo.element.classList.add('proc__preview');
    return { element: demo.element, destroy: () => demo.destroy() };
  }
  if (posterArtFor(entry).kind === 'game') return snapshotPreview(entry, theme, host);
  return emblemTrace(entry, theme, host);
}

const TRACE_SECONDS = 1.8;
const HOLD_SECONDS = 1.2;

function measurePath(pathData: string): number {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  document.body.append(svg);
  const length = path.getTotalLength();
  svg.remove();
  return length;
}

function previewCanvas(host: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'proc__preview';
  canvas.setAttribute('aria-hidden', 'true');
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = host.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  return { canvas, context: canvas.getContext('2d'), ratio, width, height };
}

function previewAccent(entry: CatalogEntry, theme: ThemeState): string {
  const stroke = readToken(document.documentElement, 'accent') || tokensFor(theme).accent;
  return theme.theme === 'sunset' ? gameAccent(entry.manifest.accent, theme) : stroke;
}

/** A sweeping scan line, the preview's heartbeat. */
function drawScanLine(
  context: CanvasRenderingContext2D,
  now: number,
  width: number,
  height: number,
  colour: string,
) {
  const scanY = (((now / 1000) % 1.6) / 1.6) * height;
  context.fillStyle = colour;
  context.fillRect(0, scanY, width, 2);
}

/** The snapshot a hosted game sent of itself, with the scan line running over it. */
function snapshotPreview(
  entry: CatalogEntry,
  theme: ThemeState,
  host: HTMLElement,
): RunningPreview {
  const { canvas, context, ratio, width, height } = previewCanvas(host);
  const still = posterStill(entry, theme.appearance, width, height);
  const scan = withAlpha(previewAccent(entry, theme), 0.18);
  let frame = 0;

  function draw(now: number) {
    frame = requestAnimationFrame(draw);
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    drawStill(context, still, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawScanLine(context, now, width, height, scan);
  }
  frame = requestAnimationFrame(draw);
  return { element: canvas, destroy: () => cancelAnimationFrame(frame) };
}

function emblemTrace(entry: CatalogEntry, theme: ThemeState, host: HTMLElement): RunningPreview {
  const { canvas, context, ratio, width, height } = previewCanvas(host);
  const path = new Path2D(entry.manifest.emblem);
  const length = measurePath(entry.manifest.emblem);
  const accent = previewAccent(entry, theme);
  const scale = (Math.min(width, height) * 0.62) / 48;
  let frame = 0;
  const started = performance.now();

  function draw(now: number) {
    frame = requestAnimationFrame(draw);
    if (!context) return;
    const t = ((now - started) / 1000) % (TRACE_SECONDS + HOLD_SECONDS);
    const progress = Math.min(1, t / TRACE_SECONDS);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    drawScanLine(context, now, width, height, withAlpha(accent, 0.08));
    context.save();
    context.translate(width / 2 - 24 * scale, height / 2 - 24 * scale);
    context.scale(scale, scale);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.setLineDash([length * progress, length]);
    context.strokeStyle = accent;
    if (theme.appearance === 'dark') {
      context.shadowColor = accent;
      context.shadowBlur = 10;
    }
    context.stroke(path);
    context.restore();
  }
  frame = requestAnimationFrame(draw);
  return { element: canvas, destroy: () => cancelAnimationFrame(frame) };
}
