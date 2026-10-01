import { describe, expect, it } from 'vitest';
import { formatRoute, parseRoute, type Route } from './router';

describe('hash routes', () => {
  const routes: [string, Route][] = [
    ['#/', { name: 'home', dir: null, sort: 'recommended' }],
    ['#/games/cards', { name: 'home', dir: 'cards', sort: 'recommended' }],
    ['#/games/cards?sort=az', { name: 'home', dir: 'cards', sort: 'az' }],
    ['#/?sort=recent', { name: 'home', dir: null, sort: 'recent' }],
    ['#/man/atc', { name: 'man', id: 'atc' }],
    ['#/run/robots', { name: 'run', id: 'robots' }],
    ['#/home', { name: 'profile' }],
    ['#/settings', { name: 'settings' }],
    ['#/closet', { name: 'closet' }],
  ];

  it('parses and formats symmetrically', () => {
    for (const [hash, route] of routes) {
      expect(parseRoute(hash)).toEqual(route);
      expect(formatRoute(route)).toBe(hash);
    }
  });

  it('falls back to Home for anything unknown', () => {
    expect(parseRoute('')).toEqual({ name: 'home', dir: null, sort: 'recommended' });
    expect(parseRoute('#/nowhere')).toEqual({ name: 'home', dir: null, sort: 'recommended' });
    expect(parseRoute('#/games/space')).toEqual({ name: 'home', dir: null, sort: 'recommended' });
    expect(parseRoute('#/games/cards?sort=chaos')).toEqual({
      name: 'home',
      dir: 'cards',
      sort: 'recommended',
    });
  });
});
