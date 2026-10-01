import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../storage/storage';
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  type EnvironmentPreferences,
  fixedPreferences,
  paletteOf,
  sanitizeSettings,
} from './settings';

function switchableEnvironment() {
  let dark = false;
  let reduced = false;
  const listeners = new Set<() => void>();
  const env: EnvironmentPreferences = {
    prefersDark: () => dark,
    prefersReducedMotion: () => reduced,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    env,
    set(next: { dark?: boolean; reduced?: boolean }) {
      dark = next.dark ?? dark;
      reduced = next.reduced ?? reduced;
      for (const listener of listeners) listener();
    },
  };
}

describe('settings store', () => {
  it('starts quiet, on system appearance and system motion', () => {
    const store = createSettingsStore({
      storage: memoryStorage(),
      environment: fixedPreferences(),
    });
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(store.get().volume).toBeLessThan(0.5);
  });

  it('persists changes across stores sharing storage', () => {
    const storage = memoryStorage();
    const first = createSettingsStore({ storage, environment: fixedPreferences() });
    first.update({ theme: 'sunset', appearance: 'dark', volume: 0.8 });
    const second = createSettingsStore({ storage, environment: fixedPreferences() });
    expect(second.get()).toMatchObject({ theme: 'sunset', appearance: 'dark', volume: 0.8 });
  });

  it('follows the OS while set to system and ignores it otherwise', () => {
    const { env, set } = switchableEnvironment();
    const store = createSettingsStore({ storage: memoryStorage(), environment: env });
    const seen: string[] = [];
    store.subscribe((state) => seen.push(`${state.appearance}/${state.reducedMotion}`));

    set({ dark: true });
    set({ reduced: true });
    store.update({ appearance: 'light', motion: 'full' });
    expect(store.resolved()).toMatchObject({ appearance: 'light', reducedMotion: false });
    expect(seen).toEqual(['dark/false', 'dark/true', 'light/false']);
  });

  it('resets to defaults', () => {
    const store = createSettingsStore({
      storage: memoryStorage(),
      environment: fixedPreferences(),
    });
    store.update({ muted: true, colorBlindPalette: true });
    expect(store.reset()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('sanitizeSettings', () => {
  it('keeps valid fields, clamps volume and drops garbage', () => {
    expect(
      sanitizeSettings({
        theme: 'manual',
        volume: 7,
        appearance: 'purple',
        muted: 'yes',
        extra: 1,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, theme: 'manual', volume: 1 });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('styles', () => {
  it('starts new players on Console Home and keeps version 1 players in the Machine Room', () => {
    expect(DEFAULT_SETTINGS.style).toBe('console');
    const storage = memoryStorage({
      'usr-games:hall:settings': JSON.stringify({ v: 1, savedAt: '', data: { theme: 'sunset' } }),
    });
    const store = createSettingsStore({ storage, environment: fixedPreferences() });
    expect(store.get()).toMatchObject({ style: 'machine-room', theme: 'sunset' });
  });

  it('paints with the style palette outside the Machine Room', () => {
    expect(paletteOf({ style: 'machine-room', theme: 'manual' })).toBe('manual');
    expect(paletteOf({ style: 'console', theme: 'manual' })).toBe('console');
    expect(paletteOf({ style: 'holo', theme: 'phosphor' })).toBe('holo');
    expect(sanitizeSettings({ style: 'arcade' }).style).toBe('console');
  });
});
