import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchesGlob } from './glob';
import { REPO_ROOT } from './paths';

/** An exception to a guard. `match` narrows it to lines containing that text. */
export interface AllowEntry {
  path: string;
  match?: string;
  reason: string;
}

export interface GuardsConfig {
  raster: { allow: AllowEntry[] };
  network: { allowUrlPrefixes: string[]; allow: AllowEntry[] };
  words: { trademarkAllow: AllowEntry[]; contentAllow: AllowEntry[] };
  provenance: { allow: AllowEntry[] };
}

export const EMPTY_CONFIG: GuardsConfig = {
  raster: { allow: [] },
  network: { allowUrlPrefixes: [], allow: [] },
  words: { trademarkAllow: [], contentAllow: [] },
  provenance: { allow: [] },
};

export function loadGuardsConfig(root = REPO_ROOT): GuardsConfig {
  const raw = JSON.parse(
    readFileSync(join(root, 'scripts/guards.config.json'), 'utf8'),
  ) as Partial<GuardsConfig>;
  return {
    raster: { allow: raw.raster?.allow ?? [] },
    network: {
      allowUrlPrefixes: raw.network?.allowUrlPrefixes ?? [],
      allow: raw.network?.allow ?? [],
    },
    words: {
      trademarkAllow: raw.words?.trademarkAllow ?? [],
      contentAllow: raw.words?.contentAllow ?? [],
    },
    provenance: { allow: raw.provenance?.allow ?? [] },
  };
}

/** Whether a finding at `path` (on a line reading `lineText`) is covered by an allow entry. */
export function isAllowed(path: string, lineText: string, entries: readonly AllowEntry[]): boolean {
  return entries.some(
    (entry) => matchesGlob(path, entry.path) && (!entry.match || lineText.includes(entry.match)),
  );
}
