/**
 * Network guard: shipped code makes no runtime network requests and names no external hosts.
 * Same-origin chunk loading by the bundler is fine; fetch, sockets, beacons and remote URLs
 * are not, unless an allow entry in guards.config.json explains why.
 */
import { extname } from 'node:path';
import { type AllowEntry, isAllowed, loadGuardsConfig } from './lib/config';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { type Finding, report } from './lib/report';
import { expandRoots, isTestFile, readText, walkFiles } from './lib/walk';

export const SHIPPED_ROOTS = [
  'apps/*/src',
  'packages/*/src',
  'packages/bridge/fixture*',
  'games/*/src',
  'games/*/app',
];

const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.html',
  '.htm',
  '.css',
  '.svg',
  '.vue',
];

interface Rule {
  name: string;
  pattern: RegExp;
}

export const NETWORK_RULES: readonly Rule[] = [
  { name: 'fetch() call', pattern: /\bfetch\s*\(/g },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/g },
  { name: 'WebSocket', pattern: /\bWebSocket\b/g },
  { name: 'EventSource', pattern: /\bEventSource\b/g },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/g },
  { name: 'importScripts()', pattern: /\bimportScripts\s*\(/g },
  { name: 'remote CSS import', pattern: /@import\s+(?:url\(\s*)?["']?https?:/gi },
  { name: 'remote CSS url()', pattern: /url\(\s*["']?https?:/gi },
  {
    name: 'remote script or link',
    pattern: /<(?:script|link|img|iframe|source)\b[^>]*\b(?:src|href)\s*=\s*["']?https?:/gi,
  },
];

const URL_LITERAL = /https?:\/\/[^\s"'`)<>\]]+/gi;

export interface NetworkOptions {
  allowUrlPrefixes: readonly string[];
  allow: readonly AllowEntry[];
}

export function findNetworkProblems(
  path: string,
  text: string,
  options: NetworkOptions,
): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  lines.forEach((lineText, index) => {
    if (isAllowed(path, lineText, options.allow)) return;
    const line = index + 1;
    for (const rule of NETWORK_RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(lineText)) findings.push({ path, line, message: rule.name });
    }
    for (const match of lineText.matchAll(URL_LITERAL)) {
      const url = match[0];
      if (!options.allowUrlPrefixes.some((prefix) => url.startsWith(prefix))) {
        findings.push({ path, line, message: `external URL ${url}` });
      }
    }
  });
  return findings;
}

export function shippedFiles(root = REPO_ROOT) {
  const within = [...expandRoots(SHIPPED_ROOTS, root), 'dist'];
  return walkFiles({ root, within, includeDist: true, extensions: CODE_EXTENSIONS }).filter(
    (file) => !isTestFile(file.path) && !file.path.endsWith('.d.ts'),
  );
}

export function scanRepoForNetwork(root = REPO_ROOT): { findings: Finding[]; scanned: number } {
  const config = loadGuardsConfig(root).network;
  const files = shippedFiles(root);
  const findings: Finding[] = [];
  for (const file of files) {
    const text = readText(file.absolute);
    if (text !== null && CODE_EXTENSIONS.includes(extname(file.path).toLowerCase())) {
      findings.push(...findNetworkProblems(file.path, text, config));
    }
  }
  return { findings, scanned: files.length };
}

if (isMainModule(import.meta.url)) {
  const { findings, scanned } = scanRepoForNetwork();
  process.exitCode = report('no runtime network', {
    errors: findings,
    summary: `${scanned} shipped files scanned`,
  });
}
