import {
  type Appearance,
  createSaveSlot,
  createSettingsStore,
  type DateKey,
  type EnvironmentPreferences,
  forgetAllData,
  type GameResult,
  type KeyValueStorage,
  localDateKey,
  type SaveSlot,
  type Settings,
  type SettingsStore,
  type StyleId,
} from '@usr-games/kit';
import type { GameManifest } from '@usr-games/kit/manifest';
import {
  acknowledgeRank,
  applyResult,
  emptyProgression,
  type EngineContext,
  type GameInfo,
  installGamePackage,
  isProgressionState,
  PROGRESSION_MIGRATIONS,
  PROGRESSION_VERSION,
  type ProgressionState,
  type ProgressionUpdate,
  recordLogin,
  recordManPageRead,
  recordStyleSeen,
  recordThemeSeen,
  syncWeek,
} from '@usr-games/kit/progression';
import type { Catalog } from '../catalog/catalog';

/**
 * The Hall's single source of truth: settings, the player's profile and their progression,
 * each persisted through a versioned kit save slot. Screens read snapshots and call actions;
 * nothing else writes to storage.
 */

export interface Profile {
  username: string | null;
  guest: boolean;
  createdOn: DateKey | null;
  /** First-visit hints already shown, so each appears once. */
  hintsSeen: string[];
  /** Whether the player has picked a Hall style; until then the first visit shows the picker. */
  styleChosen: boolean;
}

export interface HallSnapshot {
  settings: Settings;
  appearance: Appearance;
  reducedMotion: boolean;
  profile: Profile;
  progression: ProgressionState;
  today: DateKey;
  now: Date;
}

export type ChangeKind = 'settings' | 'profile' | 'progression' | 'clock' | 'reset';

export interface HallStore {
  catalog: Catalog;
  settings: SettingsStore;
  /** Where every save lives; games get slots scoped to their id (kit createSaveSlot). */
  storage: KeyValueStorage;
  snapshot(): HallSnapshot;
  subscribe(listener: (snapshot: HallSnapshot, change: ChangeKind) => void): () => void;
  /** The most recent progression update, for receipts, toasts and the rank-up moment. */
  lastUpdate(): ProgressionUpdate | null;
  login(username: string | null): void;
  /** The first-visit (or Settings) choice of Hall style. */
  chooseStyle(style: StyleId): void;
  markHintSeen(hint: string): void;
  reportResult(gameId: string, result: GameResult): ProgressionUpdate;
  installPackage(gameId: string, packageId: string): ProgressionUpdate | null;
  readManPage(gameId: string): void;
  acknowledgeRank(): void;
  forgetEverything(): void;
  gameInfo(manifest: GameManifest): GameInfo;
  homeDirectory(): string;
}

export const EMPTY_PROFILE: Profile = {
  username: null,
  guest: false,
  createdOn: null,
  hintsSeen: [],
  styleChosen: false,
};

function isProfile(value: unknown): value is Profile {
  const v = value as Profile;
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray(v.hintsSeen) &&
    typeof v.guest === 'boolean' &&
    typeof v.styleChosen === 'boolean'
  );
}

export function toGameInfo(manifest: GameManifest): GameInfo {
  return {
    id: manifest.id,
    title: manifest.title,
    category: manifest.category,
    sessionMinutes: manifest.sessionMinutes,
    daily: manifest.daily,
    ...(manifest.cronGoals ? { cronGoals: manifest.cronGoals } : {}),
  };
}

/** Notes the style the player is looking at, and the Machine Room palette when it is that one. */
function recordLook(
  state: ProgressionState,
  settings: Settings,
  context: EngineContext,
): ProgressionUpdate {
  const styled = recordStyleSeen(state, settings.style, context);
  if (settings.style !== 'machine-room') return styled;
  return combineUpdates(styled, recordThemeSeen(styled.state, settings.theme, context));
}

/** Two consecutive updates as one receipt: the second's state, both sets of lines. */
function combineUpdates(first: ProgressionUpdate, second: ProgressionUpdate): ProgressionUpdate {
  return {
    state: second.state,
    xpGained: first.xpGained + second.xpGained,
    lines: [...first.lines, ...second.lines],
    packagesInstalled: [...first.packagesInstalled, ...second.packagesInstalled],
    cronCompleted: [...first.cronCompleted, ...second.cronCompleted],
    rankBefore: first.rankBefore,
    rankAfter: second.rankAfter,
  };
}

export function createHallStore(options: {
  storage: KeyValueStorage;
  environment: EnvironmentPreferences;
  catalog: Catalog;
  clock?: () => Date;
}): HallStore {
  const { storage, catalog } = options;
  const clock = options.clock ?? (() => new Date());
  const settings = createSettingsStore({ storage, environment: options.environment });
  const profileSlot: SaveSlot<Profile> = createSaveSlot({
    storage,
    scope: 'hall',
    key: 'profile',
    version: 2,
    defaults: () => ({ ...EMPTY_PROFILE, hintsSeen: [] }),
    // Version 2 added the style picker; earlier players have not seen it yet.
    migrations: { 2: (previous) => ({ ...(previous as object), styleChosen: false }) },
    isValid: isProfile,
  });
  const progressionSlot: SaveSlot<ProgressionState> = createSaveSlot({
    storage,
    scope: 'hall',
    key: 'progression',
    version: PROGRESSION_VERSION,
    migrations: PROGRESSION_MIGRATIONS,
    defaults: emptyProgression,
    isValid: isProgressionState,
  });

  let profile = profileSlot.load();
  let progression = progressionSlot.load();
  let lastUpdate: ProgressionUpdate | null = null;
  const listeners = new Set<(snapshot: HallSnapshot, change: ChangeKind) => void>();

  const engineContext = (): EngineContext => ({
    today: localDateKey(clock()),
    shippedGames: catalog.shipped().map((entry) => toGameInfo(entry.manifest)),
  });

  const snapshot = (): HallSnapshot => {
    const resolved = settings.resolved();
    const now = clock();
    return {
      settings: resolved.settings,
      appearance: resolved.appearance,
      reducedMotion: resolved.reducedMotion,
      profile,
      progression,
      today: localDateKey(now),
      now,
    };
  };

  const emit = (change: ChangeKind) => {
    const current = snapshot();
    for (const listener of listeners) listener(current, change);
  };

  const commitProgression = (update: ProgressionUpdate) => {
    progression = update.state;
    progressionSlot.save(progression);
    lastUpdate = update;
    emit('progression');
    return update;
  };

  const commitProfile = (next: Profile) => {
    profile = next;
    profileSlot.save(profile);
    emit('profile');
  };

  // The crontab for this week exists as soon as the Hall opens, not only after the first game.
  progression = syncWeek(progression, engineContext());
  settings.subscribe(() => {
    if (profile.username !== null || profile.guest) {
      const update = recordLook(progression, settings.get(), engineContext());
      if (update.state !== progression) {
        progression = update.state;
        progressionSlot.save(progression);
        if (update.xpGained > 0) lastUpdate = update;
      }
    }
    emit('settings');
  });

  return {
    catalog,
    settings,
    storage,
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    lastUpdate: () => lastUpdate,
    login(username) {
      commitProfile({
        ...profile,
        username,
        guest: username === null,
        createdOn: profile.createdOn ?? localDateKey(clock()),
      });
      const context = engineContext();
      const loggedIn = recordLogin(progression, context);
      commitProgression(
        combineUpdates(loggedIn, recordLook(loggedIn.state, settings.get(), context)),
      );
    },
    chooseStyle(style) {
      settings.update({ style });
      if (!profile.styleChosen) commitProfile({ ...profile, styleChosen: true });
    },
    markHintSeen(hint) {
      if (!profile.hintsSeen.includes(hint))
        commitProfile({ ...profile, hintsSeen: [...profile.hintsSeen, hint] });
    },
    reportResult(gameId, result) {
      const entry = catalog.byId(gameId);
      if (!entry) throw new Error(`Unknown game: ${gameId}`);
      return commitProgression(
        applyResult(progression, toGameInfo(entry.manifest), result, engineContext()),
      );
    },
    installPackage(gameId, packageId) {
      const definition = catalog.byId(gameId)?.manifest.packages?.find((p) => p.id === packageId);
      if (!definition) return null;
      return commitProgression(
        installGamePackage(progression, gameId, definition, engineContext()),
      );
    },
    readManPage(gameId) {
      const update = recordManPageRead(progression, gameId, engineContext());
      if (update.state.hall.manPagesRead.length !== progression.hall.manPagesRead.length)
        commitProgression(update);
    },
    acknowledgeRank() {
      progression = acknowledgeRank(progression);
      progressionSlot.save(progression);
      emit('progression');
    },
    forgetEverything() {
      // The profile goes first: the settings listener records looks only for a signed-in
      // player, so resetting settings afterwards cannot write the old progress back. Storage
      // is wiped last, after the reset has saved its defaults.
      profile = { ...EMPTY_PROFILE, hintsSeen: [] };
      progression = syncWeek(emptyProgression(), engineContext());
      lastUpdate = null;
      settings.reset();
      forgetAllData(storage);
      emit('reset');
    },
    gameInfo: toGameInfo,
    homeDirectory: () => `/home/${profile.username ?? 'guest'}`,
  };
}
