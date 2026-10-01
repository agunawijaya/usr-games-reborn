import type { Appearance, ThemeId, ThemeTokens } from '@usr-games/kit';
import { manualScene } from './manual';
import { phosphorScene } from './phosphor';
import { sunsetScene } from './sunset';

/**
 * The room behind the interface. Each theme paints its own ambience on a full-screen canvas:
 * a CRT with rack lights, a manual under a lamp, a lab in low sun. Scenes are cheap by design
 * (pre-rendered sprites, a few dozen moving things, 30 frames a second at most) and stop
 * entirely when the tab is hidden or the player prefers reduced motion.
 */

export interface AmbienceFrame {
  /** Seconds since the scene started. */
  t: number;
  width: number;
  height: number;
  tokens: ThemeTokens;
  appearance: Appearance;
}

export interface AmbienceScene {
  resize(width: number, height: number, tokens: ThemeTokens, appearance: Appearance): void;
  draw(context: CanvasRenderingContext2D, frame: AmbienceFrame): void;
}

export interface AmbienceState {
  theme: ThemeId;
  appearance: Appearance;
  tokens: ThemeTokens;
  reducedMotion: boolean;
  /** Screenshots pin the clock so every frame is reproducible. */
  frozenAt?: number;
}

const SCENES: Record<ThemeId, (seed: string) => AmbienceScene> = {
  phosphor: phosphorScene,
  manual: manualScene,
  sunset: sunsetScene,
};

const FRAME_INTERVAL = 1000 / 30;
const MAX_PIXEL_RATIO = 1.5;

export interface AmbienceController {
  update(state: AmbienceState): void;
  destroy(): void;
}

export function createAmbience(host: HTMLElement, initial: AmbienceState): AmbienceController {
  let state = initial;
  let scene = SCENES[state.theme]('machine-room');
  let canvas = makeCanvas();
  let frameHandle = 0;
  let lastFrame = 0;
  const started = performance.now();

  function makeCanvas(): HTMLCanvasElement {
    const element = document.createElement('canvas');
    element.className = 'ambience';
    element.setAttribute('aria-hidden', 'true');
    host.append(element);
    return element;
  }

  function sizeCanvas(target: HTMLCanvasElement) {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = window.innerWidth;
    const height = window.innerHeight;
    target.width = Math.round(width * ratio);
    target.height = Math.round(height * ratio);
    scene.resize(width, height, state.tokens, state.appearance);
    return { ratio, width, height };
  }

  let size = sizeCanvas(canvas);

  function drawFrame(now: number) {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(size.ratio, 0, 0, size.ratio, 0, 0);
    const t = state.frozenAt ?? (now - started) / 1000;
    scene.draw(context, {
      t,
      width: size.width,
      height: size.height,
      tokens: state.tokens,
      appearance: state.appearance,
    });
  }

  const animated = () => !state.reducedMotion && state.frozenAt === undefined && !document.hidden;

  function loop(now: number) {
    frameHandle = requestAnimationFrame(loop);
    if (now - lastFrame < FRAME_INTERVAL) return;
    lastFrame = now;
    drawFrame(now);
  }

  function restart() {
    cancelAnimationFrame(frameHandle);
    drawFrame(performance.now());
    if (animated()) frameHandle = requestAnimationFrame(loop);
  }

  const onResize = () => {
    size = sizeCanvas(canvas);
    restart();
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', restart);
  restart();

  /** Cross-fades by laying the new room over the old one, then removing the old canvas. */
  function swapScene() {
    const previous = canvas;
    scene = SCENES[state.theme]('machine-room');
    canvas = makeCanvas();
    size = sizeCanvas(canvas);
    restart();
    if (state.reducedMotion) {
      previous.remove();
      return;
    }
    canvas.classList.add('ambience--entering');
    requestAnimationFrame(() => canvas.classList.remove('ambience--entering'));
    setTimeout(() => previous.remove(), 600);
  }

  return {
    update(next) {
      const themeChanged = next.theme !== state.theme || next.appearance !== state.appearance;
      state = next;
      if (themeChanged) swapScene();
      else {
        scene.resize(size.width, size.height, state.tokens, state.appearance);
        restart();
      }
    },
    destroy() {
      cancelAnimationFrame(frameHandle);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', restart);
      host.querySelectorAll('canvas.ambience').forEach((element) => element.remove());
    },
  };
}

/** Paints one moment of a room onto a canvas, for still previews such as the style picker. */
export function drawAmbienceStill(
  canvas: HTMLCanvasElement,
  state: Pick<AmbienceState, 'theme' | 'appearance' | 'tokens'>,
  t: number,
  width = 1920,
  height = 1080,
): void {
  const scene = SCENES[state.theme]('machine-room');
  canvas.width = width;
  canvas.height = height;
  scene.resize(width, height, state.tokens, state.appearance);
  const context = canvas.getContext('2d');
  if (context)
    scene.draw(context, { t, width, height, tokens: state.tokens, appearance: state.appearance });
}
