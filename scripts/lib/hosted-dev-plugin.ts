import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { hostedEntries, readCatalog, type ResolvedEntry } from './catalog';
import {
  buildHostedViteGameInProcess,
  type BridgeFiles,
  loadBuildBridge,
  normaliseBase,
} from './hosted';
import { REPO_ROOT, toPosix } from './paths';

/**
 * Makes the Hall's dev server behave like the built site for hosted games:
 * `/bridge/bridge.js|mjs` come from the bridge package, and `/play/<id>/…` serves each hosted
 * game from its own folder (static games) or from a one-off build of it (Vite games).
 * Hosted pages are served untouched: no HMR client is injected into another game's page.
 */

export const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.glsl': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

/**
 * Maps a URL path inside a game folder to a file, or null when it would leave the folder or
 * does not exist. Folders resolve to their index.html.
 */
export function resolveInside(folder: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const root = resolve(folder);
  const candidate = resolve(root, normalize(`.${sep}${decoded}`));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  if (!existsSync(candidate)) return null;
  const stats = statSync(candidate);
  if (stats.isDirectory()) {
    const index = join(candidate, 'index.html');
    return existsSync(index) ? index : null;
  }
  return stats.isFile() ? candidate : null;
}

function send(
  res: ServerResponse,
  status: number,
  body: string,
  type = 'text/plain; charset=utf-8',
) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function sendFile(res: ServerResponse, file: string) {
  res.statusCode = 200;
  res.setHeader(
    'Content-Type',
    CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
  );
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
}

function explainPage(title: string, detail: string): string {
  const escape = (text: string) =>
    text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  return `<!doctype html><meta charset="utf-8"><title>${escape(title)}</title>
<body style="font:16px/1.5 system-ui;padding:2rem;max-width:40rem"><h1>${escape(title)}</h1><pre style="white-space:pre-wrap">${escape(detail)}</pre></body>`;
}

export interface PluginState {
  repoRoot: string;
  base: string;
  bridge: Promise<BridgeFiles> | null;
  viteBuilds: Map<string, Promise<string>>;
  /** Loads a TypeScript module; in the dev server, Vite's SSR loader. */
  importModule?: (path: string) => Promise<unknown>;
}

function bridgeFiles(state: PluginState): Promise<BridgeFiles> {
  state.bridge ??= loadBuildBridge(state.importModule).then((build) => build({ write: false }));
  // A failed build is not cached, so fixing the source and reloading is enough.
  state.bridge.catch(() => {
    state.bridge = null;
  });
  return state.bridge;
}

function viteGameFolder(state: PluginState, entry: ResolvedEntry): Promise<string> {
  const existing = state.viteBuilds.get(entry.id);
  if (existing) return existing;
  const manifest = entry.manifest!;
  if (manifest.build.kind === 'native') return Promise.reject(new Error(`${entry.id} is native`));
  const source = join(state.repoRoot, manifest.build.source);
  const outDir = join(state.repoRoot, 'node_modules/.cache/usr-games/play', entry.id);
  const building = buildHostedViteGameInProcess(
    source,
    `${state.base}play/${entry.id}/`,
    outDir,
  ).then(() => outDir);
  building.catch(() => state.viteBuilds.delete(entry.id));
  state.viteBuilds.set(entry.id, building);
  return building;
}

async function serveBridge(state: PluginState, name: string, res: ServerResponse): Promise<void> {
  try {
    const files = await bridgeFiles(state);
    const code = files[name as keyof BridgeFiles];
    if (code === undefined) return send(res, 404, `No bridge file ${name}`);
    send(res, 200, code, CONTENT_TYPES['.js']);
  } catch (error) {
    send(res, 500, `Bridge build failed: ${(error as Error).message}`);
  }
}

async function servePlay(
  state: PluginState,
  id: string,
  rest: string,
  res: ServerResponse,
): Promise<void> {
  // Re-read each time: the catalog is tiny and this keeps edits to manifests live.
  const entry = hostedEntries(readCatalog(state.repoRoot), true).find(
    (candidate) => candidate.id === id,
  );
  const manifest = entry?.manifest;
  if (!entry || !manifest || manifest.build.kind === 'native') {
    return send(
      res,
      404,
      explainPage(`No hosted game "${id}"`, 'It is not in the catalog as a hosted game.'),
      CONTENT_TYPES['.html'],
    );
  }
  const source = join(state.repoRoot, manifest.build.source);
  if (!existsSync(source)) {
    return send(
      res,
      404,
      explainPage(
        `${manifest.title} is not here yet`,
        `Expected its files in ${manifest.build.source}.`,
      ),
      CONTENT_TYPES['.html'],
    );
  }
  let folder = source;
  if (manifest.build.kind === 'hosted-vite') {
    try {
      folder = await viteGameFolder(state, entry);
    } catch (error) {
      return send(
        res,
        500,
        explainPage(`Could not build ${manifest.title}`, String((error as Error).stack ?? error)),
        CONTENT_TYPES['.html'],
      );
    }
  }
  const file = resolveInside(folder, rest || '/');
  if (!file) return send(res, 404, `Not found: ${rest}`);
  sendFile(res, file);
}

export function createHostedMiddleware(state: PluginState) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(state.base)) return next();
    const path = `/${url.pathname.slice(state.base.length)}`;

    const bridge = /^\/bridge\/(bridge\.m?js)$/.exec(path);
    if (bridge) return void serveBridge(state, bridge[1] as string, res);

    const play = /^\/play\/([a-z][a-z0-9-]*)(\/.*)?$/.exec(path);
    if (!play) return next();
    const [, id, rest] = play as unknown as [string, string, string | undefined];
    if (rest === undefined) {
      res.statusCode = 302;
      res.setHeader('Location', `${state.base}play/${id}/${url.search}`);
      return res.end();
    }
    void servePlay(state, id, rest, res);
  };
}

function watchBridgeSources(server: ViteDevServer, state: PluginState) {
  const sources = toPosix(join(state.repoRoot, 'packages/bridge/src'));
  server.watcher.add(sources);
  const invalidate = (file: string) => {
    if (toPosix(file).startsWith(sources)) state.bridge = null;
  };
  server.watcher.on('change', invalidate);
  server.watcher.on('add', invalidate);
  server.watcher.on('unlink', invalidate);
}

export function hostedGamesDevPlugin(options: { repoRoot?: string } = {}): Plugin {
  return {
    name: 'usr-games:hosted-games-dev',
    apply: 'serve',
    configureServer(server) {
      const state: PluginState = {
        repoRoot: options.repoRoot ?? REPO_ROOT,
        base: normaliseBase(server.config.base),
        bridge: null,
        viteBuilds: new Map(),
        importModule: (path) => server.ssrLoadModule(toPosix(path)),
      };
      watchBridgeSources(server, state);
      // Registered before Vite's own middlewares, so /play/ never reaches the SPA fallback.
      server.middlewares.use(createHostedMiddleware(state));
    },
  };
}
