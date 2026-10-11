import { factorize } from '../../engine/factor';

/**
 * A number as a molecule: one atom per prime factor, repeated primes bonded in a chain, groups
 * bonded to the heaviest atom. The layout is a deterministic greedy packing, so every number
 * always has the same shape, and different numbers have different ones. Units are atom radii.
 */

export interface PlacedAtom {
  readonly prime: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface Molecule {
  readonly value: number;
  readonly atoms: readonly PlacedAtom[];
  readonly bonds: readonly (readonly [number, number])[];
  /** Radius of a circle around the centre that holds every atom. */
  readonly extent: number;
}

export function atomRadius(prime: number): number {
  return 0.8 + 0.16 * Math.log(prime);
}

const GAP = 0.38;
const CLEARANCE = 0.22;
const DIRECTIONS = 48;

export function moleculeOf(value: number): Molecule {
  if (value < 2) return { value, atoms: [], bonds: [], extent: 1 };
  const factors = factorize(value);
  // Heaviest prime first: it becomes the core the other groups bond to.
  const order = [...factors].sort((a, b) => b - a);
  const atoms: PlacedAtom[] = [];
  const bonds: [number, number][] = [];
  for (const prime of order) {
    const r = atomRadius(prime);
    if (atoms.length === 0) {
      atoms.push({ prime, x: 0, y: 0, r });
      continue;
    }
    const sameIndex = lastIndexOf(atoms, prime);
    const parents = sameIndex >= 0 ? [sameIndex, ...nearCentre(atoms)] : nearCentre(atoms);
    const placed = placeAtom(atoms, parents, prime, r);
    atoms.push(placed.atom);
    bonds.push([placed.parent, atoms.length - 1]);
  }
  const cx = atoms.reduce((sum, a) => sum + a.x, 0) / atoms.length;
  const cy = atoms.reduce((sum, a) => sum + a.y, 0) / atoms.length;
  const centred = atoms.map((a) => ({ ...a, x: a.x - cx, y: a.y - cy }));
  const extent = Math.max(...centred.map((a) => Math.hypot(a.x, a.y) + a.r));
  return { value, atoms: centred, bonds, extent };
}

function lastIndexOf(atoms: readonly PlacedAtom[], prime: number): number {
  for (let i = atoms.length - 1; i >= 0; i--) if (atoms[i]!.prime === prime) return i;
  return -1;
}

function nearCentre(atoms: readonly PlacedAtom[]): number[] {
  const cx = atoms.reduce((sum, a) => sum + a.x, 0) / atoms.length;
  const cy = atoms.reduce((sum, a) => sum + a.y, 0) / atoms.length;
  return atoms
    .map((a, i) => ({ i, d: Math.hypot(a.x - cx, a.y - cy) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((entry) => entry.i);
}

function placeAtom(
  atoms: readonly PlacedAtom[],
  parents: readonly number[],
  prime: number,
  r: number,
) {
  const cx = atoms.reduce((sum, a) => sum + a.x, 0) / atoms.length;
  const cy = atoms.reduce((sum, a) => sum + a.y, 0) / atoms.length;
  let best: { atom: PlacedAtom; parent: number; score: number } | null = null;
  for (const parent of parents) {
    const anchor = atoms[parent]!;
    const reach = anchor.r + r + GAP;
    for (let step = 0; step < DIRECTIONS; step++) {
      // Start at "up and to the right" so small molecules lean the same pleasing way.
      const angle = -Math.PI / 5 + (step / DIRECTIONS) * Math.PI * 2;
      const x = anchor.x + Math.cos(angle) * reach;
      const y = anchor.y + Math.sin(angle) * reach;
      let clearance = Infinity;
      for (const other of atoms) {
        clearance = Math.min(
          clearance,
          Math.hypot(other.x - x, other.y - y) - other.r - r - CLEARANCE,
        );
      }
      if (clearance < 0) continue;
      const score = -Math.hypot(x - cx, y - cy) + Math.min(clearance, 0.6) * 0.5;
      if (!best || score > best.score + 1e-9) best = { atom: { prime, x, y, r }, parent, score };
    }
    if (best) return best;
  }
  // Every direction blocked (cannot happen with these gaps, but never lose an atom).
  const anchor = atoms[parents[0]!]!;
  return {
    atom: { prime, x: anchor.x + anchor.r * 3, y: anchor.y, r },
    parent: parents[0]!,
    score: 0,
  };
}
