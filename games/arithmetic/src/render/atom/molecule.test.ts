import { describe, expect, it } from 'vitest';
import { factorize } from '../../engine/factor';
import { moleculeOf } from './molecule';

describe('molecules', () => {
  it('has one atom per prime factor, bonded into one piece', () => {
    for (const value of [2, 8, 12, 56, 360, 1024, 30030, 2 * 3 * 5 * 7 * 7919]) {
      const molecule = moleculeOf(value);
      expect(molecule.atoms.map((atom) => atom.prime).sort((a, b) => a - b)).toEqual(
        factorize(value),
      );
      expect(molecule.bonds).toHaveLength(molecule.atoms.length - 1);
      // Every atom is reachable from the first through bonds.
      const reached = new Set([0]);
      for (let pass = 0; pass < molecule.atoms.length; pass++) {
        for (const [a, b] of molecule.bonds) {
          if (reached.has(a) || reached.has(b)) {
            reached.add(a);
            reached.add(b);
          }
        }
      }
      expect(reached.size).toBe(molecule.atoms.length);
    }
  });

  it('never lets two atoms overlap', () => {
    for (let value = 2; value <= 1200; value++) {
      const { atoms } = moleculeOf(value);
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const a = atoms[i]!;
          const b = atoms[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
        }
      }
    }
  });

  it('gives a number the same shape every time, and different numbers different shapes', () => {
    expect(moleculeOf(360)).toEqual(moleculeOf(360));
    expect(moleculeOf(360)).not.toEqual(moleculeOf(540));
  });

  it('leaves zero and one without atoms', () => {
    expect(moleculeOf(0).atoms).toEqual([]);
    expect(moleculeOf(1).atoms).toEqual([]);
  });
});
