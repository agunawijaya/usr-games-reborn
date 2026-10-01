import { createRng, withAlpha } from '@usr-games/kit';
import type { AmbienceFrame, AmbienceScene } from './ambience';
import { drawGlow } from './sprites';

/**
 * Phosphor: the room is the glass of a terminal. At night it is a CRT with a slow refresh
 * band rolling down and two racks of status lights at the edges; by day the same glass sits
 * in a sunlit lab, with window glare sliding across it.
 */

interface Led {
  x: number;
  y: number;
  amber: boolean;
  period: number;
  phase: number;
  duty: number;
  /** Disk-activity lights chatter instead of blinking. */
  busy: boolean;
}

const RACK_WIDTH = 30;
const LED_SPACING = 17;

export function phosphorScene(seed: string): AmbienceScene {
  let leds: Led[] = [];
  let width = 0;
  let height = 0;

  function layoutLeds() {
    const random = createRng(`phosphor-leds:${seed}`);
    leds = [];
    const columns = [12, 26, width - 26, width - 12];
    for (const x of columns) {
      for (let y = 96; y < height - 24; y += LED_SPACING) {
        if (!random.chance(0.72)) continue;
        leds.push({
          x,
          y,
          amber: random.chance(0.22),
          period: random.float(0.8, 5),
          phase: random.float(0, 5),
          duty: random.float(0.15, 0.85),
          busy: random.chance(0.08),
        });
      }
    }
  }

  function ledIsOn(led: Led, t: number): boolean {
    if (led.busy) return Math.sin(t * 29 + led.phase * 7) + Math.sin(t * 11 + led.phase) > 0.4;
    return ((t + led.phase) % led.period) / led.period < led.duty;
  }

  function drawBase(context: CanvasRenderingContext2D, { tokens, appearance }: AmbienceFrame) {
    const glow = context.createRadialGradient(
      width * 0.5,
      height * 0.3,
      0,
      width * 0.5,
      height * 0.3,
      Math.max(width, height) * 0.85,
    );
    glow.addColorStop(0, tokens.bg2);
    glow.addColorStop(1, tokens.bg);
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    if (appearance === 'dark') {
      const vignette = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.35,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.78,
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    }
  }

  /** Two soft bands of window light sliding across the glass, only in daylight. */
  function drawGlare(context: CanvasRenderingContext2D, t: number) {
    const travel = width * 1.8;
    for (const [offset, bandWidth, strength] of [
      [0, width * 0.22, 0.38],
      [width * 0.33, width * 0.08, 0.3],
    ] as const) {
      const x = ((t * 7 + offset) % travel) - width * 0.4;
      const band = context.createLinearGradient(x, 0, x + bandWidth, 0);
      band.addColorStop(0, 'rgba(255, 255, 255, 0)');
      band.addColorStop(0.5, `rgba(255, 255, 255, ${strength})`);
      band.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = band;
      context.beginPath();
      context.moveTo(x + height * 0.45, 0);
      context.lineTo(x + bandWidth + height * 0.45, 0);
      context.lineTo(x + bandWidth, height);
      context.lineTo(x, height);
      context.closePath();
      context.fill();
    }
  }

  function drawRacks(context: CanvasRenderingContext2D, { tokens, appearance, t }: AmbienceFrame) {
    const dark = appearance === 'dark';
    context.strokeStyle = withAlpha(tokens.lineStrong, dark ? 0.32 : 0.45);
    context.lineWidth = 1;
    for (const x of [4, width - RACK_WIDTH - 4]) {
      context.beginPath();
      context.roundRect(x + 0.5, 84.5, RACK_WIDTH, height - 100, 4);
      context.stroke();
    }
    for (const led of leds) {
      const on = ledIsOn(led, t);
      const color = led.amber ? tokens.accent2 : tokens.accent;
      if (dark) drawGlow(context, color, led.x, led.y, 9, on ? 0.75 : 0.08);
      context.fillStyle = withAlpha(color, on ? 0.95 : dark ? 0.18 : 0.22);
      context.fillRect(led.x - 1.5, led.y - 1, 3, 2);
    }
  }

  /** The electron beam's refresh, a faint brighter band rolling down the tube. */
  function drawRefresh(context: CanvasRenderingContext2D, { tokens, t }: AmbienceFrame) {
    const y = ((t % 9) / 9) * (height + 260) - 130;
    const band = context.createLinearGradient(0, y - 130, 0, y + 130);
    band.addColorStop(0, withAlpha(tokens.glow, 0));
    band.addColorStop(0.5, withAlpha(tokens.glow, 0.045));
    band.addColorStop(1, withAlpha(tokens.glow, 0));
    context.fillStyle = band;
    context.fillRect(0, y - 130, width, 260);
  }

  return {
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      layoutLeds();
    },
    draw(context, frame) {
      drawBase(context, frame);
      if (frame.appearance === 'light') drawGlare(context, frame.t);
      drawRacks(context, frame);
      if (frame.appearance === 'dark') drawRefresh(context, frame);
    },
  };
}
