import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { chamberShape, placeMouths } from './chamber-shape';
import { archBox, type Box, layoutArches } from './mouths';

/** Tunnel mouths never overlap one another, and never cover the explorer, at any screen size. */

function overlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

const SIZES = [
  [1100, 860],
  [720, 560],
  [1500, 1000],
] as const;

describe('placing tunnel mouths', () => {
  for (const [width, height] of SIZES) {
    it(`keeps every mouth, plaque and mark apart in a ${width}×${height} room`, () => {
      const rng = createRng(`mouths-${width}`);
      for (let room = 1; room <= 150; room++) {
        const count = rng.int(2, 4);
        const directions = Array.from({ length: count }, (_, i) => ({
          to: i + 1,
          angle: rng.float(-Math.PI, Math.PI),
        }));
        const shape = chamberShape(width, height, room * 101 + 7);
        const sign = { w: height * 0.058 * 1.75, h: height * 0.058 };
        const explorer = {
          x0: width * 0.5 - height * 0.09,
          y0: shape.floorY - height * 0.24,
          x1: width * 0.5 + height * 0.09,
          y1: shape.floorY,
        };
        const mouths = placeMouths(directions).map((m) => ({
          ...m,
          magic: false,
          marks: rng.int(0, 2),
        }));
        const arches = layoutArches(
          shape,
          mouths,
          Math.min(width, height * 1.3) * (0.16 - count * 0.01),
          sign,
          [explorer],
          { x0: 6, y0: 6, x1: width - 6, y1: height - 6 },
        );
        const boxes = arches.map((a, i) => archBox(a, sign, mouths[i]!.marks));
        for (let i = 0; i < boxes.length; i++) {
          expect(overlap(boxes[i]!, explorer)).toBe(false);
          for (let j = i + 1; j < boxes.length; j++)
            expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
        }
      }
    });
  }
});
