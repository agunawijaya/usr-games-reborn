import { describe, expect, it } from 'vitest';
import { HOME, type Route } from '../router';
import type { HallSnapshot } from '../store/hall-store';
import { firstVisitStep, mountKeyFor } from './style-host';

function snapshotWith(profile: Partial<HallSnapshot['profile']>): HallSnapshot {
  return {
    profile: {
      username: null,
      guest: false,
      createdOn: null,
      hintsSeen: [],
      styleChosen: false,
      ...profile,
    },
  } as HallSnapshot;
}

const LOGIN: Route = { name: 'login' };
const WELCOME: Route = { name: 'welcome' };

describe('the first visit', () => {
  it('sends a stranger to the login from anywhere, and lets them stay there', () => {
    const stranger = snapshotWith({});
    expect(firstVisitStep(stranger, HOME)).toEqual(LOGIN);
    expect(firstVisitStep(stranger, { name: 'man', id: 'atc' })).toEqual(LOGIN);
    expect(firstVisitStep(stranger, LOGIN)).toBeNull();
  });

  it('asks a signed-in player to pick a style before anything else', () => {
    const named = snapshotWith({ username: 'ada' });
    expect(firstVisitStep(named, HOME)).toEqual(WELCOME);
    expect(firstVisitStep(named, LOGIN)).toEqual(WELCOME);
    expect(firstVisitStep(snapshotWith({ guest: true }), WELCOME)).toBeNull();
  });

  it('is over once a style is chosen, and the login then leads Home', () => {
    const settled = snapshotWith({ username: 'ada', styleChosen: true });
    expect(firstVisitStep(settled, HOME)).toBeNull();
    expect(firstVisitStep(settled, WELCOME)).toBeNull();
    expect(firstVisitStep(settled, LOGIN)).toEqual(HOME);
  });
});

describe('what mounts for a route', () => {
  it('uses the full-page screens for login, picker and player, and the style elsewhere', () => {
    expect(mountKeyFor(LOGIN, 'holo')).toBe('login');
    expect(mountKeyFor(WELCOME, 'holo')).toBe('picker');
    expect(mountKeyFor({ name: 'run', id: 'atc' }, 'holo')).toBe('player');
    expect(mountKeyFor(HOME, 'holo')).toBe('holo');
  });
});
