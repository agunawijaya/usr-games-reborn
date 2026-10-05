import {
  type CardId,
  CardSprites,
  CORNER,
  ease,
  rankLabel,
  roundedRect,
  type Rank,
} from '@usr-games/kit/cards';
import type { From, Layout } from '../engine/rules';
import { type BloomState, drawBloom, isBloomAnimating } from './bloom';
import { drawCard, drawStackEdges, type Pose } from './card-draw';
import { centreOf, fanStep, type Rect, type TableLayout, tableLayout } from './layout';
import type { Look } from './look';
import {
  makeSky,
  paintObservatoryBase,
  paintObservatoryLight,
  paintObservatoryShade,
  paintStars,
  paintSunroomBase,
  paintSunroomLight,
  paintSunroomShade,
  type Sky,
  SKY_GRADIENT,
} from './scenery';

/**
 * The table on screen: the room (sky, base and light layers) and the cards canvas between
 * them. It draws whatever `TableModel` it is given at a moment on the table's clock and holds
 * no game state of its own.
 */

export type Place =
  | { kind: 'stock' }
  | { kind: 'talon' }
  | { kind: 'hand' }
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; index: number };

export interface DragView {
  cards: CardId[];
  from: From;
  /** Top-left corner of the first card, following the pointer. */
  corner: { x: number; y: number };
  velocity: { x: number; y: number };
  /** The corner the cards are drawn towards when over a legal place, and how strongly. */
  snap: { x: number; y: number } | null;
  pull: number;
}

export interface Flight {
  card: CardId;
  from: Pose;
  to: Pose;
  /** Seconds on the table clock. */
  start: number;
  duration: number;
  /** How high the card arcs, in pixels. */
  arc: number;
  /** Turns over on the way (back to face). */
  flips: boolean;
  /** Draw on top of everything (dealt and played cards) or under the piles. */
  layer: 'over' | 'under';
}

export interface FinishView {
  startedAt: number;
  /** Every card in the order it leaves: the four foundations' tops in turn, then the next. */
  cards: CardId[];
}

/** The finish's order: card `i` comes off foundation `i % 4`, from the top down. */
export function finishOrder(foundations: readonly (readonly CardId[])[]): CardId[] {
  const order: CardId[] = [];
  for (let depth = 12; depth >= 0; depth--)
    for (const pile of foundations) {
      const card = pile[depth];
      if (card !== undefined) order.push(card);
    }
  return order;
}

export interface TableModel {
  layout: Layout;
  blooms: readonly BloomState[];
  drag: DragView | null;
  /** Places glowing as legal targets. */
  targets: readonly Place[];
  cursor: Place | null;
  /** Cards picked up by keyboard or click, waiting for a destination. */
  selected: { place: Place; count: number } | null;
  hint: { from: Place; to: Place } | null;
  flights: readonly Flight[];
  /** Cards drawn by a flight or the drag instead of on their pile. */
  hidden: ReadonlySet<CardId>;
  finish: FinishView | null;
  /** Small engraved labels beside the piles. */
  labels: boolean;
  /** Cards that just refused a move, shaking their heads. */
  shake: { cards: ReadonlySet<CardId>; at: number } | null;
}

export function emptyModel(layout: Layout, blooms: readonly BloomState[]): TableModel {
  return {
    layout,
    blooms,
    drag: null,
    targets: [],
    cursor: null,
    selected: null,
    hint: null,
    flights: [],
    hidden: new Set(),
    finish: null,
    labels: true,
    shake: null,
  };
}

const SHAKE_SECONDS = 0.35;

/** A refused card's sideways shudder, dying away: the horizontal offset at this time. */
function shakeOffset(model: TableModel, card: CardId, time: number, unit: number): number {
  const shake = model.shake;
  if (!shake || !shake.cards.has(card)) return 0;
  const age = time - shake.at;
  if (age < 0 || age > SHAKE_SECONDS) return 0;
  return Math.sin(age * 55) * (1 - age / SHAKE_SECONDS) * unit * 0.05;
}

const LABEL_FONT = '"Fraunces Variable", "Fraunces", Georgia, serif';

/** The pile labels' type size, in CSS pixels. */
function labelSize(t: TableLayout): number {
  return Math.max(13, Math.round(t.card.h * 0.072));
}

/** The bottom of the label drawn under a top-row pile, such as "Reserve · 12". */
export function labelBottom(t: TableLayout, rect: Rect): number {
  return rect.y + rect.h + t.card.h * 0.125 + labelSize(t) * 1.25;
}

function layer(className: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

export class TableView {
  readonly element: HTMLDivElement;
  private readonly sky = layer('td-layer td-layer--sky');
  private readonly base = layer('td-layer td-layer--base');
  private readonly cards = layer('td-layer td-layer--cards');
  private readonly shade = layer('td-layer td-layer--shade');
  private readonly light = layer('td-layer td-layer--light');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly skyField: Sky = makeSky();
  private lastSky = -1;
  private look: Look;
  private reducedMotion: boolean;
  private scale = 1;
  table: TableLayout = tableLayout(1280, 720);
  sprites: CardSprites;

  constructor(
    look: Look,
    reducedMotion: boolean,
    private fourColour = false,
  ) {
    this.look = look;
    this.reducedMotion = reducedMotion;
    this.element = document.createElement('div');
    this.element.className = 'td-table';
    this.element.append(this.sky, this.base, this.cards, this.shade, this.light);
    this.ctx = this.cards.getContext('2d')!;
    this.sprites = this.makeSprites();
  }

  private makeSprites(): CardSprites {
    return new CardSprites({
      width: this.table.card.w,
      height: this.table.card.h,
      scale: this.scale,
      look: this.look.deck,
      fourColour: this.fourColour,
      back: this.look.back,
    });
  }

  setLook(look: Look, reducedMotion: boolean): void {
    this.look = look;
    this.reducedMotion = reducedMotion;
    this.sprites = this.makeSprites();
    this.paintRoom();
  }

  setFourColour(fourColour: boolean): void {
    if (fourColour === this.fourColour) return;
    this.fourColour = fourColour;
    this.sprites = this.makeSprites();
  }

  get motion(): boolean {
    return !this.reducedMotion;
  }

  resize(width: number, height: number, scale: number): void {
    this.scale = scale;
    this.table = tableLayout(width, height);
    for (const canvas of [this.sky, this.base, this.cards, this.shade, this.light]) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    this.sprites = this.makeSprites();
    this.paintRoom();
  }

  private paintRoom(): void {
    const { width, height } = this.table;
    const dark = this.look.dark;
    this.element.dataset.look = this.look.name;
    this.element.style.background = dark ? SKY_GRADIENT : '#e7d3ad';
    const base = this.base.getContext('2d')!;
    base.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    base.clearRect(0, 0, width, height);
    if (dark) paintObservatoryBase(base, width, height, this.table.decor);
    else paintSunroomBase(base, width, height, this.table.decor);
    const shade = this.shade.getContext('2d')!;
    shade.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    shade.clearRect(0, 0, width, height);
    if (dark) paintObservatoryShade(shade, width, height);
    else paintSunroomShade(shade, width, height);
    const light = this.light.getContext('2d')!;
    light.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    light.clearRect(0, 0, width, height);
    if (dark) paintObservatoryLight(light, width, height, this.table.decor);
    else paintSunroomLight(light, width, height);
    this.sky.style.display = dark ? 'block' : 'none';
    this.lastSky = -1;
  }

  /** The sky turns a few pixels a second; repainting it thirty times a second is plenty. */
  private paintSky(time: number): void {
    if (!this.look.dark) return;
    const step = this.reducedMotion ? 0 : time;
    if (this.lastSky >= 0 && (this.reducedMotion || Math.abs(step - this.lastSky) < 1 / 30)) return;
    this.lastSky = step;
    const sky = this.sky.getContext('2d')!;
    sky.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    paintStars(
      sky,
      this.table.width,
      this.table.height,
      this.skyField,
      this.table.decor,
      step,
      !this.reducedMotion,
    );
  }

  // —— geometry ——

  rectOf(place: Place): Rect {
    const t = this.table;
    switch (place.kind) {
      case 'stock':
        return t.reserve;
      case 'talon':
        return t.talon;
      case 'hand':
        return t.hand;
      case 'foundation':
        return t.foundations[place.index]!;
      case 'tableau':
        return t.tableau[place.index]!;
    }
  }

  /** Where the card at `depth` (0 = bottom) of a tableau pile of `length` cards sits. */
  tableauCard(index: number, depth: number, length: number): { x: number; y: number } {
    const rect = this.table.tableau[index]!;
    return { x: rect.x, y: rect.y + depth * fanStep(this.table, length) };
  }

  /** Where the next card dropped on a place would settle. */
  landing(place: Place, layout: Layout): { x: number; y: number } {
    if (place.kind === 'tableau') {
      const length = layout.tableau[place.index]!.length;
      return this.tableauCard(place.index, length, length + 1);
    }
    const rect = this.rectOf(place);
    return { x: rect.x, y: rect.y };
  }

  // —— drawing ——

  /** The table clock of the frame being drawn. */
  private time = 0;

  render(model: TableModel, time: number): void {
    this.time = time;
    if (model.finish) model = { ...model, hidden: withFinishHidden(model, time, this.motion) };
    const ctx = this.ctx;
    const { width, height } = this.table;
    this.paintSky(time);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.drawSlots(model);
    model.flights.filter((f) => f.layer === 'under').forEach((f) => this.drawFlight(f, time));
    this.drawFoundations(model, time);
    this.drawReserve(model, time);
    this.drawHandAndTalon(model, time);
    this.drawLabels(model);
    this.drawTableau(model, time);
    this.drawHighlights(model, time);
    if (model.finish) this.drawFinish(model.finish, time);
    model.flights.filter((f) => f.layer === 'over').forEach((f) => this.drawFlight(f, time));
    if (model.drag) this.drawDrag(model.drag);
  }

  /** Just the room, no cards: for screens that lay their own cards on the table. */
  renderRoom(time: number): void {
    this.paintSky(time);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.cards.width, this.cards.height);
  }

  /** Whether anything on the table is still moving at this time. */
  isAnimating(model: TableModel, time: number): boolean {
    return (
      model.drag !== null ||
      model.flights.some((f) => time < f.start + f.duration) ||
      model.blooms.some((b) => isBloomAnimating(b, time)) ||
      (model.finish !== null && time - model.finish.startedAt < finishSeconds(model.finish)) ||
      (model.shake !== null && time - model.shake.at < SHAKE_SECONDS) ||
      model.targets.length > 0 ||
      model.hint !== null ||
      (this.look.dark && !this.reducedMotion)
    );
  }

  private slot(rect: Rect, label: string | null): void {
    const ctx = this.ctx;
    const r = rect.w * CORNER;
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, r);
    ctx.strokeStyle = this.look.inlay;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();
    roundedRect(ctx, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, r * 0.6);
    ctx.strokeStyle = this.look.inlaySoft;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (label) {
      ctx.font = `600 ${Math.round(rect.h * 0.2)}px ${LABEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.look.inlay;
      ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
  }

  private label(text: string, x: number, y: number, align: CanvasTextAlign = 'center'): void {
    const ctx = this.ctx;
    ctx.font = `600 ${labelSize(this.table)}px ${LABEL_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = this.look.label;
    ctx.fillText(text, x, y);
  }

  private drawSlots(model: TableModel): void {
    if (model.finish) return;
    const t = this.table;
    const base = rankLabel(model.layout.baseRank as Rank);
    t.foundations.forEach((rect, i) => {
      if (!model.layout.foundations[i]) this.slot(rect, base);
    });
    t.tableau.forEach((rect, i) => {
      if (model.layout.tableau[i]!.length === 0) this.slot(rect, null);
    });
    if (model.layout.stock.length === 0) this.slot(t.reserve, null);
    if (model.layout.talon.length === 0) this.slot(t.talon, null);
    if (model.layout.hand.length === 0) this.slot(t.hand, null);
  }

  /** Counts under the reserve, talon and hand, clear of the deepest stack's edges. */
  private drawLabels(model: TableModel): void {
    if (!model.labels || model.finish) return;
    const t = this.table;
    const below = (rect: Rect) => rect.y + rect.h + t.card.h * 0.125;
    this.label(`Reserve · ${model.layout.stock.length}`, centreOf(t.reserve).x, below(t.reserve));
    this.label(`Talon · ${model.layout.talon.length}`, centreOf(t.talon).x, below(t.talon));
    this.label(`Hand · ${model.layout.hand.length}`, centreOf(t.hand).x, below(t.hand));
  }

  private visible(model: TableModel, card: CardId): boolean {
    return !model.hidden.has(card);
  }

  /** How far a refused card is pushed sideways right now; never under reduced motion. */
  private jitter(model: TableModel, card: CardId, time: number): number {
    return this.motion ? shakeOffset(model, card, time, this.table.card.w) : 0;
  }

  private drawFoundations(model: TableModel, time: number): void {
    const t = this.table;
    t.foundations.forEach((rect, i) => {
      const bloom = model.blooms[i];
      if (bloom)
        drawBloom(this.ctx, rect.x, rect.y, rect.w, rect.h, bloom, this.look, time, this.motion);
      const pile = model.layout.foundations[i];
      if (!pile) return;
      const shown = pile.filter((card) => this.visible(model, card));
      const top = shown.at(-1);
      if (top === undefined) return;
      drawStackEdges(this.ctx, this.sprites, rect.x, rect.y, Math.min(shown.length, 6), this.look);
      drawCard(
        this.ctx,
        this.sprites,
        top,
        { x: rect.x, y: rect.y, faceUp: true },
        this.look,
        'resting',
      );
    });
  }

  private drawReserve(model: TableModel, time: number): void {
    const rect = this.table.reserve;
    const stock = model.layout.stock.filter((c) => this.visible(model, c));
    const top = stock.at(-1);
    if (top === undefined) return;
    drawStackEdges(this.ctx, this.sprites, rect.x, rect.y, stock.length, this.look);
    drawCard(
      this.ctx,
      this.sprites,
      top,
      { x: rect.x + this.jitter(model, top, time), y: rect.y, faceUp: true },
      this.look,
      'resting',
    );
  }

  private drawHandAndTalon(model: TableModel, time: number): void {
    const t = this.table;
    const hand = model.layout.hand.filter((c) => this.visible(model, c));
    if (hand.length > 0) {
      drawStackEdges(this.ctx, this.sprites, t.hand.x, t.hand.y, hand.length, this.look);
      drawCard(
        this.ctx,
        this.sprites,
        hand.at(-1)!,
        { x: t.hand.x, y: t.hand.y, faceUp: false },
        this.look,
        'resting',
      );
    }
    const talon = model.layout.talon.filter((c) => this.visible(model, c));
    const talonTop = talon.at(-1);
    if (talonTop !== undefined) {
      drawStackEdges(this.ctx, this.sprites, t.talon.x, t.talon.y, talon.length, this.look);
      drawCard(
        this.ctx,
        this.sprites,
        talonTop,
        { x: t.talon.x + this.jitter(model, talonTop, time), y: t.talon.y, faceUp: true },
        this.look,
        'resting',
      );
    }
  }

  private drawTableau(model: TableModel, time: number): void {
    model.layout.tableau.forEach((pile, index) => {
      pile.forEach((card, depth) => {
        if (!this.visible(model, card)) return;
        const at = this.tableauCard(index, depth, pile.length);
        drawCard(
          this.ctx,
          this.sprites,
          card,
          { x: at.x + this.jitter(model, card, time), y: at.y, faceUp: true },
          this.look,
          'resting',
        );
      });
    });
  }

  private outline(rect: Rect, colour: string, width: number, glow: number): void {
    const ctx = this.ctx;
    ctx.save();
    roundedRect(ctx, rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, rect.w * CORNER + 4);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.shadowColor = colour;
    ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.restore();
  }

  /** The rectangle a place's top card (or the space it would fill) occupies. */
  placeRect(place: Place, layout: Layout): Rect {
    if (place.kind === 'tableau') {
      const length = layout.tableau[place.index]!.length;
      const at = this.tableauCard(place.index, Math.max(0, length - 1), Math.max(1, length));
      return { x: at.x, y: at.y, w: this.table.card.w, h: this.table.card.h };
    }
    return this.rectOf(place);
  }

  private drawHighlights(model: TableModel, time: number): void {
    const pulse = this.motion ? 0.5 + 0.5 * Math.sin(time * 4) : 1;
    for (const place of model.targets)
      this.outline(this.placeRect(place, model.layout), this.look.target, 2.5, 10 + 8 * pulse);
    if (model.hint) {
      this.outline(this.placeRect(model.hint.from, model.layout), this.look.hint, 3, 14 * pulse);
      this.outline(this.placeRect(model.hint.to, model.layout), this.look.hint, 3, 14 * pulse);
    }
    if (model.selected) {
      const rect = this.placeRect(model.selected.place, model.layout);
      this.outline(rect, this.look.target, 3, 12);
    }
    if (model.cursor)
      this.outline(this.placeRect(model.cursor, model.layout), this.look.cursor, 3.5, 6);
  }

  private drawDrag(drag: DragView): void {
    const step = this.table.card.h * 0.24;
    const pull = drag.snap ? drag.pull : 0;
    const x = drag.snap
      ? drag.corner.x + (drag.snap.x - drag.corner.x) * pull * 0.35
      : drag.corner.x;
    const y = drag.snap
      ? drag.corner.y + (drag.snap.y - drag.corner.y) * pull * 0.35
      : drag.corner.y;
    const tilt = Math.max(-0.19, Math.min(0.19, drag.velocity.x / 2600)) * (this.motion ? 1 : 0);
    drag.cards.forEach((card, i) => {
      // Cards lower in a dragged run lean a touch more: the run swings from the grip.
      const pose: Pose = {
        x: x - Math.sin(tilt) * i * step * 0.6,
        y: y + i * step,
        rotation: tilt * (1 + i * 0.08),
        lift: 1,
        faceUp: true,
      };
      drawCard(this.ctx, this.sprites, card, pose, this.look, i === 0 ? 'cast' : 'resting');
    });
  }

  private drawFlight(flight: Flight, time: number): void {
    const raw = (time - flight.start) / flight.duration;
    if (raw < 0) {
      drawCard(this.ctx, this.sprites, flight.card, flight.from, this.look, 'resting');
      return;
    }
    const t = this.motion ? ease.inOutCubic(Math.min(1, raw)) : 1;
    const from = flight.from;
    const to = flight.to;
    const arc = Math.sin(Math.PI * t) * flight.arc;
    const turning = flight.flips ? Math.min(1, Math.max(0, (t - 0.1) / 0.75)) : 0;
    const angle = turning * Math.PI;
    const pose: Pose = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - arc,
      rotation: (from.rotation ?? 0) + ((to.rotation ?? 0) - (from.rotation ?? 0)) * t,
      lift: Math.sin(Math.PI * t) * 0.8,
      faceUp: flight.flips ? angle > Math.PI / 2 : to.faceUp,
      narrow: flight.flips ? Math.max(0.03, Math.abs(Math.cos(angle))) : 1,
      sheen: flight.flips ? Math.sin(angle) : 0,
    };
    drawCard(this.ctx, this.sprites, flight.card, pose, this.look, 'cast');
  }

  /** The finish: every card spirals up off its foundation and settles into one neat stack. */
  private drawFinish(finish: FinishView, time: number): void {
    const t = this.table;
    const centre = finishCentre(t);
    const age = time - finish.startedAt;
    // Settled cards first, so the arms of the spiral sweep over the growing stack.
    const order = finish.cards
      .map((_, i) => i)
      .sort(
        (a, b) =>
          (finishProgress(b, age, this.motion) ?? 0) - (finishProgress(a, age, this.motion) ?? 0),
      );
    for (const i of order) {
      const pose = finishPose(finish, i, age, t, centre, this.motion);
      if (!pose) continue;
      const shadow = (pose.lift ?? 0) > 0.05 ? 'cast' : 'resting';
      drawCard(this.ctx, this.sprites, finish.cards[i]!, pose, this.look, shadow);
    }
  }
}

/** Cards that have left their foundation for the finish's spiral by this time. */
function withFinishHidden(model: TableModel, time: number, motion: boolean): Set<CardId> {
  const finish = model.finish!;
  const age = time - finish.startedAt;
  const hidden = new Set(model.hidden);
  finish.cards.forEach((card, i) => {
    if (finishProgress(i, age, motion) !== null) hidden.add(card);
  });
  return hidden;
}

/** The blooms open together first; then the four foundations send their cards off at once. */
export const FINISH_DELAY = 1.1;
const FINISH_STAGGER = 0.07;
const FINISH_FLIGHT = 1.7;
/** How far round each arm of the spiral winds on its way in. */
const FINISH_TURNS = 0.85;

/** How long the finish runs, in seconds, start to last card settled. */
export function finishSeconds(finish: FinishView): number {
  return FINISH_DELAY + Math.ceil(finish.cards.length / 4) * FINISH_STAGGER + FINISH_FLIGHT;
}

/** How far card `i` is along its arm (0 leaving, 1 settled), or null while still home. */
function finishProgress(i: number, age: number, motion: boolean): number | null {
  // Without motion the deck is simply squared up on the table at once.
  if (!motion) return age >= 0 ? 1 : null;
  const start = FINISH_DELAY + Math.floor(i / 4) * FINISH_STAGGER;
  if (age < start) return null;
  return motion ? Math.min(1, (age - start) / FINISH_FLIGHT) : 1;
}

/** Where the cards gather: the middle of the play area, below the foundations. */
export function finishCentre(t: TableLayout): { x: number; y: number } {
  const first = t.foundations[0]!;
  const last = t.foundations[3]!;
  return {
    x: (first.x + last.x + t.card.w) / 2,
    y: t.tableau[0]!.y + t.card.h * 0.55,
  };
}

/**
 * Where card `i` of the finish is `age` seconds in. Each foundation sends its cards along one
 * arm of a four-armed spiral that winds in to the centre, the cards spaced along it like a
 * galaxy's stars or petals in a whirl, then each settles squarely on one neat stack. Null while
 * the card is still on its foundation.
 */
export function finishPose(
  finish: FinishView,
  i: number,
  age: number,
  t: TableLayout,
  centre: { x: number; y: number },
  motion: boolean,
): Pose | null {
  const s = finishProgress(i, age, motion);
  if (s === null) return null;
  const foundation = t.foundations[i % 4]!;
  const from = { x: foundation.x + t.card.w / 2, y: foundation.y + t.card.h / 2 };
  const startAngle = Math.atan2((from.y - centre.y) / 0.8, from.x - centre.x);
  const startRadius = Math.hypot(from.x - centre.x, (from.y - centre.y) / 0.8);
  const radius = startRadius * (1 - s) ** 1.35;
  const angle = startAngle + s * FINISH_TURNS * Math.PI * 2;
  const along = {
    x: centre.x + Math.cos(angle) * radius,
    y: centre.y + Math.sin(angle) * radius * 0.8,
  };
  const settled = Math.floor(i / 4) * 4 + (i % 4);
  const stack = {
    x: centre.x + (((settled * 7) % 5) - 2) * 0.35,
    y: centre.y - settled * Math.max(0.45, t.card.h * 0.0026),
  };
  const land = ease.inOutCubic(Math.max(0, (s - 0.86) / 0.14));
  const x = along.x + (stack.x - along.x) * land - t.card.w / 2;
  const y = along.y + (stack.y - along.y) * land - t.card.h / 2;
  const arc = Math.sin(Math.PI * s);
  const card = finish.cards[i]!;
  return {
    x,
    y,
    // Cards ride the arm pointing out from the centre, then square up on the stack.
    rotation: (angle + Math.PI / 2) * (1 - land) + ((card % 3) - 1) * 0.006 * land,
    lift: arc * 0.9,
    scale: 1 - arc * 0.16,
    faceUp: true,
  };
}
