import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './paths';

const requireFromRoot = createRequire(join(REPO_ROOT, 'package.json'));

/**
 * Resolves a package's CLI entry through its package.json `bin`, so tools run as
 * `node <entry>` without relying on shell shims (which differ on Windows).
 */
export function resolveBin(packageName: string, binName = packageName): string {
  const manifestPath = requireFromRoot.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName];
  if (!bin) throw new Error(`${packageName} has no "${binName}" executable`);
  return join(dirname(manifestPath), bin);
}

export function runNodeBin(
  packageName: string,
  args: readonly string[],
  options: { binName?: string; cwd?: string; quiet?: boolean; env?: NodeJS.ProcessEnv } = {},
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [resolveBin(packageName, options.binName), ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    stdio: options.quiet ? 'pipe' : 'inherit',
    env: { ...process.env, ...options.env },
  });
}
