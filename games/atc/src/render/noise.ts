import { createRng } from '@usr-games/kit';

/**
 * Seeded value noise for the chart's land and the scope's grain. Smooth enough for gentle hills,
 * cheap enough to fill a 2560 × 1440 texture once per arena.
 */

const SIZE = 256;

export interface Noise2D {
  (x: number, y: number): number;
}

export function valueNoise(seed: string): Noise2D {
  const rng = createRng(`noise:${seed}`);
  const values = Float32Array.from({ length: SIZE * SIZE }, () => rng.next());
  const at = (ix: number, iy: number) => values[(iy & (SIZE - 1)) * SIZE + (ix & (SIZE - 1))]!;
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}

/** Fractal sum of octaves, normalised to roughly 0–1. */
export function fractal(noise: Noise2D, octaves: number): Noise2D {
  return (x, y) => {
    let sum = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * frequency + i * 17.3, y * frequency - i * 9.1) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return sum / total;
  };
}
