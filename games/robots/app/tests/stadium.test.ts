import { describe, expect, it } from 'vitest';
import {
  AX, AZ, BACK_ROWS, FRONT_ROWS, ringStations, rowTop, seats,
} from '../src/scene/stadiumLayout';
import { crowd, crowdEvent, resetCrowd } from '../src/fx/crowd';

describe('stadium layout', () => {
  const all = seats();

  it('the ring closes and stays outside the arena and its lip', () => {
    const ring = ringStations();
    expect(ring[0].x).toBeCloseTo(ring[ring.length - 1].x);
    expect(ring[0].z).toBeCloseTo(ring[ring.length - 1].z);
    for (const s of ring) expect(Math.abs(s.x) > AX || Math.abs(s.z) > AZ).toBe(true);
  });

  it('seats a crowd of a stadium size, none of them inside the arena', () => {
    expect(all.length).toBeGreaterThan(1500);
    for (const s of all) expect(Math.abs(s.x) > AX || Math.abs(s.z) > AZ).toBe(true);
  });

  it('everyone faces the arena', () => {
    for (const s of all.filter((_, i) => i % 7 === 0)) {
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw); // local +z after the yaw
      expect(fx * -s.x + fz * -s.z).toBeGreaterThan(0);
    }
  });

  it('the front (camera-side) stands are low and the back stand is tall', () => {
    // camera looks from +x,+z: seats on that side stay in the first rows
    const front = all.filter((s) => s.x > AX + 1 && s.z > -AZ && s.z < AZ);
    const back = all.filter((s) => s.x < -AX - 1 && s.z > -AZ && s.z < AZ);
    expect(Math.max(...front.map((s) => s.row))).toBe(FRONT_ROWS - 1);
    expect(Math.max(...back.map((s) => s.row))).toBe(BACK_ROWS - 1);
    expect(Math.max(...front.map((s) => s.y))).toBeCloseTo(rowTop(FRONT_ROWS - 1));
  });

  it('is the same every time', () => {
    expect(seats().map((s) => s.seed)).toEqual(all.map((s) => s.seed));
  });
});

describe('crowd mood', () => {
  const at = { x: 1, y: 1 };

  it('cheers crashes, harder along a chain, and starts a wave at four', () => {
    resetCrowd();
    crowd.excite = 0;
    crowdEvent({ type: 'impact', at, count: 2, onPile: false, chain: 1 });
    const one = crowd.excite;
    crowdEvent({ type: 'impact', at, count: 2, onPile: false, chain: 4 });
    expect(crowd.excite).toBeGreaterThan(one);
    expect(crowd.waveUntil).toBeGreaterThan(0);
  });

  it('celebrates a cleared level with fireworks until the next level starts', () => {
    resetCrowd();
    crowdEvent({ type: 'levelClear', level: 1 });
    expect(crowd.celebrate).toBe(1);
    expect(crowd.fireworks).toBe(true);
    crowdEvent({ type: 'levelStart', level: 2, robots: 20 });
    expect(crowd.celebrate).toBe(0);
    expect(crowd.fireworks).toBe(false);
  });

  it('rises to applaud the run when you are caught, and stops the fireworks', () => {
    resetCrowd();
    crowdEvent({ type: 'levelClear', level: 1 });
    crowdEvent({ type: 'death', at });
    expect(crowd.ovation).toBe(1);
    expect(crowd.celebrate).toBe(0);
    expect(crowd.fireworks).toBe(false);
    expect(crowd.waveUntil).toBeGreaterThan(0);
  });
});
