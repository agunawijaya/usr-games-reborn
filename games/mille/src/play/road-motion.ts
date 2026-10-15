import type { Kind } from '../engine/cards';
import type { HandState, Side } from '../engine/hand';
import { RESTING } from '../render/car';
import type { Look } from '../render/look';
import type { RoadCar } from '../render/road';
import type { Route } from '../render/routes';
import type { RoadScene } from '../render/stage';
import { cameraFor, carTag, troubleOf } from './view';

/**
 * The road between frames: where each car is on its way to its mileage, how fast it is going,
 * and the short performances that follow a card (a flat that sags, a tank that coughs, a bump, a
 * fix that gleams). The game's state says where a car should be; this says where it is now.
 */

interface Effect {
  kind: Kind;
  started: number;
}

interface CarMotion {
  miles: number;
  /** Miles a second right now. */
  velocity: number;
  effects: Effect[];
  /** 0–1: the gold glow of a parry, fading. */
  glow: number;
}

const TOP_SPEED = 260;
const ACCELERATION = 520;
/** How long each performance lasts, in seconds. */
const EFFECT_LENGTH: Partial<Record<Kind, number>> = {
  flatTyre: 0.9,
  noFuel: 1.2,
  fenderBender: 0.7,
  redLight: 0.5,
  slowZone: 0.6,
  fillUp: 1,
  spareTyre: 0.9,
  mechanic: 0.9,
  greenLight: 1.4,
  openRoad: 0.8,
};

export class RoadMotion {
  private cars: [CarMotion, CarMotion];
  private camera: { left: number; span: number };
  private time = 0;
  slowMo = 0;
  private slowTarget = 0;

  constructor(state: HandState) {
    const a = state.sides[0].miles;
    const b = state.sides[1].miles;
    this.cars = [
      { miles: a, velocity: 0, effects: [], glow: 0 },
      { miles: b, velocity: 0, effects: [], glow: 0 },
    ];
    this.camera = cameraFor(a, b, state.end);
  }

  /** Puts both cars where the state says, at once (a new hand, a restored game). */
  reset(state: HandState): void {
    this.cars = [
      { miles: state.sides[0].miles, velocity: 0, effects: [], glow: 0 },
      { miles: state.sides[1].miles, velocity: 0, effects: [], glow: 0 },
    ];
    this.camera = cameraFor(this.cars[0].miles, this.cars[1].miles, state.end);
  }

  /** A card has just landed on this side's piles: play its little scene on the road. */
  perform(side: Side, kind: Kind): void {
    this.cars[side].effects.push({ kind, started: this.time });
  }

  parry(side: Side): void {
    this.cars[side].glow = 1;
  }

  setSlowMotion(on: boolean): void {
    this.slowTarget = on ? 1 : 0;
  }

  isDriving(side?: Side): boolean {
    const moving = (car: CarMotion) => Math.abs(car.velocity) > 1;
    return side === undefined ? this.cars.some(moving) : moving(this.cars[side]);
  }

  hasArrived(state: HandState): boolean {
    return this.cars.every((car, i) => Math.abs(car.miles - state.sides[i as Side].miles) < 0.5);
  }

  update(dt: number, state: HandState, reducedMotion: boolean): void {
    this.time += dt;
    this.slowMo += (this.slowTarget - this.slowMo) * Math.min(1, dt * 6);
    const pace = 1 - this.slowMo * 0.8;
    this.cars.forEach((car, i) => {
      const target = state.sides[i as Side].miles;
      if (reducedMotion) {
        car.miles = target;
        car.velocity = 0;
      } else {
        drive(car, target, dt * pace);
      }
      car.glow = Math.max(0, car.glow - dt * 0.6);
      car.effects = car.effects.filter(
        (e) => this.time - e.started < (EFFECT_LENGTH[e.kind] ?? 1) + 0.2,
      );
    });
    const want = cameraFor(this.cars[0].miles, this.cars[1].miles, state.end);
    const ease = reducedMotion ? 1 : Math.min(1, dt * 2.2);
    this.camera.left += (want.left - this.camera.left) * ease;
    this.camera.span += (want.span - this.camera.span) * ease;
  }

  /** The road as it looks now. */
  scene(state: HandState, look: Look, route: Route): RoadScene {
    const cars = [0, 1].map((i) => this.car(state, i as Side, look)) as [RoadCar, RoadCar];
    return {
      route,
      night: look.dark,
      left: this.camera.left,
      span: this.camera.span,
      end: state.end,
      passedFlag: state.end > state.rules.trip ? state.rules.trip : null,
      time: this.time,
      cars,
      puffs: [],
      slowMo: this.slowMo,
    };
  }

  private car(state: HandState, side: Side, look: Look): RoadCar {
    const motion = this.cars[side];
    const tableau = state.sides[side];
    const rolling = Math.min(1, Math.abs(motion.velocity) / TOP_SPEED);
    const trouble = troubleOf(tableau);
    const effect = (kind: Kind) => {
      const e = motion.effects.find((x) => x.kind === kind);
      return e ? Math.min(1, (this.time - e.started) / (EFFECT_LENGTH[kind] ?? 1)) : null;
    };
    // A flat sags in as the hazard lands, and pumps back up as the spare goes on.
    const flatIn = effect('flatTyre');
    const spare = effect('spareTyre');
    let flat = trouble === 'flatTyre' ? 1 : 0;
    if (flatIn !== null) flat = flatIn;
    if (spare !== null) flat = 1 - spare;
    const bump = effect('fenderBender');
    const fix = effect('mechanic');
    let dent = trouble === 'fenderBender' ? 1 : 0;
    if (fix !== null) dent = 1 - fix;
    const cough = effect('noFuel');
    const fill = effect('fillUp');
    const green = effect('greenLight');
    const wobble = flatIn !== null && flatIn < 1 ? Math.sin(flatIn * 30) * (1 - flatIn) * 0.06 : 0;
    const jolt = bump !== null && bump < 1 ? Math.sin(bump * Math.PI) * -4 : 0;
    const sputter = cough !== null && cough < 1 ? Math.sin(cough * 40) * 0.8 * (1 - cough) : 0;
    return {
      model: side === 0 ? 'roadster' : 'coupe',
      ink: look.cars[side],
      miles: motion.miles + jolt * 0.2,
      shownMiles: motion.miles,
      pose: {
        ...RESTING,
        time: this.time,
        lights: look.dark,
        flat,
        dent,
        wind: 0.25 + rolling * 0.75,
        wheelTurn: (motion.miles / 9) % 1,
        bob: (rolling > 0.05 ? Math.sin(this.time * 14) * 0.6 * rolling : 0) + sputter,
        pitch: wobble + (rolling > 0.6 ? -0.01 : 0),
        shine: fill !== null ? fill * 1.2 - 0.1 : spare !== null ? spare * 1.2 - 0.1 : -1,
      },
      trouble,
      slowed: tableau.speed === 'slowZone',
      greenFlash: green === null ? 0 : 1 - green,
      tag: carTag(state, side, look),
      speed: rolling,
      glow: motion.glow,
    };
  }
}

/** Accelerate toward the target, ease off near it, never overshoot. */
function drive(car: CarMotion, target: number, dt: number): void {
  const gap = target - car.miles;
  if (Math.abs(gap) < 0.5) {
    car.miles = target;
    car.velocity = 0;
    return;
  }
  const direction = Math.sign(gap);
  // The speed that still lets the car stop in the room left.
  const stopping = Math.sqrt(2 * ACCELERATION * Math.abs(gap));
  const wanted = direction * Math.min(TOP_SPEED, stopping);
  const change = ACCELERATION * dt;
  car.velocity += Math.max(-change, Math.min(change, wanted - car.velocity));
  const step = car.velocity * dt;
  car.miles = Math.abs(step) >= Math.abs(gap) ? target : car.miles + step;
}
