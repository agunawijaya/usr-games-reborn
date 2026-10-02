// @vitest-environment jsdom
import { memoryStorage } from '@usr-games/kit';
import type { GameManifest } from '@usr-games/kit/manifest';
import { afterEach, describe, expect, it } from 'vitest';
import type { Catalog, CatalogEntry } from '../../catalog/catalog';
import { forgetGamePoster, posterArtFor, rememberBuildPoster } from './art';
import {
  keepGamePoster,
  POSTER_MAX_CHARS,
  restoreGamePosters,
  SHELF_MAX_CHARS,
  shelvePoster,
} from './poster-shelf';

const PREFIX = 'data:image/webp;base64,';
/** A syntactically valid poster of about `chars` characters. */
const poster = (chars: number, fill = 'A') => PREFIX + fill.repeat(chars - PREFIX.length);

function entry(id: string, kind: 'hosted' | 'native'): CatalogEntry {
  const manifest = {
    id,
    kind,
    status: 'shipped',
    category: 'toys',
    accent: '#f2b541',
    emblem: 'M8 40 L24 8 L40 40 Z',
  } as unknown as GameManifest;
  return { manifest, source: 'game' };
}

const catalog = {
  byId: (id: string) =>
    ({
      worms: entry('worms', 'hosted'),
      rain: entry('rain', 'hosted'),
      atc: entry('atc', 'native'),
    })[id],
} as unknown as Catalog;

afterEach(() => {
  for (const id of ['worms', 'rain', 'atc']) forgetGamePoster(id);
});

describe('shelvePoster', () => {
  it('keeps the latest poster of each game', () => {
    const first = shelvePoster({}, 'worms', poster(100), 1);
    const second = shelvePoster(first, 'worms', poster(120, 'B'), 2);
    expect(Object.keys(second)).toEqual(['worms']);
    expect(second.worms?.image).toBe(poster(120, 'B'));
  });

  it('refuses a poster too large to keep, and anything that is not an inline image', () => {
    const shelf = shelvePoster({}, 'rain', poster(80), 1);
    expect(shelvePoster(shelf, 'worms', poster(POSTER_MAX_CHARS + 1), 2)).toBe(shelf);
    expect(shelvePoster(shelf, 'worms', 'https://example.test/poster.webp', 2)).toBe(shelf);
  });

  it('makes room by letting the posters kept longest ago go first', () => {
    const big = POSTER_MAX_CHARS;
    let shelf = {};
    const ids = ['a', 'b', 'c', 'd', 'e'];
    ids.forEach((id, order) => (shelf = shelvePoster(shelf, id, poster(big), order)));
    const kept = Object.keys(shelf);
    expect(kept.length * big).toBeLessThanOrEqual(SHELF_MAX_CHARS);
    expect(kept).toEqual(ids.slice(ids.length - kept.length));
  });
});

describe('the poster shelf in the Hall’s storage', () => {
  it('brings back a hosted game’s snapshot after a reload, and only for hosted games', () => {
    const storage = memoryStorage();
    keepGamePoster(storage, 'worms', poster(200), 10);
    keepGamePoster(storage, 'atc', poster(200), 11);
    forgetGamePoster('worms');
    forgetGamePoster('atc');
    expect(posterArtFor(entry('worms', 'hosted')).kind).toBe('procedural');

    restoreGamePosters(storage, catalog);
    expect(posterArtFor(entry('worms', 'hosted')).kind).toBe('game');
    expect(posterArtFor(entry('atc', 'native')).kind).toBe('procedural');
    const saved = JSON.parse(storage.getItem('usr-games:hall:posters') ?? '{}') as { v: number };
    expect(saved.v).toBe(1);
  });

  it('ignores a damaged shelf instead of showing it', () => {
    const storage = memoryStorage();
    storage.setItem(
      'usr-games:hall:posters',
      JSON.stringify({
        v: 1,
        savedAt: '',
        data: { worms: { image: 'javascript:alert(1)', keptAt: 1 } },
      }),
    );
    restoreGamePosters(storage, catalog);
    expect(posterArtFor(entry('worms', 'hosted')).kind).toBe('procedural');
  });
});

describe('build-time posters', () => {
  it('stand in until the game sends its own, which then takes over', () => {
    rememberBuildPoster('rain', '/play/rain/poster.webp');
    const fromBuild = posterArtFor(entry('rain', 'hosted'));
    expect(fromBuild.kind).toBe('game');

    keepGamePoster(memoryStorage(), 'rain', poster(300));
    const fromGame = posterArtFor(entry('rain', 'hosted'));
    expect(fromGame.art).not.toBe(fromBuild.art);
    expect(fromGame.cacheId).not.toBe(fromBuild.cacheId);

    forgetGamePoster('rain');
    expect(posterArtFor(entry('rain', 'hosted')).art).toBe(fromBuild.art);
  });
});
