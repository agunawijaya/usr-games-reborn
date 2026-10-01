/**
 * `pnpm check`: every quality gate in one run. It keeps going after a failure so a single run
 * shows everything that needs fixing, then exits non-zero if anything failed.
 */
import { dim, green, red } from './lib/report';
import { isMainModule } from './lib/paths';
import { runNodeBin } from './lib/run';

interface Step {
  name: string;
  packageName: string;
  binName?: string;
  args: string[];
}

const script = (name: string, file: string): Step => ({
  name,
  packageName: 'tsx',
  args: [`scripts/${file}`],
});

export const STEPS: readonly Step[] = [
  { name: 'lint', packageName: 'eslint', args: ['.'] },
  script('typecheck', 'typecheck.ts'),
  { name: 'unit tests', packageName: 'vitest', args: ['run'] },
  script('hosted tests', 'test-hosted.ts'),
  script('catalog', 'check-catalog.ts'),
  script('zero-raster', 'check-raster.ts'),
  script('network', 'check-network.ts'),
  script('words', 'check-words.ts'),
  script('mermaid', 'check-mermaid.ts'),
  script('provenance', 'check-provenance.ts'),
];

function main(): number {
  const results: { name: string; ok: boolean; seconds: string }[] = [];
  for (const step of STEPS) {
    console.log(
      `\n${dim('──')} ${step.name} ${dim('─'.repeat(Math.max(4, 60 - step.name.length)))}`,
    );
    const started = Date.now();
    const result = runNodeBin(step.packageName, step.args, { binName: step.binName });
    results.push({
      name: step.name,
      ok: result.status === 0,
      seconds: ((Date.now() - started) / 1000).toFixed(1),
    });
  }
  console.log(`\n${dim('──')} summary ${dim('─'.repeat(53))}`);
  for (const { name, ok, seconds } of results) {
    console.log(`${ok ? green('✓') : red('✗')} ${name.padEnd(14)} ${dim(`${seconds}s`)}`);
  }
  const failures = results.filter((result) => !result.ok).length;
  console.log(
    failures === 0
      ? green('\nAll checks passed.')
      : red(`\n${failures} check${failures === 1 ? '' : 's'} failed.`),
  );
  return failures === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
