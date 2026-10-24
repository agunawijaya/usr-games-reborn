import type { CardId } from '@usr-games/kit/cards';
import { isCardId } from '@usr-games/kit/cards';
import type { Level } from '../engine/ai/minds';

/**
 * Hand records: the album of your best hands and cribs, highest first, each kept with its
 * cards, its count and the day. The perfect 29 has a slot of its own, empty until it comes.
 */

export const ALBUM_SIZE = 24;

export interface AlbumEntry {
  hand: CardId[];
  starter: CardId;
  isCrib: boolean;
  total: number;
  date: string;
  opponent: Level;
}

export function isAlbumEntry(value: unknown): value is AlbumEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<AlbumEntry>;
  return (
    Array.isArray(entry.hand) &&
    entry.hand.length === 4 &&
    entry.hand.every(isCardId) &&
    isCardId(entry.starter) &&
    typeof entry.isCrib === 'boolean' &&
    typeof entry.total === 'number' &&
    typeof entry.date === 'string'
  );
}

export function albumFrom(value: unknown): AlbumEntry[] {
  return Array.isArray(value) ? value.filter(isAlbumEntry) : [];
}

/**
 * Adds a counted hand; returns the new album and whether the hand made it in. Ties keep the
 * earlier hand ahead, so an old record is never pushed down by an equal one.
 */
export function addToAlbum(
  album: readonly AlbumEntry[],
  entry: AlbumEntry,
): { album: AlbumEntry[]; added: boolean; place: number } {
  if (entry.total <= 0) return { album: [...album], added: false, place: -1 };
  const index = album.findIndex((kept) => entry.total > kept.total);
  const place = index < 0 ? album.length : index;
  if (place >= ALBUM_SIZE) return { album: [...album], added: false, place: -1 };
  const next = [...album.slice(0, place), entry, ...album.slice(place)].slice(0, ALBUM_SIZE);
  return { album: next, added: true, place };
}

export function perfectHand(album: readonly AlbumEntry[]): AlbumEntry | null {
  return album.find((entry) => entry.total === 29) ?? null;
}
