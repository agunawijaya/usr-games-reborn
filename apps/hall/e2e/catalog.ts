import { readFileSync } from 'node:fs';

/**
 * The catalog as the Hall shows it, read from the same files the Hall bundles, so the suites'
 * counts and names follow the collection as games are added and shipped.
 */

export interface CatalogGame {
  id: string;
  title: string;
  status: 'coming-soon' | 'adopting' | 'shipped' | 'unlisted';
  kind: 'native' | 'hosted';
}

const repo = new URL('../../../', import.meta.url);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, repo), 'utf8')) as T;

export const CATALOG: readonly CatalogGame[] = readJson<{
  games: { id: string; source: 'game' | 'placeholder' }[];
}>('apps/hall/src/catalog/catalog.json').games.map(({ id, source }) =>
  readJson<CatalogGame>(
    source === 'game'
      ? `games/${id}/manifest.json`
      : `apps/hall/src/catalog/placeholders/${id}.json`,
  ),
);

/** Every game a player can see: all but the unlisted. */
export const LISTED = CATALOG.filter((game) => game.status !== 'unlisted');
/** Games still asleep in the process list. */
export const SLEEPING = CATALOG.filter((game) => game.status === 'coming-soon');
export const SHIPPED = CATALOG.filter((game) => game.status === 'shipped');
