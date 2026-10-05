import { paintScallop, paintStarfish } from './ornaments';
import type { BeachLayout } from './layout';
import { type BeachPalette, mixHex, rgba } from './palette';

/**
 * The beach around the castle: the headland and its lighthouse on the horizon, the tide gauge
 * that counts the waves, the wet patch of sand the word is written in, a bucket and spade, and
 * shells strewn about. All drawn in code.
 */
export interface BeachProps {
  /** Waves taken so far: the gauge's float rises one notch per wave. */
  waves: number;
  wavesAllowed: number;
  /** 0 to 1: the lighthouse beam swung round onto the word (the Lighthouse help). */
  beam: number;
  /** Draw the damp patch behind the word row. */
  wordPatch: boolean;
  /** Draw the tide gauge (not on the title screen). */
  gauge: boolean;
}

export const NO_PROPS: BeachProps = {
  waves: 0,
  wavesAllowed: 7,
  beam: 0,
  wordPatch: false,
  gauge: false,
};

function hash(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function paintBackProps(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  props: BeachProps,
  time: number,
) {
  paintHeadland(ctx, layout, palette, props, time);
  paintStrewnShells(ctx, layout, palette);
  if (props.wordPatch) paintWordPatch(ctx, layout, palette);
  if (props.gauge) paintTideGauge(ctx, layout, palette, props, time);
}

export function paintFrontProps(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  props: BeachProps,
  time: number,
) {
  paintBucketAndSpade(ctx, layout, palette);
  if (props.beam > 0) paintBeamOnWord(ctx, layout, palette, props.beam, time);
}

// ——— the headland and the lighthouse ———

export function lighthouseLamp(layout: BeachLayout): [number, number] {
  const s = layout.scale;
  const x = layout.headlandX + 40 * s;
  return [x, headlandRidge(layout, x) + 4 * s - 93 * s];
}

/** The headland's ridge line at a given x: a gentle rise from the sea to a rounded top. */
function headlandRidge(layout: BeachLayout, x: number): number {
  const s = layout.scale;
  const start = layout.headlandX - 190 * s;
  const t = Math.min(1, Math.max(0, (x - start) / (layout.width - start)));
  const rise = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5);
  return layout.horizonY + 12 * s - rise * 74 * s + Math.sin(t * 9) * 3 * s;
}

function paintHeadland(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  props: BeachProps,
  time: number,
) {
  const s = layout.scale;
  const night = palette.look === 'moonlit';
  const start = layout.headlandX - 190 * s;
  const base = layout.horizonY + 12 * s;
  ctx.beginPath();
  ctx.moveTo(start, base);
  for (let x = start; x <= layout.width + 8; x += 6 * s) ctx.lineTo(x, headlandRidge(layout, x));
  ctx.lineTo(layout.width + 8, base + 6 * s);
  ctx.closePath();
  const hill = ctx.createLinearGradient(0, layout.horizonY - 70 * s, 0, base);
  hill.addColorStop(0, palette.headland);
  hill.addColorStop(1, mixHex(palette.headland, palette.seaDeep, 0.5));
  ctx.fillStyle = hill;
  ctx.fill();
  // Rocks at the foot of the headland, foam breaking softly round them.
  for (let i = 0; i < 7; i++) {
    const rx = start + 10 * s + i * 30 * s + hash(i) * 10 * s;
    const ry = base + hash(i + 9) * 3 * s;
    const width = (12 + hash(i + 3) * 10) * s;
    ctx.beginPath();
    ctx.ellipse(rx, ry, width, (6 + hash(i + 5) * 5) * s, 0, Math.PI, 0);
    ctx.fillStyle = mixHex(palette.headland, '#000000', 0.25);
    ctx.fill();
    const surge = 0.5 + 0.5 * Math.sin(time * 1.2 + i * 1.7);
    ctx.fillStyle = rgba(night ? palette.glow : palette.foam, (night ? 0.35 : 0.7) * surge);
    ctx.beginPath();
    ctx.ellipse(rx, ry + 1 * s, width * 1.15, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  paintLighthouse(ctx, layout, palette, props, time);
}

function paintLighthouse(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  props: BeachProps,
  time: number,
) {
  const s = layout.scale;
  const night = palette.look === 'moonlit';
  const x = layout.headlandX + 40 * s;
  const foot = headlandRidge(layout, x) + 4 * s;
  const height = 84 * s;
  const bottomHalf = 11 * s;
  const topHalf = 7.5 * s;
  const white = night ? '#c9cfe4' : '#ffffff';
  const red = night ? '#a34a48' : '#e2483d';
  ctx.beginPath();
  ctx.moveTo(x - bottomHalf, foot);
  ctx.lineTo(x - topHalf, foot - height);
  ctx.lineTo(x + topHalf, foot - height);
  ctx.lineTo(x + bottomHalf, foot);
  ctx.closePath();
  ctx.fillStyle = white;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = red;
  for (let band = 0; band < 3; band++) {
    ctx.fillRect(x - 20 * s, foot - height * (0.18 + band * 0.3), 40 * s, height * 0.14);
  }
  // Shade on the side away from the light.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  if (night) ctx.fillRect(x - 20 * s, foot - height, 20 * s, height);
  else ctx.fillRect(x, foot - height, 20 * s, height);
  ctx.restore();
  // Gallery and lamp room.
  ctx.fillStyle = night ? '#2a2f45' : '#2f3c48';
  ctx.fillRect(x - 10 * s, foot - height - 2 * s, 20 * s, 3 * s);
  const lamp: [number, number] = [x, foot - height - 9 * s];
  ctx.fillStyle = night ? palette.lantern : '#fff5d1';
  ctx.fillRect(x - 6 * s, foot - height - 14 * s, 12 * s, 11 * s);
  ctx.beginPath();
  ctx.moveTo(x - 8 * s, foot - height - 14 * s);
  ctx.lineTo(x, foot - height - 22 * s);
  ctx.lineTo(x + 8 * s, foot - height - 14 * s);
  ctx.closePath();
  ctx.fillStyle = red;
  ctx.fill();

  if (night || props.beam > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(...lamp, 0, ...lamp, 46 * s);
    halo.addColorStop(0, rgba(palette.lantern, night ? 0.7 : 0.5));
    halo.addColorStop(1, rgba(palette.lantern, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(lamp[0] - 46 * s, lamp[1] - 46 * s, 92 * s, 92 * s);
    if (night && props.beam === 0) {
      // The beam sweeping slowly out to sea.
      const angle = Math.PI - 0.42 + Math.sin(time * 0.35) * 0.12;
      paintBeam(ctx, lamp, angle, layout.width * 0.3, 0.16, palette, 0.22);
    }
    ctx.restore();
  }
}

function paintBeam(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  angle: number,
  length: number,
  spread: number,
  palette: BeachPalette,
  strength: number,
) {
  const [x, y] = from;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - spread / 2) * length, y + Math.sin(angle - spread / 2) * length);
  ctx.lineTo(x + Math.cos(angle + spread / 2) * length, y + Math.sin(angle + spread / 2) * length);
  ctx.closePath();
  const beam = ctx.createRadialGradient(x, y, 0, x, y, length);
  beam.addColorStop(0, rgba(palette.lantern, strength));
  beam.addColorStop(1, rgba(palette.lantern, 0));
  ctx.fillStyle = beam;
  ctx.fill();
}

/** The Lighthouse help: the beam swings down onto the word in the sand. */
function paintBeamOnWord(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  amount: number,
  time: number,
) {
  const lamp = lighthouseLamp(layout);
  const target: [number, number] = [
    layout.word.x + layout.word.width / 2,
    layout.word.y + layout.word.height / 2,
  ];
  const angle = Math.atan2(target[1] - lamp[1], target[0] - lamp[0]);
  const length = Math.hypot(target[0] - lamp[0], target[1] - lamp[1]) * 1.1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flicker = 0.9 + 0.1 * Math.sin(time * 9);
  paintBeam(ctx, lamp, angle, length, 0.22, palette, 0.35 * amount * flicker);
  ctx.restore();
}

// ——— the tide gauge ———

function paintTideGauge(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  props: BeachProps,
  time: number,
) {
  const s = layout.scale;
  const { x, topY, bottomY } = layout.gauge;
  const night = palette.look === 'moonlit';
  const width = 22 * s;
  const wood = night ? '#5a4a44' : '#a77c55';
  const woodDark = night ? '#3a302c' : '#7a5636';

  // The post's reflection in the wet sand.
  ctx.fillStyle = rgba(woodDark, 0.25);
  ctx.fillRect(x - width / 2, bottomY, width, 40 * s);
  const post = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  post.addColorStop(0, night ? woodDark : wood);
  post.addColorStop(0.5, night ? wood : mixHex(wood, '#ffffff', 0.15));
  post.addColorStop(1, woodDark);
  ctx.fillStyle = post;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, topY, width, bottomY - topY, [6 * s, 6 * s, 0, 0]);
  ctx.fill();

  // Notches for each wave, the last one painted red: the castle falls there.
  const marks = props.wavesAllowed;
  const span = bottomY - topY - 40 * s;
  const markY = (n: number) => bottomY - 20 * s - (span * n) / marks;
  ctx.font = `600 ${Math.max(13, Math.round(21 * s))}px 'Fredoka Variable', Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (let n = 1; n <= marks; n++) {
    const y = markY(n);
    const last = n === marks;
    ctx.fillStyle = last ? (night ? '#ff8a7a' : '#d6372b') : night ? '#e9e2d8' : '#fffaf0';
    ctx.fillRect(x - width / 2, y - 2 * s, width * (last ? 1 : 0.6), 4 * s);
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = night ? 'rgba(8,12,30,0.85)' : 'rgba(40,60,70,0.55)';
    ctx.strokeText(String(n), x - width / 2 - 8 * s, y);
    ctx.fillStyle = last ? (night ? '#ffb3a6' : '#ffe2dc') : night ? '#f0ebe2' : '#ffffff';
    ctx.fillText(String(n), x - width / 2 - 8 * s, y);
  }
  // Barnacles and a trail of weed at the foot.
  ctx.fillStyle = rgba(night ? '#8fa0a8' : '#e8e2d2', 0.8);
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(
      x - width / 2 + hash(i) * width,
      bottomY - hash(i + 4) * 26 * s,
      (1.6 + hash(i + 8) * 2) * s,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // The float rides up the post, one notch per wave.
  const level = Math.min(marks, Math.max(0, props.waves));
  const bob = Math.sin(time * 2.2) * 2 * s;
  const fy = markY(level) + bob;
  const float = night ? '#ff9b5e' : '#ff7a2f';
  ctx.beginPath();
  ctx.ellipse(x, fy, width * 0.95, 9 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = float;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, fy - 3 * s, width * 0.95, 6 * s, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', night ? 0.25 : 0.45);
  ctx.fill();
  if (night) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, fy, 0, x, fy, 30 * s);
    glow.addColorStop(0, rgba(float, 0.35));
    glow.addColorStop(1, rgba(float, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - 30 * s, fy - 30 * s, 60 * s, 60 * s);
    ctx.restore();
  }
}

// ——— the damp patch the word is written in ———

function paintWordPatch(ctx: CanvasRenderingContext2D, layout: BeachLayout, palette: BeachPalette) {
  const s = layout.scale;
  const { word } = layout;
  const night = palette.look === 'moonlit';
  const cx = word.x + word.width / 2;
  const cy = word.y + word.height / 2;
  const rx = word.width / 2 + 60 * s;
  const ry = word.height / 2 + 24 * s;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const wobble = 1 + 0.035 * Math.sin(a * 5 + 1) + 0.025 * Math.sin(a * 11 + 2);
    const px = cx + Math.cos(a) * rx * wobble;
    const py = cy + Math.sin(a) * ry * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const damp = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  damp.addColorStop(0, rgba(palette.sandWet, night ? 0.9 : 0.75));
  damp.addColorStop(0.75, rgba(palette.sandWet, night ? 0.75 : 0.55));
  damp.addColorStop(1, rgba(palette.sandWet, 0));
  ctx.fillStyle = damp;
  ctx.fill();
}

// ——— little things on the sand ———

function paintStrewnShells(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
) {
  const s = layout.scale;
  const spots: [number, number, number][] = [
    [0.06, 0.62, 0],
    [0.17, 0.57, 1],
    [0.27, 0.66, 2],
    [0.08, 0.74, 3],
    [0.93, 0.7, 4],
    [0.83, 0.64, 5],
    [0.97, 0.82, 6],
  ];
  for (const [fx, fy, i] of spots) {
    const x = fx * layout.width;
    const y = fy * layout.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((hash(i) - 0.5) * 1.4);
    // A soft shadow so things sit on the sand.
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(2 * s, 4 * s, 13 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (i % 3 === 0)
      paintScallop(ctx, 12 * s, i % 2 ? palette.shellCream : palette.shellPink, palette);
    else if (i % 3 === 1) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = palette.pebble;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-3 * s, -2 * s, 4 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else paintStarfish(ctx, 13 * s, palette);
    ctx.restore();
  }
}

function paintBucketAndSpade(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
) {
  const s = layout.scale;
  const night = palette.look === 'moonlit';
  const x = layout.width * 0.085;
  const y = layout.height * 0.9;
  const blue = night ? '#3b6f9e' : '#2f9be0';
  const blueDark = night ? '#28507a' : '#1c74b3';

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.ellipse(x + 30 * s, y + 6 * s, 90 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // The spade, stuck in at a slant.
  ctx.save();
  ctx.translate(x + 95 * s, y - 4 * s);
  ctx.rotate(0.32);
  ctx.fillStyle = night ? '#c9a04f' : '#ffc23b';
  ctx.fillRect(-4 * s, -120 * s, 8 * s, 100 * s);
  ctx.beginPath();
  ctx.roundRect(-14 * s, -132 * s, 28 * s, 14 * s, 6 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20 * s, -24 * s);
  ctx.lineTo(20 * s, -24 * s);
  ctx.quadraticCurveTo(22 * s, 6 * s, 0, 16 * s);
  ctx.quadraticCurveTo(-22 * s, 6 * s, -20 * s, -24 * s);
  ctx.fillStyle = night ? '#b0414a' : '#ff5a6a';
  ctx.fill();
  ctx.restore();

  // The bucket, its ridges like the towers it made.
  const top = y - 78 * s;
  ctx.beginPath();
  ctx.moveTo(x - 44 * s, top);
  ctx.lineTo(x - 34 * s, y);
  ctx.lineTo(x + 34 * s, y);
  ctx.lineTo(x + 44 * s, top);
  ctx.closePath();
  const body = ctx.createLinearGradient(x - 44 * s, 0, x + 44 * s, 0);
  body.addColorStop(0, night ? blueDark : blue);
  body.addColorStop(0.35, night ? blue : mixHex(blue, '#ffffff', 0.25));
  body.addColorStop(1, blueDark);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', night ? 0.15 : 0.35);
  ctx.lineWidth = 2 * s;
  for (const t of [0.3, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(x - 44 * s + 10 * s * t, top + 78 * s * t);
    ctx.lineTo(x + 44 * s - 10 * s * t, top + 78 * s * t);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(x, top, 44 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = blueDark;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, top + 2 * s, 38 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = mixHex(palette.sandDry, palette.sandShade, 0.4);
  ctx.fill();
  ctx.strokeStyle = night ? '#9aa6bd' : '#f4f4f4';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.ellipse(x, top, 48 * s, 40 * s, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}
