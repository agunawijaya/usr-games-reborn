import { PALETTES, type Look } from './palette';
import { drawShip } from './sprites';

/**
 * The Lantern large on the game menu, turned towards the chart with her lamp thrown across it,
 * riding a slow swell. Still under reduced motion.
 */

export interface HeroShip {
  resize(width: number, height: number): void;
  setLook(look: Look, reducedMotion: boolean): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

const HEADING = (52 * Math.PI) / 180;

export function startHeroShip(
  canvas: HTMLCanvasElement,
  look: Look,
  reducedMotion: boolean,
): HeroShip {
  const ctx = canvas.getContext('2d')!;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let current = look;
  let still = reducedMotion;
  let visible = true;
  let frame = 0;
  const draw = (time: number) => {
    if (width < 4 || height < 4) return;
    const t = still ? 1.3 : time / 1000;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // The ship sits below and between the menu and the chart, her light reaching into the chart.
    const size = Math.min(width * 0.16, height * 0.26);
    const bob = still ? 0 : Math.sin(t * 0.8) * size * 0.03;
    const sway = still ? 0 : Math.sin(t * 0.5) * 0.03;
    // Keep clear of the menu column, which is at most 560 px wide with its margin.
    const x = Math.max(width * 0.44, 560 + size * 0.45);
    drawShip(ctx, x, height - size * 0.75 + bob, size, PALETTES[current], current, t, {
      beamReach: 3.4,
      heading: HEADING + sway,
      shieldUp: false,
      shieldFraction: 1,
      shrouded: false,
      moored: false,
      ember: false,
    });
  };
  const loop = (time: number) => {
    frame = requestAnimationFrame(loop);
    if (visible) draw(time);
  };
  frame = requestAnimationFrame(loop);
  return {
    resize(nextWidth, nextHeight) {
      ratio = Math.min(2, window.devicePixelRatio || 1);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(performance.now());
    },
    setLook(nextLook, nextReduced) {
      current = nextLook;
      still = nextReduced;
    },
    setVisible(next) {
      visible = next;
    },
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
