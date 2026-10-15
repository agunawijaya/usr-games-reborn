import { createRng } from '@usr-games/kit';
import { drawFish } from './fish/draw';
import { speciesFor } from './fish/species';
import type { PondLayout } from './layout';
import type { Look } from './look';
import { clipToPond, moonPosition, sunPosition } from './scenery';
import { star } from './rivals/common';
import { drawSprite, glowSprite, sprite } from './sprite-cache';

const KOI_STEPS = 8;

/**
 * The water's surface, alive: drifting wave lines, glints of morning sun or the moon's path
 * breaking into ripples, koi gliding deep below, and the rings a cast or a falling drop sends
 * out. All of it is a pure function of time, so a still frame can be asked for at any moment.
 */

type Ctx = CanvasRenderingContext2D;

export interface Ripple {
  x: number;
  y: number;
  /** Seconds, on the same clock as `time`. */
  start: number;
  /** 1 for a splash, smaller for a drip. */
  strength: number;
}

interface Wave {
  x: number;
  y: number;
  length: number;
  phase: number;
}

const waveCache = new WeakMap<PondLayout, Wave[]>();

function wavesFor(layout: PondLayout): Wave[] {
  let waves = waveCache.get(layout);
  if (!waves) {
    const rng = createRng('gone-fishing:waves');
    waves = Array.from({ length: 70 }, () => {
      const angle = rng.float(0, Math.PI * 2);
      const reach = Math.sqrt(rng.float(0, 0.92));
      const x = layout.pond.cx + Math.cos(angle) * layout.pond.rx * reach;
      const y = layout.pond.cy + Math.sin(angle) * layout.pond.ry * reach;
      // Lines further away are shorter: the far water is seen at a lower angle.
      const depth = (y - (layout.pond.cy - layout.pond.ry)) / (layout.pond.ry * 2);
      return { x, y, length: (14 + depth * 34) * layout.s, phase: rng.float(0, Math.PI * 2) };
    });
    waveCache.set(layout, waves);
  }
  return waves;
}

export function drawWater(
  ctx: Ctx,
  layout: PondLayout,
  look: Look,
  time: number,
  ripples: readonly Ripple[],
  stillness = 1,
): void {
  ctx.save();
  clipToPond(ctx, layout);
  drawKoi(ctx, layout, look, time * stillness);
  drawWaves(ctx, layout, look, time * stillness);
  if (look.moon) drawMoonPath(ctx, layout, look, time * stillness);
  else drawGlints(ctx, layout, look, time * stillness);
  drawRipples(ctx, layout, look, time, ripples);
  ctx.restore();
}

function drawWaves(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  ctx.strokeStyle = look.water.line;
  ctx.lineCap = 'round';
  for (const wave of wavesFor(layout)) {
    const life = (Math.sin(time * 0.6 + wave.phase) + 1) / 2;
    const drift = Math.sin(time * 0.35 + wave.phase * 2) * 8 * layout.s;
    ctx.globalAlpha = 0.15 + life * 0.55;
    ctx.lineWidth = 1.4 * layout.s;
    ctx.beginPath();
    const x = wave.x + drift;
    ctx.moveTo(x - wave.length / 2, wave.y);
    ctx.quadraticCurveTo(x, wave.y - 2.5 * layout.s, x + wave.length / 2, wave.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Morning glints: the sun's reflection broken into twinkling points. */
function drawGlints(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  const sun = sunPosition(layout);
  const rng = createRng('gone-fishing:glints');
  ctx.fillStyle = look.water.glint;
  for (let i = 0; i < 26; i++) {
    const x = sun.x + rng.float(-0.12, 0.12) * layout.pond.rx * 2;
    const y = layout.pond.farShore(sun.x) + rng.float(0.05, 0.75) * layout.pond.ry;
    const twinkle = Math.max(0, Math.sin(time * rng.float(1.5, 3.2) + rng.float(0, 6)));
    if (twinkle < 0.35) continue;
    ctx.globalAlpha = twinkle;
    star(ctx, x, y, (2 + twinkle * 4.5) * layout.s);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The moon's path: bright strokes down the water under the moon, wobbling apart and together. */
function drawMoonPath(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  const moon = moonPosition(layout);
  const top = layout.pond.farShore(moon.x) + 6 * layout.s;
  const bottom = layout.pond.cy + layout.pond.ry * 0.55;
  const rng = createRng('gone-fishing:moonpath');
  ctx.strokeStyle = look.moon!.path;
  ctx.lineCap = 'round';
  const rows = 26;
  for (let i = 0; i < rows; i++) {
    const t = i / rows;
    const y = top + (bottom - top) * t;
    const width = (16 + t * 80) * layout.s * rng.float(0.5, 1.2);
    const wobble = Math.sin(time * 1.4 + i * 0.9) * (4 + t * 14) * layout.s;
    ctx.globalAlpha = (1 - t) * 0.75 * (0.55 + 0.45 * Math.sin(time * 2 + i));
    ctx.lineWidth = (1.6 + t * 2.4) * layout.s;
    // Each row breaks into two or three pieces, as moonlight does on a ruffled pond.
    const pieces = 1 + (i % 3);
    for (let k = 0; k < pieces; k++) {
      const segment = width / pieces;
      const x = moon.x - width / 2 + segment * k + wobble * (k % 2 ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(x + segment * 0.12, y);
      ctx.lineTo(x + segment * 0.88, y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/** Three koi gliding in slow loops deep below; by night they glow. */
function drawKoi(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  const koi = speciesFor(13);
  const { pond, s } = layout;
  for (let i = 0; i < 3; i++) {
    const direction = i % 2 ? -1 : 1;
    const angle = time * (0.07 + i * 0.02) * direction + i * 2.1;
    const rx = pond.rx * (0.55 - i * 0.1);
    const ry = pond.ry * (0.42 - i * 0.06);
    const x = pond.cx + Math.cos(angle) * rx;
    const y = pond.cy + pond.ry * 0.1 + Math.sin(angle) * ry;
    const vx = -Math.sin(angle) * rx * direction;
    const vy = Math.cos(angle) * ry * direction;
    const heading = Math.atan2(vy, vx);
    const facingLeft = vx < 0;
    const length = (64 - i * 8) * s;
    if (look.koi) {
      const r = length * 0.9;
      ctx.drawImage(glowSprite(look.koi.glow, 1), x - r, y - r, r * 2, r * 2);
    }
    // The swim cycle in eight drawings, painted once and stepped through.
    const step =
      Math.floor((((time * 4 + i) % (Math.PI * 2)) / (Math.PI * 2)) * KOI_STEPS) % KOI_STEPS;
    const image = sprite(`koi:${look.id}:${step}`, length * 1.1, length * 0.6, 2, (paint) =>
      drawFish(paint, koi, {
        x: 0,
        y: 0,
        length,
        pose: { arch: 0, wiggle: 0.5, phase: (step / KOI_STEPS) * Math.PI * 2 },
        gold: look.gold,
      }),
    );
    ctx.save();
    ctx.globalAlpha = look.koi ? 0.55 : 0.32;
    drawSprite(
      ctx,
      image,
      x,
      y,
      length * 1.1,
      length * 0.6,
      facingLeft ? heading - Math.PI : heading,
      facingLeft,
    );
    ctx.restore();
  }
}

function drawRipples(
  ctx: Ctx,
  layout: PondLayout,
  look: Look,
  time: number,
  ripples: readonly Ripple[],
): void {
  ctx.strokeStyle = look.dark ? 'rgba(210, 225, 255, 0.8)' : 'rgba(255, 255, 255, 0.9)';
  for (const ripple of ripples) {
    const age = time - ripple.start;
    if (age < 0 || age > 2.4) continue;
    for (let ring = 0; ring < 3; ring++) {
      const t = age - ring * 0.22;
      if (t <= 0) continue;
      const radius = (10 + t * 70 * ripple.strength) * layout.s;
      ctx.globalAlpha = Math.max(0, 1 - t / 2.2) * 0.8;
      ctx.lineWidth = (2.4 - ring * 0.6) * layout.s;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, radius, radius * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
