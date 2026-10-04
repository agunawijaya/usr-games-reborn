import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { cellsOf, FORMS, KINDS } from './forms';
import {
  BURST_POINTS,
  cellAt,
  CORAL,
  classicScore,
  classicTickMicros,
  countKind,
  createGame,
  depthBonus,
  fall,
  fits,
  type Game,
  type GameEvent,
  landingRow,
  landingSpot,
  plunge,
  type Rules,
  setCell,
  shift,
  sink,
  sinkSeconds,
  spawnColumn,
  turn,
} from './game';

/** The 1992 well, for checking the rules against the original. */
function classic(plan: number[] = [], level = 2): Game {
  return createGame({
    rules: 'classic',
    width: 10,
    height: 20,
    level,
    random: createRng('classic'),
    plan,
  });
}

function standard(plan: number[] = [], level = 1): Game {
  return createGame({
    rules: 'standard',
    width: 11,
    height: 18,
    level,
    random: createRng('standard'),
    plan,
  });
}

/** Fills row `y` except the listed columns, with a stand-in sinker. */
function fillRow(game: Game, y: number, gaps: number[] = []): void {
  for (let x = 0; x < game.width; x++)
    if (!gaps.includes(x)) game.cells[(y + 1) * game.width + x] = { group: 999, kind: 0, depth: y };
}

function fallToRest(game: Game): GameEvent[] {
  for (let i = 0; i < 100; i++) {
    const events = fall(game);
    if (events.some((e) => e.kind === 'landed')) return events;
  }
  throw new Error('never landed');
}

const LONG = 6;
const SQUARE = 3;
const TEE = 2;

describe('the shapes, as the 1992 table has them', () => {
  it('has seven shapes in nineteen forms, each turning back to itself', () => {
    expect(FORMS).toHaveLength(19);
    const turnsBack = Array.from({ length: KINDS }, (_, kind) => {
      let form = kind;
      let turns = 0;
      do {
        form = FORMS[form]!.left;
        turns++;
      } while (form !== kind);
      return turns;
    });
    // Zigzags and the long one have two forms, the square one, the rest four.
    expect(turnsBack).toEqual([2, 2, 4, 1, 4, 4, 2]);
  });

  it('turns clockwise by following the counter-clockwise table backwards', () => {
    for (let form = 0; form < FORMS.length; form++)
      expect(FORMS[FORMS[form]!.left]!.right).toBe(form);
  });

  it('lets the long one wobble: right of its centre lying down, below it standing up', () => {
    expect(
      cellsOf(LONG, 0, 0)
        .map((c) => c.x)
        .sort(),
    ).toEqual([-1, 0, 1, 2]);
    expect(
      cellsOf(FORMS[LONG]!.left, 0, 0)
        .map((c) => c.y)
        .sort(),
    ).toEqual([-1, 0, 1, 2]);
  });

  it('gives the square its centre at the lower right, so it sticks out up and to the left', () => {
    expect(cellsOf(SQUARE, 0, 0)).toEqual(
      expect.arrayContaining([
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: -1, y: 0 },
      ]),
    );
  });
});

describe('Classic rules: the 1992 program', () => {
  it('starts each shape with its centre in the fifth of ten columns, on the top row', () => {
    expect(spawnColumn(10)).toBe(4);
    const game = classic([TEE, TEE]);
    expect([game.x, game.y]).toEqual([4, 0]);
  });

  it('draws the shape that comes next before the one that falls first', () => {
    const game = classic([5, 1, 2]);
    expect(game.next).toBe(5);
    expect(FORMS[game.form]!.kind).toBe(1);
  });

  it('draws shapes uniformly, with repeats allowed (no bag)', () => {
    const game = createGame({
      rules: 'classic',
      width: 10,
      height: 20,
      level: 2,
      random: createRng('uniform'),
    });
    const counts = Array.from({ length: KINDS }, () => 0);
    let repeats = 0;
    let last = -1;
    for (let i = 0; i < 7000; i++) {
      const kind = game.random.int(0, KINDS - 1);
      counts[kind]!++;
      if (kind === last) repeats++;
      last = kind;
    }
    for (const count of counts) expect(Math.abs(count - 1000)).toBeLessThan(120);
    expect(repeats).toBeGreaterThan(800);
  });

  it('turns counter-clockwise only, and only where the turned form fits: no nudge off a wall', () => {
    const game = classic([LONG, LONG]);
    expect(turn(game, 'right')).toEqual([{ kind: 'blocked' }]);
    // Stand the long one up, slide it to the right wall, and try to lay it down there.
    expect(turn(game, 'left')).toEqual([{ kind: 'turned', nudge: 0 }]);
    while (shift(game, 1)[0]!.kind === 'moved');
    expect(game.x).toBe(9);
    const before = game.form;
    expect(turn(game, 'left')).toEqual([{ kind: 'blocked' }]);
    expect(game.form).toBe(before);
  });

  it('scores a point for each landing and a point for each row a dropped shape falls', () => {
    const game = classic([TEE, TEE, TEE]);
    const start = game.y;
    const bottom = landingRow(game);
    plunge(game);
    expect(game.points).toBe(bottom - start);
    fall(game);
    expect(game.points).toBe(bottom - start + 1);
  });

  it('lets a dropped shape be slid and turned until the next tick, then lands it', () => {
    const game = classic([TEE, TEE, TEE]);
    plunge(game);
    expect(game.dropped).toBe(true);
    expect(shift(game, 1)).toEqual([{ kind: 'moved', dx: 1, dy: 0 }]);
    const landed = fall(game);
    expect(landed[0]).toMatchObject({ kind: 'landed' });
    expect(game.landings).toBe(1);
  });

  it('clears full rows for no points at all, and drops what was above', () => {
    const game = classic([TEE, LONG, TEE]);
    // The bottom row full but for the four columns the long one fills lying flat; two cells above.
    fillRow(game, 19, [3, 4, 5, 6]);
    fillRow(game, 18, [2, 3, 4, 5, 6, 7, 8, 9]);
    const pointsBefore = game.points;
    const events = fallToRest(game);
    const burst = events.find((e) => e.kind === 'burst');
    expect(burst).toMatchObject({ burst: { rows: [19], points: 0 } });
    expect(game.points).toBe(pointsBefore + 1);
    // What was on row 18 has fallen into row 19.
    expect(cellAt(game, 0, 19)).not.toBeNull();
    expect(cellAt(game, 1, 19)).not.toBeNull();
    expect(cellAt(game, 5, 19)).toBeNull();
  });

  it('multiplies the points by the level for the final score', () => {
    const game = classic([], 3);
    game.points = 200;
    expect(classicScore(game)).toBe(600);
  });

  it('starts the clock at a million microseconds over the level, a three-thousandth faster each tick', () => {
    const game = classic([], 2);
    expect(game.fallMicros).toBe(500_000);
    expect(classicTickMicros(game)).toBe(500_000 - 166);
    expect(classicTickMicros(game)).toBe(499_834 - 166);
    for (let i = 0; i < 10_000; i++) classicTickMicros(game);
    // It never stops: by now about a twentieth of where it started.
    expect(game.fallMicros).toBeLessThan(20_000);
  });

  it('ends when a new shape will not fit where shapes start', () => {
    const game = classic([TEE, TEE, TEE]);
    // Room for the first shape where it starts and nowhere to fall: it settles in the doorway.
    fillRow(game, 1, [4, 8]);
    for (let y = 2; y < 20; y++) fillRow(game, y, [0]);
    const events = fallToRest(game);
    expect(events.at(-1)).toEqual({ kind: 'over' });
    expect(game.over).toBe(true);
  });
});

describe('Standard rules', () => {
  const rules: Rules = 'standard';

  it('turns both ways, and nudges a cell off a wall when it must', () => {
    const game = standard([LONG, LONG]);
    expect(game.rules).toBe(rules);
    turn(game, 'left');
    while (shift(game, 1)[0]!.kind === 'moved');
    shift(game, -1);
    // Standing one column from the right wall: lying flat needs one cell more room on the right.
    expect(game.x).toBe(9);
    expect(turn(game, 'right')).toEqual([{ kind: 'turned', nudge: -1 }]);
    expect(fits(game, game.form, game.x, game.y)).toBe(true);
    expect(game.x).toBe(8);
  });

  it('plunges straight down, scoring twice the rows fallen times the level, and settles at once', () => {
    const game = standard([TEE, TEE, TEE], 2);
    const rows = landingRow(game) - game.y;
    const events = plunge(game);
    expect(events[0]).toEqual({ kind: 'plunged', rows, points: rows * 2 * 2 });
    expect(events.some((e) => e.kind === 'landed')).toBe(true);
  });

  it('pays a landing more the deeper it settles', () => {
    expect([0, 6, 12, 17].map((row) => depthBonus({ height: 18 }, row))).toEqual([1, 2, 3, 3]);
  });

  it('counts plunges in a row as the depth combo, and a soft landing starts it over', () => {
    const game = standard([TEE, TEE, TEE, TEE, TEE]);
    plunge(game);
    plunge(game);
    expect(game.combo).toBe(2);
    fallToRest(game);
    expect(game.combo).toBe(0);
    expect(game.bestCombo).toBe(0);
  });

  it('cashes the combo in on a burst, the plunge that bursts included, and starts it over', () => {
    // The first kind planned waits as the next one, so the order played is TEE, TEE, LONG.
    const game = standard([TEE, TEE, LONG, LONG], 1);
    for (let y = 14; y < 18; y++) fillRow(game, y, [10]);
    plunge(game);
    plunge(game);
    turn(game, 'left');
    while (shift(game, 1)[0]!.kind === 'moved');
    const burst = plunge(game).find((e) => e.kind === 'burst');
    expect(burst).toMatchObject({ burst: { combo: 3, points: 100 * 3 * 1 } });
    expect(game.combo).toBe(0);
    expect(game.bestCombo).toBe(3);
  });

  it('bursts cleared rows for 10, 30, 60 or 100, times the depth combo and the level', () => {
    expect([...BURST_POINTS]).toEqual([0, 10, 30, 60, 100]);
    const game = standard([LONG, LONG, LONG], 2);
    // Four rows full but for the last column: the long one, stood up and plunged, fills them all.
    for (let y = 14; y < 18; y++) fillRow(game, y, [10]);
    turn(game, 'left');
    while (shift(game, 1)[0]!.kind === 'moved');
    const events = plunge(game);
    expect(events.find((e) => e.kind === 'burst')).toEqual({
      kind: 'burst',
      burst: { rows: [14, 15, 16, 17], combo: 1, points: 100 * 1 * 2 },
    });
    expect(game.rowsCleared).toBe(4);
  });
});

describe('what dives add', () => {
  it('pushes a sinker aside as its centre sinks into a current, and the landing spot knows', () => {
    const game = createGame({
      rules: 'standard',
      width: 11,
      height: 18,
      level: 1,
      random: createRng('current'),
      plan: [TEE, TEE, TEE],
      currents: [
        { row: 4, dir: 1 },
        { row: 9, dir: 1 },
      ],
    });
    const start = game.x;
    // The tee points down: its centre comes to rest one row above the floor.
    expect(landingSpot(game)).toEqual({ x: start + 2, y: 16 });
    for (let i = 0; i < 3; i++) fall(game);
    expect(game.x).toBe(start);
    expect(fall(game)).toContainEqual({ kind: 'drifted', dx: 1 });
    expect(game.x).toBe(start + 1);
    const events = plunge(game);
    expect(events[0]).toEqual({ kind: 'drifted', dx: 1 });
  });

  it('counts the coral left, and bursts it with its row', () => {
    const game = standard([LONG, LONG, LONG]);
    fillRow(game, 17, [10]);
    setCell(game, 3, 17, { group: 500, kind: CORAL, depth: 17 });
    setCell(game, 4, 16, { group: 501, kind: CORAL, depth: 16 });
    expect(countKind(game, CORAL)).toBe(2);
    turn(game, 'left');
    while (shift(game, 1)[0]!.kind === 'moved');
    plunge(game);
    expect(countKind(game, CORAL)).toBe(1);
    expect(cellAt(game, 4, 17)?.kind).toBe(CORAL);
  });

  it('climbs a level for every ten rows in Marathon, paying the burst at the old level', () => {
    const game = createGame({
      rules: 'standard',
      width: 11,
      height: 18,
      level: 1,
      random: createRng('climb'),
      plan: [LONG, LONG, LONG, LONG],
      levelEvery: 4,
    });
    for (let y = 14; y < 18; y++) fillRow(game, y, [10]);
    turn(game, 'left');
    while (shift(game, 1)[0]!.kind === 'moved');
    const events = plunge(game);
    expect(events.find((e) => e.kind === 'burst')).toMatchObject({ burst: { points: 100 } });
    expect(events).toContainEqual({ kind: 'levelled', level: 2 });
    expect(game.level).toBe(2);
    expect(game.fourRowBursts).toBe(1);
  });

  it('counts sinkers in a row that burst, and the turns and sinks that packages ask about', () => {
    const game = standard([TEE, TEE, TEE, TEE]);
    fillRow(game, 17, [4, 5, 6]);
    fillRow(game, 16, [4, 5, 6]);
    turn(game, 'right');
    turn(game, 'right');
    // Upside down, the tee fills row 17's three gaps and row 16's middle.
    sink(game);
    plunge(game);
    expect(game.burstChain).toBe(1);
    expect(game.turnsRight).toBe(2);
    expect(game.sinks).toBe(1);
    plunge(game);
    expect(game.burstChain).toBe(0);
    expect(game.bestBurstChain).toBe(1);
  });

  it('sinks a row a second at level 1, faster with every level', () => {
    expect(sinkSeconds(1)).toBe(1);
    expect(sinkSeconds(9)).toBeLessThan(0.2);
    for (let level = 1; level < 15; level++)
      expect(sinkSeconds(level + 1)).toBeLessThan(sinkSeconds(level));
  });
});
