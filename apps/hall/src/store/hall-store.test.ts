import { describe, expect, it } from 'vitest';
import { fixedPreferences, memoryStorage } from '@usr-games/kit';
import { loadCatalog } from '../catalog/catalog';
import { createHallStore } from './hall-store';

function freshStore() {
  const storage = memoryStorage();
  const store = createHallStore({
    storage,
    environment: fixedPreferences(false, false),
    catalog: loadCatalog({ fixtures: false }),
    clock: () => new Date(2026, 9, 1, 20, 0),
  });
  return { storage, store };
}

describe('Forget my data', () => {
  it('leaves nothing behind, even when the default style was never seen', () => {
    const { storage, store } = freshStore();
    // A player who chose Holo before signing in has never looked at Console Home, the default
    // that the reset brings back.
    store.settings.update({ style: 'holo' });
    store.login('ada');
    store.chooseStyle('holo');
    expect(store.snapshot().progression.hall.stylesSeen).toEqual(['holo']);

    store.forgetEverything();

    expect(storage.keys().filter((key) => key.startsWith('usr-games:'))).toEqual([]);
    expect(store.snapshot().profile.username).toBeNull();
    expect(store.snapshot().progression.xp).toBe(0);
    expect(store.snapshot().settings.style).toBe('console');
  });
});
