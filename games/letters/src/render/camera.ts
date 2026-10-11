import type { GridSize } from '../engine/grid';
import {
  invert,
  lookAt,
  type Mat4,
  multiply,
  perspective,
  shiftClip,
  transformPoint,
  type Vec3,
} from './math3d';

/**
 * The tabletop's geometry in world units (a cube is 1 across) and the camera that frames it:
 * looking down at the tray from a little in front, so the cubes show their sides, and fitted
 * to whatever part of the screen the layout gives the board.
 */
export const GAP = 0.16;
export const PITCH = 1 + GAP;
export const TRAY_MARGIN = 0.44;
export const TRAY_DEPTH = 0.36;
/** Height of the cubes' top faces above the tray, where the pointer is read. */
export const TOP_FACE = 1;

const ELEVATION = (61 * Math.PI) / 180;
const FIELD_OF_VIEW = (25 * Math.PI) / 180;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  viewProjection: Mat4;
  inverse: Mat4;
  eye: Vec3;
  /** The canvas size in CSS pixels. */
  width: number;
  height: number;
  size: GridSize;
}

export interface Point {
  x: number;
  y: number;
}

export function halfGrid(size: GridSize): number {
  return (size * PITCH) / 2;
}

export function cellCentre(size: GridSize, cell: number): Vec3 {
  const half = halfGrid(size);
  const row = Math.floor(cell / size);
  const column = cell % size;
  return [(column + 0.5) * PITCH - half, 0.5, (row + 0.5) * PITCH - half];
}

function trayCorners(size: GridSize): Vec3[] {
  const half = halfGrid(size) + TRAY_MARGIN;
  const corners: Vec3[] = [];
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      for (const y of [-TRAY_DEPTH, TOP_FACE + 0.1]) corners.push([x, y, z]);
    }
  }
  return corners;
}

function ndcBounds(matrix: Mat4, points: Vec3[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    const [x, y, , w] = transformPoint(matrix, point);
    minX = Math.min(minX, x / w);
    maxX = Math.max(maxX, x / w);
    minY = Math.min(minY, y / w);
    maxY = Math.max(maxY, y / w);
  }
  return { minX, maxX, minY, maxY };
}

/** A camera that shows the whole tray as large as it fits inside `rect` (CSS pixels). */
export function frameCamera(size: GridSize, width: number, height: number, rect: Rect): Camera {
  const aspect = width / Math.max(1, height);
  const projection = perspective(FIELD_OF_VIEW, aspect, 0.5, 200);
  const target: Vec3 = [0, 0.2, 0];
  const corners = trayCorners(size);
  const wantX = (rect.width / width) * 2;
  const wantY = (rect.height / height) * 2;
  let distance = 20;
  let view = lookAt(eyeAt(target, distance), target, [0, 1, 0]);
  // Perspective size falls roughly as 1/distance, so a few corrections settle the fit.
  for (let i = 0; i < 6; i++) {
    const bounds = ndcBounds(multiply(projection, view), corners);
    const ratio = Math.max(
      (bounds.maxX - bounds.minX) / wantX,
      (bounds.maxY - bounds.minY) / wantY,
    );
    distance *= ratio;
    view = lookAt(eyeAt(target, distance), target, [0, 1, 0]);
  }
  const fitted = multiply(projection, view);
  const bounds = ndcBounds(fitted, corners);
  const centreX = ((rect.x + rect.width / 2) / width) * 2 - 1;
  const centreY = 1 - ((rect.y + rect.height / 2) / height) * 2;
  const shift = shiftClip(
    centreX - (bounds.minX + bounds.maxX) / 2,
    centreY - (bounds.minY + bounds.maxY) / 2,
  );
  const viewProjection = multiply(shift, fitted);
  return {
    viewProjection,
    inverse: invert(viewProjection),
    eye: eyeAt(target, distance),
    width,
    height,
    size,
  };
}

function eyeAt(target: Vec3, distance: number): Vec3 {
  return [
    target[0],
    target[1] + Math.sin(ELEVATION) * distance,
    target[2] + Math.cos(ELEVATION) * distance,
  ];
}

/** World point to CSS pixels. */
export function project(camera: Camera, point: Vec3): Point {
  const [x, y, , w] = transformPoint(camera.viewProjection, point);
  return { x: ((x / w + 1) / 2) * camera.width, y: ((1 - y / w) / 2) * camera.height };
}

/** Where the pointer's ray meets the plane of the cubes' top faces, in world units. */
export function pointOnTop(camera: Camera, at: Point): { x: number; z: number } {
  const ndcX = (at.x / camera.width) * 2 - 1;
  const ndcY = 1 - (at.y / camera.height) * 2;
  const unproject = (z: number): Vec3 => {
    const [x, y, depth, w] = transformPoint(camera.inverse, [ndcX, ndcY, z]);
    return [x / w, y / w, depth / w];
  };
  const near = unproject(-1);
  const far = unproject(1);
  const t = (TOP_FACE - near[1]) / (far[1] - near[1]);
  return { x: near[0] + (far[0] - near[0]) * t, z: near[2] + (far[2] - near[2]) * t };
}

/**
 * The cube under the pointer, or null. `reach` is how far from a cube's centre still counts,
 * as a share of the spacing: generous for a press, tighter while dragging, so a diagonal stroke
 * that clips a neighbour's corner does not pick it up.
 */
export function cellAt(camera: Camera, at: Point, reach = 0.5): number | null {
  const size = camera.size;
  const half = halfGrid(size);
  const { x, z } = pointOnTop(camera, at);
  const column = Math.floor((x + half) / PITCH);
  const row = Math.floor((z + half) / PITCH);
  if (column < 0 || column >= size || row < 0 || row >= size) return null;
  const centre = cellCentre(size, row * size + column);
  const dx = Math.abs(x - centre[0]) / PITCH;
  const dz = Math.abs(z - centre[2]) / PITCH;
  // A full reach takes the whole cell; a tighter one is a circle, so a diagonal stroke between
  // two cubes passes their shared corner without catching it.
  const inside = reach >= 0.5 ? Math.max(dx, dz) <= reach : Math.hypot(dx, dz) <= reach;
  return inside ? row * size + column : null;
}
