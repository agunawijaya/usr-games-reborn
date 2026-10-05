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
    expect(manifest.packages.map((p) => p.id)).toEqual(PACKAGES.map((p) => p.id));
  });

  it('keeps the gallows words out of every player-facing string', () => {
    const text = JSON.stringify({ ...manifest, inspiredBy: undefined }).toLowerCase();
    expect(text).not.toMatch(/\bnoose\b|\bgallows\b/);
    expect(text.replace(/"id":"hangman"|hangman — /g, '')).not.toMatch(/hang/);
  });
});
