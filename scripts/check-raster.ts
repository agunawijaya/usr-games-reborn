/**
 * Zero-raster guard: the collection draws everything in code. Raster files and embedded raster
 * data URIs are allowed only where an ADR says so (documentation screenshots, per-game ADRs).
 */
import { extname } from 'node:path';
import { type AllowEntry, isAllowed, loadGuardsConfig } from './lib/config';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { type Finding, report } from './lib/report';
import { lineAt, readText, walkFiles } from './lib/walk';

export const RASTER_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.bmp',
  '.ico',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.svg',
  '.json',
  '.md',
  '.vue',
  '.webmanifest',
]);

const RASTER_DATA_URI =
  /data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon|tiff?|heic|heif)[;,]/gi;

export interface ScannedFile {
  path: string;
  /** Present for text files; used to find embedded raster data. */
  text: string | null;
}

export function findRasterProblems(
  files: readonly ScannedFile[],
  allow: readonly AllowEntry[],
): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (RASTER_EXTENSIONS.has(extname(file.path).toLowerCase())) {
      if (!isAllowed(file.path, '', allow))
        findings.push({ path: file.path, message: 'raster file outside the ADR allow-list' });
      continue;
    }
    if (!file.text) continue;
    for (const match of file.text.matchAll(RASTER_DATA_URI)) {
      const line = lineAt(file.text, match.index ?? 0);
      const lineText = file.text.split('\n')[line - 1] ?? '';
      if (!isAllowed(file.path, lineText, allow)) {
        findings.push({
          path: file.path,
          line,
          message: `embedded raster data (${match[0].slice(0, -1)})`,
        });
      }
    }
  }
  return findings;
}

export function scanRepoForRaster(root = REPO_ROOT): { findings: Finding[]; scanned: number } {
  const files = walkFiles({ root, includeDist: true }).map((file) => {
    const extension = extname(file.path).toLowerCase();
    return {
      path: file.path,
      text: TEXT_EXTENSIONS.has(extension) ? readText(file.absolute) : null,
    };
  });
  return {
    findings: findRasterProblems(files, loadGuardsConfig(root).raster.allow),
    scanned: files.length,
  };
}

if (isMainModule(import.meta.url)) {
  const { findings, scanned } = scanRepoForRaster();
  process.exitCode = report('zero-raster', {
    errors: findings,
    summary: `${scanned} files scanned`,
  });
}
