import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromRepo } from './lib/paths';

/**
 * Vite plans to load configs with Node's own `import()` (`configLoader: 'native'`). The Hall's
 * config pulls in `scripts/lib` and the kit's manifest code, so this loads it exactly that way: a
 * fresh Node process, no bundler, types stripped by Node itself.
 */
describe('the Hall config chain', () => {
  it('loads under Node’s native loader', () => {
    const config = pathToFileURL(fromRepo('apps/hall/vite.config.ts')).href;
    const stripTypes = (process.features as { typescript?: unknown }).typescript
      ? []
      : ['--experimental-strip-types'];
    const result = spawnSync(
      process.execPath,
      [
        ...stripTypes,
        '--no-warnings',
        '--input-type=module',
        '--eval',
        `const { default: config } = await import(${JSON.stringify(config)});
         console.log(JSON.stringify(config.plugins.map((plugin) => plugin.name)));`,
      ],
      { cwd: fromRepo('apps/hall'), encoding: 'utf8' },
    );
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual([
      'usr-games:catalog-dev',
      'usr-games:hosted-games-dev',
    ]);
  }, 30_000);
});
