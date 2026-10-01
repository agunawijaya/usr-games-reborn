import { describe, expect, it, vi } from 'vitest';
import { createSaveSlot, forgetAllData, forgetScope, memoryStorage, storageKey } from './storage';

interface ScoreV2 {
  best: number;
  plays: number;
}

function isScore(value: unknown): value is ScoreV2 {
  return typeof value === 'object' && value !== null && 'best' in value && 'plays' in value;
}

describe('createSaveSlot', () => {
  it('returns defaults when nothing is stored and round-trips saves', () => {
    const slot = createSaveSlot({
      storage: memoryStorage(),
      scope: 'atc',
      key: 'score',
      version: 1,
      defaults: () => ({ best: 0 }),
    });
    expect(slot.load()).toEqual({ best: 0 });
    slot.save({ best: 12 });
    expect(slot.load()).toEqual({ best: 12 });
    expect(slot.update((s) => ({ best: s.best + 1 }))).toEqual({ best: 13 });
  });

  it('migrates old saves step by step', () => {
    const storage = memoryStorage({
      [storageKey('atc', 'score')]: JSON.stringify({ v: 1, savedAt: '', data: { best: 7 } }),
    });
    const slot = createSaveSlot<ScoreV2>({
      storage,
      scope: 'atc',
      key: 'score',
      version: 2,
      defaults: () => ({ best: 0, plays: 0 }),
      migrations: { 2: (old) => ({ ...(old as { best: number }), plays: 1 }) },
      isValid: isScore,
    });
    expect(slot.load()).toEqual({ best: 7, plays: 1 });
  });

  it('falls back to defaults for corrupt, invalid or future saves without deleting them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const key = storageKey('hall', 'profile');
    const storage = memoryStorage({ [key]: '{not json' });
    const slot = createSaveSlot({
      storage,
      scope: 'hall',
      key: 'profile',
      version: 1,
      defaults: () => ({ name: 'guest' }),
      isValid: (v): v is { name: string } => typeof (v as { name?: unknown }).name === 'string',
    });
    expect(slot.load()).toEqual({ name: 'guest' });

    storage.setItem(key, JSON.stringify({ v: 1, savedAt: '', data: { name: 42 } }));
    expect(slot.load()).toEqual({ name: 'guest' });

    storage.setItem(key, JSON.stringify({ v: 9, savedAt: '', data: { name: 'from-the-future' } }));
    expect(slot.load()).toEqual({ name: 'guest' });
    expect(storage.getItem(key)).toContain('from-the-future');
    warn.mockRestore();
  });
});

describe('forgetting data', () => {
  it('removes every collection key and nothing else', () => {
    const storage = memoryStorage({
      [storageKey('hall', 'profile')]: '{}',
      [storageKey('atc', 'score')]: '{}',
      'someone-else': 'keep me',
    });
    expect(forgetAllData(storage)).toBe(2);
    expect(storage.keys()).toEqual(['someone-else']);
  });

  it('can forget a single game', () => {
    const storage = memoryStorage({
      [storageKey('hall', 'profile')]: '{}',
      [storageKey('atc', 'score')]: '{}',
      [storageKey('atc', 'settings')]: '{}',
    });
    expect(forgetScope(storage, 'atc')).toBe(2);
    expect(storage.keys()).toEqual([storageKey('hall', 'profile')]);
  });
});
