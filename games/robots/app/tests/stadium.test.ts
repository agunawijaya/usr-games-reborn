import { describe, expect, it } from 'vitest';
import {
  AX, AZ, BACK_ROWS, FRONT_ROWS, isThrower, ringStations, rowTop, seats, THROW_SHARE, THROW_SPAN, throwDelay,
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

  it('about THROW_SHARE of the crowd throws, each within THROW_SPAN seconds', () => {
    const throwers = all.filter((s) => isThrower(s.seed));
    const share = throwers.length / all.length;
    expect(share).toBeGreaterThan(THROW_SHARE * 0.6);
    expect(share).toBeLessThan(THROW_SHARE * 1.4);
    for (const s of throwers) {
      expect(throwDelay(s.seed)).toBeGreaterThanOrEqual(0);
      expect(throwDelay(s.seed)).toBeLessThan(THROW_SPAN);
    }
  });

  it('is the same every time (the crowd shader and the rubbish agree on who throws)', () => {
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

  it('boos and starts throwing when you lose, and stops celebrating', () => {
    resetCrowd();
    crowdEvent({ type: 'levelClear', level: 1 });
    crowdEvent({ type: 'death', at });
    expect(crowd.boo).toBe(1);
    expect(crowd.celebrate).toBe(0);
    expect(crowd.throwT0).toBeGreaterThan(-1e8);
  });
});
