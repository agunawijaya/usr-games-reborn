import { createRng } from '@usr-games/kit';
import { createLayout } from './layout';
import { isFree } from './rules';
import type { Furniture, Point, RoomState, RuleSet, TangleKind, VacuumKind } from './types';

/** A room as the data files describe it, before play begins. */
export interface RoomSpec {
  readonly width: number;
  readonly height: number;
  readonly rules: RuleSet;
  readonly cat: Point;
  readonly vacuums: readonly {
    readonly kind: VacuumKind;
    readonly x: number;
    readonly y: number;
  }[];
  readonly clutter?: readonly {
    readonly kind: Exclude<TangleKind, 'wreck'>;
    readonly x: number;
    readonly y: number;
  }[];
  readonly furniture?: readonly Furniture[];
  readonly dock?: {
    readonly x: number;
    readonly y: number;
    readonly every: number;
    readonly count: number;
  };
  /** Seeds the zoom stream, so every player's first zoom from a given spot lands alike. */
  readonly seed: string;
  readonly safeZooms?: number;
}

export function createRoom(spec: RoomSpec): RoomState {
  return {
    layout: createLayout(spec.width, spec.height, spec.furniture ?? []),
    rules: spec.rules,
    cat: spec.cat,
    vacuums: spec.vacuums.map((v, id) => ({
      id,
      kind: v.kind,
      x: v.x,
      y: v.y,
      alive: true,
      resting: false,
      full: false,
    })),
    tangles: (spec.clutter ?? []).map((c) => ({ x: c.x, y: c.y, kind: c.kind, size: 0 })),
    dock: spec.dock
      ? {
          x: spec.dock.x,
          y: spec.dock.y,
          every: spec.dock.every,
          remaining: spec.dock.count,
          jammed: false,
        }
      : null,
    turn: 0,
    safeZooms: spec.safeZooms ?? 0,
    zooms: 0,
    tangled: 0,
    napBonus: 0,
    napping: false,
    status: 'playing',
    rng: createRng(`${spec.seed}/zoom`).state(),
  };
}

// ---------------------------------------------------------------------------------------------
// The Long Night: the original field and the original waves

/** The original's playing field inside its border: 59 columns by 22 rows. */
export const CLASSIC_WIDTH = 59;
export const CLASSIC_HEIGHT = 22;
/** Ten more robots each level until four levels' worth, then no more. */
export const CLASSIC_MAX_VACUUMS = 40;

export function vacuumsForWave(wave: number): number {
  return Math.min(wave * 10, CLASSIC_MAX_VACUUMS);
}

/**
 * Lays out one wave the way the original's make_level did: robots on random empty squares
 * first, then the player on a random empty square, which may well be next to a robot.
 */
export function classicWaveSpec(seed: string, wave: number): RoomSpec {
  const rng = createRng(`${seed}/wave-${wave}`);
  const layout = createLayout(CLASSIC_WIDTH, CLASSIC_HEIGHT);
  const vacuums: { kind: VacuumKind; x: number; y: number }[] = [];
  const empty = (x: number, y: number) =>
    isFree({ layout, vacuums: [], tangles: [] }, x, y) &&
    !vacuums.some((v) => v.x === x && v.y === y);
  const randomEmpty = (): Point => {
    for (;;) {
      const x = rng.int(0, CLASSIC_WIDTH - 1);
      const y = rng.int(0, CLASSIC_HEIGHT - 1);
      if (empty(x, y)) return { x, y };
    }
  };
  for (let i = 0; i < vacuumsForWave(wave); i++) vacuums.push({ kind: 'basic', ...randomEmpty() });
  return {
    width: CLASSIC_WIDTH,
    height: CLASSIC_HEIGHT,
    rules: 'classic',
    cat: randomEmpty(),
    vacuums,
    seed: `${seed}/wave-${wave}`,
  };
}
