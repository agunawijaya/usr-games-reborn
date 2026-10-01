/**
 * Provenance scan. The BSD originals stay outside the repo; we may adapt logic with attribution,
 * but never copy their text wholesale, and never any of the fortune or quiz data (third-party
 * quotations). This looks for long lines from the originals appearing verbatim in the repo, and
 * checks that the attribution files exist.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type AllowEntry, isAllowed, loadGuardsConfig } from './lib/config';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { type Finding, type GuardOutcome, report } from './lib/report';
import { readText, walkFiles } from './lib/walk';

export const DEFAULT_ORIGINALS_DIR = 'E:\\Projects\\BSDGames\\BSDGames-master';
export const MIN_LINE_LENGTH = 48;

/** Lines that are licence or copyright boilerplate: legitimately reproduced in LICENSES/. */
const BOILERPLATE =
  /copyright|all rights reserved|redistribution|warrant|liabilit|merchantability|provided by the|this software|permission|notice|endorse or promote|software developed by|advertising materials|licen[cs]e|\$netbsd|\$openbsd|\$freebsd/i;

/** Repo locations that exist to carry original notices. */
const EXEMPT_PATHS = [/^LICENSES\//, /^CREDITS\.md$/];

export function normaliseLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isDistinctive(normalised: string): boolean {
  if (normalised.length < MIN_LINE_LENGTH || BOILERPLATE.test(normalised)) return false;
  // Rows of punctuation, box drawing or repeated characters are not authored text.
  const letters = normalised.replace(/[^a-z]/g, '').length;
  return letters >= normalised.length * 0.5 && new Set(normalised).size > 12;
}

/**
 * An index of distinctive original lines keyed by their first MIN_LINE_LENGTH characters, so
 * each repo line can be checked with a sliding window instead of a full substring search.
 */
export type OriginalIndex = Map<string, { line: string; source: string }[]>;

export function addToIndex(index: OriginalIndex, text: string, source: string): void {
  for (const raw of text.split(/\r?\n/)) {
    const line = normaliseLine(raw);
    if (!isDistinctive(line)) continue;
    const key = line.slice(0, MIN_LINE_LENGTH);
    const bucket = index.get(key);
    if (!bucket) index.set(key, [{ line, source }]);
    else if (!bucket.some((entry) => entry.line === line)) bucket.push({ line, source });
  }
}

export function buildOriginalIndex(originalsDir: string): { index: OriginalIndex; files: number } {
  const index: OriginalIndex = new Map();
  const files = walkFiles({ root: originalsDir, includeDist: true, includePrompts: true });
  let read = 0;
  for (const file of files) {
    const text = readText(file.absolute, 2 * 1024 * 1024);
    if (text === null) continue;
    read++;
    addToIndex(index, text, file.path);
  }
  return { index, files: read };
}

export function findCopiedLines(
  path: string,
  text: string,
  index: OriginalIndex,
  allow: readonly AllowEntry[] = [],
): Finding[] {
  const findings: Finding[] = [];
  text.split(/\r?\n/).forEach((raw, lineIndex) => {
    if (isAllowed(path, raw, allow)) return;
    const line = normaliseLine(raw);
    if (line.length < MIN_LINE_LENGTH) return;
    for (let start = 0; start + MIN_LINE_LENGTH <= line.length; start++) {
      const bucket = index.get(line.slice(start, start + MIN_LINE_LENGTH));
      const hit = bucket?.find((entry) => line.startsWith(entry.line, start));
      if (hit) {
        findings.push({
          path,
          line: lineIndex + 1,
          message: `verbatim text from the originals (${hit.source})`,
        });
        return;
      }
    }
  });
  return findings;
}

export function attributionProblems(root: string): Finding[] {
  const problems: Finding[] = [];
  const licenses = join(root, 'LICENSES');
  if (!existsSync(licenses) || !statSync(licenses).isDirectory()) {
    problems.push({ path: 'LICENSES/', message: 'missing; original notices must be kept there' });
  }
  if (!existsSync(join(root, 'CREDITS.md')))
    problems.push({ path: 'CREDITS.md', message: 'missing' });
  return problems;
}

export function checkProvenance(
  root = REPO_ROOT,
  originalsDir = process.env.ORIGINALS_DIR ?? DEFAULT_ORIGINALS_DIR,
): GuardOutcome {
  const errors = attributionProblems(root);
  if (!existsSync(originalsDir)) {
    return errors.length > 0
      ? {
          errors,
          notes: [{ path: originalsDir, message: 'originals not found; verbatim scan skipped' }],
        }
      : {
          errors,
          skipped: `originals not found at ${originalsDir} (set ORIGINALS_DIR); attribution files present`,
        };
  }
  const { index, files: originalFiles } = buildOriginalIndex(originalsDir);
  // Adopted games may carry derived text by decision (ADR 0011); each exception names its reason.
  const allow = existsSync(join(root, 'scripts/guards.config.json'))
    ? loadGuardsConfig(root).provenance.allow
    : [];
  const repoFiles = walkFiles({ root }).filter(
    (file) => !EXEMPT_PATHS.some((pattern) => pattern.test(file.path)),
  );
  for (const file of repoFiles) {
    const text = readText(file.absolute);
    if (text !== null) errors.push(...findCopiedLines(file.path, text, index, allow));
  }
  return {
    errors,
    summary: `${repoFiles.length} repo files against ${index.size} distinctive lines from ${originalFiles} original files`,
  };
}

if (isMainModule(import.meta.url)) {
  process.exitCode = report('provenance', checkProvenance());
}
