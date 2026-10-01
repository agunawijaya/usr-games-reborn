import { describe, expect, it } from 'vitest';
import type { GameManifest } from '@usr-games/kit/manifest';
import {
  emptyProgression,
  HALL_PACKAGES,
  installGamePackage,
  recordLogin,
} from '@usr-games/kit/progression';
import type { CatalogEntry } from '../../catalog/catalog';
import { albumGroups, albumSlots, recentlyEarned, weekDays } from './model';

const robots = {
  manifest: {
    id: 'robots',
    title: 'Robot chase',
    category: 'arcade',
    packages: [
      { id: 'first-wave', title: 'First wave', description: 'Clear a wave.', tier: 'core' },
      {
        id: 'secret',
        title: 'Secret',
        description: 'Do the hidden thing.',
        tier: 'rare',
        hidden: true,
      },
    ],
  } as unknown as GameManifest,
  source: 'placeholder',
} as CatalogEntry;

const CONTEXT = { today: '2026-10-01', shippedGames: [] };

describe('album slots', () => {
  it('lists the Hall achievements first, in plain words, then each game', () => {
    const slots = albumSlots([robots], emptyProgression());
    expect(slots).toHaveLength(HALL_PACKAGES.length + 2);
    expect(slots[0]?.entry).toBeNull();
    expect(slots.map((s) => s.title)).toContain('First quest');
    expect(slots.map((s) => s.title)).not.toContain('First cron job');
    expect(slots.at(-1)?.description).toBe('A surprise. Keep playing to find out.');
  });

  it('marks earned slots with their date and groups them by game or rarity', () => {
    const definition = robots.manifest.packages![0]!;
    let state = recordLogin(emptyProgression(), CONTEXT).state;
    state = installGamePackage(state, 'robots', definition, CONTEXT).state;
    const slots = albumSlots([robots], state);
    const byGame = albumGroups(slots, 'game');
    expect(byGame.map((g) => g.title)).toEqual(['The Hall', 'Robot chase']);
    expect(byGame[1]).toMatchObject({ earned: 1 });
    expect(albumGroups(slots, 'rarity').map((g) => g.key)).toEqual(['rare', 'extra', 'core']);
    expect(recentlyEarned(slots, 5).map((s) => s.key)).toContain('robots/first-wave');
  });
});

describe('weekDays', () => {
  it('marks the whole week, Monday first, with today and the future', () => {
    const days = weekDays(emptyProgression(), '2026-10-01');
    expect(days.map((d) => d.letter).join('')).toBe('MTWTFSS');
    expect(days.find((d) => d.today)?.day).toBe('2026-10-01');
    expect(days.at(-1)?.mark).toBe('future');
  });
});
