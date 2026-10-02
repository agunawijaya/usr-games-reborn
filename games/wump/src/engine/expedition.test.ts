import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { type Cave, digCave, dodecahedron, neighbours, reachable } from './cave';
import { type Expedition, sense, shoot, startExpedition, stirsAfterMiss } from './expedition';
import { randomFrom, scripted } from './random';
import { CLASSIC_RECIPE } from './rules';

/**
 * First checks of the engine against wump.c. The full set of faithfulness tests, the property
 * tests over many seeds and the balance simulations come with the engine stage.
 */

function dig(seed: string, allowLoops = true): Cave {
  return digCave({ size: 20, tunnelsPerRoom: 3, allowLoops }, randomFrom(createRng(seed)));
}

describe('digging a cave', () => {
  it('gives every room its full set of tunnels, sorted, and keeps the whole cave reachable', () => {
    for (let s = 0; s < 50; s++) {
      const cave = dig(`dig-${s}`);
      for (let room = 1; room <= cave.size; room++) {
        const tunnels = cave.tunnels[room]!;
        expect(tunnels).toHaveLength(3);
        expect([...tunnels].sort((a, b) => a - b)).toEqual(tunnels);
        expect(reachable(cave, room).size).toBe(cave.size);
      }
    }
  });

  it('builds some tunnels that run one way only, as the manual promises', () => {
    let oneWay = 0;
    for (let s = 0; s < 20; s++) {
      const cave = dig(`one-way-${s}`);
      for (let room = 1; room <= cave.size; room++) {
        for (const to of cave.tunnels[room]!) if (!cave.tunnels[to]!.includes(room)) oneWay++;
      }
    }
    expect(oneWay).toBeGreaterThan(0);
  });

  it('never leads a tunnel back into its own room under Standard rules', () => {
    for (let s = 0; s < 50; s++) {
      const cave = dig(`loop-${s}`, false);
      for (let room = 1; room <= cave.size; room++) expect(cave.tunnels[room]).not.toContain(room);
    }
  });
});

describe('the dodecahedron', () => {
  it('is twenty rooms with three two-way tunnels each', () => {
    const cave = dodecahedron();
    const around = neighbours(cave);
    for (let room = 1; room <= 20; room++) {
      expect(cave.tunnels[room]).toHaveLength(3);
      expect(around[room]!.size).toBe(3);
      for (const to of cave.tunnels[room]!) expect(cave.tunnels[to]).toContain(room);
    }
  });
});

describe('senses', () => {
  it('smell the wumpus up to two tunnels away and tell Standard players how far', () => {
    const expedition = startExpedition(CLASSIC_RECIPE, 'standard', randomFrom(createRng('smell')));
    const { cave } = expedition;
    const first = cave.tunnels[expedition.player]![0]!;
    const second = cave.tunnels[first]!.find((r) => r !== expedition.player)!;
    expedition.wumpus = first;
    expect(sense(expedition).wumpus).toBe(1);
    expedition.wumpus = second;
    expect(sense(expedition).wumpus).toBeGreaterThan(0);
  });
});

describe('the wumpus’s temper after a miss', () => {
  function temperRun(rules: 'classic' | 'standard', hard: boolean, draws: number[]): boolean[] {
    const expedition = { rules, recipe: { ...CLASSIC_RECIPE, hard }, temper: 2 } as Expedition;
    expedition.random = scripted(draws);
    return Array.from({ length: 5 }, () => stirsAfterMiss(expedition));
  }

  it('on the easy level of Classic rules, counts misses and stirs on the fourth', () => {
    expect(temperRun('classic', false, [7])).toEqual([false, false, false, true, true]);
  });

  it('on the hard level of Classic rules, stirs at once on an odd draw', () => {
    expect(temperRun('classic', true, [1])).toEqual([true, true, true, true, true]);
    expect(temperRun('classic', true, [0])).toEqual([false, false, false, true, true]);
  });

  it('under Standard rules, grows a real chance out of twelve', () => {
    expect(temperRun('standard', false, [5])).toEqual([false, true, true, true, true]);
    expect(temperRun('standard', false, [11])).toEqual([false, false, false, false, true]);
  });
});

describe('darts', () => {
  it('only count the room they come down in', () => {
    const expedition = startExpedition(CLASSIC_RECIPE, 'standard', randomFrom(createRng('dart')));
    const { cave } = expedition;
    const a = cave.tunnels[expedition.player]!.find((r) => r !== expedition.player)!;
    const b = cave.tunnels[a]!.find((r) => r !== expedition.player && r !== a)!;
    expedition.wumpus = a;
    expedition.random = scripted([9]);
    const events = shoot(expedition, [a, b]);
    expect(events[0]).toMatchObject({ kind: 'dart', flight: { landed: b, stop: 'path-end' } });
    expect(expedition.ending?.kind).not.toBe('hushed');
  });
});
