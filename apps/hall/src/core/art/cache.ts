import { makeCanvas } from './shapes';

/**
 * Two small caches keep posters cheap. Layers: the parts of a poster that never move (sky, sea
 * floor, a ship, a planet), painted once per size and reused every frame. Stills: whole poster
 * frames for tiles and cards that are not animating, painted once per game, look and size bucket.
 * Both are bounded, dropping the least recently used entry, so resizing never grows memory.
 */

class BoundedCache<V> {
  private readonly entries = new Map<string, V>();

  constructor(private readonly limit: number) {}

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

const layers = new BoundedCache<HTMLCanvasElement>(64);
const stills = new BoundedCache<HTMLCanvasElement>(96);

/** Still frames are painted at sizes rounded up to this step, so near-identical tiles share one. */
export const SIZE_STEP = 32;

export function sizeBucket(pixels: number): number {
  return Math.max(SIZE_STEP, Math.ceil(pixels / SIZE_STEP) * SIZE_STEP);
}

export function layerKey(
  name: string,
  width: number,
  height: number,
  ratio: number,
  variant: string,
): string {
  return `${name}|${Math.round(width)}x${Math.round(height)}@${ratio}|${variant}`;
}

export function stillKey(
  artId: string,
  appearance: string,
  width: number,
  height: number,
  ratio: number,
): string {
  return `${artId}|${appearance}|${sizeBucket(width)}x${sizeBucket(height)}@${ratio}`;
}

/**
 * A static layer at device resolution, painted by `paint` in CSS pixels the first time and
 * served from the cache after that.
 */
export function cachedLayer(
  key: string,
  width: number,
  height: number,
  ratio: number,
  paint: (context: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const cached = layers.get(key);
  if (cached) return cached;
  const canvas = makeCanvas(width * ratio, height * ratio);
  const context = canvas.getContext('2d');
  if (context) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(context);
  }
  layers.set(key, canvas);
  return canvas;
}

export function cachedStill(key: string, create: () => HTMLCanvasElement): HTMLCanvasElement {
  const cached = stills.get(key);
  if (cached) return cached;
  const canvas = create();
  stills.set(key, canvas);
  return canvas;
}

export function clearArtCaches(): void {
  layers.clear();
  stills.clear();
}

export function cacheSizes(): { layers: number; stills: number } {
  return { layers: layers.size, stills: stills.size };
}
