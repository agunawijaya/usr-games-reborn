import { Vector3 } from 'three';
import { SPACE_COUNT } from '../../boards/layout';
import type { BoardLayout, LotFrame } from './lots';
import { LOT_DEPTH, ROAD_WIDTH } from './lots';

/**
 * Ring Colony's layout: the 40 spaces on a true ring round a central dome. The start sits at
 * the near right, as on the square boards, and play runs the same way round.
 */

export const RING_ROAD = 20.5;
export const RING_INNER = RING_ROAD - ROAD_WIDTH / 2;
export const RING_LOTS = RING_ROAD + ROAD_WIDTH / 2 + 0.2;
const START = Math.PI / 4;
const STEP = (Math.PI * 2) / SPACE_COUNT;

const angleOf = (t: number) => START + t * STEP;

function frameFor(index: number): LotFrame {
  const angle = angleOf(index);
  const out = new Vector3(Math.cos(angle), 0, Math.sin(angle));
  const along = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const middle = RING_LOTS + LOT_DEPTH / 2;
  return {
    index,
    corner: index % 10 === 0,
    centre: out.clone().multiplyScalar(middle),
    along,
    out,
    width: middle * STEP * 0.96,
    depth: LOT_DEPTH,
    yaw: Math.atan2(out.x, out.z),
    stop: out.clone().multiplyScalar(RING_ROAD),
  };
}

const LOTS: readonly LotFrame[] = Array.from({ length: SPACE_COUNT }, (_, i) => frameFor(i));

export const RING_LAYOUT: BoardLayout = {
  lots: LOTS,
  roadPoint(t, lane = 0) {
    const angle = angleOf(t);
    const r = RING_ROAD + lane;
    return new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
  },
  path(s, offset) {
    const r = RING_ROAD + offset;
    const angle = START + s / r;
    return {
      point: new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
      heading: angle + Math.PI / 2,
    };
  },
  pathLength(offset) {
    return Math.PI * 2 * (RING_ROAD + offset);
  },
};
