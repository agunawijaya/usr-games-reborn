import {
  type AppearanceState,
  composeShare,
  createSaveSlot,
  dailyNumber,
  dailySeed,
  forgetScope,
  type GameContext,
  type GameResult,
  type PauseMenuItem,
  paletteOf,
  type Settings,
  shareText,
} from '@usr-games/kit';
import type { ProgressionUpdate } from '@usr-games/kit/progression';
import type { GameManifest } from '@usr-games/kit/manifest';
import type { HallSnapshot, HallStore } from '../../store/hall-store';
import { gameAccent, tokensFor } from '../palette';
import { hallSynth } from '../sound';
import { toReceipt } from './receipt';

/**
 * Builds the GameContext a native game receives: everything it may touch, wired to the Hall's
 * store. The session supplies the hooks that need the screen (overlays, toasts, navigation).
 */

export interface ContextHooks {
  onResult(update: ProgressionUpdate, result: GameResult): void;
  onPackageInstalled(update: ProgressionUpdate): void;
  setPauseItems(items: readonly PauseMenuItem[]): void;
  setOnTitleScreen(onTitle: boolean): void;
  openSettings(): void;
  confirmForget(): Promise<boolean>;
  navigate(to: 'game-menu' | 'hall'): void;
}

export interface ContextHandle {
  context: GameContext;
  firePause(): void;
  fireResume(): void;
  destroy(): void;
}

export function appearanceStateFor(
  snapshot: HallSnapshot,
  manifest: GameManifest,
): AppearanceState {
  const theme = paletteOf(snapshot.settings);
  const query = {
    theme,
    appearance: snapshot.appearance,
    colorBlindPalette: snapshot.settings.colorBlindPalette,
  };
  return {
    appearance: snapshot.appearance,
    style: snapshot.settings.style,
    theme,
    tokens: tokensFor(query),
    accent: gameAccent(manifest.accent, query),
    reducedMotion: snapshot.reducedMotion,
  };
}

/** Volume or binding changes also arrive as settings changes; games only hear about looks. */
function sameLook(a: AppearanceState, b: AppearanceState): boolean {
  const tokenNames = Object.keys(a.tokens) as (keyof AppearanceState['tokens'])[];
  return (
    a.appearance === b.appearance &&
    a.style === b.style &&
    a.theme === b.theme &&
    a.accent === b.accent &&
    a.reducedMotion === b.reducedMotion &&
    tokenNames.every((name) => a.tokens[name] === b.tokens[name])
  );
}

export function createGameContext(
  manifest: GameManifest,
  store: HallStore,
  hooks: ContextHooks,
): ContextHandle {
  const gameId = manifest.id;
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  const unsubscribers = new Set<() => void>();

  function listen<T>(listeners: Set<T>, listener: T): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const context: GameContext = {
    gameId,
    settings: () => store.settings.get(),
    appearance: () => appearanceStateFor(store.snapshot(), manifest),
    onAppearanceChange(listener) {
      let last = context.appearance();
      const stop = store.subscribe((snapshot, change) => {
        if (change !== 'settings' && change !== 'reset') return;
        const next = appearanceStateFor(snapshot, manifest);
        if (sameLook(last, next)) return;
        last = next;
        listener(next);
      });
      unsubscribers.add(stop);
      return () => {
        stop();
        unsubscribers.delete(stop);
      };
    },
    onSettingsChange(listener: (settings: Settings) => void) {
      const stop = store.subscribe((_, change) => {
        if (change === 'settings' || change === 'reset') listener(store.settings.get());
      });
      unsubscribers.add(stop);
      return () => {
        stop();
        unsubscribers.delete(stop);
      };
    },
    audio: hallSynth(store),
    save: (options) =>
      createSaveSlot({
        storage: store.storage,
        scope: gameId,
        key: options.key,
        version: options.version,
        defaults: options.defaults,
        ...(options.migrations ? { migrations: options.migrations } : {}),
      }),
    daily: {
      number: () => dailyNumber(store.snapshot().today),
      seed: () => dailySeed(gameId, store.snapshot().today),
      dateKey: () => store.snapshot().today,
    },
    reportResult(result) {
      const update = store.reportResult(gameId, result);
      hooks.onResult(update, result);
      return toReceipt(update);
    },
    installPackage(id) {
      const update = store.installPackage(gameId, id);
      if (!update || update.packagesInstalled.length === 0) return false;
      hooks.onPackageInstalled(update);
      return true;
    },
    share(input) {
      const colorBlind = store.settings.get().colorBlindPalette;
      const text = typeof input === 'string' ? input : composeShare({ colorBlind, ...input });
      return shareText(text);
    },
    pauseMenuItems: (items) => hooks.setPauseItems(items),
    onPause: (listener) => listen(pauseListeners, listener),
    onResume: (listener) => listen(resumeListeners, listener),
    setOnTitleScreen: (onTitle) => hooks.setOnTitleScreen(onTitle),
    openSettings: () => hooks.openSettings(),
    async forgetData() {
      if (!(await hooks.confirmForget())) return false;
      forgetScope(store.storage, gameId);
      return true;
    },
    navigate: (to) => hooks.navigate(to),
  };

  return {
    context,
    firePause: () => pauseListeners.forEach((listener) => listener()),
    fireResume: () => resumeListeners.forEach((listener) => listener()),
    destroy() {
      for (const stop of unsubscribers) stop();
      unsubscribers.clear();
      pauseListeners.clear();
      resumeListeners.clear();
    },
  };
}
