import type { CardId } from '@usr-games/kit/cards';
import type { CutForDeal, GameLength, Seat } from '../engine/match';
import type { ShowCombo } from '../engine/score';
import { leapingPeg } from '../render/arrange';
import { holeFor, type PegDraw } from '../render/board';
import { ringFor, type ShowFx } from '../render/count-fx';
import type { Callout } from '../render/effects';
import { CARD, fanPositions, LAYOUT, type Point, showPositions } from '../render/layout';
import type { Look } from '../render/look';
import { emptyScene, type Scene, type TableLabel } from '../render/scene';
import type { CardTarget, CardVisuals } from './visuals';

/**
 * The table as it is being shown, which runs a little behind the game itself while the
 * director animates each event: whose cards are where, the count, the pegs (two each, one of
 * them perhaps in mid-jump), the hand being counted, words in the air. `buildScene` turns it
 * into a picture for `TableView`.
 */

export interface PegState {
  /** Where each of the two pegs stands. */
  at: [number, number];
  leap: { peg: 0 | 1; from: number; to: number; start: number; duration: number } | null;
}

export interface ShowState {
  seat: Seat;
  isCrib: boolean;
  cards: CardId[];
  starter: CardId;
  combos: ShowCombo[];
  /** Combos before this are counted; this one is lighting up since `activeStart`. */
  active: number;
  activeStart: number;
  /** Seconds each combo takes to light. */
  step: number;
  gold: number;
  waitingForClaim: boolean;
}

export interface TimedCallout extends Omit<Callout, 't'> {
  start: number;
  duration: number;
}

export interface TableModel {
  names: [string, string];
  length: GameLength;
  dealer: Seat;
  yourHand: CardId[];
  rivalHand: CardId[];
  /** After the play, the computer's four are shown face up for everyone to see. */
  rivalFaceUp: boolean;
  crib: CardId[];
  stock: number;
  starter: CardId | null;
  pile: CardId[];
  turned: CardId[];
  count: number;
  countFlashAt: number;
  plates: [number, number];
  plateGlowAt: [number, number];
  pegs: [PegState, PegState];
  show: ShowState | null;
  cutForDeal: CutForDeal | null;
  callouts: TimedCallout[];
  stamp: { word: string; start: number } | null;
  celebration: { start: number } | null;
  /** Your choices in the making. */
  selected: CardId[];
  focus: CardId | null;
  playable: CardId[] | null;
  coach: CardId[];
  drag: { card: CardId; at: Point } | null;
  /** Where newly dealt cards come from, and when each leaves the deck. */
  dealHold: Map<CardId, number>;
  /** While cards are being laid away: mark the empty crib as the place to throw them. */
  cribSpot: boolean;
}

export function emptyModel(names: [string, string], length: GameLength): TableModel {
  return {
    names,
    length,
    dealer: 1,
    yourHand: [],
    rivalHand: [],
    rivalFaceUp: false,
    crib: [],
    stock: 52,
    starter: null,
    pile: [],
    turned: [],
    count: 0,
    countFlashAt: -10,
    plates: [0, 0],
    plateGlowAt: [-10, -10],
    pegs: [
      { at: [0, 0], leap: null },
      { at: [0, 0], leap: null },
    ],
    show: null,
    cutForDeal: null,
    callouts: [],
    stamp: null,
    celebration: null,
    selected: [],
    focus: null,
    playable: null,
    coach: [],
    drag: null,
    dealHold: new Map(),
    cribSpot: false,
  };
}

export const PEG_LEAP_SECONDS = 0.6;

/** Starts a peg jumping from `back` to `to`; the plate changes when it lands. */
export function startLeap(model: TableModel, side: Seat, back: number, to: number, now: number) {
  const pegs = model.pegs[side];
  if (pegs.leap) {
    // A jump still in the air lands at once before the next one begins.
    pegs.at[pegs.leap.peg] = pegs.leap.to;
    model.plates[side] = Math.max(model.plates[side], pegs.leap.to);
    pegs.leap = null;
  }
  // Both pegs start in the start holes; the second one moves first.
  const peg: 0 | 1 = pegs.at[1] === back ? 1 : 0;
  pegs.leap = {
    peg,
    from: back,
    to,
    start: now,
    duration: PEG_LEAP_SECONDS + Math.min(0.35, Math.abs(to - back) * 0.012),
  };
}

/** Finishes any jump whose time is up. Returns the sides that landed this frame. */
export function settleLeaps(model: TableModel, now: number): Seat[] {
  const landed: Seat[] = [];
  for (const side of [0, 1] as const) {
    const leap = model.pegs[side].leap;
    if (leap && now >= leap.start + leap.duration) {
      model.pegs[side].at[leap.peg] = leap.to;
      model.pegs[side].leap = null;
      model.plates[side] = Math.max(model.plates[side], leap.to);
      model.plateGlowAt[side] = now;
      landed.push(side);
    }
  }
  return landed;
}

function pegDraws(model: TableModel, now: number): PegDraw[] {
  const draws: PegDraw[] = [];
  for (const side of [0, 1] as const) {
    const state = model.pegs[side];
    for (const index of [0, 1] as const) {
      const leap = state.leap;
      if (leap && leap.peg === index) {
        const t = Math.min(1, Math.max(0, (now - leap.start) / leap.duration));
        draws.push(leapingPeg(side, leap.from, leap.to, model.length, t));
      } else {
        const at = state.at[index];
        draws.push({ side, at: holeFor(side, at, model.length, at === 0 ? index : 0), lift: 0 });
      }
    }
  }
  return draws;
}

/** Where each card belongs right now. */
function cardTargets(model: TableModel, look: Look, now: number, time: number): CardTarget[] {
  const targets: CardTarget[] = [];
  const stock = LAYOUT.stock;
  const fromStock = (card: CardId) =>
    model.dealHold.has(card) ? { from: stock, holdUntil: model.dealHold.get(card) } : {};
  const onStage = new Set(model.show ? [...model.show.cards, model.show.starter] : []);

  if (model.cutForDeal) {
    const { you, rival } = model.cutForDeal;
    targets.push({
      card: you,
      faceUp: true,
      ...LAYOUT.cutForDeal.you,
      height: CARD.pile,
      z: 50,
      from: stock,
    });
    targets.push({
      card: rival,
      faceUp: true,
      ...LAYOUT.cutForDeal.rival,
      height: CARD.pile,
      z: 51,
      from: stock,
    });
  }

  model.crib.forEach((card, i) => {
    if (onStage.has(card)) return;
    const at = model.dealer === 0 ? LAYOUT.crib.you : LAYOUT.crib.rival;
    targets.push({
      card,
      faceUp: false,
      x: at.x + (i - 1.5) * 5,
      y: at.y - i * 2,
      height: CARD.stock,
      angle: -0.08 + i * 0.05,
      z: 10 + i,
    });
  });

  if (model.starter !== null && !onStage.has(model.starter)) {
    targets.push({
      card: model.starter,
      faceUp: true,
      ...LAYOUT.starter,
      height: CARD.stock,
      angle: 0.04,
      z: 15,
      from: stock,
    });
  }

  model.turned.forEach((card, i) => {
    targets.push({
      card,
      faceUp: false,
      x: LAYOUT.turned.x + (i % 3) * 1.5,
      y: LAYOUT.turned.y - i * 1.4,
      height: CARD.stock,
      angle: ((i * 29) % 9) * 0.012 - 0.05,
      z: 20 + i,
    });
  });

  model.pile.forEach((card, i) => {
    targets.push({
      card,
      faceUp: true,
      x: LAYOUT.pileStartX + i * LAYOUT.pileStep,
      y: LAYOUT.pileY + (i % 2 === 0 ? 0 : -6),
      height: CARD.pile,
      angle: ((i * 37) % 7) * 0.006 - 0.018,
      z: 30 + i,
    });
  });

  const rivalFan = fanPositions(
    model.rivalHand.length,
    LAYOUT.centreX,
    LAYOUT.rivalY,
    CARD.rival,
    model.rivalFaceUp ? 0.7 : 0.62,
  );
  model.rivalHand.forEach((card, i) => {
    if (onStage.has(card)) return;
    targets.push({
      card,
      faceUp: model.rivalFaceUp,
      x: rivalFan[i]!.x,
      y: rivalFan[i]!.y,
      height: CARD.rival,
      angle: -rivalFan[i]!.angle,
      z: 40 + i,
      ...fromStock(card),
    });
  });

  // While a hand is being counted, yours steps back towards the edge of the table.
  const resting = model.show !== null;
  const handHeight = resting ? CARD.resting : CARD.hand;
  const fan = fanPositions(
    model.yourHand.length,
    LAYOUT.centreX,
    resting ? LAYOUT.restingY : LAYOUT.handY,
    handHeight,
  );
  model.yourHand.forEach((card, i) => {
    if (onStage.has(card)) return;
    const selected = model.selected.includes(card);
    const focused = model.focus === card;
    const dragged = model.drag?.card === card;
    const coach = model.coach.includes(card);
    const position = dragged ? model.drag!.at : fan[i]!;
    targets.push({
      card,
      faceUp: true,
      x: position.x,
      y: dragged ? position.y : fan[i]!.y - (selected ? 46 : focused ? 16 : 0),
      height: handHeight,
      angle: dragged ? 0 : fan[i]!.angle,
      lift: dragged ? 1 : selected ? 0.7 : focused ? 0.35 : 0,
      z: dragged ? 200 : 60 + i,
      dim: model.playable !== null && !model.playable.includes(card),
      ring: coach
        ? { colour: look.glow.run, strength: 0.55 + 0.25 * Math.sin(time * 3) }
        : undefined,
      ...fromStock(card),
    });
  });

  if (model.show) {
    const show = model.show;
    const cards = [...show.cards, show.starter];
    const positions = showPositions(cards.length, LAYOUT.centreX);
    const fx = showFx(model, now);
    cards.forEach((card, i) => {
      targets.push({
        card,
        faceUp: true,
        x: positions[i]!.x,
        y: positions[i]!.y,
        height: CARD.show,
        angle: i === cards.length - 1 ? 0.03 : 0,
        lift: 0.2,
        z: 100 + i,
        gold: show.gold,
        ring: fx ? ringFor(look, fx, card, time) : undefined,
      });
    });
  }
  return targets;
}

export function showFx(model: TableModel, now: number): ShowFx | null {
  const show = model.show;
  if (!show || show.waitingForClaim || show.active < 0) return null;
  const cards = [...show.cards, show.starter];
  const positions = showPositions(cards.length, LAYOUT.centreX);
  return {
    combos: show.combos,
    positions: new Map(cards.map((card, i) => [card, positions[i]!])),
    active: show.active,
    progress: Math.min(1, (now - show.activeStart) / show.step),
  };
}

function labels(model: TableModel): TableLabel[] {
  const list: TableLabel[] = [];
  if (model.starter !== null && !model.show) {
    list.push({ text: 'Starter', at: { x: LAYOUT.starter.x, y: LAYOUT.starter.y + 96 } });
  }
  if ((model.crib.length > 0 || model.cribSpot) && !(model.show?.isCrib ?? false)) {
    const at = model.dealer === 0 ? LAYOUT.crib.you : LAYOUT.crib.rival;
    const whose = model.dealer === 0 ? 'Your crib' : `${model.names[1]}'s crib`;
    list.push({ text: whose, at: { x: at.x, y: at.y + 96 } });
  }
  if (model.show) {
    const positions = showPositions(model.show.cards.length + 1, LAYOUT.centreX);
    list.push({
      text: 'Starter',
      at: { x: positions[positions.length - 1]!.x, y: LAYOUT.show.y + 140 },
    });
  }
  if (model.cutForDeal) {
    list.push({
      text: 'You cut',
      at: { x: LAYOUT.cutForDeal.you.x, y: LAYOUT.cutForDeal.you.y + 112 },
    });
    list.push({
      text: `${model.names[1]} cuts`,
      at: { x: LAYOUT.cutForDeal.rival.x, y: LAYOUT.cutForDeal.rival.y + 112 },
    });
  }
  return list;
}

export interface SceneInputs {
  look: Look;
  /** The director's clock (stops while paused). */
  now: number;
  /** Wall time for ambient motion (fire, leaves, glints). */
  time: number;
  dt: number;
  still: boolean;
  visuals: CardVisuals;
}

export function buildScene(model: TableModel, inputs: SceneInputs): Scene {
  const { look, now, time, dt, still, visuals } = inputs;
  settleLeaps(model, now);
  model.callouts = model.callouts.filter((callout) => now < callout.start + callout.duration);
  const cards = visuals.update(cardTargets(model, look, now, time), dt, now, still);
  const flash = Math.max(0, 1 - (now - model.countFlashAt) / 0.8);
  const inPlay = model.pile.length > 0 || model.count > 0 || model.turned.length > 0;
  const celebrating = model.celebration ? Math.min(1, (now - model.celebration.start) / 0.6) : 0;
  return {
    ...emptyScene(look),
    time,
    still,
    length: model.length,
    names: model.names,
    plates: model.plates,
    plateGlow: [0, 1].map((side) => Math.max(0, 1 - (now - model.plateGlowAt[side]!) / 1.2)) as [
      number,
      number,
    ],
    pegs: pegDraws(model, now),
    stock: model.stock > 0 ? { at: LAYOUT.stock, cards: model.stock } : null,
    cards,
    countDial: inPlay ? { value: model.count, flash, label: 'the count' } : null,
    showFx: showFx(model, now),
    celebration: model.celebration
      ? { t: celebrating, centre: { x: LAYOUT.centreX, y: LAYOUT.show.y } }
      : null,
    callouts: model.callouts.map((callout) => ({
      ...callout,
      t: Math.min(1, (now - callout.start) / callout.duration),
    })),
    stamp: model.stamp
      ? {
          word: model.stamp.word,
          t: Math.min(1, (now - model.stamp.start) / 1.6),
          at: { x: 1730, y: 560 },
        }
      : null,
    labels: labels(model),
    ghosts:
      model.cribSpot && model.crib.length === 0
        ? [{ at: model.dealer === 0 ? LAYOUT.crib.you : LAYOUT.crib.rival, height: CARD.stock }]
        : [],
  };
}
