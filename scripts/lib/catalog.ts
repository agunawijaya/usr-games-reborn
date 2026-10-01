import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameManifest } from '../../packages/kit/src/manifest/manifest';
import { validateManifest } from '../../packages/kit/src/manifest/validate';
import { REPO_ROOT } from './paths';

/**
 * The thirty games registered by the foundation prompt (§10), plus the owner's additions (atc-classic,
 * a second interpretation of atc, and zoomies, a second interpretation of robots, both decided on
 * 2026-10-01); ids are final.
 */
export const PLANNED_IDS = [
  'pom',
  'worms',
  'rain',
  'lightkeeper',
  'sail',
  'trek',
  'hunt',
  'robots',
  'zoomies',
  'battlestar',
  'atc',
  'atc-classic',
  'wump',
  'worm',
  'snake',
  'blocks',
  'gomoku',
  'dab',
  'backgammon',
  'monop',
  'cribbage',
  'canfield',
  'fish',
  'mille',
  'pig',
  'letters',
  'hangman',
  'quiz',
  'arithmetic',
  'signal',
  'adventure',
  'hack',
  'phantasia',
] as const;

export const CATALOG_INDEX = 'apps/hall/src/catalog/catalog.json';
export const PLACEHOLDER_DIR = 'apps/hall/src/catalog/placeholders';

export type EntrySource = 'placeholder' | 'game' | 'fixture';

export interface ResolvedEntry {
  id: string;
  source: EntrySource;
  /** Repo-relative path of the manifest this entry resolved to. */
  manifestPath: string;
  exists: boolean;
  manifest: GameManifest | null;
  /** Problems reading or validating the manifest. */
  errors: string[];
}

export interface CatalogRead {
  games: ResolvedEntry[];
  fixtures: ResolvedEntry[];
  /** Problems with catalog.json itself. */
  problems: string[];
  /** Ids of every placeholder file on disk, used or not. */
  placeholderFiles: string[];
}

interface RawIndex {
  version?: unknown;
  games?: unknown;
  fixtures?: unknown;
}

export function manifestPathFor(id: string, source: 'placeholder' | 'game'): string {
  return source === 'game' ? `games/${id}/manifest.json` : `${PLACEHOLDER_DIR}/${id}.json`;
}

function resolveEntry(
  root: string,
  id: string,
  source: EntrySource,
  manifestPath: string,
): ResolvedEntry {
  const absolute = join(root, manifestPath);
  if (!existsSync(absolute)) {
    return {
      id,
      source,
      manifestPath,
      exists: false,
      manifest: null,
      errors: [`missing manifest ${manifestPath}`],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    return {
      id,
      source,
      manifestPath,
      exists: true,
      manifest: null,
      errors: [`unreadable JSON: ${(error as Error).message}`],
    };
  }
  const result = validateManifest(raw);
  if (!result.ok)
    return { id, source, manifestPath, exists: true, manifest: null, errors: result.errors };
  const errors =
    result.value.id === id
      ? []
      : [`manifest id "${result.value.id}" does not match catalog id "${id}"`];
  return { id, source, manifestPath, exists: true, manifest: result.value, errors };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readCatalog(root = REPO_ROOT): CatalogRead {
  const problems: string[] = [];
  const placeholderDir = join(root, PLACEHOLDER_DIR);
  const placeholderFiles = existsSync(placeholderDir)
    ? readdirSync(placeholderDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -5))
        .sort()
    : [];

  let index: RawIndex;
  try {
    index = JSON.parse(readFileSync(join(root, CATALOG_INDEX), 'utf8')) as RawIndex;
  } catch (error) {
    return {
      games: [],
      fixtures: [],
      problems: [`cannot read ${CATALOG_INDEX}: ${(error as Error).message}`],
      placeholderFiles,
    };
  }
  if (index.version !== 1) problems.push('catalog.json: "version" must be 1');

  const games: ResolvedEntry[] = [];
  if (!Array.isArray(index.games)) problems.push('catalog.json: "games" must be a list');
  else {
    index.games.forEach((line, position) => {
      if (
        !isObject(line) ||
        typeof line.id !== 'string' ||
        (line.source !== 'placeholder' && line.source !== 'game')
      ) {
        problems.push(
          `catalog.json: games[${position}] must be { "id": string, "source": "placeholder" | "game" }`,
        );
        return;
      }
      games.push(resolveEntry(root, line.id, line.source, manifestPathFor(line.id, line.source)));
    });
  }

  const fixtures: ResolvedEntry[] = [];
  if (index.fixtures !== undefined && !Array.isArray(index.fixtures))
    problems.push('catalog.json: "fixtures" must be a list');
  else {
    (index.fixtures ?? []).forEach((line: unknown, position: number) => {
      if (!isObject(line) || typeof line.id !== 'string' || typeof line.manifest !== 'string') {
        problems.push(
          `catalog.json: fixtures[${position}] must be { "id": string, "manifest": string }`,
        );
        return;
      }
      fixtures.push(resolveEntry(root, line.id, 'fixture', line.manifest));
    });
  }

  return { games, fixtures, problems, placeholderFiles };
}

/** Hosted entries that the build and the dev server can serve. */
export function hostedEntries(read: CatalogRead, withFixtures: boolean): ResolvedEntry[] {
  const pool = withFixtures ? [...read.games, ...read.fixtures] : read.games;
  return pool.filter(
    (entry) => entry.manifest?.kind === 'hosted' && entry.manifest.status !== 'coming-soon',
  );
}
