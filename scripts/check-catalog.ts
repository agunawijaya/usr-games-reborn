/**
 * Catalog check: every planned game is registered once, resolves to a valid manifest, and its
 * status matches what is actually in the repo. PROGRESS.md must have a row per catalog id.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CatalogRead, PLANNED_IDS, readCatalog } from './lib/catalog';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { type Finding, type GuardOutcome, report } from './lib/report';

export const PROGRESS_PATH = 'docs/PROGRESS.md';
const INDEX = 'apps/hall/src/catalog/catalog.json';

export interface CatalogFacts {
  exists(repoRelative: string): boolean;
  /** Contents of docs/PROGRESS.md, or null when it is missing. */
  progress: string | null;
}

export function progressHasRow(progress: string, id: string): boolean {
  return new RegExp(`^\\|\\s*\`?${id}\`?\\s*\\|`, 'm').test(progress);
}

function statusProblems(
  read: CatalogRead,
  facts: CatalogFacts,
): { errors: Finding[]; notes: Finding[] } {
  const errors: Finding[] = [];
  const notes: Finding[] = [];
  for (const entry of read.games) {
    const manifest = entry.manifest;
    if (!manifest) continue;
    const where = entry.manifestPath;
    if (manifest.build.kind === 'native') {
      const module = `games/${entry.id}/src/index.ts`;
      if (manifest.status === 'shipped' && !facts.exists(module))
        errors.push({ path: where, message: `shipped native game needs ${module}` });
      continue;
    }
    const sourcePresent = facts.exists(manifest.build.source);
    if (manifest.status === 'shipped' && !sourcePresent) {
      errors.push({
        path: where,
        message: `shipped hosted game needs its files in ${manifest.build.source}`,
      });
    } else if (manifest.status === 'adopting' && !sourcePresent) {
      notes.push({ path: where, message: `adopting; ${manifest.build.source} not copied in yet` });
    }
  }
  return { errors, notes };
}

export function checkCatalog(read: CatalogRead, facts: CatalogFacts): GuardOutcome {
  const errors: Finding[] = read.problems.map((message) => ({ path: INDEX, message }));
  const notes: Finding[] = [];
  const ids = read.games.map((entry) => entry.id);
  const allIds = new Set([...ids, ...read.fixtures.map((entry) => entry.id)]);

  const seen = new Set<string>();
  for (const id of [...ids, ...read.fixtures.map((entry) => entry.id)]) {
    if (seen.has(id)) errors.push({ path: INDEX, message: `"${id}" is listed more than once` });
    seen.add(id);
  }
  for (const id of PLANNED_IDS) {
    if (!ids.includes(id)) errors.push({ path: INDEX, message: `planned game "${id}" is missing` });
  }

  for (const entry of [...read.games, ...read.fixtures]) {
    for (const problem of entry.errors) errors.push({ path: entry.manifestPath, message: problem });
    for (const other of entry.manifest?.manPage.seeAlso ?? []) {
      if (!allIds.has(other))
        errors.push({
          path: entry.manifestPath,
          message: `SEE ALSO names unknown game "${other}"`,
        });
    }
  }
  for (const fixture of read.fixtures) {
    if (fixture.manifest && fixture.manifest.status !== 'unlisted') {
      errors.push({ path: fixture.manifestPath, message: 'fixtures must be "unlisted"' });
    }
  }

  const status = statusProblems(read, facts);
  errors.push(...status.errors);
  notes.push(...status.notes);

  const usedPlaceholders = new Set(
    read.games.filter((entry) => entry.source === 'placeholder').map((entry) => entry.id),
  );
  for (const id of read.placeholderFiles) {
    if (!usedPlaceholders.has(id))
      notes.push({
        path: `apps/hall/src/catalog/placeholders/${id}.json`,
        message: 'placeholder no longer used',
      });
  }

  if (facts.progress === null)
    errors.push({ path: PROGRESS_PATH, message: 'missing; it needs one row per catalog id' });
  else {
    for (const id of ids) {
      if (!progressHasRow(facts.progress, id))
        errors.push({ path: PROGRESS_PATH, message: `no row for "${id}"` });
    }
  }

  return { errors, notes, summary: `${ids.length} games, ${read.fixtures.length} fixtures` };
}

export function checkRepoCatalog(root = REPO_ROOT): GuardOutcome {
  const progressPath = join(root, PROGRESS_PATH);
  return checkCatalog(readCatalog(root), {
    exists: (path) => existsSync(join(root, path)),
    progress: existsSync(progressPath) ? readFileSync(progressPath, 'utf8') : null,
  });
}

if (isMainModule(import.meta.url)) {
  process.exitCode = report('catalog', checkRepoCatalog());
}
