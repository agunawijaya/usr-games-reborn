import { cellCentre } from './camera';
import type { GridSize } from '../engine/grid';
import { type Quat, quatFromAxisAngle, quatFromFrames, quatMultiply, type Vec3 } from './math3d';

/**
 * How cubes come to rest: each face's outward direction and the direction its letter reads
 * upwards (matching mesh.ts and the cube shader), the turn that lays a chosen face on top with
 * its letter upright, and the tumble that drops a shaken cube into its cell.
 */
const FACE_NORMALS: readonly Vec3[] = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const FACE_UPS: readonly Vec3[] = [
  [0, 0, -1],
  [0, 0, 1],
  [0, 1, 0],
  [0, 1, 0],
  [0, 1, 0],
  [0, 1, 0],
];

/** The orientation that shows face `face` on top, its letter reading away from the player. */
export function restingRotation(face: number, yaw = 0): Quat {
  const lay = quatFromFrames(FACE_NORMALS[face]!, FACE_UPS[face]!, [0, 1, 0], [0, 0, -1]);
  return yaw === 0 ? lay : quatMultiply(quatFromAxisAngle([0, 1, 0], yaw), lay);
}

/** A little seeded variety per cell: no two cubes sit perfectly square, as by hand. */
export function cellJitter(seed: number, cell: number): { yaw: number; dx: number; dz: number } {
  const hash = (k: number) => {
    const x = Math.sin((seed + 1) * 12.9898 + cell * 78.233 + k * 37.719) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    yaw: (hash(1) - 0.5) * 0.07,
    dx: (hash(2) - 0.5) * 0.04,
    dz: (hash(3) - 0.5) * 0.04,
  };
}

export interface CubePose {
  position: Vec3;
  rotation: Quat;
  /** 0 while falling, 1 once at rest: for shadows and sound. */
  settled: number;
}

export interface TumblePlan {
  /** Seconds after the shake at which this cube starts to fall. */
  delay: number;
  /** Seconds from the start of its fall to touching the tray. */
  fall: number;
  height: number;
  axis: Vec3;
  /** Extra turns the cube carries in the air, in radians, unwound as it lands. */
  spin: number;
  drift: Vec3;
}

/** Contact times after the shake, per cube: the first landing and two smaller bounces. */
export const BOUNCES = [0, 0.32, 0.5];
export const TUMBLE_SECONDS = 2.1;

export function planTumble(size: GridSize, seed: number): TumblePlan[] {
  const plans: TumblePlan[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    const r = (k: number) => {
      const x = Math.sin((seed + 7) * 91.3458 + cell * 47.123 + k * 13.7) * 24634.6345;
      return x - Math.floor(x);
    };
    const row = Math.floor(cell / size);
    const column = cell % size;
    plans.push({
      // A wave across the tray from the back corner, with a little scatter.
      delay: (row + column) * (0.42 / size) + r(1) * 0.16,
      fall: 0.42 + r(2) * 0.12,
      // Low enough that the throw stays in frame: the cubes are tossed in, not dropped from the sky.
      height: 2.4 + r(3) * 2.2,
      axis: [r(4) - 0.5, 0.2 * (r(5) - 0.5), r(6) - 0.5],
      spin: Math.PI * (1.5 + Math.floor(r(7) * 2) * 0.5) * (r(8) < 0.5 ? -1 : 1),
      // Thrown in from just in front of the tray and drawn towards its middle, so no cube
      // flies out over the panels at the sides.
      drift: [((size - 1) / 2 - column) * 0.22 + (r(9) - 0.5) * 0.5, 0, 0.2 + r(10) * 0.7],
    });
  }
  return plans;
}

/**
 * The cube's pose `elapsed` seconds after the shake: falling with gravity, landing, two small
 * bounces, and the spin easing into the resting orientation, so it always lands showing the
 * face the roll chose.
 */
export function tumblePose(
  size: GridSize,
  cell: number,
  plan: TumblePlan,
  rest: Quat,
  elapsed: number,
  offset: Vec3 = [0, 0, 0],
): CubePose {
  const centre = cellCentre(size, cell);
  const base: Vec3 = [centre[0] + offset[0], centre[1], centre[2] + offset[2]];
  const t = elapsed - plan.delay;
  if (t <= 0) {
    return {
      position: [base[0] + plan.drift[0], base[1] + plan.height, base[2] + plan.drift[2]],
      rotation: quatMultiply(rest, quatFromAxisAngle(plan.axis, plan.spin)),
      settled: 0,
    };
  }
  let lift = 0;
  let along = 1;
  if (t < plan.fall) {
    const k = t / plan.fall;
    lift = plan.height * (1 - k * k);
    along = k * k;
  } else {
    const after = t - plan.fall;
    if (after < BOUNCES[1]!) lift = hop(after, BOUNCES[1]!, 0.42);
    else if (after < BOUNCES[2]!) lift = hop(after - BOUNCES[1]!, BOUNCES[2]! - BOUNCES[1]!, 0.12);
  }
  const unwind = Math.min(1, t / (plan.fall + 0.38));
  const remaining = 1 - easeOutBack(unwind);
  const position: Vec3 = [
    base[0] + plan.drift[0] * (1 - along),
    base[1] + lift,
    base[2] + plan.drift[2] * (1 - along),
  ];
  const rotation =
    remaining === 0
      ? rest
      : quatMultiply(rest, quatFromAxisAngle(plan.axis, plan.spin * remaining));
  return { position, rotation, settled: t >= plan.fall ? 1 : t / plan.fall };
}

function hop(time: number, duration: number, height: number): number {
  const k = time / duration;
  return 4 * height * k * (1 - k);
}

function easeOutBack(t: number): number {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

/** The moments cubes strike the tray, in seconds after the shake: what the clatter plays. */
export function contactTimes(plans: readonly TumblePlan[]): number[] {
  return plans
    .flatMap((plan) => BOUNCES.map((bounce) => plan.delay + plan.fall + bounce))
    .sort((a, b) => a - b);
}

export function restingPose(
  size: GridSize,
  cell: number,
  rest: Quat,
  offset: Vec3 = [0, 0, 0],
): CubePose {
  const centre = cellCentre(size, cell);
  return {
    position: [centre[0] + offset[0], centre[1], centre[2] + offset[2]],
    rotation: rest,
    settled: 1,
  };
}
