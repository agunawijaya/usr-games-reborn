import { describe, expect, it } from 'vitest';
import type { GameManifest } from '@usr-games/kit/manifest';
import { emptyProgression, HALL_PACKAGES, rankById } from '@usr-games/kit/progression';
import type { CatalogEntry } from '../../catalog/catalog';
import {
  achievementGroups,
  closetDistance,
  gamesPlayed,
  recentlyEarned,
  skinChoices,
  upNext,
} from './profile-model';

function entry(id: string, packages: GameManifest['packages'] = []): CatalogEntry {
  const manifest = {
    id,
    title: id.toUpperCase(),
    category: 'arcade',
    status: 'shipped',
    packages,
  } as unknown as GameManifest;
  return { manifest, source: 'placeholder', playPath: `play/${id}/` };
}

const ROBOTS = entry('robots', [
  { id: 'first-wave', title: 'First wave', description: 'Clear a wave.', tier: 'core' },
  { id: 'pile-up', title: 'Pile-up', description: 'Crash three.', tier: 'extra' },
  { id: 'secret', title: 'Hidden', description: 'Shh.', tier: 'rare', hidden: true },
]);
const SAIL = entry('sail', [
  { id: 'prize', title: 'Prize crew', description: 'Capture a ship.', tier: 'rare' },
]);

function playedRobots() {
  const state = emptyProgression();
  state.games.robots = {
    category: 'arcade',
    sessions: 4,
    completed: 4,
    wins: 3,
    losses: 1,
    draws: 0,
    bestScore: 900,
    totalSeconds: 600,
    dailies: 0,
    firstPlayed: '2026-09-01',
    lastPlayed: '2026-09-20',
    counters: {},
  };
  state.packages['robots/first-wave'] = { installedOn: '2026-09-02', xp: 30 };
  state.packages['hall/hello-world'] = { installedOn: '2026-09-01', xp: 30 };
  return state;
}

describe('achievement groups', () => {
  it('puts the Hall first, then each game with achievements, counting what is earned', () => {
    const groups = achievementGroups([ROBOTS, entry('rain'), SAIL], playedRobots());
    expect(groups.map((g) => g.id)).toEqual(['hall', 'robots', 'sail']);
    expect(groups[0]?.items).toHaveLength(HALL_PACKAGES.length);
    expect(groups[1]?.earned).toBe(1);
  });

  it('keeps hidden achievements secret until earned', () => {
    const [, robots] = achievementGroups([ROBOTS], playedRobots());
    const secret = robots?.items.find((item) => item.key === 'robots/secret');
    expect(secret?.title).toBe('A secret');
  });

  it('lists the newest earned first and suggests easy goals from games already played', () => {
    const state = playedRobots();
    const groups = achievementGroups([ROBOTS, SAIL], state);
    expect(recentlyEarned(groups, 5).map(({ item }) => item.key)).toEqual([
      'robots/first-wave',
      'hall/hello-world',
    ]);
    const next = upNext(groups, state, 20).map(({ item }) => item.key);
    expect(next).not.toContain('robots/secret');
    expect(next.indexOf('robots/pile-up')).toBeLessThan(next.indexOf('sail/prize'));
  });
});

describe('the rest of the profile', () => {
  it('lists played games, most played first', () => {
    const rows = gamesPlayed([SAIL, ROBOTS], playedRobots());
    expect(rows.map((row) => row.entry.manifest.id)).toEqual(['robots']);
  });

  it('offers Standard plus four skins, unlocked by level', () => {
    const state = { ...emptyProgression(), xp: rankById('staff').threshold };
    const skins = skinChoices(state);
    expect(skins.map((s) => s.id)).toEqual([
      'default',
      'skin-mint',
      'skin-citrus',
      'skin-aurora',
      'skin-sunset',
    ]);
    expect(skins.filter((s) => s.unlocked).map((s) => s.id)).toEqual([
      'default',
      'skin-mint',
      'skin-citrus',
    ]);
  });

  it('measures the way to the closet and opens it at root', () => {
    expect(closetDistance(emptyProgression())).toMatchObject({ open: false, openingLevel: 40 });
    const root = { ...emptyProgression(), xp: rankById('root').threshold };
    expect(closetDistance(root)).toMatchObject({ open: true, xpToGo: 0, fraction: 1 });
  });
});
