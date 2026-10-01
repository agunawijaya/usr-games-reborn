import type { RngState } from '@usr-games/kit';

/**
 * The shapes the rules work on. Everything here is plain data: a room state can be cloned,
 * hashed, saved and replayed, and the renderer only ever reads it.
 */

export type VacuumKind = 'basic' | 'mop' | 'slow' | 'turbo' | 'sweeper';

/**
 * `classic` is the original program rule for rule (the Long Night); `house` adds what the
 * reborn rooms bring: safe zooms earned by loafing, and the new vacuum kinds.
 */
export type RuleSet = 'house' | 'classic';

export type TangleKind = 'wreck' | 'sock' | 'cable';

export type FurnitureKind =
  | 'sofa'
  | 'armchair'
  | 'table'
  | 'desk'
  | 'bed'
  | 'plant'
  | 'shelf'
  | 'washer'
  | 'tub'
  | 'toybox'
  | 'crate'
  | 'counter';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Furniture {
  readonly kind: FurnitureKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The parts of a room that never change during play. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly furniture: readonly Furniture[];
  /** `blocked[y * width + x]` is true under furniture. */
  readonly blocked: readonly boolean[];
}

export interface Vacuum {
  readonly id: number;
  readonly kind: VacuumKind;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  /** Slow vacuums move every other turn; true when the coming turn is a rest. */
  readonly resting: boolean;
  /** A sweeper swallows one tangle, then behaves like any other vacuum. */
  readonly full: boolean;
}

export interface Tangle {
  readonly x: number;
  readonly y: number;
  readonly kind: TangleKind;
  /** How many vacuums are stuck in it. Socks and cables start at zero. */
  readonly size: number;
}

/** A charging dock sends out a fresh vacuum every few turns until it runs out or jams. */
export interface Dock {
  readonly x: number;
  readonly y: number;
  readonly every: number;
  readonly remaining: number;
  readonly jammed: boolean;
}

export type RoomStatus = 'playing' | 'caught' | 'cleared';

export interface RoomState {
  readonly layout: Layout;
  readonly rules: RuleSet;
  readonly cat: Point;
  readonly vacuums: readonly Vacuum[];
  readonly tangles: readonly Tangle[];
  readonly dock: Dock | null;
  readonly turn: number;
  /** House rules: zooms that are sure to land somewhere quiet (at most three held). */
  readonly safeZooms: number;
  readonly zooms: number;
  /** Vacuums tangled in this room so far. */
  readonly tangled: number;
  /** Classic rules: vacuums tangled since the cat committed to a nap, paid on a clear. */
  readonly napBonus: number;
  readonly napping: boolean;
  readonly status: RoomStatus;
  /** The zoom stream, so an undo or a replay lands exactly where the first try did. */
  readonly rng: RngState;
}

export type Step = -1 | 0 | 1;

export type Action =
  | { readonly type: 'step'; readonly dx: Step; readonly dy: Step }
  | { readonly type: 'zoom' }
  | { readonly type: 'wait'; readonly mode: 'loaf' | 'nap' };

export type TurnEvent =
  | { readonly type: 'cat-step'; readonly from: Point; readonly to: Point }
  | { readonly type: 'cat-zoom'; readonly from: Point; readonly to: Point; readonly safe: boolean }
  | { readonly type: 'cat-wait'; readonly mode: 'stay' | 'loaf' | 'nap' }
  | {
      readonly type: 'vacuum-move';
      readonly id: number;
      readonly from: Point;
      readonly to: Point;
      readonly phase: 1 | 2;
    }
  | { readonly type: 'vacuum-rest'; readonly id: number }
  | {
      readonly type: 'bonk';
      readonly at: Point;
      readonly ids: readonly number[];
      readonly onTangle: TangleKind | null;
      readonly phase: 1 | 2;
    }
  | {
      readonly type: 'gulp';
      readonly id: number;
      readonly at: Point;
      readonly swallowed: TangleKind;
    }
  | { readonly type: 'dock-spawn'; readonly id: number; readonly at: Point }
  | { readonly type: 'dock-jammed'; readonly at: Point }
  | { readonly type: 'safe-zoom-earned'; readonly total: number }
  | { readonly type: 'caught'; readonly at: Point; readonly by: readonly number[] }
  | { readonly type: 'cleared' };

export interface TurnResult {
  readonly state: RoomState;
  readonly events: readonly TurnEvent[];
}

/** Why an action cannot be taken, or `ok`. `unsafe` actions are legal but lose the room. */
export type Legality = 'ok' | 'blocked' | 'unsafe' | 'over';
