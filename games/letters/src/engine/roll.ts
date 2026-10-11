import type { Rng } from '@usr-games/kit';
import { CUBE_SETS } from './cube-sets';
import { type Board, type Face, type GridSize, QU } from './grid';

/**
 * Shaking the cubes: every cube lands in a random cell showing a random face, as in the 1988
 * program. The roll remembers which cube went where, so the renderer can show each cube's
 * other letters on its sides while it tumbles.
 */
export interface Roll {
  board: Board;
  /** For each cell, the index of the cube in its set. */
  cubeAt: number[];
  /** For each cell, which of the cube's six faces is up. */
  faceUp: number[];
}

/** A cube is written as six characters; `q` stands for the `Qu` face. */
export function facesOf(cube: string): Face[] {
  return [...cube].map((letter) => (letter === 'q' ? QU : letter));
}

export function rollCubes(size: GridSize, rng: Rng): Roll {
  const cubes = CUBE_SETS[size];
  const cubeAt = rng.shuffle(cubes.map((_, index) => index));
  const faceUp = cubeAt.map(() => rng.int(0, 5));
  const faces = cubeAt.map((cube, cell) => facesOf(cubes[cube]!)[faceUp[cell]!]!);
  return { board: { size, faces }, cubeAt, faceUp };
}

/** The six faces of the cube sitting in a cell. */
export function cubeFaces(roll: Roll, cell: number): Face[] {
  return facesOf(CUBE_SETS[roll.board.size][roll.cubeAt[cell]!]!);
}
