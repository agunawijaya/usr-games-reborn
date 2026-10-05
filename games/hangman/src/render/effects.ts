import { sectionAnchor } from './castle';
import type { SectionId } from './castle-model';
import type { BeachLayout } from './layout';
import { type BeachPalette, rgba } from './palette';

/**
 * Short-lived moments painted over the castle: sand sliding off a section the sea is taking,
 * spray from the cresting swell, a sparkle where a right letter added something, and the win
 * flourish: a rainbow mist at midday, a fan of glowing spray under the moon. Every particle is
 * a pure function of its seed and age, so a moment can be held still for a picture.
 */
export interface Effects {
  slides: { section: SectionId; age: number }[];
  /** The wrong letter's swell, 0 to 1, as the sea renders it: spray flies off its lip. */
  swell: number;
  sparkles: { x: number; y: number; age: number }[];
  flourish: { age: number } | null;
}

export const NO_EFFECTS: Effects = { slides: [], swell: 0, sparkles: [], flourish: null };

const SLIDE_SECONDS = 1.8;

function hash(n: number): number {
  const v = Math.sin(n * 91.345 + 17.17) * 47453.5453;
  return v - Math.floor(v);
}

/**
 * The sea's effects happen behind the castle (spray off the swell, the win flourish rising
 * where the last wave stopped short); the sand's happen in front of it.
 */
export function paintEffects(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  effects: Effects,
  time: number,
  layer: 'behind' | 'front',
) {
  if (layer === 'behind') {
    if (effects.swell > 0 && effects.swell < 1)
      paintCrestSpray(ctx, layout, palette, effects.swell, time);
    if (effects.flourish) {
      if (palette.look === 'moonlit') paintGlowingFan(ctx, layout, palette, effects.flourish.age);
      else paintRainbowMist(ctx, layout, palette, effects.flourish.age);
    }
    return;
  }
  for (const slide of effects.slides) paintSlide(ctx, layout, palette, slide.section, slide.age);
  for (const sparkle of effects.sparkles) paintSparkle(ctx, layout, palette, sparkle);
}

/** Grains pouring down a section's face and spreading at its foot. */
function paintSlide(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  section: SectionId,
  age: number,
) {
  if (age < 0 || age > SLIDE_SECONDS) return;
  const [ax, ay] = sectionAnchor(layout.castle, section);
  const unit = layout.castle.width;
  const fade = 1 - age / SLIDE_SECONDS;
  for (let i = 0; i < 70; i++) {
    const seed = i + section.length * 31;
    const start = hash(seed) * 0.5;
    const t = Math.max(0, age - start);
    if (t <= 0) continue;
    const spread = (hash(seed + 1) - 0.5) * unit * 0.22;
    const x = ax + spread + (hash(seed + 2) - 0.5) * unit * 0.12 * t;
    const y = ay + (hash(seed + 3) - 0.3) * unit * 0.08 + 0.5 * 260 * layout.scale * t * t;
    const floor = layout.castle.baseY - unit * 0.12;
    const size = (1.5 + hash(seed + 4) * 2.5) * layout.scale;
    ctx.fillStyle = rgba(i % 4 === 0 ? palette.castleLight : palette.castleWet, 0.85 * fade);
    ctx.fillRect(x, Math.min(y, floor + hash(seed + 5) * unit * 0.08), size, size);
  }
}

/** The swell's line on screen, the same formula the shader uses. */
function swellLine(layout: BeachLayout, swell: number): number {
  const along = 0.35 + 0.65 * swell;
  return layout.horizonY + along * (layout.shoreY - layout.horizonY);
}

function paintCrestSpray(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  swell: number,
  time: number,
) {
  const y = swellLine(layout, swell);
  const strength = Math.sin(swell * Math.PI);
  const night = palette.look === 'moonlit';
  const color = night ? palette.glow : palette.foam;
  ctx.save();
  if (night) ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    const across = (hash(i) - 0.5) * 2;
    const width = layout.width * 0.26 * Math.exp(-across * across * 0.6);
    const x = layout.castle.x + across * width * 1.6;
    const cycle = (time * (0.7 + hash(i + 3) * 0.8) + hash(i + 7)) % 1;
    const rise = Math.sin(cycle * Math.PI) * (16 + hash(i + 9) * 56) * layout.scale * strength;
    const drift = cycle * (hash(i + 11) - 0.3) * 30 * layout.scale;
    const size = (1.4 + hash(i + 13) * 3) * layout.scale;
    ctx.fillStyle = rgba(color, (0.85 - cycle * 0.6) * strength);
    ctx.beginPath();
    ctx.arc(x + drift, y - rise, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintSparkle(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  sparkle: { x: number; y: number; age: number },
) {
  const life = 0.9;
  if (sparkle.age < 0 || sparkle.age > life) return;
  const t = sparkle.age / life;
  const r = (8 + 26 * t) * layout.scale;
  const color = palette.look === 'moonlit' ? palette.lantern : '#ffffff';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 1 - t);
  ctx.lineWidth = 2 * layout.scale;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + t;
    ctx.beginPath();
    ctx.moveTo(sparkle.x + Math.cos(a) * r * 0.3, sparkle.y + Math.sin(a) * r * 0.3);
    ctx.lineTo(sparkle.x + Math.cos(a) * r, sparkle.y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** Midday's win: the wave stops short and leaves a rainbow in the mist over the castle. */
function paintRainbowMist(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  age: number,
) {
  const appear = Math.min(1, age / 0.8);
  const unit = layout.castle.width;
  const cx = layout.castle.x;
  const cy = layout.castle.baseY - unit * 0.12;
  const radius = unit * 0.78;
  const bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#748ffc', '#b197fc'];
  ctx.save();
  ctx.globalAlpha = 0.42 * appear;
  ctx.lineWidth = unit * 0.026;
  bands.forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - i * unit * 0.024, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
  });
  ctx.restore();
  // Mist: soft drifting droplets fanning up from the wave's edge.
  for (let i = 0; i < 90; i++) {
    const a = Math.PI * (1.05 + hash(i) * 0.9);
    const travel = Math.min(1, age * (0.6 + hash(i + 1) * 0.6));
    const r = unit * (0.35 + 0.5 * travel) * (0.7 + hash(i + 2) * 0.4);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.75 + travel * travel * 30 * layout.scale;
    ctx.fillStyle = rgba(palette.foam, 0.55 * (1 - travel * 0.6) * appear);
    ctx.beginPath();
    ctx.arc(x, y, (2 + hash(i + 3) * 4) * layout.scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Moonlit Tide's win: the wave rears up short of the castle and bursts into glowing spray. */
function paintGlowingFan(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  age: number,
) {
  const unit = layout.castle.width;
  const cx = layout.castle.x;
  const cy = layout.shoreY + (layout.castle.baseY - layout.shoreY) * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, cy - unit * 0.2, 0, cx, cy - unit * 0.2, unit * 0.9);
  glow.addColorStop(0, rgba(palette.glow, 0.32 * Math.min(1, age * 2)));
  glow.addColorStop(1, rgba(palette.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - unit, cy - unit, unit * 2, unit * 2);
  // A fountain: droplets thrown up and outwards in a fan, falling back as they fade.
  ctx.lineCap = 'round';
  const gravity = unit * 1.6;
  for (let i = 0; i < 240; i++) {
    const a = Math.PI * (1.14 + hash(i) * 0.72);
    const speed = (0.95 + hash(i + 1) * 0.6) * unit;
    const t = Math.max(0, Math.min(1.4, age - hash(i + 2) * 0.3));
    if (t <= 0) continue;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const x = cx + (hash(i + 5) - 0.5) * unit * 0.7 + vx * t * 0.8;
    const y = cy + vy * t + 0.5 * gravity * t * t;
    // Once a droplet drops back below the wave it came from, the sea has it again.
    if (y > cy + unit * 0.02) continue;
    const fade = Math.max(0, 1 - t / 1.4);
    const trail = 0.035;
    ctx.strokeStyle = rgba(i % 6 === 0 ? '#ffffff' : palette.glow, 0.85 * fade);
    ctx.lineWidth = (2 + hash(i + 4) * 2.6) * layout.scale;
    ctx.beginPath();
    ctx.moveTo(x - vx * trail, y - (vy + gravity * t) * trail);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}
