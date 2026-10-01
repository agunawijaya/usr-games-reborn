import { describe, expect, it } from 'vitest';
import { packagesAtTheEnd, packagesInTheAir, type SkyProgress } from './packages';

const quiet: SkyProgress = {
  arenaId: 'old-reliable',
  safe: 0,
  landings: 0,
  longestString: 0,
  lowestLandingFuel: null,
  lettersFlown: 1,
  beaconPasses: 0,
  leftHolds: 0,
};

describe('packages earned in the air', () => {
  it('earns nothing before anything has happened', () => {
    expect(packagesInTheAir(quiet)).toEqual([]);
  });

  it('earns each moment at its threshold', () => {
    expect(packagesInTheAir({ ...quiet, landings: 1, lowestLandingFuel: 9 })).toEqual([
      'first-light',
    ]);
    expect(
      packagesInTheAir({ ...quiet, landings: 3, longestString: 3, lowestLandingFuel: 9 }),
    ).toContain('string-of-pearls');
    expect(packagesInTheAir({ ...quiet, landings: 1, lowestLandingFuel: 2 })).toContain(
      'running-on-fumes',
    );
    expect(packagesInTheAir({ ...quiet, landings: 1, lowestLandingFuel: 3 })).not.toContain(
      'running-on-fumes',
    );
    expect(packagesInTheAir({ ...quiet, beaconPasses: 5 })).toEqual(['beacon-weaver']);
    expect(packagesInTheAir({ ...quiet, leftHolds: 1 })).toEqual(['left-turn-at-last']);
    expect(packagesInTheAir({ ...quiet, lettersFlown: 26 })).toEqual(['alphabet-soup']);
  });

  it('keeps Overdrive to its own arena', () => {
    expect(packagesInTheAir({ ...quiet, safe: 25 })).toEqual([]);
    expect(packagesInTheAir({ ...quiet, arenaId: 'overdrive', safe: 25 })).toEqual([
      'killer-instinct',
    ]);
  });
});

describe('packages earned at the end', () => {
  const plain = {
    starsEarned: null,
    shiftId: null,
    targetMet: false,
    terminalOrders: 0,
    dailiesFlown: 0,
  };

  it('needs all three stars for a clean shift, and the midnight target for the night owl', () => {
    expect(packagesAtTheEnd({ ...plain, starsEarned: 2 })).toEqual([]);
    expect(packagesAtTheEnd({ ...plain, starsEarned: 3 })).toEqual(['clean-shift']);
    expect(packagesAtTheEnd({ ...plain, shiftId: 'tower-at-midnight' })).toEqual([]);
    expect(packagesAtTheEnd({ ...plain, shiftId: 'tower-at-midnight', targetMet: true })).toEqual([
      'night-owl',
    ]);
  });

  it('counts orders typed and dailies flown across skies', () => {
    expect(packagesAtTheEnd({ ...plain, terminalOrders: 50, dailiesFlown: 7 })).toEqual([
      'typist',
      'daily-regular',
    ]);
  });
});
