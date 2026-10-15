import type { RouteId } from '../render/routes';

/**
 * The travel journal: which routes are open, and what each has given you. Every route opens
 * after a number of hands won; the first hand won on a route earns its sticker, and every hand
 * won there adds a stamp to the passport page.
 */

export interface RouteStop {
  id: RouteId;
  /** Hands won (anywhere) before the route opens. */
  opensAfter: number;
  /** The souvenir sticker's words. */
  sticker: string;
  /** Where the route sits on the journal's map, as shares of its width and height. */
  map: { x: number; y: number };
}

export const STOPS: readonly RouteStop[] = [
  { id: 'coast', opensAfter: 0, sticker: 'Lighthouse Point', map: { x: 0.16, y: 0.62 } },
  { id: 'desert', opensAfter: 0, sticker: 'Mesa Motor Court', map: { x: 0.38, y: 0.34 } },
  { id: 'alpine', opensAfter: 3, sticker: 'Snowline Summit', map: { x: 0.6, y: 0.22 } },
  { id: 'jungle', opensAfter: 6, sticker: 'Falls Crossing', map: { x: 0.56, y: 0.7 } },
  { id: 'city', opensAfter: 10, sticker: 'Neon Avenue', map: { x: 0.84, y: 0.46 } },
];

export interface Journal {
  handsWon: number;
  /** Routes driven at least once. */
  driven: RouteId[];
  stickers: RouteId[];
  stamps: Partial<Record<RouteId, number>>;
}

export function emptyJournal(): Journal {
  return { handsWon: 0, driven: [], stickers: [], stamps: {} };
}

export function openRoutes(journal: Journal): RouteId[] {
  return STOPS.filter((stop) => journal.handsWon >= stop.opensAfter).map((stop) => stop.id);
}

/** The routes a game runs along, hand after hand: the open ones, starting where the seed says. */
export function routeForHand(open: readonly RouteId[], offset: number, handNo: number): RouteId {
  return open[(offset + handNo) % open.length] ?? 'coast';
}

export interface JournalUpdate {
  journal: Journal;
  newSticker: RouteId | null;
  newlyOpen: RouteId[];
}

/** A hand has been driven on `route`; `won` if the player's side won it. */
export function recordHand(journal: Journal, route: RouteId, won: boolean): JournalUpdate {
  const before = openRoutes(journal);
  const next: Journal = {
    handsWon: journal.handsWon + (won ? 1 : 0),
    driven: journal.driven.includes(route) ? journal.driven : [...journal.driven, route],
    stickers: journal.stickers,
    stamps: { ...journal.stamps },
  };
  let newSticker: RouteId | null = null;
  if (won) {
    next.stamps[route] = (next.stamps[route] ?? 0) + 1;
    if (!next.stickers.includes(route)) {
      next.stickers = [...next.stickers, route];
      newSticker = route;
    }
  }
  const newlyOpen = openRoutes(next).filter((id) => !before.includes(id));
  return { journal: next, newSticker, newlyOpen };
}

export function stopOf(route: RouteId): RouteStop {
  return STOPS.find((stop) => stop.id === route)!;
}
