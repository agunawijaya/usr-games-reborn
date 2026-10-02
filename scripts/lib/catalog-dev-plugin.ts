import { existsSync, type FSWatcher, readdirSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { REPO_ROOT } from './paths.ts';

const MANIFEST = 'manifest.json';

/**
 * Keeps the Hall's dev server in step with the games folder. The Hall bundles every
 * `games/<id>/manifest.json` through `import.meta.glob`, and Vite re-runs a glob (and reloads the
 * page) when its watcher reports a matching file appearing or going away. `games/` lies outside
 * the Hall's root, so Vite's watcher never saw a new game's manifest, and the Hall stayed blank
 * until a restart. Vite turns chokidar's globbing off and chokidar cannot wait inside a folder
 * that does not exist yet, so this keeps its own small watch: `games/` for new folders and each
 * game folder for its manifest, and reports what it sees to Vite's watcher. Changes to a known
 * manifest need nothing extra: the Hall imports it, so Vite already watches the file.
 */
export function catalogDevPlugin(options: { repoRoot?: string } = {}): Plugin {
  return {
    name: 'usr-games:catalog-dev',
    apply: 'serve',
    configureServer(server) {
      const gamesDir = join(options.repoRoot ?? REPO_ROOT, 'games');
      if (!existsSync(gamesDir)) return;
      const known = new Set<string>();
      const folders = new Map<string, FSWatcher>();

      const recheck = (manifest: string) => {
        const present = existsSync(manifest);
        if (present === known.has(manifest)) return;
        if (present) known.add(manifest);
        else known.delete(manifest);
        server.watcher.emit(present ? 'add' : 'unlink', manifest);
      };

      const watchFolder = (name: string) => {
        const folder = join(gamesDir, name);
        if (folders.has(name) || !isFolder(folder)) return;
        const manifest = join(folder, MANIFEST);
        const watcher = watch(folder, (_event, file) => {
          if (file === MANIFEST) recheck(manifest);
        });
        watcher.on('error', () => forgetFolder(name));
        folders.set(name, watcher);
      };

      const forgetFolder = (name: string) => {
        folders.get(name)?.close();
        folders.delete(name);
        recheck(join(gamesDir, name, MANIFEST));
      };

      const top = watch(gamesDir, (_event, name) => {
        if (!name) return;
        if (isFolder(join(gamesDir, name))) {
          watchFolder(name);
          recheck(join(gamesDir, name, MANIFEST));
        } else if (folders.has(name)) forgetFolder(name);
      });
      for (const name of readdirSync(gamesDir)) {
        watchFolder(name);
        const manifest = join(gamesDir, name, MANIFEST);
        if (existsSync(manifest)) known.add(manifest);
      }

      server.httpServer?.once('close', () => {
        top.close();
        for (const watcher of folders.values()) watcher.close();
      });
    },
  };
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
