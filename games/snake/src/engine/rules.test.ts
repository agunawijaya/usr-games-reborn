import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { gardenFromRows, openGarden } from './garden';
import { EAST, NORTH, reach, SOUTH, WEST } from './geometry';
import {
  CLASSIC_RULES,
  luckyBreak,
  luckyChance,
  peek,
  pockets,
  type Round,
  RUN_RULES,
  step,
  warp,
  warpCost,
} from './round';
import { classicRound } from './setup';
import { aimAt, chase, chaseWeights, strikeChances } from './snake';
import { chunkFor, pocketValue } from './value';

/** A hand-made round on an open board: you at (10, 5), the snake's head to the south. */
function staged(overrides: Partial<Round> = {}): Round {
  const garden = openGarden(20, 10, { x: 19, y: 9 });
  return {
    garden,
    you: { x: 10, y: 5 },
    glints: [{ x: 2, y: 2 }],
    snake: [
      { x: 10, y: 9 },
      { x: 9, y: 9 },
      { x: 8, y: 9 },
      { x: 7, y: 9 },
      { x: 6, y: 9 },
      { x: 5, y: 9 },
    ],
    heading: 0,
    loot: 0,
    penalty: 0,
    chunk: chunkFor(20, 10),
    appetite: 0,
    ledger: null,
    rules: RUN_RULES,
    moves: 0,
    pickups: 0,
    warps: 0,
    ...overrides,
  };
}

describe('the pay per pickup (the hyperbola)', () => {
  it('pays $25 on an 80×24 terminal and $36 on any short edge up to 12', () => {
    expect(chunkFor(78, 22)).toBe(25);
    expect(chunkFor(4, 4)).toBe(36);
    expect(chunkFor(12, 40)).toBe(36);
    expect(chunkFor(48, 48)).toBe(14);
  });

  it('refuses a board with an edge under four (the 3×3 game pays without end)', () => {
    expect(() => classicRound(3, 3, createRng('small'))).toThrow(RangeError);
    expect(() => classicRound(4, 4, createRng('small'))).not.toThrow();
  });

  it('shows debts as the original did, rounding toward zero', () => {
    expect(pocketValue(25, 50, 0)).toBe(50);
    expect(pocketValue(25, 25, 30)).toBe(-5);
    expect(pocketValue(36, 25, 27)).toBe(-2);
  });
});

describe('the snake’s step', () => {
  const view = (boldness: number, heading = 0) => ({
    garden: openGarden(20, 10, { x: 19, y: 9 }),
    you: { x: 10, y: 2 },
    forbidden: [{ x: 19, y: 9 }],
    boldness,
    heading,
  });

  it('aims along the line to you, and north when its head is on you', () => {
    expect(aimAt({ x: 10, y: 8 }, { x: 10, y: 2 })).toBe(NORTH);
    expect(aimAt({ x: 2, y: 2 }, { x: 10, y: 2 })).toBe(EAST);
    expect(aimAt({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(NORTH);
  });

  it('never heads straight for you while your pockets are empty', () => {
    const rng = createRng('empty pockets');
    for (let i = 0; i < 2000; i++) {
      expect(chase({ x: 10, y: 8 }, view(0), rng).direction).not.toBe(NORTH);
    }
  });

  it('weighs the aim by loot / 10 and its last direction by loot / 20 more', () => {
    const weights = chaseWeights({ x: 10, y: 8 }, view(100, SOUTH));
    expect(weights[NORTH]).toBe(10);
    expect(weights[SOUTH]).toBe(1 + 5);
    expect(weights[EAST]).toBe(1);
  });

  it('never steps onto a glint or the door, nor off the board', () => {
    const weights = chaseWeights({ x: 0, y: 0 }, { ...view(50), forbidden: [{ x: 1, y: 0 }] });
    expect(weights[EAST]).toBe(0);
    expect(weights[NORTH]).toBe(0);
    expect(weights[WEST]).toBe(0);
  });

  it('counts the chances of its ten-bit draw exactly, the modulo fold included', () => {
    const from = { x: 10, y: 8 };
    const chances = strikeChances(from, view(130, SOUTH));
    const weights = chaseWeights(from, view(130, SOUTH));
    const total = weights.reduce((a, b) => a + b, 0);
    const counted = new Array<number>(8).fill(0);
    for (let bits = 0; bits < 1024; bits++) {
      let roll = bits % total;
      let d = 0;
      while (roll >= weights[d]!) roll -= weights[d++]!;
      counted[d]!++;
    }
    for (const c of chances) {
      const d = [0, 1, 2, 3, 4, 5, 6, 7].find(
        (k) =>
          c.cell.x - from.x === [0, 1, 1, 1, 0, -1, -1, -1][k] &&
          c.cell.y - from.y === [-1, -1, 0, 1, 1, 1, 0, -1][k],
      )!;
      expect(c.chance).toBe(counted[d]! / 1024);
    }
    expect(chances.reduce((a, c) => a + c.chance, 0)).toBeCloseTo(1, 12);
  });

  it('stays timid, never less, when a Lucky Break in debt leaves the loot below zero', () => {
    expect(chaseWeights({ x: 10, y: 8 }, view(-60)).every((w) => w >= 0)).toBe(true);
  });
});

describe('a turn', () => {
  it('lets the snake answer every step, but not a pickup or reaching the door', () => {
    const rng = createRng('turns');
    const walked = step(staged(), EAST, rng);
    expect(walked.events.map((e) => e.kind)).toEqual(['step', 'snake']);
    const picking = step(staged({ glints: [{ x: 11, y: 5 }] }), EAST, rng);
    expect(picking.events.map((e) => e.kind)).toEqual(['step', 'pickup']);
    expect(picking.round.snake).toEqual(staged().snake);
    expect(picking.round.loot).toBe(25);
    const leaving = step(staged({ garden: openGarden(20, 10, { x: 11, y: 5 }) }), EAST, rng);
    expect(leaving.events.map((e) => e.kind)).toEqual(['step', 'door']);
  });

  it('catches you on the square its tail just left', () => {
    const snake = [
      { x: 12, y: 3 },
      { x: 12, y: 4 },
      { x: 12, y: 5 },
      { x: 12, y: 6 },
      { x: 12, y: 7 },
      { x: 11, y: 6 },
    ];
    const turn = step(staged({ snake, you: { x: 10, y: 6 } }), EAST, createRng('tail'));
    expect(turn.events.at(-1)).toEqual({ kind: 'caught', by: 'tail' });
  });

  it('turns a walk into a wall or a hedge into a bump that costs nothing', () => {
    const corner = staged({ you: { x: 0, y: 0 } });
    const bump = step(corner, NORTH, createRng('bump'));
    expect(bump.events).toEqual([{ kind: 'bump' }]);
    expect(bump.round).toBe(corner);
  });

  it('keeps Classic to the original’s four directions', () => {
    const classic = staged({ rules: CLASSIC_RULES });
    expect(step(classic, 1, createRng('diagonal')).events).toEqual([{ kind: 'bump' }]);
    expect(step(classic, EAST, createRng('diagonal')).events[0]).toEqual({
      kind: 'step',
      to: { x: 11, y: 5 },
    });
  });
});

describe('warping and debt', () => {
  it('charges a tenth of the loot each time, into debt if you keep at it', () => {
    let round = staged({ rules: CLASSIC_RULES, loot: 25, chunk: 25 });
    expect(pockets(round)).toBe(25);
    expect(warpCost(round)).toBe(2);
    const rng = createRng('warps');
    for (let i = 0; i < 13; i++) round = warp(round, rng);
    expect(round.penalty).toBe(26);
    expect(pockets(round)).toBe(-1);
  });

  it('charges a run a tenth of everything it has picked up', () => {
    const round = staged({ ledger: { gross: 700, spent: 0 } });
    expect(warpCost(round)).toBe(70);
    expect(pockets(warp(round, createRng('run warp')))).toBe(630);
  });
});

describe('the Lucky Break', () => {
  it('rolls against the last digit of the pockets, negative in debt', () => {
    const round = staged({ rules: CLASSIC_RULES, loot: 75, chunk: 25 });
    const roll = luckyBreak(round, createRng('lucky'));
    expect(roll.digit).toBe(75 % 10);
    const debt = staged({ rules: CLASSIC_RULES, loot: 25, penalty: 32, chunk: 25 });
    expect(luckyBreak(debt, createRng('debt')).digit).toBe(-7);
    expect(luckyChance(-7)).toBe(0);
  });

  it('favours 0–5 a shade over 6–9, as eight bits modulo ten do', () => {
    expect(luckyChance(3)).toBe(26 / 256);
    expect(luckyChance(8)).toBe(25 / 256);
    const counts = new Array<number>(10).fill(0);
    const rng = createRng('bias');
    for (let i = 0; i < 200_000; i++) counts[rng.int(0, 255) % 10]!++;
    const low = counts.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
    const high = counts.slice(6).reduce((a, b) => a + b, 0) / 4;
    expect(low / high).toBeGreaterThan(1.02);
  });

  it('refunds nothing on an escape: the penalty folds into the loot', () => {
    const round = staged({ rules: CLASSIC_RULES, loot: 150, penalty: 15, chunk: 25 });
    const before = pockets(round);
    for (let seed = 0; seed < 400; seed++) {
      const roll = luckyBreak(round, createRng(`escape ${seed}`));
      if (!roll.escaped) continue;
      expect(roll.round.loot).toBe(135);
      expect(roll.round.penalty).toBe(0);
      expect(pockets(roll.round)).toBe(before);
      return;
    }
    throw new Error('No escape in 400 tries.');
  });
});

describe('peeking', () => {
  it('points along your column when the glint is within a twelfth of the width', () => {
    const round = staged({
      rules: CLASSIC_RULES,
      garden: openGarden(48, 22, { x: 47, y: 21 }),
      you: { x: 10, y: 15 },
      glints: [{ x: 12, y: 5 }],
    });
    const seen = peek(round)!;
    expect(seen.target).toBe('glint');
    expect(seen.path[0]).toEqual({ x: 10, y: 14 });
    expect(seen.path.at(-1)).toEqual({ x: 10, y: 5 });
  });

  it('never helps on narrow Classic boards, where the fractions round to nothing', () => {
    const round = staged({
      rules: CLASSIC_RULES,
      garden: openGarden(11, 6, { x: 10, y: 5 }),
      you: { x: 2, y: 2 },
      glints: [{ x: 3, y: 4 }],
    });
    expect(peek(round)).toBeNull();
  });

  it('reaches in a run as far as it did on the original’s 78 × 22 board', () => {
    const round = staged({ you: { x: 2, y: 2 }, glints: [{ x: 7, y: 8 }] });
    expect(peek(round)?.path.at(-1)).toEqual({ x: 2, y: 8 });
    expect(peek({ ...round, glints: [{ x: 8, y: 8 }] })).toBeNull();
  });

  it('always shows the way in the mirror chamber', () => {
    const round = staged({ rules: { ...RUN_RULES, peekAlways: true }, glints: [{ x: 2, y: 2 }] });
    const seen = peek(round)!;
    expect(seen.path.at(-1)).toEqual({ x: 2, y: 2 });
  });
});

describe('chambers that bend the rules', () => {
  it('keeps a sleeping snake still until the third glint, then wakes it', () => {
    let round = staged({ rules: { ...RUN_RULES, wakeAt: 3 }, glints: [{ x: 11, y: 5 }] });
    const rng = createRng('sleep');
    round = step(round, WEST, rng).round;
    expect(round.snake).toEqual(staged().snake);
    let woke = false;
    for (let i = 0; i < 3; i++) {
      const turn = step({ ...round, glints: [{ x: round.you.x + 1, y: round.you.y }] }, EAST, rng);
      woke ||= turn.events.some((e) => e.kind === 'wake');
      round = turn.round;
    }
    expect(woke).toBe(true);
    expect(step(round, NORTH, rng).round.snake).not.toEqual(round.snake);
  });

  it('lets the snake swim two squares when its head starts in a pool', () => {
    const garden = gardenFromRows([
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..........~.........',
      '..........~.........',
      '...................#',
    ]);
    const round = staged({
      garden,
      snake: staged().snake.map((s, i) => (i === 0 ? { x: 10, y: 8 } : s)),
    });
    const turn = step(round, WEST, createRng('swim'));
    expect(turn.events.filter((e) => e.kind === 'snake')).toHaveLength(2);
    expect(reach(turn.round.snake[0]!, { x: 10, y: 8 })).toBeLessThanOrEqual(2);
  });
});

describe('the classic layout', () => {
  it('grows the body as a walk behind the head, each segment beside the one before', () => {
    for (let seed = 0; seed < 50; seed++) {
      const round = classicRound(78, 22, createRng(`layout ${seed}`));
      expect(round.snake).toHaveLength(6);
      round.snake
        .slice(1)
        .forEach((s, i) => expect(reach(s, round.snake[i]!)).toBeLessThanOrEqual(1));
      for (const c of [round.you, round.garden.door, ...round.glints, round.snake[0]!]) {
        expect(c.y === 0 && c.x < 5).toBe(false);
      }
    }
  });
});
