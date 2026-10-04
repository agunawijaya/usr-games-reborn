import { validateManifest } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { PACKAGES } from './game/packages';

/** The manifest the Hall reads and the packages the game installs are one list. */
describe('manifest', () => {
  it('validates', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('lists exactly the packages the game installs, tier for tier', () => {
    expect(manifest.packages.map((p) => [p.id, p.tier])).toEqual(
      PACKAGES.map((p) => [p.id, p.tier]),
    );
  });

  it('keeps six core, four extra and two rare packages', () => {
    const tiers = PACKAGES.map((p) => p.tier);
    expect([
      tiers.filter((t) => t === 'core').length,
      tiers.filter((t) => t === 'extra').length,
      tiers.filter((t) => t === 'rare').length,
    ]).toEqual([6, 4, 2]);
  });
});
