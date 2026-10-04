import type { BoardFrame, Region } from './frame';
import { type Look, PALETTES } from './look';
import { mix, painter, rgba } from './noise';

/**
 * What the board is drawn on, painted once per look and size. By day: a sun-warmed pavement of
 * concrete slabs, grit in the surface, the shade of a tree and old chalk scuffs from earlier
 * games, with two sticks of chalk left by the board. By night: a brick wall with a dark sign board
 * bolted to it for the neon.
 */
export interface GroundScene {
  readonly frame: BoardFrame;
  /** The part of the screen the board may use: the interface covers the rest. */
  readonly region: Region;
  readonly width: number;
  readonly height: number;
  readonly look: Look;
  readonly seed: number;
}

export function paintGround(ctx: CanvasRenderingContext2D, scene: GroundScene) {
  if (scene.look === 'chalk') paintPavement(ctx, scene);
  else paintNightWall(ctx, scene);
}

// ---------------------------------------------------------------------------------- pavement

function paintPavement(ctx: CanvasRenderingContext2D, scene: GroundScene) {
  const { width, height, frame, seed } = scene;
  const p = PALETTES.chalk;
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, mix(p.ground[0], '#ffffff', 0.12));
  base.addColorStop(1, p.ground[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Slabs: big squares with a little tone of their own, and the joints between them.
  const slab = Math.max(frame.spacing * 2.6, 150);
  const random = painter(seed * 17 + 3);
  const offsetX = (frame.x % slab) - slab;
  const offsetY = (frame.y % slab) - slab;
  for (let y = offsetY; y < height; y += slab) {
    for (let x = offsetX; x < width; x += slab) {
      ctx.fillStyle = rgba(random() < 0.5 ? '#ffffff' : '#6d6455', 0.03 + random() * 0.05);
      ctx.fillRect(x, y, slab, slab);
    }
  }
  // Aggregate: a fine scatter of light and dark grit.
  const specks = Math.round((width * height) / 260);
  for (let i = 0; i < specks; i++) {
    const tone = random();
    ctx.fillStyle =
      tone < 0.5
        ? rgba('#5d5546', 0.12 + random() * 0.14)
        : rgba('#ffffff', 0.12 + random() * 0.18);
    const size = 0.8 + random() * 1.8;
    ctx.fillRect(random() * width, random() * height, size, size);
  }
  ctx.strokeStyle = rgba(p.joint, 0.7);
  ctx.lineWidth = 3;
  for (let x = offsetX; x < width; x += slab) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = offsetY; y < height; y += slab) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba('#ffffff', 0.25);
  ctx.lineWidth = 1;
  for (let x = offsetX; x < width; x += slab) {
    ctx.beginPath();
    ctx.moveTo(x + 2.5, 0);
    ctx.lineTo(x + 2.5, height);
    ctx.stroke();
  }
  paintCracks(ctx, scene, random);
  paintScuffs(ctx, scene, random);
  paintShade(ctx, scene, random);
  paintChalkSticks(ctx, scene);
}

function paintCracks(ctx: CanvasRenderingContext2D, scene: GroundScene, random: () => number) {
  ctx.strokeStyle = rgba('#5d5546', 0.35);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let x = random() * scene.width;
    let y = random() * scene.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += (random() - 0.5) * 40;
      y += 6 + random() * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Faint chalk from earlier games: scuffs, a stray arrow, half a hopscotch square. */
function paintScuffs(ctx: CanvasRenderingContext2D, scene: GroundScene, random: () => number) {
  const { frame, width, height } = scene;
  const colours = ['#f2a7c3', '#9fd3f2', '#f7e08a', '#b5e7a0', '#ffffff'];
  for (let i = 0; i < 26; i++) {
    const x = random() * width;
    const y = random() * height;
    const inside =
      x > frame.x - frame.spacing &&
      x < frame.x + frame.width + frame.spacing &&
      y > frame.y - frame.spacing &&
      y < frame.y + frame.height + frame.spacing;
    if (inside) continue;
    ctx.fillStyle = rgba(colours[i % colours.length]!, 0.08 + random() * 0.1);
    ctx.beginPath();
    ctx.ellipse(x, y, 20 + random() * 60, 6 + random() * 18, random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Half a hopscotch court running off the left edge.
  ctx.strokeStyle = rgba('#ffffff', 0.32);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const hx = Math.min(frame.x - frame.spacing * 2.2, width * 0.12);
  if (hx > 40) {
    const cell = frame.spacing * 0.95;
    for (let k = 0; k < 4; k++) {
      ctx.strokeRect(hx - cell, height - (k + 1) * cell - 40, cell, cell);
    }
  }
}

/** The shade of a tree out of view: soft, dappled, cool. */
function paintShade(ctx: CanvasRenderingContext2D, scene: GroundScene, random: () => number) {
  const { width, height } = scene;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 16; i++) {
    const x = width * (0.78 + random() * 0.3);
    const y = height * (random() * 0.55 - 0.1);
    const r = 60 + random() * 140;
    const shade = ctx.createRadialGradient(x, y, 0, x, y, r);
    shade.addColorStop(0, 'rgba(120, 128, 150, 0.22)');
    shade.addColorStop(1, 'rgba(120, 128, 150, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  const sun = ctx.createRadialGradient(
    width * 0.25,
    height * 0.2,
    0,
    width * 0.25,
    height * 0.2,
    width * 0.8,
  );
  sun.addColorStop(0, 'rgba(255, 244, 214, 0.28)');
  sun.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);
}

/** Two sticks of chalk, one per player colour, lying beside the board. */
function paintChalkSticks(ctx: CanvasRenderingContext2D, scene: GroundScene) {
  const { frame, region } = scene;
  const s = frame.spacing;
  // Beside the board's bottom right corner if there is room before the interface, else under it.
  const beside = frame.x + frame.width + s * 1.95 <= region.x + region.width;
  const baseX = beside ? frame.x + frame.width + s * 0.55 : frame.x + s * 0.2;
  const baseY = beside ? frame.y + frame.height + s * 0.25 : frame.y + frame.height + s * 0.75;
  if (baseX + s * 1.4 > scene.width || baseY + s * 0.6 > scene.height) return;
  PALETTES.chalk.players.forEach((player, i) => {
    ctx.save();
    ctx.translate(baseX + i * s * 0.35, baseY + i * s * 0.28);
    ctx.rotate(-0.5 + i * 0.35);
    ctx.fillStyle = 'rgba(60, 50, 35, 0.25)';
    ctx.beginPath();
    ctx.roundRect(4, 5, s * 0.95, s * 0.2, s * 0.1);
    ctx.fill();
    const body = ctx.createLinearGradient(0, 0, 0, s * 0.2);
    body.addColorStop(0, mix(player.ink, '#ffffff', 0.45));
    body.addColorStop(1, player.ink);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(0, 0, s * 0.95, s * 0.2, s * 0.1);
    ctx.fill();
    ctx.fillStyle = mix(player.ink, '#ffffff', 0.7);
    ctx.beginPath();
    ctx.ellipse(s * 0.95, s * 0.1, s * 0.035, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------- night

function paintNightWall(ctx: CanvasRenderingContext2D, scene: GroundScene) {
  const { width, height, frame, seed } = scene;
  const p = PALETTES.neon;
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, p.ground[0]);
  base.addColorStop(1, p.ground[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Bricks in running bond, each a shade apart, barely seen.
  const random = painter(seed * 29 + 5);
  const brickW = 74;
  const brickH = 30;
  for (let row = 0; row * brickH < height; row++) {
    const shift = (row % 2) * (brickW / 2);
    for (let x = -brickW + shift; x < width; x += brickW) {
      const tone = random();
      ctx.fillStyle = rgba(tone < 0.5 ? '#2a2550' : '#181530', 0.35 + tone * 0.35);
      ctx.fillRect(x + 2, row * brickH + 2, brickW - 4, brickH - 4);
    }
  }
  // The glow of the street: violet from the left, teal from the right.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [cx, colour] of [
    [0, 'rgba(150, 70, 255, 0.10)'],
    [width, 'rgba(40, 200, 255, 0.08)'],
  ] as const) {
    const glow = ctx.createRadialGradient(cx, height * 0.4, 0, cx, height * 0.4, width * 0.6);
    glow.addColorStop(0, colour);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  // The sign board: dark metal, a bevel, four bolts.
  const pad = frame.spacing * 0.62;
  const bx = frame.x - pad;
  const by = frame.y - pad;
  const bw = frame.width + pad * 2;
  const bh = frame.height + pad * 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#0d0c1a';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 18);
  ctx.fill();
  ctx.restore();
  const sheen = ctx.createLinearGradient(bx, by, bx, by + bh);
  sheen.addColorStop(0, '#1b1932');
  sheen.addColorStop(1, '#0c0b18');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.roundRect(bx + 3, by + 3, bw - 6, bh - 6, 15);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 170, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const [x, y] of [
    [bx + 18, by + 18],
    [bx + bw - 18, by + 18],
    [bx + 18, by + bh - 18],
    [bx + bw - 18, by + bh - 18],
  ] as const) {
    ctx.fillStyle = '#2d2a48';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // A cable running off the board to the transformer.
  ctx.strokeStyle = '#05040a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx + bw - 40, by + bh);
  ctx.bezierCurveTo(
    bx + bw - 30,
    by + bh + 80,
    bx + bw + 60,
    by + bh + 40,
    bx + bw + 90,
    height + 20,
  );
  ctx.stroke();
}
