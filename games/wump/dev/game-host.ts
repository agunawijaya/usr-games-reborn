import {
  type AppearanceState,
  browserStorage,
  createSaveSlot,
  createSynth,
  dailyNumber,
  dailySeed,
  DEFAULT_SETTINGS,
  type GameContext,
  localDateKey,
  type PauseMenuItem,
  shareText,
  themeTokens,
} from '@usr-games/kit';
import game from '../src/index';

/**
 * The game on the workbench, outside the Hall: a small stand-in for the Hall's context, with
 * Escape pausing (or leaving from the game menu), so the whole game can be played on port 5274.
 * `?appearance=dark|light` forces a look and `?reduced=1` asks for reduced motion; results,
 * packages and shares are written to the console and to `window.__wumpLog` for the browser tests.
 */

declare global {
  interface Window {
    __wumpLog?: { kind: string; value: unknown }[];
  }
}

export function mountGame(host: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const forced = params.get('appearance');
  const media = matchMedia('(prefers-color-scheme: dark)');
  const log: { kind: string; value: unknown }[] = [];
  window.__wumpLog = log;
  const appearance = (): AppearanceState => {
    const dark = forced ? forced === 'dark' : media.matches;
    return {
      appearance: dark ? 'dark' : 'light',
      style: 'console',
      theme: 'console',
      tokens: themeTokens({
        theme: 'console',
        appearance: dark ? 'dark' : 'light',
        colorBlindPalette: false,
      }),
      accent: '#6a9a2f',
      reducedMotion:
        params.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  };
  const synth = createSynth({ getVolume: () => 0.35, isMuted: () => params.get('mute') === '1' });
  const appearanceListeners = new Set<(state: AppearanceState) => void>();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  let onTitle = false;
  let paused = false;
  let items: readonly PauseMenuItem[] = [];
  const pauseNote = document.createElement('div');
  pauseNote.dataset.testid = 'workbench-pause';
  pauseNote.style.cssText =
    'position:fixed;inset:auto 16px 16px auto;z-index:99;padding:10px 14px;border-radius:10px;background:#111;color:#fff;font:600 14px system-ui;display:none';
  document.body.append(pauseNote);
  // Where the Hall puts its own buttons, so the game's layout can be judged as it will be seen.
  const chromeStyle =
    'position:fixed;top:16px;z-index:98;padding:9px 14px;border-radius:999px;border:1px solid #8888;background:#fffc;color:#111;font:600 14px system-ui;cursor:pointer';
  const corner = document.createElement('button');
  corner.textContent = '← Back to the Hall  Esc';
  corner.style.cssText = `${chromeStyle};left:16px`;
  const pauseButton = document.createElement('button');
  pauseButton.textContent = 'Pause  Esc';
  pauseButton.style.cssText = `${chromeStyle};right:16px`;
  pauseButton.addEventListener('click', () => togglePause());
  document.body.append(corner, pauseButton);
  media.addEventListener('change', () => appearanceListeners.forEach((l) => l(appearance())));

  const togglePause = () => {
    paused = !paused;
    pauseNote.style.display = paused ? 'block' : 'none';
    pauseNote.textContent = `Paused · items: ${items.map((i) => i.label).join(', ') || 'none'} · Esc resumes`;
    (paused ? pauseListeners : resumeListeners).forEach((l) => l());
  };

  const context: GameContext = {
    gameId: 'wump',
    settings: () => DEFAULT_SETTINGS,
    appearance,
    onAppearanceChange(listener) {
      appearanceListeners.add(listener);
      return () => appearanceListeners.delete(listener);
    },
    onSettingsChange: () => () => {},
    audio: synth,
    save: ({ key, version, defaults, migrations }) =>
      createSaveSlot({
        storage: browserStorage(),
        scope: 'wump-workbench',
        key,
        version,
        defaults,
        migrations,
      }),
    daily: {
      number: () => dailyNumber(params.get('date') ?? undefined),
      seed: () => dailySeed('wump', params.get('date') ?? undefined),
      dateKey: () => params.get('date') ?? localDateKey(),
    },
    reportResult(result) {
      log.push({ kind: 'result', value: result });
      console.warn('[workbench] result', JSON.stringify(result));
      return { xpGained: 12, packagesInstalled: [], rankChange: null, cronJobsCompleted: [] };
    },
    installPackage(id) {
      log.push({ kind: 'package', value: id });
      console.warn('[workbench] package', id);
      return true;
    },
    share: async (input) => {
      log.push({ kind: 'share', value: input });
      return shareText(typeof input === 'string' ? input : input.title).catch(
        () => 'unavailable' as const,
      );
    },
    pauseMenuItems(next) {
      items = next;
    },
    onPause(listener) {
      pauseListeners.add(listener);
      return () => pauseListeners.delete(listener);
    },
    onResume(listener) {
      resumeListeners.add(listener);
      return () => resumeListeners.delete(listener);
    },
    setOnTitleScreen(value) {
      onTitle = value;
      corner.hidden = !value;
    },
    openSettings: () => console.warn('[workbench] Hall settings would open here'),
    forgetData: async () => true,
    navigate: (to) => {
      log.push({ kind: 'navigate', value: to });
      console.warn('[workbench] navigate', to);
    },
  };

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if ((event.target as HTMLElement | null)?.closest('input')) return;
    event.preventDefault();
    if (onTitle) {
      log.push({ kind: 'navigate', value: 'hall' });
      console.warn('[workbench] Escape on the game menu: back to the Hall');
      return;
    }
    togglePause();
  });
  void game.mount(host, context);
}
