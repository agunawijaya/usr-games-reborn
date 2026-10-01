import { createRng, withAlpha } from '@usr-games/kit';
import type { AmbienceFrame, AmbienceScene } from './ambience';
import { drawGlow, grainTexture } from './sprites';

/**
 * Manual Page: the room is a printed manual on a desk. By day, warm paper with a fine grain
 * and the punched holes of a binder; by night the same pages under a desk lamp, its warm
 * pool breathing gently while dust drifts through the light.
 */

interface Mote {
  x: number;
  y: number;
  speed: number;
  drift: number;
  size: number;
  phase: number;
}

const GRAIN_TILE = 256;
const BINDER_X = 26;

export function manualScene(seed: string): AmbienceScene {
  let width = 0;
  let height = 0;
  let grain: CanvasPattern | null = null;
  let motes: Mote[] = [];

  function prepare(context: CanvasRenderingContext2D, ink: string) {
    const random = createRng(`manual-grain:${seed}`);
    grain = context.createPattern(
      grainTexture(GRAIN_TILE, GRAIN_TILE, ink, 0.012, random.next),
      'repeat',
    );
  }

  function drawBinderHoles(
    context: CanvasRenderingContext2D,
    { tokens, appearance }: AmbienceFrame,
  ) {
    const dark = appearance === 'dark';
    for (const fraction of [0.2, 0.5, 0.8]) {
      const y = height * fraction;
      const hole = context.createRadialGradient(BINDER_X - 2, y - 2, 1, BINDER_X, y, 9);
      hole.addColorStop(0, dark ? '#02050c' : withAlpha(tokens.shadow, 0.55));
      hole.addColorStop(1, tokens.bg2);
      context.fillStyle = hole;
      context.beginPath();
      context.arc(BINDER_X, y, 8, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = withAlpha(tokens.lineStrong, dark ? 0.35 : 0.3);
      context.stroke();
    }
    context.strokeStyle = withAlpha(tokens.line, dark ? 0.7 : 1);
    context.beginPath();
    context.moveTo(52.5, 0);
    context.lineTo(52.5, height);
    context.stroke();
  }

  /** The desk lamp sits just off the top-left corner; its light breathes a little. */
  function lampStrength(t: number): number {
    return 1 + 0.035 * Math.sin(t * 0.9) + 0.012 * Math.sin(t * 3.7);
  }

  function drawLamp(context: CanvasRenderingContext2D, { tokens, t }: AmbienceFrame) {
    const strength = lampStrength(t);
    const x = width * 0.14;
    const y = -height * 0.18;
    const radius = Math.max(width, height) * 1.05;
    const pool = context.createRadialGradient(x, y, 0, x, y, radius);
    pool.addColorStop(0, withAlpha(tokens.glow, 0.26 * strength));
    pool.addColorStop(0.38, withAlpha(tokens.glow, 0.1 * strength));
    pool.addColorStop(0.7, withAlpha(tokens.glow, 0.025));
    pool.addColorStop(1, withAlpha(tokens.glow, 0));
    context.fillStyle = pool;
    context.fillRect(0, 0, width, height);
  }

  function drawMotes(context: CanvasRenderingContext2D, { tokens, t }: AmbienceFrame) {
    for (const mote of motes) {
      const y = (((mote.y - t * mote.speed) % height) + height) % height;
      const x = mote.x + Math.sin(t * 0.3 + mote.phase) * mote.drift;
      // Motes only catch the light near the lamp.
      const light = Math.max(
        0,
        1 - Math.hypot(x - width * 0.14, y + height * 0.18) / (Math.max(width, height) * 0.8),
      );
      drawGlow(
        context,
        tokens.glow,
        x,
        y,
        mote.size * 3,
        light * (0.35 + 0.25 * Math.sin(t + mote.phase)),
      );
    }
  }

  function drawDaylight(context: CanvasRenderingContext2D, { tokens }: AmbienceFrame) {
    const light = context.createRadialGradient(
      width * 0.85,
      -height * 0.1,
      0,
      width * 0.85,
      -height * 0.1,
      Math.max(width, height) * 0.9,
    );
    light.addColorStop(0, 'rgba(255, 253, 244, 0.65)');
    light.addColorStop(1, withAlpha(tokens.bg, 0));
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);
  }

  return {
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      grain = null;
      const random = createRng(`manual-motes:${seed}`);
      motes = Array.from({ length: 42 }, () => ({
        x: random.float(0, width * 0.7),
        y: random.float(0, height),
        speed: random.float(3, 9),
        drift: random.float(6, 24),
        size: random.float(0.8, 1.8),
        phase: random.float(0, Math.PI * 2),
      }));
    },
    draw(context, frame) {
      const dark = frame.appearance === 'dark';
      if (!grain) prepare(context, frame.tokens.ink);
      const base = context.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, frame.tokens.bg);
      base.addColorStop(1, frame.tokens.bg2);
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);
      if (grain) {
        context.globalAlpha = dark ? 0.35 : 0.8;
        context.fillStyle = grain;
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 1;
      }
      if (dark) {
        drawLamp(context, frame);
        drawMotes(context, frame);
      } else {
        drawDaylight(context, frame);
      }
      drawBinderHoles(context, frame);
    },
  };
}
