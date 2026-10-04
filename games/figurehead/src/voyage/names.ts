import type { Rng } from '@usr-games/kit';

/**
 * Names for the Gannet Sea: ships of the three flags, merchantmen, officers, and the names a
 * new ship might be launched under. All of them are Figurehead's own.
 */

/** Suggestions on the launch screen; the player may type any name. */
export const LAUNCH_NAMES = [
  'Kittiwake',
  'Marigold',
  'Steadfast',
  'Wren',
  'Halcyon',
  'Bright Ellen',
  'Larkspur',
  'Thistle',
  'Morning Star',
  'Fair Rosamund',
  'Curlew',
  'Hollyhock',
] as const;

/** Ships of Vesk, the rival fleet across the sea. */
export const VESK_NAMES = [
  'Corvane',
  'Ostrava',
  'Meridel',
  'Hask',
  'Vantage',
  'Iron Duchess',
  'Sorrel',
  'Kestrin',
  'Valmont',
  'Grauland',
  'Tessaly',
  'Ardent Crown',
  'Brevard',
  'Calloway',
  'Dunmere',
  'Esk',
] as const;

/** The raiders of Gullrock and the outer isles. */
export const RAIDER_NAMES = [
  'Magpie',
  'Saltjack',
  'Black Gull',
  'Rook',
  'Weasel',
  'Long Tom',
  'Jackdaw',
  'Sea Ferret',
  'Merry Thief',
  'Quickthorn',
] as const;

/** Ships of our own flag that join when the squadron is short. */
export const STATION_NAMES = [
  'Plover',
  'Constance',
  'Snowdrop',
  'Goldfinch',
  'Resolute',
  'Bramble',
  'Swift',
  'Linnet',
] as const;

export const MERCHANT_NAMES = [
  'Saltbox',
  'Barleycorn',
  'Bountiful',
  'Good Intent',
  'Wool Princess',
  'Cheerful Polly',
  'Amberley',
  'Harvest Home',
] as const;

const GIVEN = [
  'Ada',
  'Tobias',
  'Mercy',
  'Elias',
  'Harriet',
  'Jonah',
  'Isobel',
  'Silas',
  'Martha',
  'Owen',
  'Nell',
  'Barnaby',
  'Ruth',
  'Caleb',
  'Hester',
  'Abel',
  'Tamsin',
  'Ezra',
  'Lettie',
  'Rufus',
] as const;

const FAMILY = [
  'Pell',
  'Rook',
  'Hartley',
  'Quill',
  'Marsh',
  'Treadwell',
  'Fenn',
  'Ashby',
  'Corrie',
  'Lowe',
  'Penhallow',
  'Brack',
  'Dunstan',
  'Tregear',
  'Holloway',
  'Merriman',
  'Swale',
  'Oakes',
] as const;

export function personName(rng: Rng): string {
  return `${rng.pick(GIVEN)} ${rng.pick(FAMILY)}`;
}

/** A name from `list` not already used; numbered when the list runs dry. */
export function freshName(rng: Rng, list: readonly string[], used: Set<string>): string {
  const left = list.filter((name) => !used.has(name));
  const name = left.length ? rng.pick(left) : `${rng.pick(list)} ${used.size + 2}`;
  used.add(name);
  return name;
}

/** Roman numerals for a ship's later hulls: Kittiwake, Kittiwake II, Kittiwake III. */
export function hullName(name: string, hull: number): string {
  const numerals = ['', '', ' II', ' III', ' IV', ' V', ' VI'];
  return `${name}${numerals[hull] ?? ` ${hull}`}`;
}
