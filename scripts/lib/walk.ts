import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { REPO_ROOT, repoRelative } from './paths.ts';

/** Folders no guard ever needs to look inside, wherever they appear. */
const ALWAYS_SKIPPED = new Set([
  'node_modules',
  '.git',
  'test-results',
  'playwright-report',
  'blob-report',
  'coverage',
  '.vite',
  'scratch',
]);

export interface WalkOptions {
  /** Absolute folder to walk; defaults to the repo root. */
  root?: string;
  /** Repo-relative folders to start from instead of the whole root. */
  within?: readonly string[];
  /** `dist/` is skipped unless a guard asks for the built site. */
  includeDist?: boolean;
  /** Architect prompts are skipped by default; they are not project content. */
  includePrompts?: boolean;
  /** Keep only these extensions (lower case, with the dot). */
  extensions?: readonly string[];
}

export interface WalkedFile {
  /** Repo-relative, forward slashes. */
  path: string;
  absolute: string;
}

function skipDirectory(name: string, relativePath: string, options: WalkOptions): boolean {
  if (ALWAYS_SKIPPED.has(name)) return true;
  if (!options.includeDist && relativePath === 'dist') return true;
  if (!options.includePrompts && relativePath === 'prompts') return true;
  return false;
}

export function walkFiles(options: WalkOptions = {}): WalkedFile[] {
  const root = options.root ?? REPO_ROOT;
  const starts = options.within?.length ? options.within.map((dir) => join(root, dir)) : [root];
  const extensions = options.extensions ? new Set(options.extensions) : null;
  const found: WalkedFile[] = [];

  const visit = (directory: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const path = repoRelative(absolute, root);
      if (entry.isDirectory()) {
        if (!skipDirectory(entry.name, path, options)) visit(absolute);
      } else if (entry.isFile()) {
        if (!extensions || extensions.has(extname(entry.name).toLowerCase()))
          found.push({ path, absolute });
      }
    }
  };

  for (const start of starts) {
    try {
      if (statSync(start).isDirectory()) visit(start);
    } catch {
      // A start folder that does not exist yet (no games shipped, no dist) is simply empty.
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** Expands `apps/*` style roots against the real folders, one level of `*` per segment. */
export function expandRoots(patterns: readonly string[], root = REPO_ROOT): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    let current = [''];
    for (const segment of pattern.split('/')) {
      const next: string[] = [];
      for (const base of current) {
        if (segment.includes('*')) {
          const matcher = new RegExp(
            `^${segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
          );
          let names: string[];
          try {
            names = readdirSync(join(root, base), { withFileTypes: true })
              .filter(
                (entry) =>
                  entry.isDirectory() &&
                  matcher.test(entry.name) &&
                  !ALWAYS_SKIPPED.has(entry.name),
              )
              .map((entry) => entry.name);
          } catch {
            names = [];
          }
          next.push(...names.map((name) => (base ? `${base}/${name}` : name)));
        } else {
          next.push(base ? `${base}/${segment}` : segment);
        }
      }
      current = next;
    }
    results.push(...current);
  }
  return [...new Set(results)];
}

/** Text files only: anything with a NUL byte in its first 8 KB is treated as binary. */
export function readText(absolute: string, maxBytes = 5 * 1024 * 1024): string | null {
  try {
    if (statSync(absolute).size > maxBytes) return null;
    const buffer = readFileSync(absolute);
    if (buffer.subarray(0, 8192).includes(0)) return null;
    return buffer.toString('utf8');
  } catch {
    return null;
  }
}

/** 1-based line number of a character offset. */
export function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

export function isTestFile(path: string): boolean {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)(__tests__|test|tests|e2e)\//.test(path)
  );
}
