import { type Cave, neighbours } from '../engine/cave';
import type { Point } from './hand';
import { scatter } from './noise';

/**
 * Where each room sits on the explorer's map. The whole cave is laid out once, so a room keeps its
 * place while the map is drawn around it: rooms one tunnel apart sit about one step apart
 * (stress majorization over tunnel distances), then the drawing is turned to lie along the page
 * and nudged until no two rooms crowd each other. Yob's dodecahedron gets its own flat drawing:
 * a pentagon inside a ring inside a pentagon.
 */

export interface LayoutOptions {
  /** Width over height of the area the map is drawn in. */
  aspect: number;
  dodecahedron?: boolean;
}

/** Positions per room (index 0 unused), x in [0, aspect], y in [0, 1]. */
export function layoutCave(cave: Cave, options: LayoutOptions): Point[] {
  const raw = options.dodecahedron ? schlegel() : majorize(cave);
  return fit(separate(raw, cave.size), options.aspect);
}

function distances(cave: Cave): number[][] {
  const around = neighbours(cave);
  const size = cave.size;
  const table: number[][] = [];
  for (let start = 1; start <= size; start++) {
    const steps = new Array<number>(size + 1).fill(Infinity);
    steps[start] = 0;
    const queue = [start];
    while (queue.length > 0) {
      const room = queue.shift()!;
      for (const next of around[room]!) {
        if (steps[next]! > steps[room]! + 1) {
          steps[next] = steps[room]! + 1;
          queue.push(next);
        }
      }
    }
    table[start] = steps;
  }
  return table;
}

function majorize(cave: Cave): Point[] {
  const size = cave.size;
  const d = distances(cave);
  const positions = classicalStart(d, size, cave);
  for (let round = 0; round < 260; round++) {
    for (let i = 1; i <= size; i++) {
      let sx = 0;
      let sy = 0;
      let weights = 0;
      const pi = positions[i]!;
      for (let j = 1; j <= size; j++) {
        if (i === j) continue;
        const target = d[i]![j]!;
        if (!Number.isFinite(target)) continue;
        const pj = positions[j]!;
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const length = Math.hypot(dx, dy) || 1e-6;
        const w = 1 / (target * target);
        sx += w * (pj.x + (target * dx) / length);
        sy += w * (pj.y + (target * dy) / length);
        weights += w;
      }
      if (weights > 0) positions[i] = { x: sx / weights, y: sy / weights };
    }
  }
  return positions;
}

/** Classical scaling as a starting point, found by power iteration; avoids most bad folds. */
function classicalStart(d: number[][], size: number, cave: Cave): Point[] {
  const squared = (i: number, j: number) => {
    const value = d[i]![j]!;
    return Number.isFinite(value) ? value * value : (size / 2) ** 2;
  };
  const rowMean = new Array<number>(size + 1).fill(0);
  let total = 0;
  for (let i = 1; i <= size; i++) {
    for (let j = 1; j <= size; j++) rowMean[i]! += squared(i, j);
    total += rowMean[i]!;
    rowMean[i]! /= size;
  }
  total /= size * size;
  const b = (i: number, j: number) => -0.5 * (squared(i, j) - rowMean[i]! - rowMean[j]! + total);

  const random = scatter(size * 7919 + (cave.tunnels[1]?.[0] ?? 0));
  const vectors: number[][] = [];
  const values: number[] = [];
  for (let axis = 0; axis < 2; axis++) {
    let v = Array.from({ length: size + 1 }, () => random() - 0.5);
    let value = 0;
    for (let iteration = 0; iteration < 120; iteration++) {
      const next = new Array<number>(size + 1).fill(0);
      for (let i = 1; i <= size; i++) {
        let sum = 0;
        for (let j = 1; j <= size; j++) sum += b(i, j) * v[j]!;
        next[i] = sum;
      }
      for (const [k, other] of vectors.entries()) {
        let dot = 0;
        for (let i = 1; i <= size; i++) dot += other[i]! * v[i]!;
        for (let i = 1; i <= size; i++) next[i]! -= values[k]! * dot * other[i]!;
      }
      let norm = 0;
      for (let i = 1; i <= size; i++) norm += next[i]! * next[i]!;
      norm = Math.sqrt(norm) || 1;
      value = norm;
      v = next.map((x) => x / norm);
    }
    vectors.push(v);
    values.push(value);
  }
  return Array.from({ length: size + 1 }, (_, i) => ({
    x: vectors[0]![i]! * Math.sqrt(values[0]!),
    y: vectors[1]![i]! * Math.sqrt(values[1]!) + (random() - 0.5) * 0.01,
  }));
}

function schlegel(): Point[] {
  const positions: Point[] = [{ x: 0, y: 0 }];
  const at = (radius: number, angle: number): Point => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  });
  const corner = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  for (let i = 0; i < 5; i++) positions[1 + i] = at(2.6, corner(i));
  for (let i = 0; i < 5; i++) {
    positions[6 + 2 * i] = at(1.65, corner(i));
    positions[7 + 2 * i] = at(1.65, corner(i) + Math.PI / 5);
  }
  for (let i = 0; i < 5; i++) positions[16 + i] = at(0.85, corner(i) + Math.PI / 5);
  return positions;
}

/** Pushes rooms apart until each has a room's width to itself. */
function separate(positions: Point[], size: number): Point[] {
  const points = positions.map((p) => ({ ...p }));
  const minimum = 0.82;
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 1; i <= size; i++) {
      for (let j = i + 1; j <= size; j++) {
        const a = points[i]!;
        const b = points[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1e-6;
        if (length >= minimum) continue;
        const push = (minimum - length) / 2;
        a.x -= (dx / length) * push;
        a.y -= (dy / length) * push;
        b.x += (dx / length) * push;
        b.y += (dy / length) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return points;
}

/** Turns the drawing to lie along its longest spread and scales it into the page. */
function fit(positions: Point[], aspect: number): Point[] {
  const rooms = positions.slice(1);
  const cx = rooms.reduce((s, p) => s + p.x, 0) / rooms.length;
  const cy = rooms.reduce((s, p) => s + p.y, 0) / rooms.length;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const p of rooms) {
    xx += (p.x - cx) ** 2;
    xy += (p.x - cx) * (p.y - cy);
    yy += (p.y - cy) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const turned = positions.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: dx * Math.cos(-angle) - dy * Math.sin(-angle),
      y: dx * Math.sin(-angle) + dy * Math.cos(-angle),
    };
  });
  const body = turned.slice(1);
  const minX = Math.min(...body.map((p) => p.x));
  const maxX = Math.max(...body.map((p) => p.x));
  const minY = Math.min(...body.map((p) => p.y));
  const maxY = Math.max(...body.map((p) => p.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const uniform = Math.min(aspect / spanX, 1 / spanY);
  // A little extra stretch along the shorter side uses the page without distorting much.
  const sx = Math.min(aspect / spanX, uniform * 1.25);
  const sy = Math.min(1 / spanY, uniform * 1.25);
  const offsetX = (aspect - spanX * sx) / 2;
  const offsetY = (1 - spanY * sy) / 2;
  return turned.map((p) => ({ x: offsetX + (p.x - minX) * sx, y: offsetY + (p.y - minY) * sy }));
}
