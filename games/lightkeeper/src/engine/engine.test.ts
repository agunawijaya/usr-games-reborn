import { describe, expect, it } from 'vitest';
import { flarePath } from './combat';
import { applyOrder } from './orders';
import { CAREER_TUNING, rulesFor } from './params';
import {
  clearCourseTo,
  courseTo,
  knownCalls,
  plotCourse,
  previewBeams,
  suggestedBeamEnergy,
  sureStopEnergy,
} from './preview';
import { cleanRecord, earnsPromotion, lights, scoreSheet } from './score';
import { newWatch, WORLD_COUNT } from './setup';
import type { RankId, WatchState } from './types';

function watch(rank: RankId = 1, seed = 'test', ruleSet: 'commission' | 'classic' = 'classic') {
  return newWatch({ seed, rank, length: 1, ruleSet }).state;
}

function totalGleaners(s: WatchState) {
  return s.zones.flat().reduce((sum, zone) => sum + Math.max(0, zone.gleaners), 0);
}

describe('setting up a watch', () => {
  it('draws the same Reach from the same seed, as the original tournament code did', () => {
    const a = watch(3, 'same code');
    const b = watch(3, 'same code');
    expect(a.zones).toEqual(b.zones);
    expect(a.now).toEqual(b.now);
    expect(watch(3, 'another code').zones).not.toEqual(a.zones);
  });

  it('places every world once and the whole swarm', () => {
    for (const seed of ['a', 'b', 'c']) {
      const s = watch(2, seed);
      const worlds = s.zones.flat().filter((zone) => zone.world !== null);
      expect(worlds).toHaveLength(WORLD_COUNT);
      expect(totalGleaners(s)).toBe(s.now.gleaners);
      expect(s.zones.flat().every((zone) => zone.gleaners <= 9)).toBe(true);
    }
  });

  it('scales the classic watch with skill and length like setup.c', () => {
    for (let i = 0; i < 20; i++) {
      const s = newWatch({ seed: `skill:${i}`, rank: 3, length: 2, ruleSet: 'classic' }).state;
      expect(s.params.gleaners).toBeGreaterThanOrEqual(3 * 2 * 5);
      expect(s.params.gleaners).toBeLessThanOrEqual(Math.trunc(3 * 2 * 3.5 * 1.75));
      expect(s.params.harbours).toBeGreaterThanOrEqual(2);
      expect(s.params.harbours).toBeLessThanOrEqual(4);
      expect(s.params.time).toBe(14);
      expect(s.now.reserve).toBe(s.params.gleaners * 14);
    }
    expect(
      newWatch({ seed: 'x', rank: 6, length: 1, ruleSet: 'classic' }).state.params.harbours,
    ).toBe(1);
  });

  it('starts in the first harbour’s zone with the shield up, as the original ship did', () => {
    const s = watch(1, 'start');
    const first = s.now.harbours[0]!;
    expect(s.ship.zone).toEqual(first);
    expect(s.ship.shieldUp).toBe(true);
  });

  it('unlocks one idea per rank in the career', () => {
    expect(rulesFor('commission', 1)).toMatchObject({ calls: true, sieges: false, hail: false });
    expect(rulesFor('commission', 2)).toMatchObject({ sieges: true, hail: true, snare: false });
    expect(rulesFor('commission', 4)).toMatchObject({
      collapses: true,
      bursts: true,
      shroud: false,
    });
    expect(rulesFor('commission', 6)).toMatchObject({ redline: true });
    expect(Object.values(rulesFor('classic', 1)).filter((v) => v === false)).toHaveLength(1);
  });

  it('gives the career a few more gleaners and a longer clock than the classic watch', () => {
    const s = newWatch({ seed: 'career', rank: 1, length: 1, ruleSet: 'commission' }).state;
    expect(s.params.gleaners).toBeGreaterThanOrEqual(5 + CAREER_TUNING.extraGleaners);
    const top = newWatch({ seed: 'career', rank: 6, length: 1, ruleSet: 'commission' }).state;
    expect(top.params.time).toBe(8 + CAREER_TUNING.baseExtraDays + 5 * CAREER_TUNING.extraDays);
    expect(top.params.regen).toBe(0);
    expect(top.params.harbours).toBe(1);
  });
});

/** A watch in a zone with a single gleaner and nothing else, for exact combat checks. */
function duel(seed = 'duel', power = 250): WatchState {
  const s = structuredClone(watch(1, seed));
  s.outcome = null;
  for (const row of s.cells) row.fill('empty');
  s.harbourCell = null;
  s.worldCell = null;
  s.ship.cell = { row: 5, col: 2 };
  s.cells[5]![2] = 'lantern';
  s.cells[5]![6] = 'gleaner';
  s.gleaners = [{ row: 5, col: 6, power, dist: 4, avgDist: 4, hailed: 0 }];
  const zone = s.zones[s.ship.zone.row]![s.ship.zone.col]!;
  s.now.gleaners = s.now.gleaners - zone.gleaners + 1;
  s.now.reserve = s.now.gleaners * 8;
  zone.gleaners = 1;
  zone.harbour = false;
  zone.world = null;
  zone.layout = { stars: [], holes: [], world: null, harbour: null };
  s.events = [];
  // Hold the gleaner still so combat checks do not depend on its dance.
  s.params.moveChance = [0, 0, 0, 0, 0, 0];
  return s;
}

describe('orders', () => {
  it('never changes the state it is given', () => {
    const s = duel();
    const before = JSON.stringify(s);
    applyOrder(s, { type: 'shield', up: false });
    applyOrder(s, { type: 'flare', bearing: 90 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('refuses beams through a raised shield, as the original did', () => {
    const s = duel();
    const result = applyOrder(s, { type: 'beams', energy: 500 });
    expect(result.accepted).toBe(false);
    expect(result.beats).toEqual([{ type: 'refused', reason: 'shield-up', system: undefined }]);
  });

  it('stretches the clock when a gleaner is stopped', () => {
    let s = duel('clock');
    s = applyOrder(s, { type: 'shield', up: false }).state;
    const reserve = s.now.reserve;
    const result = applyOrder(s, { type: 'beams', energy: sureStopEnergy(s.gleaners[0]!) });
    const after = result.state;
    expect(after.tally.stopped).toBe(1);
    expect(after.now.time).toBeCloseTo(reserve / after.now.gleaners, 6);
    expect(result.beats.some((beat) => beat.type === 'clock' && beat.after > beat.before)).toBe(
      true,
    );
  });

  it('sure-stop energy stops a gleaner even at the worst luck', () => {
    for (let i = 0; i < 30; i++) {
      let s = duel(`sure:${i}`, 400);
      s = applyOrder(s, { type: 'shield', up: false }).state;
      if (s.gleaners.length === 0) continue;
      const result = applyOrder(s, { type: 'beams', energy: sureStopEnergy(s.gleaners[0]!) });
      expect(result.beats.some((beat) => beat.type === 'gleaner-stopped')).toBe(true);
    }
  });

  it('only moors beside a harbour', () => {
    const s = duel();
    expect(applyOrder(s, { type: 'moor' }).beats[0]).toMatchObject({ reason: 'no-harbour-near' });
    const near = structuredClone(s);
    near.cells[4]![2] = 'harbour';
    near.harbourCell = { row: 4, col: 2 };
    const moored = applyOrder(near, { type: 'moor' }).state;
    expect(moored.ship.condition).toBe('moored');
    expect(moored.ship.energy).toBe(moored.params.energy);
  });

  it('ends the watch when asked', () => {
    expect(applyOrder(duel(), { type: 'end-watch' }).state.outcome).toEqual({ kind: 'ended' });
  });
});

describe('flares and courses', () => {
  it('walks a flare cell by cell and stops at the first thing it meets', () => {
    const occupied = (at: { row: number; col: number }) =>
      at.row === 5 && at.col === 6 ? 'gleaner' : 'empty';
    const flight = flarePath({ row: 5, col: 2 }, 90, occupied);
    expect(flight.path).toEqual([
      { row: 5, col: 3 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
    ]);
    expect(flight.end).toBe('gleaner');
    expect(flarePath({ row: 5, col: 2 }, 0, occupied).end).toBe('missed');
  });

  it('computes courses like the original computer: 0 north, 90 east', () => {
    const s = duel();
    const east = courseTo(s, s.ship.zone, { row: 5, col: 6 });
    expect(east.bearing).toBe(90);
    expect(east.distance).toBeCloseTo(0.4, 9);
    expect(courseTo(s, s.ship.zone, { row: 1, col: 2 }).bearing).toBe(0);
    expect(courseTo(s, s.ship.zone, { row: 9, col: 2 }).bearing).toBe(180);
  });

  it('finds a clear line out of a zone when the obvious one is blocked', () => {
    const s = duel();
    s.cells[5]![3] = 'star';
    const east = { row: s.ship.zone.row, col: Math.min(7, s.ship.zone.col + 1) };
    if (east.col === s.ship.zone.col) return;
    const course = clearCourseTo(s, east)!;
    expect(plotCourse(s, course).blockedBy).toBeNull();
  });
});

describe('the living Reach', () => {
  it('turns unanswered calls into dark worlds that grow the swarm', () => {
    let grew = false;
    let fell = false;
    for (let i = 0; i < 12 && !(grew && fell); i++) {
      let s = watch(2, `calls:${i}`);
      for (let step = 0; step < 40 && !s.outcome; step++) {
        const result = applyOrder(s, { type: 'rest', days: 0.5 });
        if (result.beats.some((b) => b.type === 'world-fell')) fell = true;
        if (result.beats.some((b) => b.type === 'swarm-grew')) grew = true;
        s = result.state;
      }
    }
    expect(fell).toBe(true);
    expect(grew).toBe(true);
  });

  it('lists only the calls the crew has heard', () => {
    const s = duel();
    s.events.push(
      {
        id: 90,
        kind: 'world-falls',
        date: s.now.date + 2,
        zone: { row: 1, col: 1 },
        world: 3,
        system: null,
        hidden: false,
        ghost: false,
      },
      {
        id: 91,
        kind: 'world-falls',
        date: s.now.date + 1,
        zone: { row: 2, col: 2 },
        world: 4,
        system: null,
        hidden: true,
        ghost: false,
      },
    );
    expect(knownCalls(s).map((call) => call.world)).toEqual([3]);
  });

  it('keeps a light looking lit while its call is unheard, and shows the truth at the end', () => {
    const s = duel();
    const zone = s.zones.flat().find((z) => z.world !== null)!;
    const at = s.zones
      .flatMap((row, r) => row.map((z, c) => ({ z, r, c })))
      .find((x) => x.z === zone)!;
    s.events.push({
      id: 77,
      kind: 'swarm-grows',
      date: s.now.date + 1,
      zone: { row: at.r, col: at.c },
      world: zone.world,
      system: null,
      hidden: true,
      ghost: false,
    });
    zone.distress = 77;
    const known = lights(s).find((light) => light.world === zone.world)!;
    const truth = lights(s, true).find((light) => light.world === zone.world)!;
    expect(known.state).toBe('lit');
    expect(truth.state).toBe('dark');
  });
});

describe('the score sheet and promotion', () => {
  it('follows the original’s lines and needs a clean win worth 1,000', () => {
    const s = duel();
    s.outcome = { kind: 'won' };
    s.tally.stopped = 12;
    s.now.gleaners = 0;
    s.now.date = s.params.date + 4;
    const sheet = scoreSheet(s);
    expect(sheet.lines.find((line) => line.id === 'stopped')!.points).toBe(
      Math.trunc(s.params.gleanerPower / 4) * 12,
    );
    expect(sheet.lines.find((line) => line.id === 'pace')!.points).toBe(1200);
    expect(earnsPromotion(s)).toBe(true);
    s.tally.beaconCalls = 1;
    expect(cleanRecord(s).noBeacon).toBe(false);
    expect(earnsPromotion(s)).toBe(false);
  });
});

describe('the beam suggestion', () => {
  it('stops every gleaner in the zone at any even luck', () => {
    for (const [power, spread] of [
      [250, 2],
      [550, 3],
      [700, 4],
    ] as const) {
      const s = duel(`beams:${power}`, power);
      s.gleaners = [
        { row: 5, col: 4, power, dist: 0, avgDist: 0, hailed: 0 },
        { row: 5 - spread, col: 6, power, dist: 0, avgDist: 0, hailed: 0 },
        { row: 9, col: 9, power: power / 2, dist: 0, avgDist: 0, hailed: 0 },
      ];
      for (const g of s.gleaners)
        g.dist = Math.hypot(g.row - s.ship.cell.row, g.col - s.ship.cell.col);
      s.gleaners.sort((a, b) => a.dist - b.dist);
      const energy = suggestedBeamEnergy(s);
      expect(energy).toBeLessThan(s.ship.energy);
      for (const luck of [0, 0.5, 1]) {
        expect(previewBeams(s, energy, luck).targets.every((t) => t.stopped)).toBe(true);
      }
    }
  });
});
