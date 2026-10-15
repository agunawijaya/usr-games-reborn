import type { Rank } from '@usr-games/kit/cards';
import { drawFish } from './fish/draw';
import { speciesFor } from './fish/species';
import type { Point, Rect } from './layout';
import type { Look } from './look';

/**
 * Your wooden bucket on the bank, with every book you have made swimming in it as its rank's
 * fish, heads and tails poking out over the rim. Golden fish shine among them.
 */

type Ctx = CanvasRenderingContext2D;

export interface BucketFish {
  rank: Rank;
  golden: boolean;
}

export interface BucketShape {
  mouth: Point;
  mouthRx: number;
  mouthRy: number;
  bottom: number;
  bottomRx: number;
}

export function bucketShape(rect: Rect, s: number): BucketShape {
  const height = Math.min(rect.h * 0.55, 168 * s);
  // Room below for the bucket's card.
  const bottom = rect.y + rect.h - 58 * s;
  return {
    mouth: { x: rect.x + rect.w / 2, y: bottom - height },
    mouthRx: Math.min(rect.w * 0.34, 112 * s),
    mouthRy: 26 * s,
    bottom,
    bottomRx: Math.min(rect.w * 0.27, 88 * s),
  };
}

/** Where each fish pokes out of the bucket: fanned across the mouth, angled up and out. */
function fishSpots(shape: BucketShape, count: number): { x: number; y: number; angle: number }[] {
  const shown = Math.min(count, 9);
  return Array.from({ length: shown }, (_, i) => {
    const t = shown === 1 ? 0.5 : i / (shown - 1);
    const x = shape.mouth.x + (t - 0.5) * shape.mouthRx * 1.3;
    return { x, y: shape.mouth.y + 4 - (i % 2) * 10, angle: -Math.PI / 2 + (t - 0.5) * 1.3 };
  });
}

export function drawBucket(
  ctx: Ctx,
  shape: BucketShape,
  fish: readonly BucketFish[],
  look: Look,
  time: number,
  s: number,
): void {
  const { mouth, mouthRx, mouthRy, bottom, bottomRx } = shape;
  // Its shadow on the grass.
  ctx.fillStyle = look.shadow;
  ctx.beginPath();
  ctx.ellipse(mouth.x + 10 * s, bottom + 6 * s, bottomRx * 1.3, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // The far rim and the water inside.
  ctx.fillStyle = look.wood.shade;
  ctx.beginPath();
  ctx.ellipse(mouth.x, mouth.y, mouthRx, mouthRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.water.deep;
  ctx.beginPath();
  ctx.ellipse(mouth.x, mouth.y + 3 * s, mouthRx * 0.9, mouthRy * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fish, tails down in the water, heads up over the rim; the bucket's front hides the rest.
  fishSpots(shape, fish.length).forEach((spot, i) => {
    const one = fish[fish.length - 1 - i]!;
    const species = speciesFor(one.rank);
    const length = 92 * s * (0.75 + species.size * 0.25);
    drawFish(ctx, species, {
      x: spot.x,
      y: spot.y - length * 0.28,
      length,
      angle: spot.angle + Math.sin(time * 1.4 + i) * 0.05,
      pose: { arch: 0, wiggle: 0.35, phase: time * 3 + i * 1.7 },
      golden: one.golden,
      gold: look.gold,
      time: time + i,
    });
  });

  // The front of the bucket: staves, two iron hoops, a rope handle.
  ctx.beginPath();
  ctx.moveTo(mouth.x - mouthRx, mouth.y);
  ctx.lineTo(mouth.x - bottomRx, bottom);
  ctx.ellipse(mouth.x, bottom, bottomRx, mouthRy * 0.8, 0, Math.PI, 0, true);
  ctx.lineTo(mouth.x + mouthRx, mouth.y);
  ctx.ellipse(mouth.x, mouth.y, mouthRx, mouthRy, 0, 0, Math.PI);
  ctx.closePath();
  const wood = ctx.createLinearGradient(mouth.x - mouthRx, 0, mouth.x + mouthRx, 0);
  wood.addColorStop(0, look.wood.shade);
  wood.addColorStop(0.35, look.wood.light);
  wood.addColorStop(0.7, look.wood.mid);
  wood.addColorStop(1, look.wood.shade);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = look.wood.grain;
  ctx.lineWidth = 1.4 * s;
  for (let i = -3; i <= 3; i++) {
    const top = mouth.x + (i / 3.5) * mouthRx;
    const low = mouth.x + (i / 3.5) * bottomRx;
    ctx.beginPath();
    ctx.moveTo(top, mouth.y);
    ctx.lineTo(low, bottom + mouthRy);
    ctx.stroke();
  }
  ctx.restore();
  for (const t of [0.22, 0.78]) {
    const y = mouth.y + (bottom - mouth.y) * t;
    const rx = mouthRx + (bottomRx - mouthRx) * t;
    ctx.strokeStyle = look.dark ? '#3a3f48' : '#4a4e55';
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.ellipse(mouth.x, y, rx, mouthRy * (1 - t * 0.2), 0, 0.05, Math.PI - 0.05);
    ctx.stroke();
    ctx.strokeStyle = look.dark ? 'rgba(200, 210, 230, 0.25)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.ellipse(mouth.x, y - 2 * s, rx, mouthRy * (1 - t * 0.2), 0, 0.3, Math.PI - 1.4);
    ctx.stroke();
  }
  // The near rim.
  ctx.strokeStyle = look.wood.light;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.ellipse(mouth.x, mouth.y, mouthRx, mouthRy, 0, 0, Math.PI);
  ctx.stroke();
}

/** Where a leaping fish should land: the middle of the bucket's mouth. */
export function bucketTarget(shape: BucketShape): Point {
  return { x: shape.mouth.x, y: shape.mouth.y - 4 };
}
