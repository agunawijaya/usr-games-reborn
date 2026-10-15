import { type Distance, type Kind, type Safety, DISTANCES, MILES, SAFETIES } from '../engine/cards';
import { CARD_ASPECT } from './card-art';
import type { Rect, SideSlots, TableLayout } from './layout';
import type { Look } from './look';
import {
  type Ctx,
  DISPLAY_FONT,
  alpha,
  circle,
  fillWith,
  hash01,
  roundRect,
  seeded,
  strokeWith,
} from './paint';
import type { CardSprites } from './sprites';

/**
 * The table under the road: a road atlas spread open, the two sides' placards with their piles,
 * and your hand, the deck and the discard pile along the bottom.
 */

export interface SideView {
  name: string;
  miles: number;
  battle: Kind | null;
  /** How many cards lie under the battle pile's top card. */
  battleDepth: number;
  speed: Kind | null;
  safeties: Readonly<Record<Safety, 'none' | 'played' | 'coup'>>;
  distances: Readonly<Record<Distance, number>>;
  coups: number;
  /** The car's colour, for the placard's chip. */
  colour: string;
  /** The trip this hand: 700, or 1000 after an extension. */
  trip: number;
}

export interface HandCardView {
  kind: Kind | null;
  /** 0–1: raised for the keyboard or the pointer. */
  lift: number;
  selected: boolean;
  /** The helper greys out what cannot be played now. */
  dim: boolean;
  /** The helper's "save for a counter" ribbon on a safety. */
  counter: boolean;
  /** A safety that can parry right now glows. */
  parry: boolean;
}

export interface FlyingCard {
  kind: Kind | null;
  x: number;
  y: number;
  w: number;
  rotation: number;
  alpha: number;
  /** Lifted cards cast a longer shadow. */
  height: number;
}

export interface TableView {
  sides: [SideView, SideView];
  hand: HandCardView[];
  deckLeft: number;
  discardTop: Kind | null;
  /** Piles to light up as places the chosen card may go. */
  targets: readonly string[];
  /** The pile under the pointer or keyboard while choosing. */
  hover: string | null;
  flying: readonly FlyingCard[];
  /** Cards whose own place is empty while they fly (pile keys, hand slots). */
  hidden: readonly string[];
  time: number;
}

function pileKey(side: 0 | 1, pile: 'battle' | 'speed' | 'miles' | 'safety'): string {
  return `${pile}-${side}`;
}

/** The atlas the cards lie on, painted once per size and look. */
export function paintAtlas(ctx: Ctx, w: number, h: number, look: Look, top: number): void {
  const t = look.table;
  ctx.fillStyle = t.paper;
  ctx.fillRect(0, top, w, h - top);
  const rand = seeded(7);
  // Contour lines round a few hills.
  ctx.strokeStyle = t.contour;
  ctx.lineWidth = 1.2;
  for (let hill = 0; hill < 6; hill++) {
    const cx = rand() * w;
    const cy = top + rand() * (h - top);
    const base = 30 + rand() * 60;
    for (let ring = 0; ring < 6; ring++) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) {
        const wobble = 1 + 0.18 * Math.sin(a * 3 + hill) + 0.1 * Math.sin(a * 5 + ring);
        const rr = (base + ring * 26) * wobble;
        const x = cx + Math.cos(a) * rr * 1.4;
        const y = cy + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // Rivers, then roads over them.
  const wander = (colour: string, width: number, count: number, salt: number) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (let k = 0; k < count; k++) {
      ctx.beginPath();
      let x = hash01(k, salt) * w;
      let y = top;
      let heading = Math.PI / 2 + (hash01(k, salt + 1) - 0.5);
      ctx.moveTo(x, y);
      for (let step = 0; step < 60 && y < h + 20; step++) {
        heading += (hash01(k * 97 + step, salt + 2) - 0.5) * 0.5;
        x += Math.cos(heading) * 28;
        y += Math.abs(Math.sin(heading)) * 28 + 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };
  wander(t.river, 5, 2, 11);
  wander(t.road, 4, 5, 21);
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  wander(t.road, 3, 3, 31);
  ctx.restore();
  // The map's fold creases.
  for (let i = 1; i < 4; i++) {
    const x = (w * i) / 4;
    const grad = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
    grad.addColorStop(0, alpha('#000000', 0));
    grad.addColorStop(0.5, t.fold);
    grad.addColorStop(1, alpha('#000000', 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - 18, top, 36, h - top);
  }
  const mid = top + (h - top) / 2;
  const grad = ctx.createLinearGradient(0, mid - 14, 0, mid + 14);
  grad.addColorStop(0, alpha('#000000', 0));
  grad.addColorStop(0.5, t.fold);
  grad.addColorStop(1, alpha('#000000', 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, mid - 14, w, 28);
  if (look.dark) {
    // A reading lamp's pool of light over the hand.
    const lamp = ctx.createRadialGradient(w * 0.55, h * 0.95, 0, w * 0.55, h * 0.95, h * 0.75);
    lamp.addColorStop(0, t.lamp);
    lamp.addColorStop(1, alpha('#000000', 0));
    ctx.fillStyle = lamp;
    ctx.fillRect(0, top, w, h - top);
  }
}

export function drawTable(
  ctx: Ctx,
  layout: TableLayout,
  view: TableView,
  look: Look,
  sprites: CardSprites,
): void {
  view.sides.forEach((side, i) =>
    placard(ctx, layout, layout.sides[i]!, side, i as 0 | 1, view, look, sprites),
  );
  deckAndDiscard(ctx, layout, view, look, sprites);
  hand(ctx, layout, view, look, sprites);
  for (const card of view.flying) flying(ctx, card, look, sprites, layout.scale);
}

function shadowed(ctx: Ctx, look: Look, lift: number, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = look.table.shadow;
  ctx.shadowBlur = 6 + lift * 22;
  ctx.shadowOffsetY = 2 + lift * 10;
  draw();
  ctx.restore();
}

function cardAt(
  ctx: Ctx,
  sprites: CardSprites,
  kind: Kind | null,
  rect: Rect,
  look: Look,
  lift = 0,
  compact = false,
): void {
  const image =
    kind === null ? sprites.back(rect.w, rect.h) : sprites.face(kind, rect.w, rect.h, compact);
  shadowed(ctx, look, lift, () => ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h));
}

function emptySlot(
  ctx: Ctx,
  rect: Rect,
  look: Look,
  label: string,
  lit: boolean,
  scale: number,
): void {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.w * 0.07);
  ctx.save();
  ctx.setLineDash([6 * scale, 5 * scale]);
  strokeWith(ctx, lit ? look.table.target : look.table.slot, (lit ? 2.6 : 1.6) * scale);
  ctx.restore();
  ctx.fillStyle = lit ? look.table.target : look.table.labelSoft;
  ctx.font = `750 ${Math.max(9, 12 * scale)}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function highlight(
  ctx: Ctx,
  rect: Rect,
  look: Look,
  strong: boolean,
  scale: number,
  time: number,
): void {
  const pulse = 0.55 + 0.45 * Math.sin(time * 5);
  roundRect(
    ctx,
    rect.x - 5 * scale,
    rect.y - 5 * scale,
    rect.w + 10 * scale,
    rect.h + 10 * scale,
    rect.w * 0.1,
  );
  strokeWith(
    ctx,
    alpha(look.table.target, strong ? 1 : 0.5 + 0.4 * pulse),
    (strong ? 4 : 3) * scale,
  );
}

function placard(
  ctx: Ctx,
  layout: TableLayout,
  slots: SideSlots,
  side: SideView,
  index: 0 | 1,
  view: TableView,
  look: Look,
  sprites: CardSprites,
): void {
  const s = layout.scale;
  const p = slots.panel;
  shadowed(ctx, look, 0.1, () => {
    roundRect(ctx, p.x, p.y, p.w, p.h, 16 * s);
    fillWith(ctx, look.table.placard);
  });
  roundRect(ctx, p.x, p.y, p.w, p.h, 16 * s);
  strokeWith(ctx, look.table.placardEdge, 1.2 * s);
  // Header: the car's colour, the side's name, its miles.
  circle(ctx, p.x + 30 * s, p.y + 28 * s, 9 * s);
  fillWith(ctx, side.colour);
  ctx.fillStyle = look.table.label;
  ctx.font = `800 ${22 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(side.name, p.x + 48 * s, p.y + 29 * s);
  const nameW = ctx.measureText(side.name).width;
  ctx.fillStyle = look.table.labelSoft;
  ctx.font = `650 ${15 * s}px ${DISPLAY_FONT}`;
  if (side.coups) {
    ctx.fillText(
      `${side.coups} coup${side.coups > 1 ? 's' : ''} fourré${side.coups > 1 ? 's' : ''}`,
      p.x + 48 * s + nameW + 14 * s,
      p.y + 30 * s,
    );
  }

  const label = (rect: Rect, text: string) => {
    ctx.fillStyle = look.table.labelSoft;
    ctx.font = `750 ${11.5 * s}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, rect.x + rect.w / 2, rect.y - 7 * s);
  };
  const lit = (key: string) => view.targets.includes(key);
  const hidden = (key: string) => view.hidden.includes(key);

  // Battle pile: only the top card counts, a few edges show the pile beneath.
  label(slots.battle, 'BATTLE');
  const battleKey = pileKey(index, 'battle');
  if (side.battle && !hidden(battleKey)) {
    for (let k = Math.min(3, side.battleDepth); k > 0; k--) {
      roundRect(
        ctx,
        slots.battle.x + k * 2.5 * s,
        slots.battle.y + k * 2.5 * s,
        slots.battle.w,
        slots.battle.h,
        slots.battle.w * 0.07,
      );
      fillWith(ctx, look.card.paperEdge);
    }
    cardAt(ctx, sprites, side.battle, slots.battle, look);
  } else emptySlot(ctx, slots.battle, look, 'stopped', lit(battleKey), s);
  if (lit(battleKey)) highlight(ctx, slots.battle, look, view.hover === battleKey, s, view.time);

  label(slots.speed, 'SPEED');
  const speedKey = pileKey(index, 'speed');
  if (side.speed && !hidden(speedKey)) cardAt(ctx, sprites, side.speed, slots.speed, look);
  else emptySlot(ctx, slots.speed, look, 'open', lit(speedKey), s);
  if (lit(speedKey)) highlight(ctx, slots.speed, look, view.hover === speedKey, s, view.time);

  odometer(ctx, slots.odometer, side, look, s);

  // Safeties in a row; a coup fourré lies crosswise, as the rules ask.
  const first = slots.safeties[0]!;
  ctx.fillStyle = look.table.labelSoft;
  ctx.font = `750 ${11.5 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SAFETIES', first.x, first.y - 7 * s);
  SAFETIES.forEach((safety, i) => {
    const box = slots.safeties[i]!;
    const state = side.safeties[safety];
    const upright = { w: box.h / CARD_ASPECT, h: box.h };
    if (state === 'none' || hidden(`safety-${index}-${safety}`)) {
      const ghost = { x: box.x + (box.w - upright.w) / 2, y: box.y, w: upright.w, h: upright.h };
      roundRect(ctx, ghost.x, ghost.y, ghost.w, ghost.h, ghost.w * 0.08);
      ctx.save();
      ctx.setLineDash([4 * s, 4 * s]);
      strokeWith(ctx, alpha(look.table.slot, 0.75), 1.2 * s);
      ctx.restore();
      shieldGhost(ctx, ghost.x + ghost.w / 2, ghost.y + ghost.h / 2, 11 * s, look);
      return;
    }
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    if (state === 'coup') ctx.rotate(Math.PI / 2);
    cardAt(
      ctx,
      sprites,
      safety,
      { x: -upright.w / 2, y: -upright.h / 2, w: upright.w, h: upright.h },
      look,
      0.1,
      true,
    );
    ctx.restore();
  });
  const safetyKey = pileKey(index, 'safety');
  if (lit(safetyKey)) {
    const last = slots.safeties[3]!;
    highlight(
      ctx,
      { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h },
      look,
      view.hover === safetyKey,
      s,
      view.time,
    );
  }

  // Miles: a chip per distance with how many have been laid.
  const milesKey = pileKey(index, 'miles');
  const chipA = slots.miles[0]!;
  ctx.fillStyle = look.table.labelSoft;
  ctx.font = `750 ${11.5 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('MILES LAID', chipA.x, chipA.y - 7 * s);
  const fam = look.card.families.distance;
  DISTANCES.forEach((distance, i) => {
    const chip = slots.miles[i]!;
    const n = side.distances[distance];
    roundRect(ctx, chip.x, chip.y, chip.w, chip.h, chip.h / 2);
    if (n === 0) {
      ctx.save();
      ctx.setLineDash([4 * s, 4 * s]);
      strokeWith(ctx, alpha(look.table.slot, 0.6), 1.2 * s);
      ctx.restore();
    } else {
      fillWith(ctx, fam.base);
    }
    ctx.fillStyle = n === 0 ? alpha(look.table.labelSoft, 0.75) : fam.onBase;
    ctx.font = `800 ${19 * s}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(MILES[distance]), chip.x + 14 * s, chip.y + chip.h / 2 + 1 * s);
    if (n > 0) {
      ctx.font = `700 ${16 * s}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`×${n}`, chip.x + chip.w - 14 * s, chip.y + chip.h / 2 + 1 * s);
    }
  });
  if (lit(milesKey)) {
    const last = slots.miles[4]!;
    highlight(
      ctx,
      { x: chipA.x, y: chipA.y, w: last.x + last.w - chipA.x, h: chipA.h },
      look,
      view.hover === milesKey,
      s,
      view.time,
    );
  }
}

/** Miles so far in big figures, the trip under them, and a bar between. */
function odometer(ctx: Ctx, rect: Rect, side: SideView, look: Look, s: number): void {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12 * s);
  fillWith(ctx, look.dark ? alpha('#000000', 0.25) : alpha('#ffffff', 0.55));
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12 * s);
  strokeWith(ctx, look.table.placardEdge, 1 * s);
  const cx = rect.x + rect.w / 2;
  ctx.fillStyle = look.table.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${38 * s}px ${DISPLAY_FONT}`;
  ctx.fillText(String(side.miles), cx, rect.y + 48 * s);
  ctx.fillStyle = look.table.labelSoft;
  ctx.font = `700 ${13 * s}px ${DISPLAY_FONT}`;
  const left = side.trip - side.miles;
  ctx.fillText(
    left > 0 ? `of ${side.trip} · ${left} to go` : `${side.trip} · trip done`,
    cx,
    rect.y + 68 * s,
  );
  const bar = { x: rect.x + 14 * s, y: rect.y + rect.h - 24 * s, w: rect.w - 28 * s, h: 10 * s };
  roundRect(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2);
  fillWith(ctx, alpha(look.table.slot, 0.5));
  roundRect(
    ctx,
    bar.x,
    bar.y,
    Math.max(bar.h, bar.w * Math.min(1, side.miles / side.trip)),
    bar.h,
    bar.h / 2,
  );
  fillWith(ctx, side.colour);
}

/** The faint shield printed in an empty safety slot. */
function shieldGhost(ctx: Ctx, x: number, y: number, r: number, look: Look): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.88, y - r * 0.62);
  ctx.quadraticCurveTo(x + r * 0.84, y + r * 0.56, x, y + r * 1.04);
  ctx.quadraticCurveTo(x - r * 0.84, y + r * 0.56, x - r * 0.88, y - r * 0.62);
  ctx.closePath();
  fillWith(ctx, alpha(look.table.slot, 0.35));
}

function deckAndDiscard(
  ctx: Ctx,
  layout: TableLayout,
  view: TableView,
  look: Look,
  sprites: CardSprites,
): void {
  const s = layout.scale;
  const d = layout.deck;
  const layers = Math.min(6, Math.ceil(view.deckLeft / 15));
  if (view.deckLeft > 0) {
    for (let k = layers; k > 0; k--) {
      cardAt(ctx, sprites, null, { ...d, x: d.x - k * 1.4 * s, y: d.y - k * 1.4 * s }, look, 0.05);
    }
    cardAt(ctx, sprites, null, d, look, 0.1);
  } else emptySlot(ctx, d, look, 'empty', false, s);
  ctx.fillStyle = look.table.label;
  ctx.font = `750 ${15 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${view.deckLeft} left`, d.x + d.w / 2, d.y + d.h + 24 * s);
  const t = layout.discard;
  if (view.discardTop) cardAt(ctx, sprites, view.discardTop, t, look, 0.05);
  else emptySlot(ctx, t, look, 'empty', view.targets.includes('discard'), s);
  if (view.targets.includes('discard'))
    highlight(ctx, t, look, view.hover === 'discard', s, view.time);
  ctx.fillStyle = look.table.label;
  ctx.fillText('discards', t.x + t.w / 2, t.y + t.h + 24 * s);
}

function hand(
  ctx: Ctx,
  layout: TableLayout,
  view: TableView,
  look: Look,
  sprites: CardSprites,
): void {
  const s = layout.scale;
  view.hand.forEach((card, slot) => {
    const rect = layout.hand[slot]!;
    if (card.kind === null || view.hidden.includes(`hand-${slot}`)) {
      if (slot === 0) emptySlot(ctx, rect, look, 'next card', false, s);
      return;
    }
    const lift = card.lift * 22 * s;
    const r = { ...rect, y: rect.y - lift };
    cardAt(ctx, sprites, card.kind, r, look, 0.15 + card.lift * 0.6);
    if (card.dim) {
      roundRect(ctx, r.x, r.y, r.w, r.h, r.w * 0.07);
      fillWith(ctx, alpha(look.dark ? '#0b1120' : '#efe5cf', look.dark ? 0.55 : 0.5));
    }
    if (card.parry) {
      const pulse = 0.5 + 0.5 * Math.sin(view.time * 6);
      ctx.save();
      ctx.shadowColor = look.card.families.safety.base;
      ctx.shadowBlur = (16 + pulse * 18) * s;
      roundRect(ctx, r.x, r.y, r.w, r.h, r.w * 0.07);
      strokeWith(ctx, look.card.families.safety.base, 3.5 * s);
      ctx.restore();
    }
    if (card.selected) {
      roundRect(ctx, r.x - 4 * s, r.y - 4 * s, r.w + 8 * s, r.h + 8 * s, r.w * 0.09);
      strokeWith(ctx, look.table.cursor, 3.5 * s);
    }
    if (card.counter) counterRibbon(ctx, r, look, s);
  });
  // The pick slot is set a little apart, marked P like the original's.
  const pick = layout.hand[0]!;
  ctx.fillStyle = look.table.labelSoft;
  ctx.font = `750 ${12 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('NEW', pick.x + pick.w / 2, pick.y - 8 * s);
}

function counterRibbon(ctx: Ctx, r: Rect, look: Look, s: number): void {
  const text = 'save for a counter';
  ctx.font = `750 ${11 * s}px ${DISPLAY_FONT}`;
  const w = ctx.measureText(text).width + 14 * s;
  const x = r.x + r.w / 2 - w / 2;
  const y = r.y + r.h - 12 * s;
  roundRect(ctx, x, y, w, 20 * s, 10 * s);
  fillWith(ctx, look.card.families.safety.deep);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, y + 10.5 * s);
}

function flying(ctx: Ctx, card: FlyingCard, look: Look, sprites: CardSprites, scale: number): void {
  const w = card.w;
  const h = w * CARD_ASPECT;
  ctx.save();
  ctx.globalAlpha = card.alpha;
  ctx.translate(card.x, card.y);
  ctx.rotate(card.rotation);
  const image = card.kind === null ? sprites.back(w, h) : sprites.face(card.kind, w, h);
  ctx.shadowColor = look.table.shadow;
  ctx.shadowBlur = (10 + card.height * 30) * scale;
  ctx.shadowOffsetY = (4 + card.height * 24) * scale;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}
