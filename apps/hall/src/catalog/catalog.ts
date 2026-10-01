import type { GameModule, PackageDefinition } from '@usr-games/kit';
import { type GameManifest, validateManifest } from '@usr-games/kit/manifest';
import index from './catalog.json';

/**
 * The Hall's view of the collection: every catalog line resolved to its manifest, plus how to
 * launch it. Manifests are bundled eagerly (they are small); native game code is split into
 * its own chunk and loaded only when the player runs the game.
 */

export type EntrySource = 'placeholder' | 'game' | 'fixture';

export interface CatalogEntry {
  manifest: GameManifest;
  source: EntrySource;
  /** Native games: the code-split module. */
  loadModule?: () => Promise<GameModule>;
  /** Hosted games: the frame URL, relative to the site base. */
  playPath?: string;
}

export interface Catalog {
  entries: readonly CatalogEntry[];
  byId(id: string): CatalogEntry | undefined;
  /** Everything the player can see: all statuses except `unlisted`. */
  listed(): CatalogEntry[];
  /** Games that can be run today. */
  shipped(): CatalogEntry[];
}

interface CatalogIndex {
  version: number;
  games: { id: string; source: 'placeholder' | 'game' }[];
  fixtures: { id: string; manifest: string }[];
}

const placeholderFiles = import.meta.glob<GameManifest>('./placeholders/*.json', {
  eager: true,
  import: 'default',
});
const gameFiles = import.meta.glob<GameManifest>('../../../../games/*/manifest.json', {
  eager: true,
  import: 'default',
});
const nativeModules = import.meta.glob<GameModule>('../../../../games/*/src/index.ts', {
  import: 'default',
});

/**
 * Test fixtures: the bridge's hosted ones and the Hall's own native one. Only development and
 * `--fixtures` builds bundle them; in production these globs sit in dead code and drop out.
 */
const FIXTURE_BUILD = import.meta.env.DEV || import.meta.env.VITE_HALL_FIXTURES === '1';
const fixtureFiles = FIXTURE_BUILD
  ? {
      ...import.meta.glob<GameManifest>('../../../../packages/bridge/fixture*/manifest.json', {
        eager: true,
        import: 'default',
      }),
      ...import.meta.glob<GameManifest>('../fixtures/*/manifest.json', {
        eager: true,
        import: 'default',
      }),
    }
  : {};
const fixtureModules: Record<string, () => Promise<GameModule>> = FIXTURE_BUILD
  ? import.meta.glob<GameModule>('../fixtures/*/index.ts', { import: 'default' })
  : {};

function fileFor<T>(files: Record<string, T>, suffix: string): T | undefined {
  const key = Object.keys(files).find((path) => path.endsWith(suffix));
  return key ? files[key] : undefined;
}

const CATALOG_DIR = 'apps/hall/src/catalog';

/** A glob key such as `../fixtures/native/index.ts`, as the repo-relative path catalog.json uses. */
function repoPath(globKey: string): string {
  const parts = CATALOG_DIR.split('/');
  for (const segment of globKey.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

function byRepoPath<T>(files: Record<string, T>, path: string): T | undefined {
  const key = Object.keys(files).find((globKey) => repoPath(globKey) === path);
  return key ? files[key] : undefined;
}

function checked(manifest: GameManifest | undefined, where: string): GameManifest {
  if (!manifest) throw new Error(`Catalog: no manifest at ${where}`);
  const result = validateManifest(manifest);
  if (!result.ok) throw new Error(`Catalog: ${where} is invalid:\n${result.errors.join('\n')}`);
  return result.value;
}

/** `manifestPath` is given for fixtures, whose native module sits next to their manifest. */
function launchInfo(
  manifest: GameManifest,
  manifestPath?: string,
): Pick<CatalogEntry, 'loadModule' | 'playPath'> {
  if (manifest.build.kind === 'native') {
    const load = manifestPath
      ? byRepoPath(fixtureModules, manifestPath.replace(/manifest\.json$/, 'index.ts'))
      : fileFor(nativeModules, `/games/${manifest.id}/src/index.ts`);
    return load ? { loadModule: load } : {};
  }
  const entry = manifest.build.entry ?? '';
  return { playPath: `${manifest.build.output}${entry}` };
}

export function isLaunchable(entry: CatalogEntry): boolean {
  const { status } = entry.manifest;
  const runnable = status === 'shipped' || (entry.source === 'fixture' && status === 'unlisted');
  return runnable && Boolean(entry.loadModule || entry.playPath);
}

/**
 * Screenshot scenes preview the catalog as a later prompt will leave it (for example the
 * adopted games shipped). The override lives only in memory and never in a manifest file.
 */
export interface CatalogPreview {
  shipped?: readonly string[];
  packages?: Readonly<Record<string, PackageDefinition[]>>;
}

function previewed(manifest: GameManifest, preview: CatalogPreview | undefined): GameManifest {
  if (!preview) return manifest;
  const shipped = preview.shipped?.includes(manifest.id) ?? false;
  const packages = preview.packages?.[manifest.id];
  if (!shipped && !packages) return manifest;
  return {
    ...manifest,
    ...(shipped ? { status: 'shipped' as const } : {}),
    ...(packages ? { packages } : {}),
  };
}

export function loadCatalog(options: { fixtures: boolean; preview?: CatalogPreview }): Catalog {
  const data = index as CatalogIndex;
  const entries: CatalogEntry[] = data.games.map(({ id, source }) => {
    const file =
      source === 'game'
        ? checked(fileFor(gameFiles, `/games/${id}/manifest.json`), `games/${id}/manifest.json`)
        : checked(fileFor(placeholderFiles, `/placeholders/${id}.json`), `placeholders/${id}.json`);
    const manifest = previewed(file, options.preview);
    return { manifest, source, ...launchInfo(manifest) };
  });
  if (options.fixtures) {
    for (const fixture of data.fixtures) {
      const manifest = checked(byRepoPath(fixtureFiles, fixture.manifest), fixture.manifest);
      entries.push({ manifest, source: 'fixture', ...launchInfo(manifest, fixture.manifest) });
    }
  }
  const byId = new Map(entries.map((entry) => [entry.manifest.id, entry]));
  return {
    entries,
    byId: (id) => byId.get(id),
    listed: () => entries.filter((entry) => entry.manifest.status !== 'unlisted'),
    shipped: () =>
      entries.filter((entry) => entry.manifest.status === 'shipped' && isLaunchable(entry)),
  };
}
