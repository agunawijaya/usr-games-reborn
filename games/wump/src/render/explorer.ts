import type { Look } from './look';

/**
 * The explorer: a caver in an orange caving suit, helmet and headlamp, a climbing harness with its
 * carabiners, a coil of rope across the chest, knee pads and heavy boots, a pack on the back with a
 * quiver of fluffy-tailed sleep darts, and a lantern held up to see by. A cartoon, but kitted out
 * the way a real caver would be. Drawn on a figure 100 units tall standing on (x, y), facing right
 * unless `facing` is −1; `lift` raises the lantern arm (1 = high), `lean` tilts the whole figure.
 */

export interface ExplorerPose {
  x: number;
  y: number;
  height: number;
  lift: number;
  lean: number;
  /** Faces left (−1) or right (1). */
  facing: -1 | 1;
  time: number;
}

type P = { x: number; y: number };

function hand(pose: ExplorerPose): P {
  return { x: 22 + pose.lift * 6, y: -62 - pose.lift * 22 };
}

/** Where the lantern hangs, so the room can be lit from it. */
export function lanternPoint(pose: ExplorerPose): { x: number; y: number } {
  const u = pose.height / 100;
  const h = hand(pose);
  return { x: pose.x + pose.facing * (h.x + 1) * u, y: pose.y + (h.y + 13) * u };
}

export function drawExplorer(ctx: CanvasRenderingContext2D, pose: ExplorerPose, look: Look): void {
  const u = pose.height / 100;
  const kit = look.caver;
  const ink = look.outline;
  const line = look.dark ? 0 : Math.max(1.1, u * 1.5) / u;
  const breathe = Math.sin(pose.time * 2.1) * 0.5;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.lean * 0.12);
  ctx.scale(pose.facing * u, u);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /** Fills a path, then inks its outline on paper. */
  const shape = (fill: string | CanvasGradient, draw: () => void, outline = true) => {
    ctx.beginPath();
    draw();
    ctx.fillStyle = fill;
    ctx.fill();
    if (line > 0 && outline) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = line;
      ctx.stroke();
    }
  };
  /** A limb as a thick bent stroke, inked round its edge on paper. */
  const limb = (points: P[], width: number, color: string) => {
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length - 1; i++) {
        const a = points[i]!;
        const b = points[i + 1]!;
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      const last = points[points.length - 1]!;
      ctx.lineTo(last.x, last.y);
    };
    if (line > 0) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = width + line * 2;
      trace();
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    trace();
    ctx.stroke();
  };
  /** Light comes from the lantern, up and to the front: shade the back of each form. */
  const sideLit = (base: string, shade: string, from: number, to: number) => {
    const gradient = ctx.createLinearGradient(from, 0, to, 0);
    gradient.addColorStop(0, shade);
    gradient.addColorStop(0.55, base);
    gradient.addColorStop(1, base);
    return gradient;
  };

  drawPack(ctx, kit, shape, look);
  // The far arm, hanging, its gloved hand resting by the harness.
  limb(
    [
      { x: -11, y: -66 + breathe },
      { x: -17, y: -55 },
      { x: -14, y: -44 },
    ],
    7.5,
    kit.suitShade,
  );
  shape(kit.glove, () => ctx.ellipse(-14, -42.5, 4, 4.6, 0.2, 0, Math.PI * 2));

  drawLegs(ctx, kit, limb, shape);
  drawTorso(ctx, kit, shape, sideLit, breathe);
  drawHarness(ctx, kit, shape, line, ink);
  drawRope(ctx, kit, line, ink, breathe);
  drawHead(ctx, kit, look, shape, breathe, pose.time);

  // The lantern arm, raised, and the lantern hanging from the gloved hand.
  const h = hand(pose);
  limb(
    [
      { x: 11, y: -66 + breathe },
      { x: 21, y: -60 },
      { x: h.x - 1, y: h.y + 4 },
    ],
    7.5,
    kit.suit,
  );
  shape(kit.glove, () => ctx.ellipse(h.x, h.y + 1, 4.4, 4.2, 0, 0, Math.PI * 2));
  drawLantern(ctx, h.x + 1, h.y + 13, look, pose.time, line, ink);
  ctx.restore();
}

type Shape = (fill: string | CanvasGradient, draw: () => void, outline?: boolean) => void;
type Limb = (points: P[], width: number, color: string) => void;

/** The pack on the back, with the dart quiver strapped to it and three pompoms peeking out. */
function drawPack(
  ctx: CanvasRenderingContext2D,
  kit: Look['caver'],
  shape: Shape,
  look: Look,
): void {
  for (let i = 0; i < 3; i++) {
    const x = -19 + i * 3.4;
    const y = -80 - (i % 2) * 2.5;
    ctx.strokeStyle = look.dark ? '#cfc8b4' : look.outline;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x + 1, y + 10);
    ctx.stroke();
    ctx.fillStyle =
      i === 1 ? (look.dark ? '#d9d2ff' : '#c9d3f2') : look.dark ? '#b7adff' : '#aebde8';
    ctx.beginPath();
    ctx.arc(x, y, 3.1, 0, Math.PI * 2);
    ctx.fill();
  }
  shape(kit.packShade, () => ctx.roundRect(-22, -74, 9, 24, 3));
  shape(kit.pack, () => ctx.roundRect(-20, -71, 13, 30, 4));
  shape(kit.packShade, () => ctx.roundRect(-20, -71, 13, 8, [4, 4, 2, 2]));
  ctx.fillStyle = kit.metal;
  ctx.beginPath();
  ctx.arc(-13.5, -62.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  kit: Look['caver'],
  limb: Limb,
  shape: Shape,
): void {
  // The far leg first, a shade darker.
  limb(
    [
      { x: -5, y: -45 },
      { x: -7, y: -26 },
      { x: -8, y: -9 },
    ],
    10.5,
    kit.suitShade,
  );
  limb(
    [
      { x: 6, y: -45 },
      { x: 8, y: -26 },
      { x: 9, y: -9 },
    ],
    10.5,
    kit.suit,
  );
  for (const [x, y] of [
    [-7.2, -26],
    [8.2, -26],
  ] as const) {
    shape(kit.pad, () => ctx.roundRect(x - 5.6, y - 4.5, 11.2, 9, 3));
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y - 1);
    ctx.lineTo(x + 3.5, y - 1);
    ctx.stroke();
  }
  // Heavy boots, toes forward, laced, on thick soles.
  for (const x of [-8, 9]) {
    shape(kit.boot, () => {
      ctx.moveTo(x - 6, -12);
      ctx.lineTo(x + 5, -12);
      ctx.quadraticCurveTo(x + 6, -6, x + 11, -5);
      ctx.quadraticCurveTo(x + 14, -4, x + 13, -1.5);
      ctx.lineTo(x - 6.5, -1.5);
      ctx.closePath();
    });
    shape(kit.sole, () => ctx.roundRect(x - 7, -2.5, 21, 3, 1.4), false);
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.45)';
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x - 2 + k * 2, -11 + k * 1.6);
      ctx.lineTo(x + 2 + k * 2, -11 + k * 1.6);
      ctx.stroke();
    }
  }
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  kit: Look['caver'],
  shape: Shape,
  sideLit: (base: string, shade: string, from: number, to: number) => CanvasGradient,
  breathe: number,
): void {
  shape(sideLit(kit.suit, kit.suitShade, -13, 12), () => {
    ctx.moveTo(-12, -68 + breathe);
    ctx.quadraticCurveTo(0, -72 + breathe, 12, -68 + breathe);
    ctx.quadraticCurveTo(14, -58, 11.5, -46);
    ctx.lineTo(10, -40);
    ctx.quadraticCurveTo(0, -37, -10, -40);
    ctx.lineTo(-11.5, -46);
    ctx.quadraticCurveTo(-14, -58, -12, -68 + breathe);
    ctx.closePath();
  });
  // Collar, zip and a chest pocket with its flap.
  shape(kit.suitShade, () => {
    ctx.moveTo(-5, -70 + breathe);
    ctx.lineTo(1, -65 + breathe);
    ctx.lineTo(7, -70 + breathe);
    ctx.lineTo(4, -71.5 + breathe);
    ctx.lineTo(1, -68.5 + breathe);
    ctx.lineTo(-2, -71.5 + breathe);
    ctx.closePath();
  });
  ctx.strokeStyle = 'rgba(40, 20, 10, 0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(1, -65 + breathe);
  ctx.lineTo(1, -47);
  ctx.stroke();
  shape(kit.suitShade, () => ctx.roundRect(3.5, -62, 6.5, 6.5, 1), true);
  ctx.beginPath();
  ctx.moveTo(3.5, -59.8);
  ctx.lineTo(10, -59.8);
  ctx.stroke();
  // A strip of reflective tape round each sleeve-top, catching the light.
  ctx.fillStyle = 'rgba(255, 246, 214, 0.75)';
  ctx.fillRect(-12, -55, 3, 1.4);
}

function drawHarness(
  ctx: CanvasRenderingContext2D,
  kit: Look['caver'],
  shape: Shape,
  line: number,
  ink: string,
): void {
  shape(kit.strap, () => {
    ctx.moveTo(-11.5, -46.5);
    ctx.quadraticCurveTo(0, -44, 11.8, -46.5);
    ctx.lineTo(11.4, -42.5);
    ctx.quadraticCurveTo(0, -40, -11, -42.5);
    ctx.closePath();
  });
  // Leg loops.
  ctx.strokeStyle = kit.strap;
  ctx.lineWidth = 2.6;
  for (const [x, lean] of [
    [-5.5, -1],
    [6.5, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 5.5, -39 + lean);
    ctx.quadraticCurveTo(x, -35.5, x + 5.5, -39 - lean);
    ctx.stroke();
  }
  // The central ring and a pair of carabiners clipped at the hip.
  ctx.strokeStyle = kit.metal;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(1, -41.5, 2.2, 2.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const [x, y, a] of [
    [10.5, -38.5, 0.2],
    [13, -37, 0.45],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.6, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (line > 0) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = line * 0.7;
    ctx.beginPath();
    ctx.ellipse(1, -41.5, 3, 3.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** A coil of rope slung from the far shoulder across the chest to the near hip. */
function drawRope(
  ctx: CanvasRenderingContext2D,
  kit: Look['caver'],
  line: number,
  ink: string,
  breathe: number,
): void {
  const trace = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(-11 + offset * 0.4, -68 + breathe + offset);
    ctx.quadraticCurveTo(-1 + offset, -58 + offset * 0.6, 12.5, -47.5 + offset * 0.4);
  };
  for (let k = 0; k < 3; k++) {
    const offset = k * 1.9;
    if (line > 0) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.8 + line * 1.6;
      trace(offset);
      ctx.stroke();
    }
    ctx.strokeStyle = kit.rope;
    ctx.lineWidth = 2.8;
    trace(offset);
    ctx.stroke();
  }
  // The twist of the rope, a few short ticks along the coil.
  ctx.strokeStyle = 'rgba(110, 80, 40, 0.55)';
  ctx.lineWidth = 0.7;
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const x = -11 + t * 23.5 + Math.sin(t * Math.PI) * 3;
    const y = -68 + breathe + t * 21 + Math.sin(t * Math.PI) * 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 0.4);
    ctx.lineTo(x + 0.6, y + 3.4);
    ctx.stroke();
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  kit: Look['caver'],
  look: Look,
  shape: Shape,
  breathe: number,
  time: number,
): void {
  const y = breathe;
  shape(look.skin, () => ctx.roundRect(-1, -76 + y, 7, 6, 2));
  // Hair showing at the back of the neck, under the helmet.
  shape(kit.hair, () => {
    ctx.moveTo(-7, -86 + y);
    ctx.quadraticCurveTo(-9, -78 + y, -4, -74 + y);
    ctx.lineTo(-1, -78 + y);
    ctx.closePath();
  });
  shape(look.skin, () => ctx.ellipse(3, -82 + y, 9.2, 10, 0, 0, Math.PI * 2));
  shape(look.skin, () => ctx.ellipse(-4.5, -81 + y, 2.2, 3, 0, 0, Math.PI * 2));
  // Face, turned towards the lantern: brows, eyes, a round nose, a small determined smile.
  const blink = Math.abs(Math.sin(time * 0.9)) > 0.985;
  ctx.fillStyle = look.dark ? '#1a120c' : '#2a2a33';
  ctx.strokeStyle = ctx.fillStyle;
  for (const [x, r] of [
    [5.5, 1.35],
    [10, 1.15],
  ] as const) {
    if (blink) {
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 1.4, -83 + y);
      ctx.lineTo(x + 1.4, -83 + y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, -83 + y, r, r * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3.5, -86.5 + y);
  ctx.quadraticCurveTo(5.5, -87.6 + y, 7.5, -86.8 + y);
  ctx.moveTo(8.8, -86.6 + y);
  ctx.quadraticCurveTo(10.4, -87.4 + y, 11.6, -86.4 + y);
  ctx.stroke();
  shape(
    look.dark ? '#c98d68' : '#dc9f7a',
    () => ctx.ellipse(11.6, -80.5 + y, 2.3, 2, 0, 0, Math.PI * 2),
    false,
  );
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(5.5, -77.3 + y);
  ctx.quadraticCurveTo(8, -75.8 + y, 10.3, -77.4 + y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(214, 92, 72, 0.28)';
  ctx.beginPath();
  ctx.ellipse(4, -79.5 + y, 2.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // The helmet: a dome with a short peak, a chin strap and a headlamp.
  ctx.strokeStyle = kit.strap;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5.5, -86 + y);
  ctx.quadraticCurveTo(-3, -76 + y, 4, -72.5 + y);
  ctx.stroke();
  const dome = ctx.createLinearGradient(-8, 0, 14, 0);
  dome.addColorStop(0, kit.helmetShade);
  dome.addColorStop(0.6, kit.helmet);
  dome.addColorStop(1, kit.helmet);
  shape(dome, () => {
    ctx.moveTo(-8.5, -86 + y);
    ctx.quadraticCurveTo(-8.5, -98.5 + y, 3.5, -98.5 + y);
    ctx.quadraticCurveTo(14.5, -98.5 + y, 14, -88 + y);
    ctx.lineTo(16.5, -87.2 + y);
    ctx.quadraticCurveTo(17.5, -85.6 + y, 15, -85.4 + y);
    ctx.lineTo(-9.5, -85.4 + y);
    ctx.quadraticCurveTo(-10.5, -86.2 + y, -8.5, -86 + y);
    ctx.closePath();
  });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, -95 + y, 4, 1.6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  shape(kit.strap, () => ctx.roundRect(8.5, -93.5 + y, 6.5, 5, 1.5));
  shape(look.dark ? '#fff2c8' : '#fbf3d2', () =>
    ctx.ellipse(15.2, -91 + y, 1.6, 2.3, 0, 0, Math.PI * 2),
  );
}

function drawLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  look: Look,
  time: number,
  line: number,
  ink: string,
): void {
  const flicker = 1 + Math.sin(time * 11) * 0.06 + Math.sin(time * 7.3) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = look.dark ? '#2b221a' : ink;
  ctx.lineWidth = Math.max(1, line || 1.2);
  ctx.beginPath();
  ctx.arc(0, -10, 4, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = look.dark ? '#3a2d22' : '#6d5a44';
  ctx.fillRect(-6, -8, 12, 3);
  ctx.fillRect(-6, 9, 12, 3);
  ctx.fillStyle = look.dark ? '#ffd889' : '#f8d68c';
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-5, -5, 10, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = look.dark ? '#fff4d6' : '#f2a53a';
  ctx.beginPath();
  ctx.ellipse(0, 3, 2.4 * flicker, 4.6 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeRect(-5, -5, 10, 14);
  ctx.restore();
}

/** The lantern left behind on the floor, tipped on its side, its flame shrinking to a bead. */
export function drawDroppedLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  look: Look,
  time: number,
  strength: number,
): void {
  const u = height / 100;
  ctx.save();
  ctx.translate(x, y - 6 * u);
  ctx.rotate(-1.35);
  ctx.strokeStyle = look.dark ? '#2b221a' : look.outline;
  ctx.lineWidth = Math.max(1, u * 1.6);
  ctx.fillStyle = look.dark ? '#3a2d22' : '#6d5a44';
  ctx.fillRect(-6 * u, -8 * u, 12 * u, 3 * u);
  ctx.fillRect(-6 * u, 9 * u, 12 * u, 3 * u);
  ctx.fillStyle = look.dark ? 'rgba(255, 216, 137, 0.35)' : 'rgba(248, 214, 140, 0.6)';
  ctx.fillRect(-5 * u, -5 * u, 10 * u, 14 * u);
  const flicker = 0.7 + Math.sin(time * 13) * 0.2 + Math.sin(time * 5.1) * 0.1;
  ctx.fillStyle = look.dark ? '#ff9a4a' : '#e0782c';
  ctx.beginPath();
  ctx.ellipse(
    0,
    4 * u,
    1.6 * u * strength * 2 * flicker,
    2.6 * u * strength * 2 * flicker,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.strokeRect(-5 * u, -5 * u, 10 * u, 14 * u);
  ctx.beginPath();
  ctx.arc(0, -10 * u, 4 * u, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

/** A lantern set down upright on the floor, as for a camp: the title's and the poster's light. */
export function drawStandingLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  look: Look,
  time: number,
): void {
  const u = height / 100;
  ctx.save();
  ctx.translate(x, y - 12 * u);
  ctx.scale(u, u);
  drawLantern(ctx, 0, 0, look, time, look.dark ? 0 : 1.4, look.outline);
  ctx.restore();
}
