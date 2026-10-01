/**
 * Type-checks every TypeScript project in the workspace, each with its own tsconfig, so a
 * DOM-only package and the Node scripts are never checked against each other's globals.
 * Hosted games (`games/<id>/app`) keep their own setup and are not included.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dim, green, red } from './lib/report';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { runNodeBin } from './lib/run';
import { expandRoots } from './lib/walk';

export function findProjects(root = REPO_ROOT): string[] {
  const folders = [...expandRoots(['apps/*', 'packages/*', 'games/*'], root), 'scripts'];
  return folders.filter((folder) => existsSync(join(root, folder, 'tsconfig.json'))).sort();
}

function main(): number {
  const projects = findProjects();
  const failed: string[] = [];
  for (const project of projects) {
    const started = Date.now();
    const result = runNodeBin(
      'typescript',
      ['-p', join(project, 'tsconfig.json'), '--noEmit', '--pretty'],
      {
        binName: 'tsc',
        quiet: true,
      },
    );
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (result.status === 0) {
      console.log(`${green('✓')} ${project} ${dim(`${seconds}s`)}`);
    } else {
      failed.push(project);
      console.log(`${red('✗')} ${project} ${dim(`${seconds}s`)}`);
      process.stdout.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    }
  }
  console.log(
    failed.length === 0
      ? green(`${projects.length} projects type-check`)
      : red(`${failed.length} of ${projects.length} projects have type errors`),
  );
  return failed.length === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
