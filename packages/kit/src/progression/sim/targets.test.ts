import { describe, expect, it } from 'vitest';
import { PLANNED_COLLECTION } from './collection';
import { BOT_PROFILES, MARATHON_PROFILE, runMany, summarise } from './simulate';

/**
 * The balance targets from the foundation brief, locked with tolerances. If a rule or
 * threshold change moves a median outside its band, this fails and NOTES-progression.md
 * needs a fresh `pnpm sim` run and a deliberate decision.
 */
const RUNS = 24;
const DAYS = 90;

describe('progression targets on the full planned collection', () => {
  const casual = runMany(BOT_PROFILES.casual, RUNS, DAYS, PLANNED_COLLECTION);
  const regular = runMany(BOT_PROFILES.regular, RUNS, DAYS, PLANNED_COLLECTION);
  const enthusiast = runMany(BOT_PROFILES.enthusiast, RUNS, DAYS, PLANNED_COLLECTION);

  it('casual (15 min/day, 3 games) reaches user on day 1', () => {
    const user = summarise(casual, 'user');
    expect(user.reached).toBe(RUNS);
    expect(user.p90).toBe(1);
  });

  it('casual reaches staff in about two weeks (median 11–17 days)', () => {
    const staff = summarise(casual, 'staff');
    expect(staff.median).toBeGreaterThanOrEqual(11);
    expect(staff.median).toBeLessThanOrEqual(17);
  });

  it('regular (45 min/day, 6 games) reaches wheel in about five weeks (median 30–40 days)', () => {
    const wheel = summarise(regular, 'wheel');
    expect(wheel.median).toBeGreaterThanOrEqual(30);
    expect(wheel.median).toBeLessThanOrEqual(40);
  });

  it('enthusiast (2 h/day, everything) reaches root in about eight weeks (median 50–62 days)', () => {
    const root = summarise(enthusiast, 'root');
    expect(root.reached).toBe(RUNS);
    expect(root.median).toBeGreaterThanOrEqual(50);
    expect(root.median).toBeLessThanOrEqual(62);
  });

  it('never lets anyone reach root in under three weeks, even six hours a day', () => {
    expect(summarise(enthusiast, 'root').min).toBeGreaterThanOrEqual(21);
    const marathon = runMany(MARATHON_PROFILE, 8, 40, PLANNED_COLLECTION);
    const fastest = summarise(marathon, 'root').min;
    expect(fastest === null || fastest >= 21).toBe(true);
  });
});
