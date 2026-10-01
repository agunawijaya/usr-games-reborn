import { beforeEach, describe, expect, it } from 'vitest';
import { after, clearScheduled, slowMotion, stepClock, vclock } from '../src/fx/clock';

beforeEach(() => {
  clearScheduled();
  Object.assign(vclock, { t: 0, scale: 1, target: 1, slowUntil: 0, manual: false });
});

const run = (seconds: number, dt = 1 / 60) => { for (let s = 0; s < seconds - 1e-9; s += dt) stepClock(dt); };

describe('visual clock', () => {
  it('runs a scheduled moment once its visual time has passed', () => {
    const hits: number[] = [];
    after(0.2, () => hits.push(vclock.t));
    run(0.15);
    expect(hits).toEqual([]);
    run(0.1);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toBeGreaterThanOrEqual(0.2);
    run(1);
    expect(hits).toHaveLength(1);
  });

  it('keeps a crash in step with slow motion: it lands later in real time', () => {
    let landedAtReal = -1, real = 0;
    slowMotion(0.3, 1);
    after(0.2, () => { landedAtReal = real; });
    for (let i = 0; i < 120 && landedAtReal < 0; i++) { stepClock(1 / 60); real += 1 / 60; }
    expect(landedAtReal).toBeGreaterThan(0.5);
  });

  it('runs moments in time order and forgets them on clearScheduled', () => {
    const order: string[] = [];
    after(0.3, () => order.push('b'));
    after(0.1, () => order.push('a'));
    after(0.5, () => order.push('never'));
    run(0.4);
    clearScheduled();
    run(1);
    expect(order).toEqual(['a', 'b']);
  });

  it('comes back to full speed after the slow stretch', () => {
    slowMotion(0.3, 0.2);
    run(0.1);
    expect(vclock.scale).toBeLessThan(0.5);
    run(3);
    expect(vclock.scale).toBeGreaterThan(0.95);
  });
});
