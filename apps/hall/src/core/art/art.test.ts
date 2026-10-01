// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameManifest } from '@usr-games/kit/manifest';
import type { CatalogEntry } from '../../catalog/catalog';
import { drawStill, forgetGamePoster, posterArtFor, rememberGamePoster } from './art';
import { cachedStill, cacheSizes, clearArtCaches, layerKey, sizeBucket, stillKey } from './cache';
import { compose, scatter, tone, withOpacity } from './shapes';

function entry(
  id: string,
  status: GameManifest['status'],
  category: GameManifest['category'] = 'arcade',
): CatalogEntry {
  const manifest = {
    id,
    status,
    category,
    accent: '#f2b541',
    emblem: 'M8 40 L24 8 L40 40 Z',
  } as unknown as GameManifest;
  return { manifest, source: 'placeholder' };
}

afterEach(() => clearArtCaches());

describe('posterArtFor', () => {
  it('gives the four first-wave games their placeholder key art', () => {
    for (const id of ['sail', 'robots', 'trek', 'pom']) {
      expect(posterArtFor(entry(id, 'adopting')).kind).toBe('key-art');
      expect(posterArtFor(entry(id, 'shipped')).kind).toBe('key-art');
    }
  });

  it('gives every other game a procedural poster, one shared art per category', () => {
    const atc = posterArtFor(entry('atc', 'shipped', 'arcade'));
    const snake = posterArtFor(entry('snake', 'shipped', 'arcade'));
    const fish = posterArtFor(entry('fish', 'shipped', 'cards'));
    expect(atc.kind).toBe('procedural');
    expect(snake.art).toBe(atc.art);
    expect(fish.art).not.toBe(atc.art);
  });

  it('keeps coming-soon games on the calm procedural poster, even with key art available', () => {
    expect(posterArtFor(entry('sail', 'coming-soon', 'strategy')).kind).toBe('procedural');
  });

  it('prefers art a hosted game sent over the bridge', () => {
    rememberGamePoster('pom', 'data:image/png;base64,iVBORw0KGgo=');
    expect(posterArtFor(entry('pom', 'shipped', 'toys')).kind).toBe('game');
    expect(posterArtFor(entry('pom', 'coming-soon', 'toys')).kind).toBe('procedural');
    forgetGamePoster('pom');
    expect(posterArtFor(entry('pom', 'shipped', 'toys')).kind).toBe('key-art');
  });
});

describe('caches', () => {
  it('buckets sizes so near-identical tiles share one still', () => {
    expect(sizeBucket(1)).toBe(32);
    expect(sizeBucket(300)).toBe(320);
    expect(sizeBucket(320)).toBe(320);
    expect(stillKey('key-art:sail', 'dark', 300, 170, 2)).toBe(
      stillKey('key-art:sail', 'dark', 310, 180, 2),
    );
    expect(stillKey('key-art:sail', 'dark', 300, 170, 2)).not.toBe(
      stillKey('key-art:sail', 'light', 300, 170, 2),
    );
    expect(stillKey('key-art:sail', 'dark', 300, 170, 1)).not.toBe(
      stillKey('key-art:sail', 'dark', 300, 170, 2),
    );
    expect(layerKey('sail-sky', 1920.4, 650, 2, 'night')).toBe('sail-sky|1920x650@2|night');
  });

  it('reuses a still until it falls out of the bounded cache', () => {
    const create = vi.fn(() => document.createElement('canvas'));
    const first = cachedStill('a', create);
    expect(cachedStill('a', create)).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 120; i++) cachedStill(`filler-${i}`, create);
    expect(cacheSizes().stills).toBeLessThanOrEqual(96);
    cachedStill('a', create);
    expect(create).toHaveBeenCalledTimes(122);
  });
});

describe('drawStill', () => {
  it('crops the cached still to the target shape instead of stretching it', () => {
    const still = Object.assign(document.createElement('canvas'), { width: 640, height: 384 });
    const drawImage = vi.fn();
    drawStill({ drawImage } as unknown as CanvasRenderingContext2D, still, 300, 170);
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = drawImage.mock.calls[0] as number[];
    expect(sw! / sh!).toBeCloseTo(300 / 170, 5);
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 300, 170]);
  });
});

describe('drawing helpers', () => {
  it('puts the subject right of centre on wide art and centred on portrait cards', () => {
    expect(compose(1920, 650)).toMatchObject({ portrait: false, focusX: 1920 * 0.64, unit: 650 });
    expect(compose(240, 336)).toMatchObject({ portrait: true, focusX: 120, unit: 240 });
  });

  it('scatters the same points for the same seed, and different ones otherwise', () => {
    const a = scatter('poster:sail', 20);
    expect(scatter('poster:sail', 20)).toEqual(a);
    expect(scatter('poster:pom', 20)).not.toEqual(a);
    for (const point of a) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThan(1);
      expect(point.y).toBeLessThan(1);
    }
  });

  it('derives tones and translucent colours', () => {
    expect(tone('#f2b541', 0.2)).toMatch(/^#[0-9a-f]{6}$/);
    expect(tone('#f2b541', 0.2)).not.toBe(tone('#f2b541', 0.9));
    expect(withOpacity('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withOpacity('rgba(1, 2, 3, 1)', 0.25)).toBe('rgba(1, 2, 3, 0.25)');
  });
});
