import { isPosterImage } from '@usr-games/bridge/protocol';
import { createSaveSlot, type KeyValueStorage, type SaveSlot } from '@usr-games/kit';
import type { Catalog } from '../../catalog/catalog';
import { rememberGamePoster } from './game-posters';

/**
 * Key art hosted games drew of themselves, kept between visits. A hosted game sends a snapshot
 * of itself over the bridge while it is played; the shelf keeps the latest one per game in the
 * Hall's storage, so Console Home and Holo Collection show it again after a reload. It is
 * versioned like every save and capped, because browser storage is small and shared with the
 * player's progress: one poster may take at most `POSTER_MAX_CHARS`, the whole shelf at most
 * `SHELF_MAX_CHARS`, and the posters played longest ago make room first.
 */

/** About 300 KB of WebP: a 1280-pixel snapshot fits with room to spare. */
export const POSTER_MAX_CHARS = 400_000;
/** The whole shelf, about a quarter of what browsers give a site. */
export const SHELF_MAX_CHARS = 1_600_000;

export interface ShelvedPoster {
  image: string;
  /** When it was kept (milliseconds), so the oldest makes room first. */
  keptAt: number;
}

export type PosterShelf = Record<string, ShelvedPoster>;

function isShelf(value: unknown): value is PosterShelf {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (poster: unknown) =>
      typeof poster === 'object' &&
      poster !== null &&
      isPosterImage((poster as ShelvedPoster).image) &&
      Number.isFinite((poster as ShelvedPoster).keptAt),
  );
}

function shelfSize(shelf: PosterShelf): number {
  return Object.values(shelf).reduce((sum, poster) => sum + poster.image.length, 0);
}

/**
 * The shelf with `image` kept for `gameId`, or the shelf unchanged when the image is too large
 * to keep at all. Older posters of other games leave until everything fits.
 */
export function shelvePoster(
  shelf: PosterShelf,
  gameId: string,
  image: string,
  keptAt: number,
): PosterShelf {
  if (image.length > POSTER_MAX_CHARS || !isPosterImage(image)) return shelf;
  const next: PosterShelf = { ...shelf, [gameId]: { image, keptAt } };
  const oldestFirst = Object.entries(next)
    .filter(([id]) => id !== gameId)
    .sort(([, a], [, b]) => a.keptAt - b.keptAt);
  while (shelfSize(next) > SHELF_MAX_CHARS && oldestFirst.length > 0) {
    const [oldest] = oldestFirst.shift()!;
    delete next[oldest];
  }
  return next;
}

function shelfSlot(storage: KeyValueStorage): SaveSlot<PosterShelf> {
  return createSaveSlot({
    storage,
    scope: 'hall',
    key: 'posters',
    version: 1,
    defaults: () => ({}),
    isValid: isShelf,
  });
}

/** Keeps a poster a hosted game just sent, and shows it from now on. */
export function keepGamePoster(
  storage: KeyValueStorage,
  gameId: string,
  image: string,
  now = Date.now(),
): void {
  rememberGamePoster(gameId, image);
  const slot = shelfSlot(storage);
  const shelf = slot.load();
  const next = shelvePoster(shelf, gameId, image, now);
  // A full or blocked storage is shrugged off by the kit; the poster still shows this visit.
  if (next !== shelf) slot.save(next);
}

/** At start-up: the posters kept on earlier visits, for games still in the catalog. */
export function restoreGamePosters(storage: KeyValueStorage, catalog: Catalog): void {
  const shelf = shelfSlot(storage).load();
  for (const [gameId, poster] of Object.entries(shelf)) {
    if (catalog.byId(gameId)?.manifest.kind === 'hosted') rememberGamePoster(gameId, poster.image);
  }
}
