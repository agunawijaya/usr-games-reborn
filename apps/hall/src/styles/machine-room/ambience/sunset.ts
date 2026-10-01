import { createRng, withAlpha } from '@usr-games/kit';
import type { AmbienceFrame, AmbienceScene } from './ambience';
import { drawGlow } from './sprites';

/**
 * Sunset Lab: a 1970s campus computer lab. At golden hour, low sun pours through venetian
 * blinds in slanted stripes and dust sparkles in them. After dark the room turns indigo, the
 * window fills with stars and neon from the corridor spills magenta and teal across the floor.
 */

interface Speck {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

const BLIND_PITCH = 58;
const BLIND_ANGLE = 0.36;

export function sunsetScene(seed: string): AmbienceScene {
  let width = 0;
  let height = 0;
  let dust: Speck[] = [];
  let stars: Speck[] = [];

  function drawSky(context: CanvasRenderingContext2D, { tokens, appearance }: AmbienceFrame) {
    const base = context.createLinearGradient(0, 0, 0, height);
    if (appearance === 'dark') {
      base.addColorStop(0, '#0c0824');
      base.addColorStop(0.55, tokens.bg);
      base.addColorStop(1, tokens.bg2);
    } else {
      base.addColorStop(0, '#f8ead0');
      base.addColorStop(0.5, tokens.bg);
      base.addColorStop(1, tokens.bg2);
    }
    context.fillStyle = base;
    context.fillRect(0, 0, width, height);
  }

  function drawSun(context: CanvasRenderingContext2D, { tokens }: AmbienceFrame) {
    const x = width * 0.88;
    const y = height * 0.06;
    const glow = context.createRadialGradient(x, y, 0, x, y, width * 0.62);
    glow.addColorStop(0, withAlpha(tokens.glow, 0.62));
    glow.addColorStop(0.35, withAlpha(tokens.glow, 0.22));
    glow.addColorStop(1, withAlpha(tokens.glow, 0));
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }

  /** Light through the blinds: slanted bright stripes that creep as the sun sinks. */
  function drawBlinds(context: CanvasRenderingContext2D, { t, appearance }: AmbienceFrame) {
    const dark = appearance === 'dark';
    const color = dark ? '#3ef0d8' : '#fff4d4';
    const strength = dark ? 0.035 : 0.17;
    context.save();
    context.translate(width * 0.28, -height * 0.1);
    context.rotate(BLIND_ANGLE);
    const drift = (t * 3) % BLIND_PITCH;
    const span = Math.hypot(width, height) * 1.2;
    for (let offset = -BLIND_PITCH * 2; offset < span; offset += BLIND_PITCH) {
      const x = offset + drift;
      const band = context.createLinearGradient(0, 0, 0, span);
      band.addColorStop(0, withAlpha(color, 0));
      band.addColorStop(0.25, withAlpha(color, strength));
      band.addColorStop(0.7, withAlpha(color, strength * 0.6));
      band.addColorStop(1, withAlpha(color, 0));
      context.fillStyle = band;
      context.fillRect(x, 0, BLIND_PITCH * 0.46, span);
    }
    context.restore();
  }

  function drawDust(context: CanvasRenderingContext2D, { t }: AmbienceFrame) {
    for (const speck of dust) {
      const y = (((speck.y + t * speck.speed) % height) + height) % height;
      const x = speck.x + Math.sin(t * 0.4 + speck.phase) * 14;
      const twinkle = 0.25 + 0.35 * Math.max(0, Math.sin(t * 1.3 + speck.phase));
      drawGlow(context, '#fff1c2', x, y, speck.size * 3.2, twinkle);
    }
  }

  function drawNight(context: CanvasRenderingContext2D, { tokens, t }: AmbienceFrame) {
    for (const star of stars) {
      const twinkle = 0.35 + 0.45 * Math.max(0, Math.sin(t * star.speed + star.phase));
      context.fillStyle = withAlpha('#f4edff', twinkle);
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    const pulse = 1 + 0.08 * Math.sin(t * 0.6);
    drawGlow(context, tokens.accent, width * 0.06, height * 1.02, width * 0.42, 0.34 * pulse);
    drawGlow(
      context,
      tokens.accent2,
      width * 0.96,
      height * 0.02,
      width * 0.36,
      0.22 * (2 - pulse),
    );
  }

  return {
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      const random = createRng(`sunset:${seed}`);
      dust = Array.from({ length: 46 }, () => ({
        x: random.float(width * 0.25, width),
        y: random.float(0, height),
        size: random.float(0.6, 1.6),
        phase: random.float(0, Math.PI * 2),
        speed: random.float(2, 7),
      }));
      stars = Array.from({ length: 110 }, () => ({
        x: random.float(0, width),
        // Denser near the top of the window, thinning toward the horizon.
        y: height * 0.5 * random.next() ** 1.6,
        size: random.chance(0.12) ? 2 : 1,
        phase: random.float(0, Math.PI * 2),
        speed: random.float(0.6, 2.2),
      }));
    },
    draw(context, frame) {
      drawSky(context, frame);
      if (frame.appearance === 'dark') {
        drawNight(context, frame);
        drawBlinds(context, frame);
      } else {
        drawSun(context, frame);
        drawBlinds(context, frame);
        drawDust(context, frame);
      }
    },
  };
}
