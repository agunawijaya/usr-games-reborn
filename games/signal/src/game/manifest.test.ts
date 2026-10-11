import { validateManifest } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { PACKAGES } from './packages';

describe('the manifest', () => {
  it('validates', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('lists exactly the packages the game installs, with the same words', () => {
    expect(manifest.packages.map((p) => p.id)).toEqual(PACKAGES.map((p) => p.id));
    expect(manifest.packages.map((p) => p.description)).toEqual(PACKAGES.map((p) => p.description));
  });

  it('keeps the share string promise: no links in anything a player reads', () => {
    expect(JSON.stringify(manifest)).not.toMatch(/https?:|www\./);
  });
});
