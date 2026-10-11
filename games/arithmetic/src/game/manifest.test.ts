import { validateManifest } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { PACKAGES } from './packages';

describe('the manifest', () => {
  it('validates', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('lists exactly the packages the game installs', () => {
    expect(manifest.packages).toEqual(
      PACKAGES.map(({ id, title, description, tier }) => ({ id, title, description, tier })),
    );
  });

  it('reports every stat its weekly goals count', () => {
    const reported = ['sumsSolved', 'numbersSplit', 'boardsCleared', 'wordsDone'];
    for (const goal of manifest.cronGoals) expect(reported).toContain(goal.stat);
  });
});
