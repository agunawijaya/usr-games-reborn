/**
 * Local persistence. Everything the collection stores lives under one prefix so a single
 * "Forget my data" can remove it all, and every value is wrapped in a versioned envelope so
 * old saves migrate forward instead of being thrown away.
 */

export const STORAGE_PREFIX = 'usr-games:';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

/**
 * The browser's localStorage, or memory when it is unavailable (private windows, blocked
 * site data). Play must never crash because a save could not be written.
 */
export function browserStorage(): KeyValueStorage {
  try {
    const probe = `${STORAGE_PREFIX}probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    return memoryStorage();
  }
  const local = window.localStorage;
  return {
    getItem: (key) => local.getItem(key),
    setItem: (key, value) => {
      try {
        local.setItem(key, value);
      } catch (error) {
        console.warn('Could not save; storage is full or blocked.', error);
      }
    },
    removeItem: (key) => local.removeItem(key),
    keys: () => Array.from({ length: local.length }, (_, i) => local.key(i)).filter(isString),
  };
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}

/** Scope is `hall` for the Hall itself or a game id. */
export function storageKey(scope: string, key: string): string {
  return `${STORAGE_PREFIX}${scope}:${key}`;
}

export type Migration = (previous: unknown) => unknown;

export interface SaveSlotOptions<T> {
  storage: KeyValueStorage;
  scope: string;
  key: string;
  version: number;
  defaults: () => T;
  /** `migrations[n]` upgrades data saved at version `n - 1` to version `n`. */
  migrations?: Readonly<Record<number, Migration>>;
  /** Rejects data that parsed but has the wrong shape, falling back to defaults. */
  isValid?: (value: unknown) => value is T;
}

export interface SaveSlot<T> {
  load(): T;
  save(value: T): void;
  update(change: (current: T) => T): T;
  clear(): void;
  readonly storageKey: string;
}

interface Envelope {
  v: number;
  savedAt: string;
  data: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as Envelope).v) &&
    'data' in value
  );
}

export function createSaveSlot<T>(options: SaveSlotOptions<T>): SaveSlot<T> {
  const { storage, version, defaults, migrations = {}, isValid } = options;
  const fullKey = storageKey(options.scope, options.key);

  function migrate(envelope: Envelope): unknown {
    let data = envelope.data;
    for (let next = envelope.v + 1; next <= version; next++) {
      const step = migrations[next];
      if (!step) throw new Error(`No migration to version ${next} for ${fullKey}`);
      data = step(data);
    }
    return data;
  }

  function load(): T {
    const raw = storage.getItem(fullKey);
    if (raw === null) return defaults();
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!isEnvelope(envelope)) return defaults();
      // A save from a newer build: keep it on disk untouched and play with defaults.
      if (envelope.v > version) return defaults();
      const data = migrate(envelope);
      if (isValid && !isValid(data)) return defaults();
      return data as T;
    } catch (error) {
      console.warn(`Ignoring an unreadable save at ${fullKey}.`, error);
      return defaults();
    }
  }

  function save(value: T): void {
    const envelope: Envelope = { v: version, savedAt: new Date().toISOString(), data: value };
    storage.setItem(fullKey, JSON.stringify(envelope));
  }

  return {
    load,
    save,
    update(change) {
      const next = change(load());
      save(next);
      return next;
    },
    clear: () => storage.removeItem(fullKey),
    storageKey: fullKey,
  };
}

/** Removes every key the collection ever wrote, Hall and games alike. Returns how many. */
export function forgetAllData(storage: KeyValueStorage): number {
  const ours = storage.keys().filter((key) => key.startsWith(STORAGE_PREFIX));
  for (const key of ours) storage.removeItem(key);
  return ours.length;
}

/** Removes one game's keys only. */
export function forgetScope(storage: KeyValueStorage, scope: string): number {
  const prefix = `${STORAGE_PREFIX}${scope}:`;
  const keys = storage.keys().filter((key) => key.startsWith(prefix));
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}
