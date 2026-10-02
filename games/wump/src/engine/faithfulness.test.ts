import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import {
  type Cave,
  caveProblem,
  DEFAULT_ROOMS,
  DEFAULT_TUNNELS,
  digCave,
  isMagic,
  neighbours,
  reachable,
} from './cave';
import {
  type Expedition,
  move,
  populationProblem,
  type Preset,
  sense,
  shoot,
  startExpedition,
  stirsAfterMiss,
} from './expedition';
import { glibcRandom } from './glibc';
import { randomFrom, scripted } from './random';
import { CLASSIC_RECIPE, MAX_DART_ROOMS, type RuleSet } from './rules';

/**
 * One test per rule of the BSD wump (wump.c), as listed in docs/NOTES.md. Where a rule depends on
 * a dice roll the stream is scripted, so each test shows the exact draw that makes it happen.
 */

/** A hand-made cave from adjacency lists (index 0 unused), every room with the same tunnel count. */
function caveOf(tunnels: number[][]): Cave {
  return {
    size: tunnels.length - 1,
    tunnelsPerRoom: tunnels[1]!.length,
    tunnels: tunnels.map((t) => [...t].sort((a, b) => a - b)),
  };
}

/**
 * Ten rooms in a ring, each also leading two ahead: 1→2,10,3 … Every tunnel to the next and
 * previous room runs both ways; the jump of two runs one way only.
 */
const RING = caveOf([
  [],
  ...Array.from({ length: 10 }, (_, i) => [
    ((i + 1) % 10) + 1,
    ((i + 9) % 10) + 1,
    ((i + 2) % 10) + 1,
  ]),
]);

function expedition(
  preset: Omit<Preset, 'cave'> & { cave?: Cave },
  draws: number[],
  rules: RuleSet = 'classic',
  darts = 5,
): Expedition {
  return startExpedition({ ...CLASSIC_RECIPE, rooms: 10, darts }, rules, scripted(draws), {
    preset: { cave: preset.cave ?? RING, ...preset },
  });
}

const seeds = (count: number, label: string) =>
  Array.from({ length: count }, (_, i) => randomFrom(createRng(`${label}-${i}`)));

describe('the cave', () => {
  it('has twenty rooms of three tunnels by default; the manual says twenty-five', () => {
    expect(DEFAULT_ROOMS).toBe(20);
    expect(DEFAULT_TUNNELS).toBe(3);
    expect(CLASSIC_RECIPE).toMatchObject({
      rooms: 20,
      tunnelsPerRoom: 3,
      bats: 3,
      pits: 3,
      darts: 5,
    });
  });

  it('refuses the sizes the original refused, in its order of checking', () => {
    expect(caveProblem(9, 3)).toBe('too-few-rooms');
    expect(caveProblem(251, 3)).toBe('too-many-rooms');
    expect(caveProblem(20, 1)).toBe('too-few-tunnels');
    expect(caveProblem(20, 15)).toBeNull();
    expect(caveProblem(20, 16)).toBe('collapses'); // more than rooms − rooms/4
    expect(caveProblem(250, 26)).toBe('collapses'); // more than 25
  });

  it('threads a two-way ring through every room, so every cave is connected', () => {
    for (const random of seeds(120, 'ring')) {
      const cave = digCave({ size: 20, tunnelsPerRoom: 3, allowLoops: true }, random);
      const twoWay = (a: number, b: number) =>
        cave.tunnels[a]!.includes(b) && cave.tunnels[b]!.includes(a);
      const seen = new Set([1]);
      const queue = [1];
      while (queue.length > 0) {
        const room = queue.shift()!;
        for (const next of cave.tunnels[room]!) {
          if (!twoWay(room, next) || seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      expect(seen.size).toBe(20);
      for (let room = 1; room <= 20; room++) expect(reachable(cave, room).size).toBe(20);
    }
  });

  it('answers extra tunnels only some of the time, so one-way tunnels are common', () => {
    let oneWay = 0;
    let twoWay = 0;
    for (const random of seeds(60, 'answer')) {
      const cave = digCave({ size: 20, tunnelsPerRoom: 3, allowLoops: true }, random);
      for (let room = 1; room <= 20; room++) {
        for (const to of cave.tunnels[room]!) {
          if (cave.tunnels[to]!.includes(room)) twoWay++;
          else oneWay++;
        }
      }
    }
    expect(oneWay).toBeGreaterThan(200);
    expect(twoWay).toBeGreaterThan(oneWay);
  });

  it('shows each room’s tunnels in ascending order', () => {
    const cave = digCave({ size: 30, tunnelsPerRoom: 4, allowLoops: true }, seeds(1, 'sort')[0]!);
    for (let room = 1; room <= 30; room++) {
      expect([...cave.tunnels[room]!].sort((a, b) => a - b)).toEqual(cave.tunnels[room]);
    }
  });

  it('can lead a tunnel back into its own room under Classic rules, never under Standard', () => {
    let loops = 0;
    for (const random of seeds(150, 'loops')) {
      const cave = digCave({ size: 20, tunnelsPerRoom: 3, allowLoops: true }, random);
      for (let room = 1; room <= 20; room++) if (cave.tunnels[room]!.includes(room)) loops++;
    }
    expect(loops).toBeGreaterThan(0);
    for (const random of seeds(150, 'loops')) {
      const cave = digCave({ size: 20, tunnelsPerRoom: 3, allowLoops: false }, random);
      for (let room = 1; room <= 20; room++) expect(cave.tunnels[room]).not.toContain(room);
    }
  });

  it('never digs a magic tunnel: the original’s magic tunnels are dead code', () => {
    for (const random of seeds(150, 'magic')) {
      const cave = digCave({ size: 20, tunnelsPerRoom: 3, allowLoops: true }, random);
      for (let room = 1; room <= 20; room++)
        expect(cave.tunnels[room]!.some((to) => isMagic(cave, to))).toBe(false);
    }
  });

  it('keeps a Standard cave connected even with magic tunnels in it', () => {
    for (const random of seeds(60, 'standard')) {
      const cave = digCave(
        { size: 60, tunnelsPerRoom: 3, allowLoops: false, magicTunnels: 3 },
        random,
      );
      expect(
        neighbours(cave)
          .slice(1)
          .every((around) => around.size > 0),
      ).toBe(true);
      expect(reachable(cave, 1).size).toBe(60);
    }
  });
});

describe('hazards', () => {
  it('keeps bats in rooms of their own under both rule sets', () => {
    for (const rules of ['classic', 'standard'] as const) {
      for (const random of seeds(80, `bats-${rules}`)) {
        const e = startExpedition({ ...CLASSIC_RECIPE, bats: 6 }, rules, random);
        expect(e.bats.filter(Boolean)).toHaveLength(6);
      }
    }
  });

  it('lets pits stack and share rooms with bats under Classic (`&&` for `||`), never under Standard', () => {
    let fewer = 0;
    let shared = 0;
    for (const random of seeds(400, 'pits')) {
      const e = startExpedition({ ...CLASSIC_RECIPE, bats: 6, pits: 6 }, 'classic', random);
      if (e.pits.filter(Boolean).length < 6) fewer++;
      for (let room = 1; room <= 20; room++) if (e.pits[room] && e.bats[room]) shared++;
    }
    expect(fewer).toBeGreaterThan(0);
    expect(shared).toBeGreaterThan(0);
    for (const random of seeds(200, 'pits')) {
      const e = startExpedition({ ...CLASSIC_RECIPE, bats: 6, pits: 6 }, 'standard', random);
      expect(e.pits.filter(Boolean)).toHaveLength(6);
      for (let room = 1; room <= 20; room++) expect(e.pits[room] && e.bats[room]).toBe(false);
    }
  });

  it('may put the wumpus on a pit or with bats: it has sucker feet and is too heavy to lift', () => {
    let onHazard = 0;
    for (const random of seeds(400, 'feet')) {
      const e = startExpedition({ ...CLASSIC_RECIPE, bats: 6, pits: 6 }, 'classic', random);
      if (e.pits[e.wumpus] || e.bats[e.wumpus]) onHazard++;
    }
    expect(onHazard).toBeGreaterThan(0);
  });

  it('never starts the explorer in the wumpus’s room, and on the hard level out of smelling range', () => {
    for (const rules of ['classic', 'standard'] as const) {
      for (const random of seeds(150, `start-${rules}`)) {
        const easy = startExpedition(CLASSIC_RECIPE, rules, random);
        expect(easy.player).not.toBe(easy.wumpus);
        const hard = startExpedition(
          { ...CLASSIC_RECIPE, bats: 1, pits: 1, hard: true },
          rules,
          random,
        );
        expect(sense(hard).wumpus).toBe(0);
      }
    }
  });

  it('lets the explorer start on a pit or among bats under Classic; Standard starts somewhere calm', () => {
    let onHazard = 0;
    for (const random of seeds(400, 'unharmed')) {
      const e = startExpedition({ ...CLASSIC_RECIPE, bats: 6, pits: 6 }, 'classic', random);
      if (e.pits[e.player] || e.bats[e.player]) onHazard++;
    }
    expect(onHazard).toBeGreaterThan(0);
    for (const random of seeds(200, 'calm')) {
      const e = startExpedition(CLASSIC_RECIPE, 'standard', random);
      const s = sense(e);
      expect(e.pits[e.player] || e.bats[e.player]).toBe(false);
      expect(s.pit || s.bats || s.wumpus === 1).toBe(false);
    }
  });

  it('draws the hard level’s extras from the C library’s default seed under Classic', () => {
    expect(glibcRandom(1)()).toBe(1804289383);
    const e = startExpedition({ ...CLASSIC_RECIPE, hard: true }, 'classic', seeds(1, 'hard')[0]!);
    expect(e.announced).toEqual({
      bats: 3 + (1804289383 % 10) + 1,
      pits: 3 + (846930886 % 10) + 1,
    });
  });

  it('refuses a cave too crowded with bats or too full of pits', () => {
    expect(populationProblem(CLASSIC_RECIPE, { bats: 11, pits: 3 })).toBe('too-crowded');
    expect(populationProblem(CLASSIC_RECIPE, { bats: 3, pits: 11 })).toBe('too-dangerous');
    expect(populationProblem(CLASSIC_RECIPE, { bats: 10, pits: 10 }, 'classic')).toBeNull();
  });
});

describe('senses', () => {
  it('only look down the tunnels leading out of a room', () => {
    // Room 1 leads to 2, 3 and 10; room 9 leads into room 1 but not the other way.
    const e = expedition({ pits: [9], bats: [8], wumpus: 6, start: 1 }, [0]);
    expect(RING.tunnels[9]).toContain(1);
    expect(RING.tunnels[1]).not.toContain(9);
    expect(sense(e)).toEqual({ bats: false, pit: false, wumpus: 0 });
  });

  it('feel bats and pits one tunnel away', () => {
    const e = expedition({ pits: [3], bats: [10], wumpus: 7, start: 1 }, [0]);
    expect(sense(e)).toMatchObject({ bats: true, pit: true });
  });

  it('smell the wumpus two tunnels away but not three', () => {
    expect(sense(expedition({ pits: [], bats: [], wumpus: 3, start: 1 }, [0])).wumpus).toBe(1);
    expect(sense(expedition({ pits: [], bats: [], wumpus: 5, start: 1 }, [0])).wumpus).toBe(2);
    expect(sense(expedition({ pits: [], bats: [], wumpus: 6, start: 1 }, [0])).wumpus).toBe(0);
  });
});

describe('moving', () => {
  it('walks only through a tunnel; asking for any other room is a bump', () => {
    const e = expedition({ pits: [], bats: [], wumpus: 6, start: 1 }, [0]);
    expect(move(e, 5)).toEqual([{ kind: 'bumped', from: 1, toward: 5 }]);
    expect(e.player).toBe(1);
    expect(move(e, 2)).toEqual([{ kind: 'walked', from: 1, to: 2 }]);
  });

  it('wakes the wumpus on one bump in six, and it may walk into you', () => {
    // Draws: the bump's die (1 wakes it), then the wumpus's tunnel (index 0 of room 3 → room 2).
    const e = expedition({ pits: [], bats: [], wumpus: 3, start: 2 }, [1, 0]);
    const events = move(e, 7);
    expect(events.map((x) => x.kind)).toEqual(['bumped', 'stirred', 'ended']);
    expect(e.ending).toEqual({ kind: 'bowled-over', room: 2, cause: 'it-came' });
    const quiet = expedition({ pits: [], bats: [], wumpus: 3, start: 2 }, [0]);
    expect(move(quiet, 7).map((x) => x.kind)).toEqual(['bumped']);
  });

  it('checks the wumpus first, then a pit, then bats', () => {
    const both = expedition({ pits: [2], bats: [2], wumpus: 2, start: 1 }, [0]);
    move(both, 2);
    expect(both.ending?.kind).toBe('bowled-over');
    const pitAndBats = expedition({ pits: [2], bats: [2], wumpus: 7, start: 1 }, [1]);
    expect(move(pitAndBats, 2).map((x) => x.kind)).toEqual(['walked', 'ledge']);
  });

  it('lets two pits in twelve be survived', () => {
    for (const [draw, survived] of [
      [0, true],
      [1, true],
      [2, false],
      [11, false],
    ] as const) {
      const e = expedition({ pits: [2], bats: [], wumpus: 7, start: 1 }, [draw]);
      move(e, 2);
      expect(e.ending === null).toBe(survived);
    }
  });

  it('lets bats drop you in any room, even straight into more bats', () => {
    // Bats in 2 and 5. Draws: 4 → room 5 (more bats), 8 → room 9.
    const e = expedition({ pits: [], bats: [2, 5], wumpus: 7, start: 1 }, [4, 8]);
    const events = move(e, 2);
    expect(events).toEqual([
      { kind: 'walked', from: 1, to: 2 },
      { kind: 'carried', from: 2, to: 5 },
      { kind: 'carried', from: 5, to: 9 },
    ]);
    expect(e.player).toBe(9);
    expect(e.batRides).toBe(2);
  });
});

describe('darts', () => {
  it('fly through at most five rooms', () => {
    expect(MAX_DART_ROOMS).toBe(5);
    const e = expedition({ pits: [], bats: [], wumpus: 9, start: 1 }, [9]);
    const [dart] = shoot(e, [2, 3, 4, 5, 6, 7]);
    expect(dart).toMatchObject({ kind: 'dart', flight: { stop: 'too-far', landed: 6 } });
  });

  it('go down a random tunnel when a hop has none, and stop there', () => {
    // From room 1 no tunnel leads to 5: the die picks tunnel index 2 of room 1 (10, after 2, 3).
    const e = expedition({ pits: [], bats: [], wumpus: 9, start: 1 }, [2, 9]);
    const [dart] = shoot(e, [5, 6]);
    expect(dart).toMatchObject({
      flight: { stop: 'deflected', landed: 10, hops: [{ kind: 'deflected', to: 10 }] },
    });
  });

  it('may break the string after the third room (2 in 10) and waver after the fourth (6 in 10)', () => {
    const broke = expedition({ pits: [], bats: [], wumpus: 9, start: 1 }, [9, 9, 1]);
    expect(shoot(broke, [2, 3, 4, 5])[0]).toMatchObject({
      flight: { stop: 'string-broke', landed: 4 },
    });
    const held = expedition({ pits: [], bats: [], wumpus: 9, start: 1 }, [9, 9, 2, 5]);
    expect(shoot(held, [2, 3, 4, 5, 6])[0]).toMatchObject({
      flight: { stop: 'wavered', landed: 5 },
    });
    const flew = expedition({ pits: [], bats: [], wumpus: 9, start: 1 }, [9, 9, 2, 6, 9]);
    expect(shoot(flew, [2, 3, 4, 5, 6])[0]).toMatchObject({
      flight: { stop: 'path-end', landed: 6 },
    });
  });

  it('only count the room they come down in: flying through the wumpus is a miss', () => {
    const e = expedition({ pits: [], bats: [], wumpus: 2, start: 1 }, [9, 9, 9]);
    shoot(e, [2, 3]);
    expect(e.ending).toBeNull();
    const hit = expedition({ pits: [], bats: [], wumpus: 3, start: 1 }, [9]);
    shoot(hit, [2, 3]);
    expect(hit.ending).toEqual({ kind: 'hushed', room: 3 });
  });

  it('can come back to your own room', () => {
    const e = expedition({ pits: [], bats: [], wumpus: 7, start: 1 }, [9]);
    shoot(e, [2, 1]);
    expect(e.ending).toEqual({ kind: 'own-dart', room: 1 });
  });

  it('end the expedition when the last one misses', () => {
    const e = expedition({ pits: [], bats: [], wumpus: 7, start: 1 }, [9], 'classic', 1);
    shoot(e, [2]);
    expect(e.ending).toEqual({ kind: 'empty-quiver', room: 1 });
  });

  it('cost nothing when no rooms are given', () => {
    const e = expedition({ pits: [], bats: [], wumpus: 7, start: 1 }, [9]);
    expect(shoot(e, [])).toEqual([]);
    expect(e.darts).toBe(5);
  });
});

describe('the wumpus’s temper', () => {
  /** Five misses in a row from a fresh temper; true where the wumpus stirs. */
  function stirs(rules: RuleSet, hard: boolean, draws: number[]): boolean[] {
    const e = {
      rules,
      recipe: { ...CLASSIC_RECIPE, hard },
      temper: 2,
      random: scripted(draws),
    } as Expedition;
    return Array.from({ length: 5 }, () => stirsAfterMiss(e));
  }

  it('reproduces the precedence bug exactly under Classic rules', () => {
    // Easy: random() % 1 is never 1, so only the counter matters: 4, 6, 8, 10 → the fourth miss.
    expect(stirs('classic', false, [0])).toEqual([false, false, false, true, true]);
    expect(stirs('classic', false, [1234567])).toEqual([false, false, false, true, true]);
    // Hard: an odd draw stirs it at once and leaves the counter alone; an even one counts.
    expect(stirs('classic', true, [1])).toEqual([true, true, true, true, true]);
    expect(stirs('classic', true, [0])).toEqual([false, false, false, true, true]);
    expect(stirs('classic', true, [0, 1, 0, 0, 0])).toEqual([false, true, false, false, true]);
  });

  it('plays the intended growing chance under Standard rules: out of 12 easy, 9 hard', () => {
    expect(stirs('standard', false, [3])).toEqual([true, true, true, true, true]);
    expect(stirs('standard', false, [4])).toEqual([false, true, true, true, true]);
    expect(stirs('standard', false, [11])).toEqual([false, false, false, false, true]);
    expect(stirs('standard', true, [8])).toEqual([false, false, false, true, true]);
  });

  it('settles back to a temper of 0, 1 or 2 after it stirs', () => {
    // Draws: the hop's ten-sided die, the hard coin (odd: it stirs), its tunnel, the new temper.
    const e = startExpedition(
      { ...CLASSIC_RECIPE, rooms: 10, hard: true },
      'classic',
      scripted([9, 1, 0, 5]),
      {
        preset: { cave: RING, pits: [], bats: [], wumpus: 6, start: 1 },
      },
    );
    shoot(e, [2]);
    expect(e.wumpus).toBe(RING.tunnels[6]![0]);
    expect(e.temper).toBe(5 % 3);
  });

  it('ends the expedition when a woken wumpus walks into you: the original carried on', () => {
    for (const rules of ['classic', 'standard'] as const) {
      // The dart flies through the wumpus's room 3 and comes down in 4; the woken wumpus takes
      // tunnel 0 of room 3, which leads to room 2, where you stand.
      const e = startExpedition(
        { ...CLASSIC_RECIPE, rooms: 10, hard: true },
        rules,
        scripted([9, 1, 1, 0]),
        {
          preset: { cave: RING, pits: [], bats: [], wumpus: 3, start: 2 },
        },
      );
      e.temper = rules === 'standard' ? 20 : 2;
      shoot(e, [3, 4]);
      expect(e.ending).toEqual({ kind: 'bowled-over', room: 2, cause: 'it-came' });
    }
  });
});
