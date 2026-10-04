import type { Point } from '../engine/types';

/** Where the zone's board sits on the canvas, in CSS pixels. */
export interface BoardGeometry {
  x0: number;
  y0: number;
  board: number;
  cell: number;
}

export interface Pixel {
  x: number;
  y: number;
}

/** One stray wedge, as canvas angles in radians (0 = east, clockwise). */
export interface FlareWedge {
  from: number;
  to: number;
  /** The outer flares of a spread of three are drawn faint. */
  faint: boolean;
}

/**
 * The flare preview as drawn: a straight line along the bearing from the Lantern, and the stray
 * wedges around it, the aimed flare's last.
 */
export interface FlareGuide {
  from: Pixel;
  to: Pixel;
  wedges: FlareWedge[];
}

export interface FlareAim {
  /** Compass degrees: 0 is north (up the board), clockwise. */
  bearing: number;
  /** The widest a flare strays either side of its bearing, in degrees. */
  scatter: number;
  /** The angle of the outer flares of a spread of three; 0 for a single flare. */
  burst: number;
  /** The first thing the flare meets flown true, or null when it leaves the zone. */
  hit: Point | null;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function cellCentre(geometry: BoardGeometry, at: Point): Pixel {
  const { x0, y0, cell } = geometry;
  return { x: x0 + (at.col + 0.5) * cell, y: y0 + (at.row + 0.5) * cell };
}

/**
 * Works out the flare preview so that it agrees with the card: the line keeps the bearing exactly
 * and stops where the flight meets something (level with that cell's centre) or leaves the board.
 * The engine's flight steps through the cells this line crosses, so the line always passes
 * through the cell it stops at.
 */
export function flareGuide(geometry: BoardGeometry, ship: Point, aim: FlareAim): FlareGuide {
  const from = cellCentre(geometry, ship);
  // Compass bearing to canvas angle: north is up, so a quarter turn back from east.
  const heading = radians(aim.bearing) - Math.PI / 2;
  const direction = { x: Math.cos(heading), y: Math.sin(heading) };
  const reach = aim.hit
    ? Math.max(0, along(direction, from, cellCentre(geometry, aim.hit)))
    : distanceToEdge(geometry, from, direction);
  const spread = radians(aim.scatter);
  const wedge = (offset: number, faint: boolean): FlareWedge => ({
    from: heading + radians(offset) - spread,
    to: heading + radians(offset) + spread,
    faint,
  });
  const outer = aim.burst > 0 ? [wedge(-aim.burst, true), wedge(aim.burst, true)] : [];
  return {
    from,
    to: { x: from.x + direction.x * reach, y: from.y + direction.y * reach },
    wedges: [...outer, wedge(0, false)],
  };
}

/** How far along `direction` from `origin` the point `to` lies. */
function along(direction: Pixel, origin: Pixel, to: Pixel): number {
  return (to.x - origin.x) * direction.x + (to.y - origin.y) * direction.y;
}

function distanceToEdge(geometry: BoardGeometry, from: Pixel, direction: Pixel): number {
  const { x0, y0, board } = geometry;
  const limit = (start: number, step: number, low: number, high: number) =>
    step > 0 ? (high - start) / step : step < 0 ? (low - start) / step : Infinity;
  return Math.min(
    limit(from.x, direction.x, x0, x0 + board),
    limit(from.y, direction.y, y0, y0 + board),
  );
}
