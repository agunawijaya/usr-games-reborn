import { describe, expect, it } from 'vitest';
import { flarePath } from '../engine/combat';
import { type Point, ZONE_SIZE } from '../engine/types';
import { type BoardGeometry, cellCentre, flareGuide, type Pixel } from './flare-guide';

const geometry: BoardGeometry = { x0: 20, y0: 30, cell: 50, board: 50 * ZONE_SIZE };

/** The compass bearing of the line from `a` to `b`: 0 is north, clockwise, in [0, 360). */
function compass(a: Pixel, b: Pixel): number {
  const degrees = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function angleGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return Math.min(gap, 360 - gap);
}

/** How far `p` lies from the infinite line through `a` and `b`. */
function offLine(p: Pixel, a: Pixel, b: Pixel): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
}

const ships: Point[] = [
  { row: 4, col: 5 },
  { row: 0, col: 0 },
  { row: 9, col: 3 },
  { row: 6, col: 9 },
];

describe('the flare preview', () => {
  it('draws the bearing true and stops in the cell the flight meets', () => {
    let checked = 0;
    for (const ship of ships) {
      for (let row = 0; row < ZONE_SIZE; row++) {
        for (let col = 0; col < ZONE_SIZE; col++) {
          if (row === ship.row && col === ship.col) continue;
          const target = cellCentre(geometry, { row, col });
          const bearing = Math.round(compass(cellCentre(geometry, ship), target));
          const flight = flarePath(ship, bearing, (at) =>
            at.row === row && at.col === col ? 'gleaner' : 'empty',
          );
          const guide = flareGuide(geometry, ship, {
            bearing,
            scatter: 12,
            burst: 0,
            hit: flight.at,
          });
          expect(angleGap(compass(guide.from, guide.to), bearing)).toBeLessThan(0.01);
          if (flight.at) {
            // The line crosses the cell it meets, and ends level with that cell's centre.
            const hit = cellCentre(geometry, flight.at);
            expect(offLine(hit, guide.from, guide.to)).toBeLessThanOrEqual(geometry.cell * 0.7072);
            expect(Math.abs(guide.to.x - hit.x)).toBeLessThanOrEqual(geometry.cell * 0.6);
            expect(Math.abs(guide.to.y - hit.y)).toBeLessThanOrEqual(geometry.cell * 0.6);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('runs to the edge of the board when the flight meets nothing', () => {
    for (const ship of ships) {
      for (let bearing = 0; bearing < 360; bearing += 7) {
        const guide = flareGuide(geometry, ship, { bearing, scatter: 12, burst: 0, hit: null });
        const { x0, y0, board } = geometry;
        const onEdge = [
          guide.to.x - x0,
          x0 + board - guide.to.x,
          guide.to.y - y0,
          y0 + board - guide.to.y,
        ];
        expect(Math.min(...onEdge.map(Math.abs))).toBeLessThan(1e-6);
        expect(angleGap(compass(guide.from, guide.to), bearing)).toBeLessThan(0.01);
      }
    }
  });

  it('spans the stray wedge either side of the bearing, the spread of three drawn faint', () => {
    const toCompass = (canvasAngle: number) => ((canvasAngle * 180) / Math.PI + 90 + 360) % 360;
    const single = flareGuide(geometry, ships[0]!, {
      bearing: 297,
      scatter: 12,
      burst: 0,
      hit: null,
    });
    expect(single.wedges).toHaveLength(1);
    const aimed = single.wedges[0]!;
    expect(aimed.faint).toBe(false);
    expect(angleGap(toCompass(aimed.from), 285)).toBeLessThan(1e-9);
    expect(angleGap(toCompass(aimed.to), 309)).toBeLessThan(1e-9);

    const spread = flareGuide(geometry, ships[0]!, {
      bearing: 40,
      scatter: 18,
      burst: 5,
      hit: null,
    });
    expect(spread.wedges.map((w) => w.faint)).toEqual([true, true, false]);
    const middles = spread.wedges.map((w) => toCompass((w.from + w.to) / 2));
    expect(middles.map((m) => Math.round(m))).toEqual([35, 45, 40]);
    for (const w of spread.wedges) expect(((w.to - w.from) * 180) / Math.PI).toBeCloseTo(36, 9);
  });
});
