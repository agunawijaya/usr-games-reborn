import { describe, expect, it } from 'vitest';
import { definePackages, packageKey, packagePath, packageXp, validatePackages } from './packages';

describe('packages', () => {
  it('uses tier XP unless a definition overrides it', () => {
    expect(packageXp({ id: 'a', title: 'A', description: 'd', tier: 'core' })).toBe(30);
    expect(packageXp({ id: 'a', title: 'A', description: 'd', tier: 'rare', xp: 200 })).toBe(200);
  });

  it('builds keys and home-directory paths', () => {
    expect(packageKey('atc', 'first-landing')).toBe('atc/first-landing');
    expect(packagePath('ada', 'atc', 'first-landing')).toBe('/home/ada/atc/first-landing.pkg');
  });

  it('rejects duplicates, bad ids and out-of-range XP', () => {
    const errors = validatePackages('atc', [
      { id: 'ok-one', title: 'One', description: 'Do it.', tier: 'core' },
      { id: 'ok-one', title: 'Again', description: 'Do it.', tier: 'core' },
      { id: 'Bad Id', title: 'Bad', description: 'Do it.', tier: 'core' },
      { id: 'greedy', title: 'Greedy', description: 'Do it.', tier: 'rare', xp: 9000 },
    ]);
    expect(errors).toHaveLength(3);
    expect(() =>
      definePackages('atc', [{ id: 'x', title: '', description: '', tier: 'core' }]),
    ).toThrow();
  });
});
