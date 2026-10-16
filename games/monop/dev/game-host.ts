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
  memoryStorage,
  type PauseMenuItem,
  shareText,
  themeTokens,
} from '@usr-games/kit';
import game from '../src/index';
import { STAGES } from './stages';

/**
 * The game on the workbench, outside the Hall: a small stand-in for the Hall's context, with
 * Escape pausing during play (or leaving from the game menu) the way the Hall's player does.
 *
 * - `?appearance=dark|light` forces a look; `?reduced=1` asks for reduced motion.
 * - `?seed=`, `?rounds=`, `?pace=` and `?coach=0|1` set up the game for tests and recordings;
 *   `?auto=1` lets a rival's mind play the person's seat; `?stage=slice` sets up a staged table;
 *   `?board=` opens on a board; `?honours=all` shows every career touch, earned or not.
 * - `?fresh=1` starts with empty saves; `?chrome=0` hides the stand-in Hall buttons.
 *
 * Results, navigation and pauses go to `window.__ddLog`, and `window.__ddPause()` pauses as
 * the Hall would.
 */

declare global {
  interface Window {
    __ddLog?: { kind: string; value: unknown }[];
    __ddPause?: () => void;
    __ddItems?: () => readonly PauseMenuItem[];
    __ddAppearance?: (dark: boolean) => void;
  }
}

export function mountGame(host: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  let forced = params.get('appearance');
  const media = matchMedia('(prefers-color-scheme: dark)');
  const log: { kind: string; value: unknown }[] = [];
  window.__ddLog = log;
  window.__ddDev = {
    ...(params.has('seed') ? { seed: params.get('seed')! } : {}),
    ...(params.has('rounds') ? { rounds: Number(params.get('rounds')) } : {}),
    ...(params.has('pace') ? { pace: Number(params.get('pace')) } : {}),
    ...(params.has('coach') ? { coach: params.get('coach') !== '0' } : {}),
    ...(params.get('auto') === '1' ? { autopilot: true } : {}),
    ...(params.has('stage') && STAGES[params.get('stage')!]
      ? { prepare: STAGES[params.get('stage')!]! }
      : {}),
    ...(params.has('board')
      ? { board: params.get('board') as 'harbour' | 'colony' | 'popup' }
      : {}),
    ...(params.get('honours') === 'all' ? { honours: true } : {}),
  };
  const storage = params.get('fresh') === '1' ? memoryStorage() : browserStorage();
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
      accent: '#1c64a8',
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
  window.__ddItems = () => items;
  window.__ddAppearance = (dark) => {
    forced = dark ? 'dark' : 'light';
    appearanceListeners.forEach((listener) => listener(appearance()));
  };
  const pauseNote = document.createElement('div');
  pauseNote.dataset.testid = 'workbench-pause';
  pauseNote.style.cssText =
    'position:fixed;inset:auto 16px 16px auto;z-index:99;padding:10px 14px;border-radius:10px;background:#111;color:#fff;font:600 14px system-ui;display:none';
  document.body.append(pauseNote);
  // Where the Hall puts its own button, so the layout can be judged as it will be seen.
  const pauseButton = document.createElement('button');
  pauseButton.textContent = 'Pause  Esc';
  pauseButton.style.cssText =
    'position:fixed;top:14px;right:16px;z-index:98;padding:9px 14px;border-radius:999px;border:1px solid #8888;background:#fffc;color:#111;font:600 14px system-ui;cursor:pointer';
  pauseButton.addEventListener('click', () => togglePause());
  if (params.get('chrome') !== '0') document.body.append(pauseButton);
  media.addEventListener('change', () => appearanceListeners.forEach((l) => l(appearance())));

  const togglePause = () => {
    paused = !paused;
    pauseNote.style.display = paused ? 'block' : 'none';
    pauseNote.textContent = `Paused · ${items.map((i) => i.label).join(' · ') || 'no items'} · Esc resumes`;
    (paused ? pauseListeners : resumeListeners).forEach((l) => l());
  };
  window.__ddPause = togglePause;

  const context: GameContext = {
    gameId: 'monop',
    settings: () => DEFAULT_SETTINGS,
    appearance,
    onAppearanceChange(listener) {
      appearanceListeners.add(listener);
      return () => appearanceListeners.delete(listener);
    },
    onSettingsChange: () => () => {},
    audio: synth,
    save: ({ key, version, defaults, migrations }) =>
      createSaveSlot({ storage, scope: 'monop-workbench', key, version, defaults, migrations }),
    daily: {
      number: () => dailyNumber(params.get('date') ?? undefined),
      seed: () => dailySeed('monop', params.get('date') ?? undefined),
      dateKey: () => params.get('date') ?? localDateKey(),
    },
    reportResult(result) {
      log.push({ kind: 'result', value: result });
      console.warn('[workbench] result', JSON.stringify(result));
      return { xpGained: 30, packagesInstalled: [], rankChange: null, cronJobsCompleted: [] };
    },
    installPackage(id) {
      log.push({ kind: 'package', value: id });
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
      pauseButton.hidden = value;
      log.push({ kind: 'title', value });
    },
    openSettings: () => console.warn('[workbench] Hall settings would open here'),
    forgetData: async () => true,
    navigate: (to) => {
      log.push({ kind: 'navigate', value: to });
      console.warn('[workbench] navigate', to);
    },
  };

  // Registered before the game mounts, as the Hall's own listener is: Escape pauses during
  // play and leaves from the game menu; the game's own panels catch it first.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    if (onTitle) {
      log.push({ kind: 'navigate', value: 'hall' });
      return;
    }
    togglePause();
  });
  void game.mount(host, context);
}
