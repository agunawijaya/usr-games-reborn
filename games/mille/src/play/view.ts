import { type Hazard, type Kind, isHazard, isSafety } from '../engine/cards';
import { type HandState, type Side, type Tableau, PICK_SLOT, playVerdict } from '../engine/hand';
import { RESTING } from '../render/car';
import type { Look } from '../render/look';
import type { RoadCar, Trouble } from '../render/road';
import type { RoadScene } from '../render/stage';
import type { Route } from '../render/routes';
import type { HandCardView, SideView } from '../render/table';

/**
 * Turns a hand of the engine into what the table and the road show. Nothing here changes the
 * game; the animator moves things between these pictures.
 */

export function sideView(state: HandState, side: Side, look: Look, name: string): SideView {
  const t = state.sides[side];
  return {
    name,
    miles: t.miles,
    battle: t.battle,
    battleDepth: Math.max(0, t.battlePile.length - 1),
    speed: t.speed,
    safeties: t.safeties,
    distances: t.distanceCounts,
    coups: t.coups,
    colour: look.cars[side].body,
    trip: state.end,
  };
}

export interface HandViewOptions {
  helper: boolean;
  selected: number | null;
  hover: number | null;
}

export function handView(state: HandState, seat: number, options: HandViewOptions): HandCardView[] {
  const hand = state.seats[seat]!.hand;
  return hand.map((card, slot) => {
    const kind = card === null ? null : state.cards[card]!;
    const verdict = kind === null ? 'empty-slot' : playVerdict(state, seat, slot);
    const myTurn = state.turn === seat && !state.over;
    return {
      kind,
      lift: options.selected === slot ? 1 : options.hover === slot ? 0.45 : 0,
      selected: options.selected === slot,
      dim:
        options.helper && myTurn && kind !== null && verdict !== 'ok' && verdict !== 'draw-first',
      counter: options.helper && kind !== null && isSafety(kind),
      parry: false,
    };
  });
}

/** What holds a car up, as the road shows it. */
export function troubleOf(t: Tableau): Trouble {
  if (t.canGo) return null;
  if (isHazard(t.battle)) return t.battle as Hazard;
  // Waiting for a green light: at the start, after a red light, or after a repair.
  return 'redLight';
}

/** The name over a car: in partnerships each car carries a whole team. */
export function carTag(state: HandState, side: Side, look: Look): string {
  if (!state.rules.teams) return look.cars[side].tag;
  return side === 0 ? 'Your team' : 'Rivals';
}

export function roadCar(
  state: HandState,
  side: Side,
  look: Look,
  time: number,
  rolling: number,
): RoadCar {
  const t = state.sides[side];
  const trouble = troubleOf(t);
  return {
    model: side === 0 ? 'roadster' : 'coupe',
    ink: look.cars[side],
    miles: t.miles,
    shownMiles: t.miles,
    pose: {
      ...RESTING,
      time,
      lights: look.dark,
      flat: trouble === 'flatTyre' ? 1 : 0,
      dent: trouble === 'fenderBender' ? 1 : 0,
      wind: 0.25 + rolling * 0.75,
      wheelTurn: time * rolling * 1.6,
      bob: rolling > 0 ? Math.sin(time * 14) * 0.5 * rolling : 0,
    },
    trouble,
    slowed: t.speed === 'slowZone',
    greenFlash: 0,
    tag: carTag(state, side, look),
    speed: rolling,
  };
}

/**
 * Frames both cars: the camera sits a little ahead of the pair and widens when they spread
 * apart, so both stay in view, never wider than the whole trip.
 */
export function cameraFor(a: number, b: number, end: number): { left: number; span: number } {
  const span = Math.min(end + 220, Math.max(470, Math.abs(a - b) + 330));
  const centre = (a + b) / 2 + 70;
  const left = Math.max(-90, Math.min(end + 130 - span, centre - span / 2));
  return { left, span };
}

export function roadScene(
  state: HandState,
  look: Look,
  route: Route,
  time: number,
  rolling: [number, number] = [0, 0],
): RoadScene {
  const cars: [RoadCar, RoadCar] = [
    roadCar(state, 0, look, time, rolling[0]),
    roadCar(state, 1, look, time, rolling[1]),
  ];
  const { left, span } = cameraFor(cars[0].miles, cars[1].miles, state.end);
  return {
    route,
    night: look.dark,
    left,
    span,
    end: state.end,
    passedFlag: state.end > state.rules.trip ? state.rules.trip : null,
    time,
    cars,
    puffs: [],
    slowMo: 0,
  };
}

export function pickSlotEmpty(state: HandState, seat: number): boolean {
  return state.seats[seat]!.hand[PICK_SLOT] === null;
}

export type { Kind };
