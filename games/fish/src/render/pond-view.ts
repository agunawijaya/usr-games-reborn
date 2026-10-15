import type { CardId, Rank } from '@usr-games/kit/cards';
import { type BucketFish, bucketShape, bucketTarget, drawBucket } from './bucket';
import { CardPainter, drawCardAt, drawDrips, drawHand, drawPile, handSlots } from './cards';
import { CAST, castAt, drawFloat, drawLine, drawRod, drawSpray, landingPoint } from './cast';
import {
  drawFlight,
  drawLap,
  drawRivalLeap,
  type Flight,
  type LapFish,
  type RivalLeap,
} from './effects';
import { drawPads, drawReeds } from './flora';
import { drawFlyers } from './flyers';
import { type LayoutOptions, layoutFor, type Point, type PondLayout } from './layout';
import { drawLeap, type LeapPicture } from './leap';
import type { Look } from './look';
import { CAT } from './rivals/cat';
import type { Mood, RivalPainter } from './rivals/common';
import { HERON } from './rivals/heron';
import { OTTER } from './rivals/otter';
import { clipToPond, paintScenery } from './scenery';
import { drawWater, type Ripple } from './water';

/**
 * The pond on screen: a still back layer painted once (sky, trees, banks, basin) and a live
 * layer drawn each frame from a `PondScene`, the plain description of this moment: who sits
 * where in what mood, the cards in your hand and in the pond, your bucket, and any cast or leap
 * in progress. The view owns no game state; the director builds the scene and asks for frames.
 */

export type RivalKind = 'otter' | 'heron' | 'cat';

export const PAINTERS: Readonly<Record<RivalKind, RivalPainter>> = {
  otter: OTTER,
  heron: HERON,
  cat: CAT,
};

export interface RivalInScene {
  kind: RivalKind;
  mood: Mood;
  moodAge: number;
  cards: number;
}

export interface CastInScene {
  age: number;
  card: CardId;
  lucky: boolean;
}

export interface PondScene {
  time: number;
  rivals: readonly RivalInScene[];
  pond: number;
  hand: readonly CardId[];
  lifted?: Rank;
  /** Cards drawn elsewhere this moment (flying), left out of the hand's fan. */
  hiddenInHand?: ReadonlySet<CardId>;
  bucket: readonly BucketFish[];
  ripples: readonly Ripple[];
  cast?: CastInScene;
  leap?: Omit<LeapPicture, 'gather' | 'to' | 'from'>;
  /** Cards on their way between seats, or out of the pond. */
  flights?: readonly Flight[];
  rivalLeaps?: readonly RivalLeap[];
  /** The end of the game: every fish swimming its lap. */
  lap?: { age: number; fish: readonly LapFish[] };
  /** 0 under reduced motion: water, pads, reeds and flyers hold still. */
  motion: number;
  /** Key art and the attract mode leave your bucket off the bank. */
  hideBucket?: boolean;
}

/** Where each rival holds its cards, from where it sits (scaled by its seat). */
const HAND_AT: Readonly<Record<RivalKind, Point>> = {
  otter: { x: 0, y: -92 },
  heron: { x: 46, y: -112 },
  cat: { x: 24, y: -80 },
};

const SEEDS: Readonly<Record<RivalKind, number>> = { otter: 3, heron: 7, cat: 12 };

/** How far out from the bank each rival sits: Otto's log floats, Miso's stone is at the edge. */
const OFFSHORE: Readonly<Record<RivalKind, number>> = { otter: 22, heron: 0, cat: 0 };

export class PondView {
  readonly element: HTMLDivElement;
  private readonly back: HTMLCanvasElement;
  private readonly live: HTMLCanvasElement;
  /** The rivals upside down, drawn here first so the water can break them into ripples. */
  private readonly mirror = document.createElement('canvas');
  private mirrorTop = -1;
  private readonly cards = new CardPainter();
  private look: Look;
  private dpr = 1;
  private current: PondLayout = layoutFor(1920, 1080);

  constructor(look: Look) {
    this.look = look;
    this.element = document.createElement('div');
    this.element.className = 'gf-pond';
    this.element.style.cssText = 'position:absolute;inset:0;overflow:hidden;outline:none';
    // Focusable so the game has the keyboard when play begins; the panels carry the words.
    this.element.tabIndex = -1;
    this.element.setAttribute('aria-label', 'The pond');
    this.back = document.createElement('canvas');
    this.live = document.createElement('canvas');
    for (const canvas of [this.back, this.live]) {
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      canvas.setAttribute('aria-hidden', 'true');
      this.element.append(canvas);
    }
  }

  get layout(): PondLayout {
    return this.current;
  }

  private options: LayoutOptions = {};

  resize(width: number, height: number, dpr: number, options: LayoutOptions = this.options): void {
    this.dpr = Math.min(2, dpr);
    this.options = options;
    this.current = layoutFor(width, height, options);
    for (const canvas of [this.back, this.live]) {
      canvas.width = Math.round(width * this.dpr);
      canvas.height = Math.round(height * this.dpr);
    }
    // Only as tall as the reflections reach below the far bank.
    this.mirror.width = Math.round(width * this.dpr);
    this.mirror.height = Math.round(200 * this.current.s * this.dpr);
    this.mirrorTop = -1;
    this.paintBack();
  }

  setLook(look: Look): void {
    this.look = look;
    this.paintBack();
  }

  private paintBack(): void {
    const ctx = this.back.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.current.width, this.current.height);
    paintScenery(ctx, this.current, this.look);
    this.cards.prepare(this.current, this.look, this.dpr);
  }

  /** Where rival `index` of `count` sits, for name plates and speech bubbles. */
  rivalAnchor(index: number, count: number, kind: RivalKind): { base: Point; top: number } {
    const spot = this.current.seats(count)[index]!;
    const base = { x: spot.base.x, y: spot.base.y + OFFSHORE[kind] * this.current.s };
    return { base, top: base.y - PAINTERS[kind].height * spot.scale };
  }

  /** The middle of each card in the hand, for pointer hits. */
  handSlots(hand: readonly CardId[], lifted?: Rank) {
    return handSlots(this.current, hand, lifted);
  }

  /** Where rival `index` of `count` holds its cards: cards fly to and from here. */
  rivalHand(index: number, count: number, kind: RivalKind): Point {
    const spot = this.current.seats(count)[index]!;
    const facing = spot.base.x > this.current.pond.cx + 1 ? -1 : 1;
    const offset = HAND_AT[kind];
    const offshore = OFFSHORE[kind] * this.current.s;
    return {
      x: spot.base.x + offset.x * spot.scale * (kind === 'heron' ? facing : 1),
      y: spot.base.y + offshore + offset.y * spot.scale,
    };
  }

  /** Where a rival's fish dives back in: the water just in front of them. */
  diveSpot(index: number, count: number): Point {
    const spot = this.current.seats(count)[index]!;
    const toward = this.current.pond.cx - spot.base.x;
    return {
      x: spot.base.x + Math.sign(toward || 1) * 90 * this.current.s,
      y: spot.base.y + 90 * this.current.s,
    };
  }

  /** Where `card` sits (or will sit) in the fan of `hand`. */
  handPoint(card: CardId, hand: readonly CardId[]): Point {
    const slots = handSlots(this.current, hand.includes(card) ? hand : [...hand, card]);
    return (
      slots.find((slot) => slot.card === card) ?? {
        x: this.current.hand.cx,
        y: this.current.hand.baseline,
      }
    );
  }

  get pilePoint(): Point {
    return this.current.pile;
  }

  /** The still and the live layers laid onto another canvas (the poster). */
  composite(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.drawImage(this.back, 0, 0, width, height);
    ctx.drawImage(this.live, 0, 0, width, height);
  }

  get bucketMouth(): Point {
    return bucketTarget(bucketShape(this.current.bucket, this.current.s));
  }

  draw(scene: PondScene): void {
    const ctx = this.live.getContext('2d')!;
    const layout = this.current;
    const look = this.look;
    const time = scene.time;
    const still = time * scene.motion;
    const sprites = this.cards.prepare(layout, look, this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);

    drawWater(ctx, layout, look, time, scene.ripples, scene.motion);
    this.drawReflections(ctx, scene);
    drawPads(ctx, layout, look, still);
    drawPile(ctx, sprites, layout, scene.pond, look, still);
    if (scene.lap) drawLap(ctx, layout, scene.lap.fish, scene.lap.age, look);
    drawReeds(ctx, layout, look, still);
    this.drawRivals(ctx, scene);
    for (const leap of scene.rivalLeaps ?? []) drawRivalLeap(ctx, leap, look, layout.s);
    drawFlyers(ctx, layout, look, still);
    const bucket = bucketShape(layout.bucket, layout.s);
    if (!scene.hideBucket) this.drawBucketCached(ctx, scene.bucket);
    drawHand(ctx, sprites, layout, scene.hand, {
      lifted: scene.lifted,
      look,
      hidden: scene.hiddenInHand,
    });
    for (const flight of scene.flights ?? []) drawFlight(ctx, sprites, flight, layout.s);
    if (scene.cast) this.drawCast(ctx, scene.cast);
    if (scene.leap) {
      const slots = handSlots(layout, [...scene.hand, ...scene.leap.cards], scene.lifted);
      const from = scene.leap.cards.map(
        (card) => slots.find((slot) => slot.card === card) ?? layout.pile,
      );
      drawLeap(
        ctx,
        sprites,
        {
          ...scene.leap,
          from,
          // Gathered over the water to the right of your hand, on the way to the bucket.
          gather: { x: layout.hand.cx + 370 * layout.s, y: layout.askBar.y - 40 * layout.s },
          to: bucketTarget(bucket),
        },
        look,
        layout.s,
      );
    }
  }

  private bucketImage: { key: string; image: HTMLCanvasElement } | null = null;

  /** The bucket and its fish change only when a book is made: painted then, copied between. */
  private drawBucketCached(ctx: CanvasRenderingContext2D, fish: PondScene['bucket']): void {
    const layout = this.current;
    const key = `${this.look.id}|${layout.width}x${layout.height}|${this.dpr}|${fish.map((f) => `${f.rank}${f.golden ? 'g' : ''}`).join(',')}`;
    if (this.bucketImage?.key !== key) {
      const image = this.bucketImage?.image ?? document.createElement('canvas');
      image.width = Math.round(layout.width * this.dpr);
      image.height = Math.round(layout.height * this.dpr);
      const paint = image.getContext('2d')!;
      paint.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paint.clearRect(0, 0, layout.width, layout.height);
      drawBucket(paint, bucketShape(layout.bucket, layout.s), fish, this.look, 0.8, layout.s);
      this.bucketImage = { key, image };
    }
    const { x, y, w, h } = layout.bucket;
    const margin = 120 * layout.s;
    // Only the bucket's corner of the image: the fish reach up and out a little past its box.
    ctx.drawImage(
      this.bucketImage.image,
      (x - margin) * this.dpr,
      (y - margin) * this.dpr,
      (w + margin * 2) * this.dpr,
      (h + margin) * this.dpr,
      x - margin,
      y - margin,
      w + margin * 2,
      h + margin,
    );
  }

  private frameCount = 0;

  private seatOrder(count: number): number[] {
    // The middle seat of three is furthest back, so it is drawn first.
    return count === 3 ? [1, 0, 2] : Array.from({ length: count }, (_, i) => i);
  }

  private poseFor(scene: PondScene, index: number) {
    const rival = scene.rivals[index]!;
    const count = scene.rivals.length;
    const spot = this.current.seats(count)[index]!;
    const facing: 1 | -1 = spot.base.x > this.current.pond.cx + 1 ? -1 : 1;
    return {
      x: spot.base.x,
      y: spot.base.y + OFFSHORE[rival.kind] * this.current.s,
      scale: spot.scale,
      mood: rival.mood,
      moodAge: rival.moodAge,
      time: scene.time,
      cards: rival.cards,
      look: this.look,
      seed: SEEDS[rival.kind],
      facing,
    };
  }

  private drawRivals(ctx: CanvasRenderingContext2D, scene: PondScene): void {
    for (const index of this.seatOrder(scene.rivals.length)) {
      PAINTERS[scene.rivals[index]!.kind].draw(ctx, this.poseFor(scene, index));
    }
  }

  /**
   * Each rival upside down in the water below them: squashed by the angle of view, fading with
   * depth, and laid on the water in thin strips that waver, so it reads as a reflection and
   * never as a second animal under the surface.
   */
  private drawReflections(ctx: CanvasRenderingContext2D, scene: PondScene): void {
    const layout = this.current;
    const depth = 150 * layout.s;
    let top = layout.height;
    for (const index of this.seatOrder(scene.rivals.length))
      top = Math.min(top, this.poseFor(scene, index).y);
    const bandTop = top - 12 * layout.s;
    // The reflections change slowly (a blink, a breath): drawn every other frame.
    if (this.frameCount++ % 2 === 0 || this.mirrorTop !== bandTop) {
      this.mirrorTop = bandTop;
      const mirror = this.mirror.getContext('2d')!;
      mirror.setTransform(this.dpr, 0, 0, this.dpr, 0, -bandTop * this.dpr);
      mirror.clearRect(0, bandTop, layout.width, depth + 24 * layout.s);
      for (const index of this.seatOrder(scene.rivals.length)) {
        const pose = this.poseFor(scene, index);
        mirror.save();
        mirror.translate(pose.x, pose.y);
        mirror.scale(1, -0.5);
        PAINTERS[scene.rivals[index]!.kind].draw(mirror, { ...pose, x: 0, y: 0, mood: 'idle' });
        mirror.restore();
      }
      mirror.globalCompositeOperation = 'destination-in';
      const fade = mirror.createLinearGradient(0, top, 0, top + depth);
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mirror.fillStyle = fade;
      mirror.fillRect(0, bandTop, layout.width, depth + 24 * layout.s);
      mirror.globalCompositeOperation = 'source-over';
    }

    ctx.save();
    clipToPond(ctx, layout);
    ctx.globalAlpha = this.look.reflection * 0.62;
    const strip = 3 * layout.s;
    const time = scene.time * scene.motion;
    for (let y = top - 10 * layout.s; y < top + depth; y += strip) {
      const shift = Math.sin(y * 0.09 + time * 2.2) * 3.2 * layout.s * (0.4 + (y - top) / depth);
      ctx.drawImage(
        this.mirror,
        0,
        (y - bandTop) * this.dpr,
        this.mirror.width,
        strip * this.dpr,
        shift,
        y,
        layout.width,
        strip,
      );
    }
    ctx.restore();
  }

  private drawCast(ctx: CanvasRenderingContext2D, cast: CastInScene): void {
    const layout = this.current;
    const look = this.look;
    const picture = castAt(layout, cast.age);
    const tip = drawRod(
      ctx,
      layout,
      look,
      picture.rodLean,
      picture.cardOut > 0 ? picture.end : null,
    );
    if (picture.cardOut === 0) drawLine(ctx, tip, picture.end, picture.tension, look, layout.s);
    const landing = landingPoint(layout);
    drawSpray(ctx, landing, cast.age - CAST.landed, look, layout.s);
    if (picture.floatVisible) drawFloat(ctx, picture.end, picture.dip, look, layout.s);
    if (picture.cardOut > 0) {
      drawSpray(ctx, landing, cast.age - CAST.bite, look, layout.s, 1.5);
      drawPlume(ctx, landing, cast.age - CAST.bite, look, layout.s);
      const sprites = this.cards.current;
      // The card wriggles on the hook like a fish, swinging from the middle of its top edge.
      const wriggle = Math.sin(cast.age * 15) * 0.38 * (1 - picture.cardOut * 0.25);
      const height = sprites.height * 0.9;
      const centre = {
        x: picture.end.x - (Math.sin(wriggle) * height) / 2,
        y: picture.end.y + (Math.cos(wriggle) * height) / 2,
      };
      drawWriggleMarks(ctx, centre, height, wriggle, look, layout.s);
      drawCardAt(ctx, sprites, cast.card, {
        x: centre.x,
        y: centre.y,
        angle: wriggle,
        scale: 0.9,
        turn: 0,
        lift: 0.9,
        wet: 1 - picture.cardOut * 0.4,
        glow: cast.lucky ? 'rgba(255, 220, 120, 0.95)' : undefined,
      });
      // The hook through the top edge.
      ctx.strokeStyle = look.dark ? '#c9ced8' : '#5d646e';
      ctx.lineWidth = 2 * layout.s;
      ctx.beginPath();
      ctx.arc(
        picture.end.x,
        picture.end.y + 5 * layout.s,
        5 * layout.s,
        Math.PI * 1.1,
        Math.PI * 2.4,
      );
      ctx.stroke();
      drawLine(ctx, tip, picture.end, picture.tension, look, layout.s);
      const bottom = {
        x: centre.x - (Math.sin(wriggle) * height) / 2,
        y: centre.y + (Math.cos(wriggle) * height) / 2,
      };
      drawDrips(ctx, bottom.x, bottom.y, sprites.width * 0.8, cast.age, look, layout.s);
    }
  }
}

/** The column of water a card drags up as it leaves the pond, falling back as it rises. */
function drawPlume(
  ctx: CanvasRenderingContext2D,
  at: Point,
  age: number,
  look: Look,
  s: number,
): void {
  if (age < 0 || age > 0.8) return;
  const t = age / 0.8;
  const height = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 70 * s * (1 - t * 0.6);
  const width = (16 + t * 22) * s;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.85;
  const fill = ctx.createLinearGradient(0, at.y - height, 0, at.y);
  fill.addColorStop(0, look.spray);
  fill.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(at.x - width, at.y);
  ctx.quadraticCurveTo(at.x - width * 0.3, at.y - height * 0.6, at.x, at.y - height);
  ctx.quadraticCurveTo(at.x + width * 0.3, at.y - height * 0.6, at.x + width, at.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Cartoon swish marks either side of a wriggling card, showing which way it swings. */
function drawWriggleMarks(
  ctx: CanvasRenderingContext2D,
  centre: Point,
  height: number,
  swing: number,
  look: Look,
  s: number,
): void {
  ctx.save();
  ctx.strokeStyle = look.dark ? 'rgba(220, 230, 255, 0.75)' : 'rgba(255, 255, 255, 0.95)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3 * s;
  const reach = height * 0.62;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const r = reach + i * 14 * s;
      const middle = (side > 0 ? 0 : Math.PI) + swing;
      ctx.globalAlpha = 0.9 - i * 0.35;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, r, middle - 0.22, middle + 0.22);
      ctx.stroke();
    }
  }
  ctx.restore();
}
