/**
 * `pnpm build [--fixtures]`: the whole static site in `dist/`.
 *
 *   dist/               the Hall (native games are code-split chunks of it)
 *   dist/bridge/        bridge.js (classic script) and bridge.mjs for hosted games
 *   dist/play/<id>/     each hosted game, copied or built by its own Vite step
 *
 * `SITE_BASE` sets the public path (GitHub Pages serves a project at `/<repo>/`).
 * `--fixtures` (or `HALL_FIXTURES=1`) adds the bridge fixture games, for end-to-end tests.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { hostedEntries, readCatalog, type ResolvedEntry } from './lib/catalog';
import { buildHostedViteGame, copyStaticGame, loadBuildBridge, normaliseBase } from './lib/hosted';
import { fromRepo, isMainModule } from './lib/paths';
import { dim, green, red, yellow } from './lib/report';
import { walkFiles } from './lib/walk';

export const FIRST_LOAD_BUDGET_KB = 250;
const DIST = fromRepo('dist');

interface ViteManifestChunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
}

/** Each Hall style is loaded lazily; a player's first visit downloads the entry plus one style. */
export const STYLE_ENTRIES = {
  'Console Home': 'src/styles/console/index.ts',
  'Holo Collection': 'src/styles/holo/index.ts',
  'Machine Room': 'src/styles/machine-room/index.ts',
} as const;

/**
 * The entry chunk plus everything it imports statically, and optionally one lazily loaded chunk
 * with its own static imports: what a first visit downloads.
 */
export function firstLoadFiles(
  manifest: Record<string, ViteManifestChunk>,
  lazyEntry?: string,
): string[] {
  const files = new Set<string>();
  const visit = (key: string) => {
    const chunk = manifest[key];
    if (!chunk || files.has(chunk.file)) return;
    files.add(chunk.file);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
  if (lazyEntry) visit(lazyEntry);
  return [...files].filter((file) => file.endsWith('.js'));
}

type FirstLoads = Record<string, string[]>;

const gzipSize = (path: string) => gzipSync(readFileSync(path)).length;
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

async function buildHall(base: string, withFixtures: boolean): Promise<FirstLoads> {
  process.env.SITE_BASE = base;
  process.env.VITE_HALL_FIXTURES = withFixtures ? '1' : '0';
  const { build } = await import('vite');
  await build({
    root: fromRepo('apps/hall'),
    base,
    mode: 'production',
    logLevel: 'warn',
    build: { outDir: DIST, emptyOutDir: true, manifest: true },
  });
  const manifestPath = join(DIST, '.vite/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
    string,
    ViteManifestChunk
  >;
  // The manifest is only for this measurement; the published site does not need it.
  rmSync(join(DIST, '.vite'), { recursive: true, force: true });
  return Object.fromEntries(
    Object.entries(STYLE_ENTRIES).map(([style, key]) => [style, firstLoadFiles(manifest, key)]),
  );
}

async function buildHostedGame(entry: ResolvedEntry, base: string): Promise<'built' | 'skipped'> {
  const manifest = entry.manifest!;
  if (manifest.build.kind === 'native') return 'skipped';
  const source = fromRepo(manifest.build.source);
  const outDir = join(DIST, manifest.build.output);
  if (!existsSync(source)) {
    console.warn(
      yellow(
        `  ! ${entry.id}: ${manifest.build.source} is missing; skipped (status ${manifest.status})`,
      ),
    );
    return 'skipped';
  }
  if (manifest.build.kind === 'hosted-static') {
    copyStaticGame(source, outDir);
    console.log(`  ${green('✓')} ${entry.id} ${dim(`copied from ${manifest.build.source}`)}`);
  } else {
    const how = await buildHostedViteGame(source, `${base}play/${entry.id}/`, outDir);
    console.log(
      `  ${green('✓')} ${entry.id} ${dim(`built with ${how === 'own' ? 'its own' : 'the workspace'} Vite`)}`,
    );
  }
  return 'built';
}

function folderSize(folder: string): { files: number; bytes: number; jsGzip: number } {
  const files = walkFiles({ root: folder, includeDist: true });
  let bytes = 0;
  let jsGzip = 0;
  for (const file of files) {
    bytes += statSync(file.absolute).size;
    if (['.js', '.mjs'].includes(extname(file.path))) jsGzip += gzipSize(file.absolute);
  }
  return { files: files.length, bytes, jsGzip };
}

function printSizes(firstLoads: FirstLoads): number {
  const rows: [string, string, string, string][] = [['', 'files', 'raw', 'JS gzip']];
  const hallFiles = walkFiles({ root: DIST, includeDist: true }).filter(
    (f) => !/^(bridge|play)\//.test(f.path),
  );
  const hallBytes = hallFiles.reduce((sum, f) => sum + statSync(f.absolute).size, 0);
  const hallJs = hallFiles
    .filter((f) => f.path.endsWith('.js'))
    .reduce((sum, f) => sum + gzipSize(f.absolute), 0);
  rows.push(['Hall (all chunks)', String(hallFiles.length), kb(hallBytes), kb(hallJs)]);
  for (const folder of ['bridge', ...listPlayFolders()]) {
    const size = folderSize(join(DIST, folder));
    rows.push([folder, String(size.files), kb(size.bytes), kb(size.jsGzip)]);
  }
  const total = folderSize(DIST);
  rows.push(['dist total', String(total.files), kb(total.bytes), kb(total.jsGzip)]);
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => row[column]!.length)));
  for (const row of rows)
    console.log(
      `  ${row.map((value, i) => (i === 0 ? value.padEnd(widths[i]!) : value.padStart(widths[i]!))).join('   ')}`,
    );

  console.log('');
  let failures = 0;
  for (const [style, files] of Object.entries(firstLoads)) {
    const gzip = files.reduce((sum, file) => sum + gzipSize(join(DIST, file)), 0);
    const withinBudget = gzip <= FIRST_LOAD_BUDGET_KB * 1024;
    if (!withinBudget) failures++;
    const verdict = `Hall first-load JS in ${style}: ${kb(gzip)} gzipped across ${files.length} file(s) (budget ${FIRST_LOAD_BUDGET_KB} KB)`;
    console.log(withinBudget ? green(`✓ ${verdict}`) : red(`✗ ${verdict}`));
  }
  return failures === 0 ? 0 : 1;
}

function listPlayFolders(): string[] {
  const play = join(DIST, 'play');
  if (!existsSync(play)) return [];
  return walkFiles({ root: play, includeDist: true })
    .map((file) => `play/${file.path.split('/')[0]}`)
    .filter((folder, index, all) => all.indexOf(folder) === index);
}

async function main(): Promise<number> {
  const withFixtures = process.argv.includes('--fixtures') || process.env.HALL_FIXTURES === '1';
  const base = normaliseBase(process.env.SITE_BASE);
  console.log(
    `Building /usr/games Reborn into dist/ ${dim(`(base ${base}${withFixtures ? ', with fixtures' : ''})`)}`,
  );

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  console.log('\nHall');
  const firstLoads = await buildHall(base, withFixtures);
  console.log(`  ${green('✓')} built`);

  console.log('\nBridge');
  const buildBridge = await loadBuildBridge();
  await buildBridge({ outDir: join(DIST, 'bridge') });
  console.log(`  ${green('✓')} bridge.js and bridge.mjs`);

  console.log('\nHosted games');
  const catalog = readCatalog();
  const hosted = hostedEntries(catalog, withFixtures);
  if (hosted.length === 0) console.log(dim('  none yet'));
  for (const entry of hosted) await buildHostedGame(entry, base);

  // GitHub Pages would otherwise run Jekyll and hide folders that start with an underscore.
  writeFileSync(join(DIST, '.nojekyll'), '');

  console.log('\nSizes');
  return printSizes(firstLoads);
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(red(`\nBuild failed: ${(error as Error).message}`));
    process.exitCode = 1;
  }
}
