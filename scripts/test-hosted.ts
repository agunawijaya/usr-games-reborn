/**
 * `pnpm test` (after the workspace's Vitest projects) and `pnpm check`: each adopted game's own
 * test suite, run exactly as it ran before adoption, through the test script in its own
 * package.json. The static games test with node:test; robots brings its own Vitest. A single
 * run is wanted here, so `test:once` wins over `test` (which may watch).
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostedEntries, readCatalog } from './lib/catalog';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { dim, green, red } from './lib/report';

export interface HostedSuite {
  id: string;
  folder: string;
  script: string;
}

function testScriptOf(packagePath: string): string | null {
  const { scripts = {} } = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  if (scripts['test:once']) return 'test:once';
  return scripts.test ? 'test' : null;
}

/** Hosted games in the catalog whose folder is here and whose package.json has a test script. */
export function hostedSuites(root = REPO_ROOT): HostedSuite[] {
  return hostedEntries(readCatalog(root), false).flatMap((entry) => {
    const build = entry.manifest?.build;
    if (!build || build.kind === 'native') return [];
    const folder = join(root, build.source);
    const packagePath = join(folder, 'package.json');
    const script = existsSync(packagePath) ? testScriptOf(packagePath) : null;
    return script ? [{ id: entry.id, folder, script }] : [];
  });
}

/**
 * Through the pnpm that started us when there is one (a script for Node, or pnpm's own
 * executable), else through the shell's pnpm.
 */
function runScript(suite: HostedSuite): SpawnSyncReturns<Buffer> {
  const options = { cwd: suite.folder, stdio: 'inherit' } as const;
  const args = ['run', suite.script];
  const pnpm = process.env.npm_execpath;
  if (pnpm && /pnpm/i.test(pnpm)) {
    return /\.[cm]?js$/.test(pnpm)
      ? spawnSync(process.execPath, [pnpm, ...args], options)
      : spawnSync(pnpm, args, options);
  }
  return spawnSync('pnpm', args, { ...options, shell: true });
}

function main(): number {
  const suites = hostedSuites();
  if (suites.length === 0) {
    console.log(dim('No hosted game has its own tests yet.'));
    return 0;
  }
  const failed: string[] = [];
  for (const suite of suites) {
    console.log(`\n${dim('──')} ${suite.id} ${dim(`(pnpm run ${suite.script})`)}`);
    if (runScript(suite).status !== 0) failed.push(suite.id);
  }
  console.log(
    failed.length === 0
      ? green(`\n✓ ${suites.length} hosted game suites pass`)
      : red(`\n✗ hosted game suites failing: ${failed.join(', ')}`),
  );
  return failed.length === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
