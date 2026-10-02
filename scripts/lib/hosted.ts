import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fromRepo } from './paths.ts';

export type BridgeFiles = { 'bridge.js': string; 'bridge.mjs': string };

/** Where the built site lists the hosted games' build-time posters (see posters.ts). */
export const POSTER_LIST = 'play/posters.js';
export type BuildBridge = (options?: { outDir?: string; write?: boolean }) => Promise<BridgeFiles>;

/**
 * The bridge package owns its own build; scripts load it lazily so they still start (and can
 * explain the problem) when the package is missing or broken. Scripts run under tsx and can
 * import TypeScript directly; the Hall's dev server passes Vite's own loader instead, because
 * its plugins run in plain Node, which cannot import `.ts` files.
 */
export async function loadBuildBridge(
  importModule: (path: string) => Promise<unknown> = (path) => import(pathToFileURL(path).href),
): Promise<BuildBridge> {
  const path = fromRepo('packages/bridge/build.ts');
  if (!existsSync(path)) {
    throw new Error(
      'packages/bridge/build.ts is missing; the bridge package must export buildBridge().',
    );
  }
  const module = (await importModule(path)) as { buildBridge?: unknown };
  if (typeof module.buildBridge !== 'function') {
    throw new Error('packages/bridge/build.ts does not export a buildBridge() function.');
  }
  return module.buildBridge as BuildBridge;
}

/** `usr-games-reborn` → `/usr-games-reborn/`; empty → `/`. */
export function normaliseBase(base: string | undefined): string {
  const trimmed = (base ?? '/').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

const NOT_SHIPPED = new Set([
  'node_modules',
  '.git',
  '.vite',
  'dist',
  'test-results',
  'playwright-report',
  'coverage',
]);

/**
 * The adopted games arrived with their own workbench beside the page: tests, screenshot and
 * server scripts, docs, notes, package files and a visual test bench (`lab.html`). The page never
 * loads any of it, so the site leaves it out (only at the top of the game folder; the game's own
 * `src/` ships untouched).
 */
const ADOPTED_WORKBENCH = new Set(['docs', 'scripts', 'tests', 'package.json', 'lab.html']);

export function isAdoptedWorkbench(pathInGame: string): boolean {
  const parts = pathInGame.split(/[\\/]/).filter(Boolean);
  if (parts.length !== 1) return false;
  const name = parts[0]!;
  return ADOPTED_WORKBENCH.has(name) || name.toLowerCase().endsWith('.md');
}

/** Copies a finished static game as it is, leaving out tooling folders and its workbench. */
export function copyStaticGame(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    filter: (path) =>
      !NOT_SHIPPED.has(basename(path)) && !isAdoptedWorkbench(relative(source, path)),
  });
}

async function buildWithViteApi(source: string, base: string, outDir: string): Promise<void> {
  const { build } = await import('vite');
  await build({ root: source, base, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
}

/**
 * The Vite CLI a hosted game would use: its own when it installs one, else the workspace's.
 * Resolution walks up from the game folder exactly as Node would for the game's own config.
 */
export function viteCliFor(source: string): { cli: string; own: boolean } {
  const manifestPath = createRequire(join(source, 'package.json')).resolve('vite/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.vite;
  if (!bin) throw new Error(`vite at ${manifestPath} has no CLI entry`);
  // pnpm links a game's own Vite from the shared store, so its real path lies outside the game
  // folder; "own" means it is a different install from the one the workspace root resolves.
  const workspaceVite = createRequire(fromRepo('package.json')).resolve('vite/package.json');
  return {
    cli: join(dirname(manifestPath), bin),
    own: resolve(manifestPath) !== resolve(workspaceVite),
  };
}

export interface ViteCliRun {
  status: number | null;
  /** What the CLI printed, when it was asked to stay quiet. */
  output: string;
}

/**
 * Runs a Vite CLI build under Node with an argument array and no shell, so `--base /play/<id>/`
 * reaches Vite untouched (Git Bash would otherwise rewrite a leading-slash argument into a
 * Windows path). It runs as a child process, so the dev server's event loop keeps serving.
 */
export function runViteCli(
  cli: string,
  options: { source: string; base: string; outDir: string; quiet: boolean },
): Promise<ViteCliRun> {
  const args = [cli, 'build', '--base', options.base, '--outDir', options.outDir, '--emptyOutDir'];
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, {
      cwd: options.source,
      // The dev server runs with NODE_ENV=development, which would hand the game a
      // development build of its libraries; the game is always served as it ships.
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', rejectRun);
    child.on('close', (status) => resolveRun({ status, output }));
  });
}

/**
 * Builds a hosted game with its own Vite, the one its config and plugins were written for, so
 * the dev server and `pnpm build` produce the same game (Robots stays on its Vite 5 and its
 * React plugin). Only when no CLI resolves, or it fails, does the workspace's Vite JS API try.
 * `quiet` keeps the CLI's output for the error instead of printing it (the dev server).
 */
export async function buildHostedViteGame(
  source: string,
  base: string,
  outDir: string,
  options: { quiet?: boolean } = {},
): Promise<'own' | 'workspace'> {
  let failure = '';
  try {
    const { cli, own } = viteCliFor(source);
    const run = await runViteCli(cli, { source, base, outDir, quiet: options.quiet ?? false });
    if (run.status === 0) return own ? 'own' : 'workspace';
    failure = run.output;
  } catch {
    // No resolvable Vite CLI: fall through to the JS API below.
  }
  try {
    await buildWithViteApi(source, base, outDir);
  } catch (error) {
    if (failure) (error as Error).message += `\n\nThe game's own Vite said:\n${failure}`;
    throw error;
  }
  return 'workspace';
}
