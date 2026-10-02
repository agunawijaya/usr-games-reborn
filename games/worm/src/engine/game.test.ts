import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { classicStart, emptyBoard, parseBoard } from './board';
import {
  continueDash,
  COUNT_UP_BONUS,
  createGame,
  DASH_ACROSS,
  DASH_UPDOWN,
  type Game,
  type MoveEvent,
  move,
  type PlannedDigit,
  ROOT_REGROW,
  startDash,
} from './game';
import type { Cell } from './geometry';

/** A straight worm lying leftwards from `head`, head first. */
function lying(head: Cell, length: number): Cell[] {
  return Array.from({ length }, (_, i) => ({ x: head.x - i, y: head.y }));
}

function game(body: Cell[], plan: PlannedDigit[] = [], width = 20, height = 9): Game {
  return createGame({
    board: emptyBoard(width, height),
    body,
    random: createRng('test'),
    plan,
    heading: 'right',
  });
}

const bites = (events: MoveEvent[]) => events.flatMap((e) => (e.kind === 'bite' ? [e.bite] : []));

describe('the 1980 rules', () => {
  it('lays the starting worm out as worm.c did on an 80 × 24 terminal', () => {
    // 80 × 24 leaves a box of 77 × 21; the default length is 7 behind the head.
    const body = classicStart(77, 21, 7);
    expect(body[0]).toEqual({ x: 8, y: 11 });
    expect(body).toHaveLength(8);
    expect(body.at(-1)).toEqual({ x: 1, y: 11 });
  });

  it('folds a long starting worm back on the row below at the left edge', () => {
    const body = classicStart(12, 9, 14);
    const turn = body.findIndex((c, i) => i > 0 && c.y !== body[i - 1]!.y);
    expect(body[turn - 1]!.x).toBe(1);
    expect(body[turn]).toEqual({ x: 1, y: body[turn - 1]!.y + 1 });
    expect(body[turn + 1]!.x).toBe(2);
  });

  it('waits for the first move, with no heading, as the original did', () => {
    const g = createGame({
      board: emptyBoard(77, 21),
      body: classicStart(77, 21, 7),
      random: createRng('w'),
    });
    expect(g.status).toBe('waiting');
    expect(g.heading).toBeNull();
    expect(g.digit).not.toBeNull();
  });

  it('moves the tail up when there is nothing to digest, so the length stays the same', () => {
    const g = game(lying({ x: 5, y: 4 }, 4), [{ value: 1, at: { x: 15, y: 8 } }]);
    move(g, 'right');
    expect(g.body).toHaveLength(4);
    expect(g.body[0]).toEqual({ x: 6, y: 4 });
    expect(g.body.at(-1)).toEqual({ x: 3, y: 4 });
  });

  it('scores the whole pending growth at each bite: a 9, then a 5 two moves later, is 9 + 12', () => {
    const g = game(lying({ x: 5, y: 4 }, 4), [
      { value: 9, at: { x: 6, y: 4 } },
      { value: 5, at: { x: 8, y: 4 } },
      { value: 1, at: { x: 1, y: 8 } },
    ]);
    const first = bites(move(g, 'right'));
    expect(first[0]).toMatchObject({ value: 9, carried: 0, pending: 9, points: 9, chain: 1 });
    move(g, 'right');
    const second = bites(move(g, 'right'));
    // The 5 arrives with 7 of the 9 still to grow: 7 + 5 = 12.
    expect(second[0]).toMatchObject({ value: 5, carried: 7, pending: 12, points: 12, chain: 2 });
    expect(g.score).toBe(21);
  });

  it('grows by exactly the digit, one cell a move, from the tail', () => {
    const g = game(lying({ x: 5, y: 4 }, 4), [
      { value: 3, at: { x: 6, y: 4 } },
      { value: 1, at: { x: 1, y: 8 } },
    ]);
    move(g, 'right');
    expect(g.body).toHaveLength(4);
    for (let i = 0; i < 3; i++) move(g, 'right');
    expect(g.body).toHaveLength(7);
    move(g, 'right');
    expect(g.body).toHaveLength(7);
  });

  it('dashes nine cells across and five up or down, counting the first step', () => {
    const across = game(lying({ x: 3, y: 4 }, 3), [{ value: 1, at: { x: 0, y: 0 } }], 30, 15);
    startDash(across, 'right');
    while (across.dashLeft > 0) continueDash(across);
    expect(across.body[0]).toEqual({ x: 3 + DASH_ACROSS, y: 4 });

    const down = game(lying({ x: 3, y: 4 }, 3), [{ value: 1, at: { x: 0, y: 0 } }], 30, 15);
    startDash(down, 'down');
    while (down.dashLeft > 0) continueDash(down);
    expect(down.body[0]).toEqual({ x: 3, y: 4 + DASH_UPDOWN });
  });

  it('stops a dash on the digit it eats', () => {
    const g = game(
      lying({ x: 3, y: 4 }, 3),
      [
        { value: 2, at: { x: 6, y: 4 } },
        { value: 1, at: { x: 0, y: 0 } },
      ],
      30,
      15,
    );
    startDash(g, 'right');
    const eaten: number[] = [];
    while (g.dashLeft > 0) eaten.push(...bites(continueDash(g)).map((b) => b.value));
    expect(eaten).toEqual([2]);
    expect(g.body[0]).toEqual({ x: 6, y: 4 });
  });

  it('lets the head follow the tail when not growing, and not when growing', () => {
    // A worm curled in a 2 × 2 square: the head can step into the cell the tail is leaving.
    const square = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const free = game(square, [{ value: 1, at: { x: 9, y: 8 } }]);
    free.heading = 'left';
    move(free, 'down');
    expect(free.status).toBe('playing');

    const growing = game(square, [{ value: 1, at: { x: 9, y: 8 } }]);
    growing.heading = 'left';
    growing.growing = 2;
    move(growing, 'down');
    expect(growing.loss?.kind).toBe('self');
  });

  it('ends at the edge of the box', () => {
    const g = game(lying({ x: 19, y: 4 }, 3), [{ value: 1, at: { x: 0, y: 0 } }]);
    const events = move(g, 'right');
    expect(events).toEqual([{ kind: 'lost', loss: 'wall', at: { x: 20, y: 4 } }]);
  });

  it('ends on rock, which the 1980 box never had', () => {
    const board = parseBoard(['..#r', '....']);
    const g = createGame({
      board,
      body: [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
      random: createRng('r'),
      heading: 'right',
      plan: [{ value: 1, at: { x: 0, y: 1 } }],
    });
    expect(move(g, 'right')).toEqual([{ kind: 'lost', loss: 'rock', at: { x: 2, y: 0 } }]);
  });
});

describe('what Noodle Nine changes', () => {
  it('refuses a reverse into the neck with a bump, where the original ended the game', () => {
    const g = game(lying({ x: 5, y: 4 }, 4), [{ value: 1, at: { x: 15, y: 8 } }]);
    expect(move(g, 'left')).toEqual([{ kind: 'bump', dir: 'left' }]);
    expect(g.status).not.toBe('lost');
  });

  it('refuses a reverse even before the first move, going by the way the body lies', () => {
    const g = createGame({
      board: emptyBoard(77, 21),
      body: classicStart(77, 21, 7),
      random: createRng('first'),
    });
    expect(move(g, 'left')).toEqual([{ kind: 'bump', dir: 'left' }]);
    expect(g.status).toBe('waiting');
  });

  it('multiplies a bite by the tempo', () => {
    const g = game(lying({ x: 5, y: 4 }, 4), [
      { value: 9, at: { x: 6, y: 4 } },
      { value: 1, at: { x: 0, y: 0 } },
    ]);
    expect(bites(move(g, 'right', { multiplier: 1.5 }))[0]!.points).toBe(14);
  });

  it('counts a chain while the noodle is still digesting, and lets it lapse when it is not', () => {
    const g = game(lying({ x: 5, y: 4 }, 4), [
      { value: 2, at: { x: 6, y: 4 } },
      { value: 2, at: { x: 7, y: 4 } },
      { value: 1, at: { x: 12, y: 4 } },
      { value: 1, at: { x: 0, y: 8 } },
    ]);
    move(g, 'right');
    expect(bites(move(g, 'right'))[0]!.chain).toBe(2);
    for (let i = 0; i < 4; i++) move(g, 'right');
    expect(g.chain).toBe(0);
    expect(bites(move(g, 'right'))[0]!.chain).toBe(1);
    expect(g.bestChain).toBe(2);
  });

  it('comes out of the far mouth of a tunnel', () => {
    const board = parseBoard(['.A...A..', '........']);
    const g = createGame({
      board,
      body: [{ x: 0, y: 0 }],
      random: createRng('t'),
      heading: 'right',
      plan: [{ value: 1, at: { x: 0, y: 1 } }],
    });
    const moved = move(g, 'right').find((e) => e.kind === 'moved');
    expect(moved).toMatchObject({ to: { x: 5, y: 0 }, tunnel: true });
  });

  it('calls the box filled when the body covers every open cell', () => {
    // A 3 × 2 box with a worm of 5 that eats a 1 on the last free cell.
    const body = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ];
    const g = createGame({
      board: emptyBoard(3, 2),
      body,
      random: createRng('f'),
      heading: 'left',
      plan: [{ value: 1, at: { x: 0, y: 1 } }],
    });
    g.growing = 1;
    const events = move(g, 'left');
    expect(events.map((e) => e.kind)).toEqual(['moved', 'bite', 'filled']);
    expect(g.status).toBe('filled');
  });

  it('chews through a root, which ends a dash and the chain, and grows back after the tail', () => {
    const board = parseBoard(['....r.......', ...Array.from({ length: 5 }, () => '............')]);
    const g = createGame({
      board,
      body: lying({ x: 2, y: 0 }, 3),
      random: createRng('root'),
      heading: 'right',
      plan: [
        { value: 3, at: { x: 3, y: 0 } },
        { value: 1, at: { x: 0, y: 5 } },
      ],
    });
    move(g, 'right');
    expect(g.chain).toBe(1);
    const events = startDash(g, 'right');
    expect(events.map((e) => e.kind)).toEqual(['moved', 'chewed']);
    expect(g.dashLeft).toBe(0);
    expect(g.chain).toBe(0);
    // Right along the top, down the side, back along the bottom: the tail leaves the root on
    // move 8, and the root grows back ROOT_REGROW moves after that.
    let regrewOn = 0;
    for (let i = 0; i < 20 && regrewOn === 0; i++) {
      const step = move(g, i < 5 ? 'right' : i < 9 ? 'down' : 'left');
      if (step.some((e) => e.kind === 'regrew')) regrewOn = g.moves;
    }
    expect(regrewOn).toBe(8 + ROOT_REGROW);
    expect(g.chewed.size).toBe(0);
  });

  it('stops a dash in mud', () => {
    const board = parseBoard(['.....~.....', '...........']);
    const g = createGame({
      board,
      body: lying({ x: 1, y: 0 }, 2),
      random: createRng('mud'),
      heading: 'right',
      plan: [{ value: 1, at: { x: 0, y: 1 } }],
    });
    startDash(g, 'right');
    while (g.dashLeft > 0) continueDash(g);
    expect(g.body[0]).toEqual({ x: 5, y: 0 });
  });

  it('grows a garden when the length goal is reached at a bite', () => {
    const g = createGame({
      board: emptyBoard(12, 5),
      body: lying({ x: 3, y: 2 }, 4),
      random: createRng('goal'),
      heading: 'right',
      plan: [
        { value: 5, at: { x: 4, y: 2 } },
        { value: 1, at: { x: 0, y: 0 } },
      ],
      goal: 9,
    });
    expect(move(g, 'right').map((e) => e.kind)).toEqual(['moved', 'bite', 'grown']);
    expect(g.status).toBe('grown');
  });

  it('runs out of numbers when a fixed sequence is eaten and the box is not full', () => {
    const g = createGame({
      board: emptyBoard(8, 3),
      body: lying({ x: 2, y: 1 }, 3),
      random: createRng('out'),
      heading: 'right',
      plan: [{ value: 1, at: { x: 3, y: 1 } }],
    });
    move(g, 'right');
    expect(g.status).toBe('playing');
    const events = move(g, 'right');
    expect(events.at(-1)).toEqual({ kind: 'lost', loss: 'out-of-numbers', at: { x: 4, y: 1 } });
  });

  it('pays the count-up bonus for one to nine in order, where a garden offers it', () => {
    const plan = Array.from({ length: 9 }, (_, i) => ({ value: i + 1, at: { x: 4 + i, y: 1 } }));
    const g = createGame({
      board: emptyBoard(16, 3),
      body: lying({ x: 3, y: 1 }, 3),
      random: createRng('count'),
      heading: 'right',
      plan: [...plan, { value: 1, at: { x: 0, y: 0 } }],
      countUpBonus: true,
    });
    const all = Array.from({ length: 9 }, () => bites(move(g, 'right'))[0]!);
    expect(all.map((b) => b.countUp)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(all.at(-1)!.bonus).toBe(COUNT_UP_BONUS);
    expect(all.at(-1)!.points).toBe(all.at(-1)!.pending + COUNT_UP_BONUS);
    expect(all.slice(0, -1).every((b) => b.bonus === 0)).toBe(true);
  });

  it('draws random digits from a garden’s range', () => {
    const random = createRng('big');
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const g = createGame({
        board: emptyBoard(20, 9),
        body: lying({ x: 5, y: 4 }, 3),
        random,
        digits: { min: 5, max: 9 },
      });
      seen.add(g.digit!.value);
    }
    expect([...seen].sort()).toEqual([5, 6, 7, 8, 9]);
  });
});
