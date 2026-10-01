import { createSaveSlot, type KeyValueStorage, type SaveSlot } from '../storage/storage';

export type Appearance = 'light' | 'dark';
export type AppearancePreference = Appearance | 'system';
/** The Machine Room's three palettes. */
export type ThemeId = 'phosphor' | 'manual' | 'sunset';
/**
 * A Hall style is a whole way of presenting the collection: the Unix machine room, a console
 * home screen, or a holographic card collection. Every style runs on the same data.
 */
export type StyleId = 'machine-room' | 'console' | 'holo';
/** Every palette the tokens define: the Machine Room's three plus one signature palette per new style. */
export type PaletteId = ThemeId | 'console' | 'holo';
export type MotionPreference = 'system' | 'reduce' | 'full';
export type LanguageId = 'en';

export const THEME_IDS: readonly ThemeId[] = ['phosphor', 'manual', 'sunset'];
/** In the order the style picker offers them; Console Home first as the most familiar. */
export const STYLE_IDS: readonly StyleId[] = ['console', 'holo', 'machine-room'];
export const PALETTE_IDS: readonly PaletteId[] = [
  'phosphor',
  'manual',
  'sunset',
  'console',
  'holo',
];

/** Action id → key codes (KeyboardEvent.code) or pointer/gamepad names, per game id. */
export type BindingOverrides = Record<string, Record<string, string[]>>;

export interface Settings {
  style: StyleId;
  appearance: AppearancePreference;
  /** The Machine Room palette; the other styles each have one signature palette. */
  theme: ThemeId;
  /** Console Home accent skin, a cosmetic id, or `default`. Applied only once unlocked. */
  consoleSkin: string;
  /** Holo Collection foil finish, a cosmetic id, or `default`. Applied only once unlocked. */
  holoFinish: string;
  /** Master volume, 0–1. Sound starts quiet on purpose. */
  volume: number;
  muted: boolean;
  motion: MotionPreference;
  colorBlindPalette: boolean;
  language: LanguageId;
  bindings: BindingOverrides;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  style: 'console',
  appearance: 'system',
  theme: 'phosphor',
  consoleSkin: 'default',
  holoFinish: 'default',
  volume: 0.35,
  muted: false,
  motion: 'system',
  colorBlindPalette: false,
  language: 'en',
  bindings: {},
});

/** What the operating system says; injected so tests and the Hall share one code path. */
export interface EnvironmentPreferences {
  prefersDark(): boolean;
  prefersReducedMotion(): boolean;
  /** Calls back when either OS preference changes; returns an unsubscribe function. */
  onChange(listener: () => void): () => void;
}

export function browserPreferences(): EnvironmentPreferences {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  return {
    prefersDark: () => dark.matches,
    prefersReducedMotion: () => motion.matches,
    onChange(listener) {
      dark.addEventListener('change', listener);
      motion.addEventListener('change', listener);
      return () => {
        dark.removeEventListener('change', listener);
        motion.removeEventListener('change', listener);
      };
    },
  };
}

export function fixedPreferences(dark = false, reducedMotion = false): EnvironmentPreferences {
  return {
    prefersDark: () => dark,
    prefersReducedMotion: () => reducedMotion,
    onChange: () => () => {},
  };
}

/** The palette that paints the Hall right now. */
export function paletteOf(settings: Pick<Settings, 'style' | 'theme'>): PaletteId {
  return settings.style === 'machine-room' ? settings.theme : settings.style;
}

export function resolveAppearance(settings: Settings, env: EnvironmentPreferences): Appearance {
  if (settings.appearance !== 'system') return settings.appearance;
  return env.prefersDark() ? 'dark' : 'light';
}

export function resolveReducedMotion(settings: Settings, env: EnvironmentPreferences): boolean {
  if (settings.motion === 'system') return env.prefersReducedMotion();
  return settings.motion === 'reduce';
}

const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** Keeps whatever is valid from a stored object and fills the rest from defaults. */
export function sanitizeSettings(value: unknown): Settings {
  const input = (typeof value === 'object' && value !== null ? value : {}) as Partial<Settings>;
  const pick = <K extends keyof Settings>(key: K, valid: (v: unknown) => boolean): Settings[K] =>
    valid(input[key]) ? (input[key] as Settings[K]) : DEFAULT_SETTINGS[key];
  const isCosmeticChoice = (v: unknown) => typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v);
  return {
    style: pick('style', (v) => STYLE_IDS.includes(v as StyleId)),
    appearance: pick('appearance', (v) => v === 'light' || v === 'dark' || v === 'system'),
    theme: pick('theme', (v) => THEME_IDS.includes(v as ThemeId)),
    consoleSkin: pick('consoleSkin', isCosmeticChoice),
    holoFinish: pick('holoFinish', isCosmeticChoice),
    volume: typeof input.volume === 'number' ? clampVolume(input.volume) : DEFAULT_SETTINGS.volume,
    muted: pick('muted', (v) => typeof v === 'boolean'),
    motion: pick('motion', (v) => v === 'system' || v === 'reduce' || v === 'full'),
    colorBlindPalette: pick('colorBlindPalette', (v) => typeof v === 'boolean'),
    language: 'en',
    bindings: pick('bindings', (v) => typeof v === 'object' && v !== null && !Array.isArray(v)),
  };
}

export interface ResolvedSettings {
  settings: Settings;
  appearance: Appearance;
  reducedMotion: boolean;
}

export interface SettingsStore {
  get(): Settings;
  resolved(): ResolvedSettings;
  update(patch: Partial<Settings>): Settings;
  reset(): Settings;
  /** Fires on every change, including OS preference changes while `system` is selected. */
  subscribe(listener: (state: ResolvedSettings) => void): () => void;
  dispose(): void;
}

export const SETTINGS_VERSION = 2;

/**
 * Version 2 introduced Hall styles. Anyone with a version 1 save chose their look before styles
 * existed, so they keep the Machine Room they already know; new players start on Console Home.
 */
export const SETTINGS_MIGRATIONS = {
  2: (previous: unknown) => ({ ...(previous as object), style: 'machine-room' }),
};

export function createSettingsStore(options: {
  storage: KeyValueStorage;
  environment: EnvironmentPreferences;
}): SettingsStore {
  const slot: SaveSlot<Settings> = createSaveSlot({
    storage: options.storage,
    scope: 'hall',
    key: 'settings',
    version: SETTINGS_VERSION,
    defaults: () => ({ ...DEFAULT_SETTINGS, bindings: {} }),
    migrations: SETTINGS_MIGRATIONS,
  });
  let current = sanitizeSettings(slot.load());
  const listeners = new Set<(state: ResolvedSettings) => void>();

  const resolved = (): ResolvedSettings => ({
    settings: current,
    appearance: resolveAppearance(current, options.environment),
    reducedMotion: resolveReducedMotion(current, options.environment),
  });

  const notify = () => {
    const state = resolved();
    for (const listener of listeners) listener(state);
  };

  const stopWatchingOs = options.environment.onChange(notify);

  return {
    get: () => current,
    resolved,
    update(patch) {
      current = sanitizeSettings({ ...current, ...patch });
      slot.save(current);
      notify();
      return current;
    },
    reset() {
      current = { ...DEFAULT_SETTINGS, bindings: {} };
      slot.clear();
      notify();
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stopWatchingOs();
      listeners.clear();
    },
  };
}
