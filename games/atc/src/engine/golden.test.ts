import { describe, expect, it } from 'vitest';
import { CLASSIC_ARENAS } from '../arenas/classic';
import { glibcRandom } from './glibc-random';
import LONG_RUNS from './golden-long.json';
import type { LossReason } from './world';
import { traceScenario } from './trace';

/**
 * Golden runs: scripted shifts played by the original program and by Skyloom's engine from the
 * same seed must agree tick for tick. The expected numbers come from the 1986 code built on
 * Linux in a scratch folder outside the repository and driven by a small harness (how is
 * recorded in docs/NOTES.md); only these derived numbers are kept: a digest of every tick's
 * state, how many ticks were played, how many planes were safe and how the shift ended.
 */

interface Golden {
  arena: string;
  seed: number;
  ticks: number;
  orders?: [number, string][];
  expected: {
    digest: number;
    ticks: number;
    safe: number;
    loss: { tick: number; plane: string; kind: LossReason['kind'] } | null;
  };
}

const GOLDEN: Golden[] = [
  {
    arena: 'old-reliable',
    seed: 1,
    ticks: 40,
    expected: {
      digest: 3191576840,
      ticks: 20,
      safe: 0,
      loss: { tick: 20, plane: 'a', kind: 'left-arena' },
    },
  },
  {
    arena: 'old-reliable',
    seed: 42,
    ticks: 40,
    expected: {
      digest: 2488428794,
      ticks: 16,
      safe: 0,
      loss: { tick: 16, plane: 'A', kind: 'separation' },
    },
  },
  {
    arena: 'seven-fields',
    seed: 3,
    ticks: 30,
    expected: { digest: 3947001340, ticks: 30, safe: 0, loss: null },
  },
  {
    arena: 'overdrive',
    seed: 7,
    ticks: 80,
    expected: {
      digest: 430786308,
      ticks: 29,
      safe: 0,
      loss: { tick: 29, plane: 'a', kind: 'left-arena' },
    },
  },
  {
    // A climbs out of b's way, then waits for beacon 0 to turn north and leaves at 9 000 ft;
    // b turns east at beacon 1 and leaves too.
    arena: 'old-reliable',
    seed: 42,
    ticks: 70,
    orders: [
      [1, 'Aa9'],
      [6, 'btd@b1'],
      [7, 'ba9'],
      [15, 'Ata'],
      [17, 'Atw@b0'],
    ],
    expected: {
      digest: 3365520461,
      ticks: 60,
      safe: 2,
      loss: { tick: 60, plane: 'd', kind: 'left-arena' },
    },
  },
  {
    // A turns at two beacons and lands; b is cleared off the ground, circles, and runs dry.
    arena: 'seven-fields',
    seed: 3,
    ticks: 70,
    orders: [
      [1, 'Atd@b7'],
      [2, 'ba5'],
      [4, 'btx@b1'],
      [10, 'bc'],
      [23, 'Atw@b8'],
      [25, 'Aa0'],
    ],
    expected: {
      digest: 2064350463,
      ticks: 53,
      safe: 1,
      loss: { tick: 53, plane: 'b', kind: 'fuel' },
    },
  },
  {
    // A take-off, a hard turn, relative turns and turns towards places, some of them refused.
    arena: 'seven-fields',
    seed: 11,
    ticks: 90,
    orders: [
      [1, 'aa4'],
      [3, 'atL'],
      [5, 'atlw'],
      [7, 'atte0'],
      [9, 'ata+2'],
      [12, 'atta1'],
      [14, 'ac'],
      [20, 'attb3'],
      [22, 'ad3'],
      [30, 'atx'],
      [31, 'aa0'],
    ],
    expected: {
      digest: 3414363795,
      ticks: 6,
      safe: 0,
      loss: { tick: 6, plane: 'a', kind: 'left-arena' },
    },
  },
  {
    // The fastest arena, with orders for planes that have not arrived yet (refused).
    arena: 'overdrive',
    seed: 5,
    ticks: 150,
    orders: [
      [2, 'aa9'],
      [3, 'ba5'],
      [4, 'ca3'],
      [6, 'da8'],
      [8, 'ea6'],
      [10, 'fa4'],
      [12, 'ga2'],
      [14, 'ha9'],
    ],
    expected: {
      digest: 606450298,
      ticks: 20,
      safe: 0,
      loss: { tick: 20, plane: 'B', kind: 'left-arena' },
    },
  },
  {
    // Relative climbs and descents, marks, and keys the grammar does not accept.
    arena: 'little-field',
    seed: 9,
    ticks: 120,
    orders: [
      [1, 'aa9'],
      [2, 'ba9'],
      [3, 'ca2'],
      [5, 'da9'],
      [9, 'at+'],
      [11, 'btrz'],
      [13, 'aa-3'],
      [15, 'au'],
      [16, 'am'],
      [17, 'ai'],
    ],
    expected: {
      digest: 3631400047,
      ticks: 14,
      safe: 0,
      loss: { tick: 14, plane: 'a', kind: 'left-arena' },
    },
  },
];

describe('the C library generator', () => {
  it('gives the well-known first values for seed 1', () => {
    const draw = glibcRandom(1);
    expect([draw(), draw(), draw()]).toEqual([1804289383, 846930886, 1681692777]);
  });
});

describe('golden runs against the 1986 program', () => {
  for (const golden of GOLDEN) {
    const label = `${golden.arena}, seed ${golden.seed}${golden.orders ? `, ${golden.orders.length} orders` : ''}`;
    it(`plays ${label} exactly as the original did`, () => {
      const arena = CLASSIC_ARENAS.find((a) => a.id === golden.arena)!;
      const result = traceScenario({
        arena,
        seed: golden.seed,
        ticks: golden.ticks,
        orders: golden.orders,
      });
      expect({
        digest: result.digest,
        ticks: result.lines.length - 1,
        safe: result.safe,
        loss: result.loss,
      }).toEqual(golden.expected);
    });
  }
});

/**
 * Long runs: the house controller typed every order of these shifts (see
 * scripts/bot-orders.ts), and the original program replayed them from the same seed. Three
 * hundred ticks each, with take-offs, landings, departures and holds.
 */
describe('long golden runs against the 1986 program', () => {
  for (const golden of LONG_RUNS as Golden[]) {
    it(`plays ${golden.arena}, seed ${golden.seed}, ${golden.orders!.length} orders, exactly as the original did`, () => {
      const arena = CLASSIC_ARENAS.find((a) => a.id === golden.arena)!;
      const result = traceScenario({
        arena,
        seed: golden.seed,
        ticks: golden.ticks,
        orders: golden.orders,
      });
      expect({
        digest: result.digest,
        ticks: result.lines.length - 1,
        safe: result.safe,
        loss: result.loss,
      }).toEqual(golden.expected);
    });
  }
});
