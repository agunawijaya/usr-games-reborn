import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root, found relative to this file so scripts work from any cwd. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Forward slashes everywhere, so allow-lists and reports read the same on Windows and Linux. */
export function toPosix(path: string): string {
  return path.split(sep).join('/').replace(/\\/g, '/');
}

export function repoRelative(absolute: string, root = REPO_ROOT): string {
  return toPosix(relative(root, absolute));
}

export function fromRepo(...segments: string[]): string {
  return resolve(REPO_ROOT, ...segments);
}

/** True when the calling module is the script node was asked to run (not an import). */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(fileURLToPath(moduleUrl)).toLowerCase() === resolve(entry).toLowerCase();
}
