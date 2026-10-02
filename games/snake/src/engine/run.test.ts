import { addDays, createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { connected, DAILY_LENGTH, layOutChamber, planChamber, RUN_LENGTH } from './chambers';
import { groundAt } from './garden';
import { reach } from './geometry';
import { captureRisk } from './risk';
import { pockets, type Round, step, warp } from './round';
import { goDeeper, isLastChamber, layoutRng, playRng, startRun } from './run';
import { FAIR_DISTANCE, HEAD_DISTANCE } from './setup';

describe('chambers', () => {
  it('plans ten chambers for a run and five for the Daily Run, the lawn first', () => {
    const run = startRun('plans', RUN_LENGTH);
    expect(run.plans).toHaveLength(10);
    expect(run.plans[0]!.kind).toBe('lawn');
    expect(run.plans[1]!.kind).toBe('hedges');
    expect(startRun('daily', DAILY_LENGTH).plans).toHaveLength(5);
  });

  it('pays more and brings a bolder snake the deeper the chamber', () => {
    const plans = startRun('rates', RUN_LENGTH).plans;
    plans.slice(1).forEach((plan, i) => {
      expect(plan.rate).toBeGreaterThan(plans[i]!.rate);
      expect(plan.appetite).toBeGreaterThan(plans[i]!.appetite);
    });
  });

  it('lays out every kind in one piece, door to the east and the way in to the west', () => {
    for (const kind of [
      'lawn',
      'hedges',
      'pools',
      'corridors',
      'twin',
      'sleeping',
      'mirror',
    ] as const) {
      for (let depth = 1; depth <= RUN_LENGTH; depth++) {
        const rng = createRng(`${kind}:${depth}`);
        const plan = planChamber(kind, depth, rng);
        const { garden, start } = layOutChamber(plan, rng);
        expect(connected(garden)).toBe(true);
        expect(groundAt(garden, garden.door)).toBe('stone');
        expect(start.x).toBeLessThan(garden.width / 3);
        expect(garden.door.x).toBeGreaterThanOrEqual(garden.width - Math.floor(garden.width / 3));
      }
    }
  });

  it('keeps the first chamber free of pools, so the snake cannot swim at a new arrival', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { garden } = startRun(`no pools ${seed}`, RUN_LENGTH).round;
      expect(garden.ground.includes('pool')).toBe(false);
    }
  });
});

describe('a run', () => {
  it('carries the pockets and the snake’s boldness down the steps', () => {
    let run = startRun('carry', RUN_LENGTH);
    const rng = playRng('carry', 1);
    let round: Round = { ...run.round, glints: [{ x: run.round.you.x + 1, y: run.round.you.y }] };
    round = step(round, 2, rng).round;
    run = goDeeper({ ...run, round });
    expect(run.index).toBe(1);
    expect(run.round.loot).toBe(25);
    expect(pockets(run.round)).toBe(round.chunk);
  });

  it('lays out each chamber from the seed alone, however the one before was played', () => {
    const quiet = goDeeper(startRun('same', RUN_LENGTH));
    const busy = startRun('same', RUN_LENGTH);
    const warped = warp(busy.round, playRng('same', 1));
    const after = goDeeper({ ...busy, round: warped });
    expect(after.round.garden).toEqual(quiet.round.garden);
    expect(after.round.snake).toEqual(quiet.round.snake);
    expect(layoutRng('same', 2).nextUint32()).toBe(layoutRng('same', 2).nextUint32());
  });

  it('ends at its tenth chamber', () => {
    let run = startRun('to the bottom', RUN_LENGTH);
    while (!isLastChamber(run)) run = goDeeper(run);
    expect(run.index).toBe(9);
    expect(() => goDeeper(run)).toThrow(RangeError);
  });
});

describe('fair starts', () => {
  it('never lets the Daily Run’s first chamber force a capture within three steps', () => {
    for (let day = 0; day < 365; day++) {
      const seed = `snake:daily:${addDays('2026-09-01', day)}`;
      const round = startRun(seed, DAILY_LENGTH).round;
      // Three steps each can close at most six squares of the gap.
      expect(reach(round.snake[0]!, round.you)).toBeGreaterThanOrEqual(HEAD_DISTANCE);
      for (const segment of round.snake)
        expect(reach(segment, round.you)).toBeGreaterThanOrEqual(FAIR_DISTANCE);
      for (let direction = 0; direction < 8; direction++)
        expect(captureRisk(round, direction) ?? 0).toBe(0);
    }
  });
});
