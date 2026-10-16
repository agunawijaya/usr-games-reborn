import {
  Color,
  DirectionalLight,
  Group,
  type Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from 'three';
import type { BoardTheme } from '../../boards/themes';
import { LAYOUT } from '../../boards/layout';
import { restingOn } from '../boards/dice';
import { at, cylinder, gold, mesh, paint, release, roundedBox } from './kit3d';
import { Dust, beacons, bunting, debtBoards } from './overlays';
import type { Weather } from './weather';
import type { BoardLayout, LotFrame } from './lots';
import { type LookSettings, Stage } from './stage';

/**
 * A board's living miniature: the shared part. The world draws a picture of the game's state
 * (who owns what, how far each lot is built, where the tokens stand) and keeps the town moving
 * round it; each board's art (harbour, colony, pop-up book) supplies the look through `BoardArt`.
 * The world never decides anything about the game.
 */

export interface TokenPlacement {
  readonly seat: number;
  readonly token: string;
  readonly colour: string;
  /** Spaces round from the start; a fraction is a token on its way between two spaces. */
  readonly at: number;
  /** 0–1 through a hop between spaces: the token rises and lands. */
  readonly hop?: number;
}

export interface WorldState {
  /** Seat that owns each space, or null. */
  readonly owners: readonly (number | null)[];
  /** Buildings on each space: 0 none, 1–4 storeys of growth, 5 the group's landmark. */
  readonly levels: readonly number[];
  readonly mortgaged: readonly boolean[];
  readonly tokens: readonly TokenPlacement[];
  readonly seatColours: readonly string[];
  /** The token each seat plays with: its emblem flies on the flags of what it owns. */
  readonly seatTokens: readonly string[];
  /** A lot being built right now and how far along (0–1). */
  readonly construction?: { readonly space: number; readonly progress: number };
  /** Districts held whole by one seat: bunting goes up along their streets. */
  readonly wholeDistricts?: readonly number[];
  /** Seats below zero: their lots show sale boards until they settle. */
  readonly debtors?: readonly number[];
  /** The end of the game: the winner's lots lit in their colour. */
  readonly beacon?: { readonly seat: number; readonly colour: string };
}

/**
 * The career's touches for one seat (the player's): gold pennants over their flags, a statue of
 * their token in the middle of town, a golden base under their token, and gilding on the statue
 * and flagpoles.
 */
export interface Honours {
  readonly seat: number;
  readonly token: string;
  readonly colour: string;
  readonly pennants: boolean;
  readonly statue: boolean;
  readonly goldBase: boolean;
  readonly gilded: boolean;
}

/** The touches a lot's flag carries for an honoured owner. */
export interface FlagHonour {
  readonly pennant: boolean;
  readonly gilded: boolean;
}

export interface ArtContext {
  readonly dark: boolean;
  readonly theme: BoardTheme;
  readonly stage: Stage;
  /** The town's fixed scenery goes here once. */
  readonly scenery: Group;
}

export interface LotArt {
  readonly frame: LotFrame;
  readonly group: number | null;
  readonly owner: number | null;
  readonly ownerColour: string | null;
  readonly ownerToken: string | null;
  readonly level: number;
  readonly mortgaged: boolean;
  /** 0–1 while the newest storey is going up; 1 when it stands finished. */
  readonly progress: number;
  /** The owner's career touches on the lot's flag, if they have earned any. */
  readonly honour?: FlagHonour;
}

export interface BoardArt {
  readonly theme: BoardTheme;
  readonly layout: BoardLayout;
  look(dark: boolean): LookSettings;
  /** Sky, light, ground, the road, the park and everything that never changes. */
  setup(context: ArtContext): void;
  /** What stands on one lot: its sign, its owner's mark and its buildings. */
  lot(context: ArtContext, lot: LotArt): Object3D;
  /** A player's token on its base in the seat's colour. */
  token(context: ArtContext, token: string, colour: string): Object3D;
  /** Things that move every frame: traffic, water, weather. */
  animate?(context: ArtContext, seconds: number, elapsed: number): void;
  /**
   * The board's own celebration when a lot's first tower is finished, `seconds` after it began
   * (fireworks over the harbour, a dome lighting up, a big fold-up of paper).
   */
  signature?(context: ArtContext, lot: LotFrame, seconds: number): Object3D;
  /** An open spot in the middle of town where a player's statue can stand. */
  readonly statueSpot?: Vector3;
  /** How the camera frames a first landmark: how high it looks, from how far and how low. */
  readonly landmarkShot?: LandmarkShot;
  /** The board's sky, if it has one: clouds and showers, or meteors. */
  weather?(dark: boolean): Weather;
  /** How the camera follows a token: from how far and how high, and how far out towards the lots it looks. */
  readonly followShot?: FollowShot;
}

export interface FollowShot {
  readonly distance: number;
  readonly elevation: number;
  readonly outward: number;
}

const FOLLOW_SHOT: FollowShot = { distance: 52, elevation: 0.62, outward: 0 };

export interface LandmarkShot {
  readonly height: number;
  readonly distance: number;
  readonly elevation: number;
}

/** The harbour's framing, which suits a tall tower against an open sky. */
const LANDMARK_SHOT: LandmarkShot = { height: 10, distance: 74, elevation: 0.3 };

export interface CameraShot {
  /** The point the camera looks at. */
  readonly target: Vector3;
  /** Distance from the target, and the angles it is seen from. */
  readonly distance: number;
  readonly elevation: number;
  readonly azimuth: number;
}

export class BoardWorld {
  readonly stage: Stage;
  private context!: ArtContext;
  private readonly lotRoot = new Group();
  private readonly tokenRoot = new Group();
  private lotObjects: (Object3D | null)[] = [];
  private signs: Object3D[] = [];
  private tokenObjects = new Map<number, Object3D>();
  private state: WorldState | null = null;
  private stopAnimate: (() => void) | null = null;
  private celebration: Object3D | null = null;
  private throwing: DiceThrow | null = null;
  private honours: Honours | null = null;
  private statue: Object3D | null = null;
  private readonly overlays = new Group();
  private overlayKey = '';
  private dust: Dust | null = null;
  /** Told of every picture drawn: the flat map follows the town this way. */
  onShow: ((state: WorldState) => void) | null = null;
  private weather: Weather | null = null;
  private sun: {
    light: DirectionalLight;
    colour: Color;
    intensity: number;
    position: Vector3;
  } | null = null;
  /** Motion in the sky stops for reduced motion. */
  still = false;
  private day = 0;

  constructor(
    host: HTMLElement,
    private readonly art: BoardArt,
    private dark: boolean,
    options: { preserveDrawingBuffer?: boolean; maxPixelRatio?: number } = {},
  ) {
    this.stage = new Stage(host, art.look(dark), options);
    this.build();
  }

  private build(): void {
    const scene = this.stage.scene;
    scene.clear();
    const scenery = new Group();
    scenery.name = 'scenery';
    this.context = { dark: this.dark, theme: this.art.theme, stage: this.stage, scenery };
    this.art.setup(this.context);
    this.overlays.clear();
    this.overlayKey = '';
    this.dust = new Dust(this.dark);
    scene.add(scenery, this.lotRoot, this.tokenRoot, this.overlays, this.dust.group);
    this.weather = this.art.weather?.(this.dark) ?? null;
    if (this.weather) scene.add(this.weather.group);
    // The board's main light (the one that casts shadows) is the sun the day moves.
    const sun = scenery.children.find(
      (child): child is DirectionalLight => child instanceof DirectionalLight && child.castShadow,
    );
    this.sun = sun
      ? {
          light: sun,
          colour: sun.color.clone(),
          intensity: sun.intensity,
          position: sun.position.clone(),
        }
      : null;
    this.stage.applyQuality();
    this.setDay(this.day);
    this.stage.setLook(this.art.look(this.dark));
    this.statue = null;
    this.raiseStatue();
    this.stopAnimate?.();
    const animate = this.art.animate;
    const stopArt = animate
      ? this.stage.onTick((seconds, elapsed) =>
          animate.call(this.art, this.context, seconds, elapsed),
        )
      : null;
    const stopSigns = this.stage.onTick(() => this.faceSigns());
    const stopDice = this.stage.onTick((seconds) => this.tumble(seconds));
    const stopDust = this.stage.onTick((seconds) => {
      this.dust?.step(seconds);
      if (!this.still) this.weather?.step(seconds);
    });
    this.stopAnimate = () => {
      stopArt?.();
      stopSigns();
      stopDice();
      stopDust();
    };
  }

  /** Where this board lays its spaces out. */
  get layout(): BoardLayout {
    return this.art.layout;
  }

  get landmarkShot(): LandmarkShot {
    return this.art.landmarkShot ?? LANDMARK_SHOT;
  }

  get followShot(): FollowShot {
    return this.art.followShot ?? FOLLOW_SHOT;
  }

  /** Switches between the board's day and night looks, keeping the game's state. */
  setDark(dark: boolean): void {
    if (dark === this.dark) return;
    this.dark = dark;
    for (const lot of this.lotRoot.children) release(lot);
    this.lotRoot.clear();
    this.tokenRoot.clear();
    this.lotObjects = [];
    this.tokenObjects.clear();
    this.build();
    if (this.state) this.show(this.state, true);
  }

  /** Sets the career's touches; the lots and tokens they change are drawn again. */
  setHonours(honours: Honours | null): void {
    const before = JSON.stringify(this.honours);
    if (before === JSON.stringify(honours)) return;
    this.honours = honours;
    const seat = honours?.seat ?? 0;
    const token = this.tokenObjects.get(seat);
    if (token) {
      this.tokenRoot.remove(token);
      this.tokenObjects.delete(seat);
    }
    this.raiseStatue();
    if (this.state) this.show(this.state, true);
  }

  /** The player's token cast large on a plinth, in the board's open spot, when they have earned it. */
  private raiseStatue(): void {
    if (this.statue) {
      this.stage.scene.remove(this.statue);
      release(this.statue);
      this.statue = null;
    }
    const h = this.honours;
    const spot = this.art.statueSpot;
    if (!h?.statue || !spot) return;
    const statue = new Group();
    statue.name = 'statue';
    const stone = paint(this.dark ? '#8d93a3' : '#d9d4c7', { roughness: 0.8 });
    statue.add(at(mesh(roundedBox(2.4, 1.1, 2.4, 0.12), stone), 0, 0.55, 0));
    statue.add(at(mesh(roundedBox(2.7, 0.28, 2.7, 0.08), h.gilded ? gold() : stone), 0, 0.14, 0));
    statue.add(
      at(mesh(cylinder(0.9, 0.9, 0.06, 28), paint(h.colour, { roughness: 0.4 })), 0, 1.13, 0),
    );
    const figure = this.art.token(this.context, h.token, h.colour);
    figure.scale.multiplyScalar(1.4);
    figure.position.y = 1.1;
    if (h.gilded) {
      figure.traverse((child) => {
        if ((child as Mesh).isMesh) (child as Mesh).material = gold();
      });
    }
    statue.add(figure);
    statue.position.copy(spot);
    statue.traverse((child) => {
      child.castShadow = true;
    });
    this.statue = statue;
    this.stage.scene.add(statue);
  }

  /** Draws the game's state; lots that did not change keep their objects. */
  show(state: WorldState, force = false): void {
    const previous = this.state;
    this.state = state;
    this.art.layout.lots.forEach((frame, index) => {
      const lot = this.lotFor(state, frame);
      const before = previous ? this.lotFor(previous, frame) : null;
      if (!force && before && sameLot(before, lot) && this.lotObjects[index]) return;
      const old = this.lotObjects[index];
      if (old) {
        this.lotRoot.remove(old);
        release(old);
      }
      const object = this.art.lot(this.context, lot);
      object.position.copy(frame.centre);
      object.rotation.y = frame.yaw;
      this.lotRoot.add(object);
      this.lotObjects[index] = object;
    });
    this.signs = [];
    this.lotRoot.traverse((child) => {
      if (child.name === 'sign') this.signs.push(child);
    });
    this.faceSigns();
    this.placeTokens(state);
    this.layOverlays(state);
    this.onShow?.(state);
  }

  /** Bunting, sale boards and the winner's light, rebuilt only when what they show changes. */
  private layOverlays(state: WorldState): void {
    const debtors = state.debtors ?? [];
    const owned = (seat: number) => state.owners.flatMap((o, s) => (o === seat ? [s] : []));
    const key = JSON.stringify([
      state.wholeDistricts,
      debtors.map(owned),
      state.beacon && owned(state.beacon.seat),
    ]);
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    for (const child of [...this.overlays.children]) {
      this.overlays.remove(child);
      release(child);
    }
    const layout = this.art.layout;
    for (const group of state.wholeDistricts ?? []) {
      const lots = LAYOUT.filter((s) => s.group === group).map((s) => s.index);
      this.overlays.add(bunting(layout, lots, this.art.theme.groups[group]!.colour));
    }
    for (const seat of debtors) this.overlays.add(debtBoards(layout, owned(seat), this.dark));
    if (state.beacon)
      this.overlays.add(beacons(layout, owned(state.beacon.seat), state.beacon.colour));
  }

  /**
   * How far through the game it is, 0 to 1: by day the sun lowers and warms towards a golden
   * evening as the rounds go by (the night look stays night). A shower passes now and then.
   */
  setProgress(progress: number, round: number): void {
    this.setDay(progress);
    // One round in six, picked the same way every game, brings rain.
    this.weather?.setShower(round > 1 && (round * 7 + 3) % 6 === 0);
  }

  private setDay(progress: number): void {
    this.day = Math.max(0, Math.min(1, progress));
    const sun = this.sun;
    if (!sun || this.dark) return;
    const evening = this.day ** 1.4;
    sun.light.color.copy(sun.colour).lerp(new Color('#ffb877'), evening * 0.6);
    sun.light.intensity = sun.intensity * (1 - evening * 0.22);
    sun.light.position.copy(sun.position);
    sun.light.position.y = sun.position.y * (1 - evening * 0.35);
  }

  /** A puff of dust over lots that have just gone back to the bank. */
  puff(spaces: readonly number[]): void {
    this.dust?.add(spaces.map((s) => this.art.layout.lots[s]!.centre));
  }

  private lotFor(state: WorldState, frame: LotFrame): LotArt {
    const index = frame.index;
    const owner = state.owners[index] ?? null;
    const building = state.construction?.space === index;
    const honoured = this.honours && owner === this.honours.seat ? this.honours : null;
    return {
      ...(honoured && (honoured.pennants || honoured.gilded)
        ? { honour: { pennant: honoured.pennants, gilded: honoured.gilded } }
        : {}),
      frame,
      group: LAYOUT[index]!.group ?? null,
      owner,
      ownerColour: owner === null ? null : (state.seatColours[owner] ?? null),
      ownerToken: owner === null ? null : (state.seatTokens[owner] ?? null),
      level: state.levels[index] ?? 0,
      mortgaged: state.mortgaged[index] ?? false,
      progress: building ? state.construction!.progress : 1,
    };
  }

  private placeTokens(state: WorldState): void {
    const sharing = new Map<number, number>();
    for (const placement of state.tokens) {
      let object = this.tokenObjects.get(placement.seat);
      if (!object) {
        object = this.art.token(this.context, placement.token, placement.colour);
        if (this.honours?.goldBase && placement.seat === this.honours.seat) {
          // A gold rim under the token's own base, in the token's units.
          object.add(at(mesh(cylinder(0.76, 0.8, 0.08, 32), gold()), 0, 0.03, 0));
        }
        this.tokenObjects.set(placement.seat, object);
        this.tokenRoot.add(object);
      }
      const resting = Number.isInteger(placement.at);
      const slot = resting ? (sharing.get(placement.at) ?? 0) : 0;
      if (resting) sharing.set(placement.at, slot + 1);
      const lots = this.art.layout.lots;
      const point = this.art.layout.roadPoint(placement.at);
      const frame = lots[Math.floor(placement.at) % lots.length]!;
      // Tokens sharing a space stand side by side across the road.
      const spread = (slot - 0.5) * 1.05;
      point.addScaledVector(frame.along, resting ? spread * 0.55 : 0);
      point.addScaledVector(frame.out, resting ? (slot % 2 === 0 ? -0.55 : 0.55) : 0);
      const hop = placement.hop ?? 0;
      point.y += Math.sin(hop * Math.PI) * 1.4;
      object.position.copy(point);
      object.rotation.y = Math.atan2(frame.along.x, frame.along.z);
    }
  }

  /** Stages the board's first-tower celebration over a lot, `seconds` in; null clears it. */
  celebrate(space: number | null, seconds = 0): void {
    if (this.celebration) {
      this.stage.scene.remove(this.celebration);
      release(this.celebration);
    }
    this.celebration = null;
    if (space === null || !this.art.signature) return;
    this.celebration = this.art.signature(this.context, this.art.layout.lots[space]!, seconds);
    this.stage.scene.add(this.celebration);
  }

  /** Turns each sign about its post to face the camera. */
  private faceSigns(): void {
    const camera = this.stage.camera.position;
    for (const sign of this.signs) {
      const lot = sign.parent!;
      const dx = camera.x - lot.position.x;
      const dz = camera.z - lot.position.z;
      sign.rotation.y = Math.atan2(dx, dz) - lot.rotation.y;
    }
  }

  /**
   * Throws the dice in the park's tray: they leap, spin and bounce, and come to rest showing
   * `values` after `seconds` (0 sets them down at once).
   */
  throwDice(values: readonly [number, number], seconds: number, seed = 0): void {
    const dice = [0, 1].map((i) => this.stage.scene.getObjectByName(`die-${i}`));
    if (dice.some((d) => !d)) return;
    const spin = (i: number) => 0.4 + i * 0.9 + ((seed * 0.37 + i * 1.3) % 1) * 0.8;
    const parts = dice.map((object, i) => {
      const to = new Quaternion().setFromEuler(restingOn(values[i]!, spin(i)));
      const rest = this.restingPositions[i] ?? object!.position.clone();
      this.restingPositions[i] = rest;
      const axis = new Vector3(Math.sin(seed + i * 2.1), 0.6, Math.cos(seed * 1.7 + i)).normalize();
      return {
        object: object!,
        rest,
        from: object!.quaternion.clone(),
        to,
        axis,
        turns: 2.5 + i * 0.8,
      };
    });
    this.throwing = { elapsed: 0, seconds, parts };
    if (seconds <= 0) this.tumble(0);
  }

  private readonly restingPositions: Vector3[] = [];

  private tumble(seconds: number): void {
    const roll = this.throwing;
    if (!roll) return;
    roll.elapsed += seconds;
    const p = roll.seconds > 0 ? Math.min(1, roll.elapsed / roll.seconds) : 1;
    for (const part of roll.parts) {
      // Two and a half bounces, each lower than the last.
      const lift = Math.abs(Math.sin(p * Math.PI * 2.5)) * 2.4 * (1 - p) ** 1.4;
      part.object.position.set(part.rest.x, part.rest.y + lift, part.rest.z);
      const spinning = new Quaternion().setFromAxisAngle(
        part.axis,
        part.turns * Math.PI * 2 * Math.min(1, p / 0.7),
      );
      const tumbling = part.from.clone().multiply(spinning);
      part.object.quaternion.copy(p < 0.7 ? tumbling : tumbling.slerp(part.to, (p - 0.7) / 0.3));
    }
    if (p >= 1) {
      for (const part of roll.parts) {
        part.object.quaternion.copy(part.to);
        part.object.position.copy(part.rest);
      }
      this.throwing = null;
    }
  }

  /** Where a token stands now, in the world. */
  tokenPosition(seat: number): Vector3 | null {
    return this.tokenObjects.get(seat)?.position.clone() ?? null;
  }

  /** The middle of a lot, raised to `height`. */
  lotPoint(space: number, height = 0): Vector3 {
    return this.art.layout.lots[space]!.centre.clone().setY(height);
  }

  /** A point in the world on the screen, in CSS pixels from the canvas's top left. */
  screenPoint(point: Vector3): { x: number; y: number; ahead: boolean } {
    const projected = point.clone().project(this.stage.camera);
    const box = this.stage.canvas.getBoundingClientRect();
    return {
      x: ((projected.x + 1) / 2) * box.width,
      y: ((1 - projected.y) / 2) * box.height,
      ahead: projected.z < 1,
    };
  }

  /** The lot under a point on the screen, if one is near enough. */
  pickLot(x: number, y: number, reach = 56): number | null {
    let best: number | null = null;
    let nearest = reach;
    this.art.layout.lots.forEach((frame, index) => {
      const point = this.screenPoint(frame.centre.clone().setY(1.5));
      const distance = Math.hypot(point.x - x, point.y - y);
      if (point.ahead && distance < nearest) {
        nearest = distance;
        best = index;
      }
    });
    return best;
  }

  /** Points the camera at a shot. */
  frame(shot: CameraShot): void {
    const camera = this.stage.camera;
    const flat = Math.cos(shot.elevation) * shot.distance;
    camera.position.set(
      shot.target.x + Math.sin(shot.azimuth) * flat,
      shot.target.y + Math.sin(shot.elevation) * shot.distance,
      shot.target.z + Math.cos(shot.azimuth) * flat,
    );
    camera.lookAt(shot.target);
    this.faceSigns();
  }

  dispose(): void {
    this.stopAnimate?.();
    this.stage.dispose();
  }
}

interface DiceThrow {
  elapsed: number;
  readonly seconds: number;
  readonly parts: readonly {
    readonly object: Object3D;
    readonly rest: Vector3;
    readonly from: Quaternion;
    readonly to: Quaternion;
    readonly axis: Vector3;
    readonly turns: number;
  }[];
}

function sameLot(a: LotArt, b: LotArt): boolean {
  return (
    a.owner === b.owner &&
    a.level === b.level &&
    a.mortgaged === b.mortgaged &&
    a.progress === b.progress &&
    a.ownerColour === b.ownerColour
  );
}
