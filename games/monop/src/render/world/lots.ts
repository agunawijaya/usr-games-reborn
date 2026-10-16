import { Vector3 } from 'three';
import { SPACE_COUNT } from '../../boards/layout';

/**
 * Where the 40 spaces sit in the world. The board is a square of lots round a ring road with a
 * park in the middle: the start at the near right corner, the loop running left along the near
 * side, away up the left, right along the far side and back down the right, as a player reads a
 * board laid on the table in front of them. World units are about a metre of a toy town; the
 * camera looks from the near side (+z).
 */

export const BOARD_HALF = 26;
export const LOT_DEPTH = 7.2;
export const ROAD_WIDTH = 3.4;
export const KERB = 0.35;
/** The inner edge of the road: the park fills the square inside it. */
export const PARK_HALF = BOARD_HALF - LOT_DEPTH - ROAD_WIDTH;
/** The road's centre line, where tokens and cars run. */
export const ROAD_CENTRE = BOARD_HALF - LOT_DEPTH - ROAD_WIDTH / 2;

export interface LotFrame {
  readonly index: number;
  readonly corner: boolean;
  /** The middle of the lot at ground level. */
  readonly centre: Vector3;
  /** Along the road, in the direction of play. */
  readonly along: Vector3;
  /** Away from the road, towards the board's edge. */
  readonly out: Vector3;
  /** Size along the road, and away from it. */
  readonly width: number;
  readonly depth: number;
  /** Turn about y that maps a model's +z onto `out`. */
  readonly yaw: number;
  /** Where a token stands for this space: on the road in front of the lot. */
  readonly stop: Vector3;
}

const SIDES = [
  { out: new Vector3(0, 0, 1), along: new Vector3(-1, 0, 0) },
  { out: new Vector3(-1, 0, 0), along: new Vector3(0, 0, -1) },
  { out: new Vector3(0, 0, -1), along: new Vector3(1, 0, 0) },
  { out: new Vector3(1, 0, 0), along: new Vector3(0, 0, 1) },
];

function frameFor(index: number): LotFrame {
  const side = Math.floor(index / 10);
  const step = index % 10;
  const { out, along } = SIDES[side]!;
  const sideLength = BOARD_HALF * 2;
  const regular = (sideLength - 2 * LOT_DEPTH) / 9;
  const middle = BOARD_HALF - LOT_DEPTH / 2;
  // The side's start corner, seen from the middle of the board.
  const startCorner = out.clone().multiplyScalar(BOARD_HALF).addScaledVector(along, -BOARD_HALF);
  if (step === 0) {
    const centre = out
      .clone()
      .multiplyScalar(middle)
      .addScaledVector(along, -BOARD_HALF + LOT_DEPTH / 2);
    const stop = out.clone().multiplyScalar(ROAD_CENTRE).addScaledVector(along, -ROAD_CENTRE);
    return {
      index,
      corner: true,
      centre,
      along: along.clone(),
      out: out.clone(),
      width: LOT_DEPTH,
      depth: LOT_DEPTH,
      yaw: Math.atan2(out.x, out.z),
      stop,
    };
  }
  const offset = LOT_DEPTH + regular * (step - 0.5);
  const centre = startCorner
    .clone()
    .addScaledVector(out, -LOT_DEPTH / 2)
    .addScaledVector(along, offset);
  const stop = centre.clone().addScaledVector(out, -(LOT_DEPTH / 2 + ROAD_WIDTH / 2));
  return {
    index,
    corner: false,
    centre,
    along: along.clone(),
    out: out.clone(),
    width: regular,
    depth: LOT_DEPTH,
    yaw: Math.atan2(out.x, out.z),
    stop,
  };
}

export const LOTS: readonly LotFrame[] = Array.from({ length: SPACE_COUNT }, (_, i) => frameFor(i));

/** A point on the road's centre line, `t` spaces round from the start (fractions in between). */
export function roadPoint(t: number, lane = 0): Vector3 {
  const wrapped = ((t % SPACE_COUNT) + SPACE_COUNT) % SPACE_COUNT;
  const from = LOTS[Math.floor(wrapped)]!;
  const to = LOTS[(Math.floor(wrapped) + 1) % SPACE_COUNT]!;
  const f = wrapped - Math.floor(wrapped);
  const point = from.stop.clone().lerp(to.stop, f);
  if (lane !== 0) point.addScaledVector(from.out, lane);
  return point;
}

/**
 * The ring road as a rounded square path, `offset` out from its centre line; `s` runs in the
 * direction of play from the near right corner.
 */
function ringPoint(s: number, offset: number, corner = 2.2): { point: Vector3; heading: number } {
  const h = ROAD_CENTRE + offset;
  const r = Math.min(corner + offset, h);
  const straight = 2 * (h - r);
  const arc = (Math.PI / 2) * r;
  const side = straight + arc;
  const perimeter = side * 4;
  let t = ((s % perimeter) + perimeter) % perimeter;
  const index = Math.floor(t / side);
  t -= index * side;
  // Each side as drawn for side 0 (near side, heading -x), then turned to the side in hand.
  let x: number;
  let z: number;
  let heading: number;
  if (t < straight) {
    x = h - r - t;
    z = h;
    heading = Math.PI;
  } else {
    const a = ((t - straight) / arc) * (Math.PI / 2);
    x = -(h - r) - Math.sin(a) * r;
    z = h - r + Math.cos(a) * r;
    heading = Math.PI + a;
  }
  // Rotate by the side: each side turns the frame a quarter turn about y.
  const turn = index * (Math.PI / 2);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const point = new Vector3(x * cos - z * sin, 0, x * sin + z * cos);
  return { point, heading: heading + turn };
}

function ringLength(offset: number, corner = 2.2): number {
  const h = ROAD_CENTRE + offset;
  const r = Math.min(corner + offset, h);
  return 4 * (2 * (h - r) + (Math.PI / 2) * r);
}

/**
 * How a board lays its 40 spaces out in the world: the lots, the stops on the road where tokens
 * stand, and the road as one smooth closed path for the traffic. Harbour City and the pop-up book
 * use the square; Ring Colony has a true ring.
 */
export interface BoardLayout {
  readonly lots: readonly LotFrame[];
  /** A point on the road's centre line, `t` spaces round from the start, `lane` out from it. */
  roadPoint(t: number, lane?: number): Vector3;
  /** The road as a path `s` units round, `offset` out from the centre line; heading is (cos, sin) in x, z. */
  path(s: number, offset: number): { point: Vector3; heading: number };
  pathLength(offset: number): number;
}

export const SQUARE_LAYOUT: BoardLayout = {
  lots: LOTS,
  roadPoint,
  path: (s, offset) => ringPoint(s, offset),
  pathLength: (offset) => ringLength(offset),
};
