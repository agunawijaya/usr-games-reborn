import {
  type AppearanceState,
  applyTokens,
  browserStorage,
  createSaveSlot,
  createSynth,
  dailyNumber,
  dailySeed,
  DEFAULT_SETTINGS,
  type GameContext,
  type GameResult,
  localDateKey,
  memoryStorage,
  type PauseMenuItem,
  themeTokens,
} from '@usr-games/kit';

/**
 * A stand-in for the Hall, good enough to play Figurehead on its own: saves (in memory with
 * `?fresh=1`), the daily numbers (`?date=`), appearance from `?look=night`, and a log of what
 * would reach the Hall. It draws a small strip with the pause items and the way out.
 */
export function mockContext(
  params: URLSearchParams,
  log: (line: string) => void,
): { context: GameContext; strip: HTMLElement } {
  const dark = params.get('look') === 'night';
  const reducedMotion = params.get('motion') === 'reduce';
  const storage = params.get('fresh') === '1' ? memoryStorage() : browserStorage();
  const tokens = themeTokens({
    theme: 'console',
    appearance: dark ? 'dark' : 'light',
    colorBlindPalette: false,
  });
  applyTokens(document.documentElement, tokens);
  const appearance: AppearanceState = {
    appearance: dark ? 'dark' : 'light',
    style: 'console',
    theme: 'console',
    tokens,
    accent: '#3a6fb0',
    reducedMotion,
  };
  const dateKey = params.get('date') ?? localDateKey();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  let items: PauseMenuItem[] = [];
  let onTitle = false;
  const strip = document.createElement('div');
  strip.style.cssText =
    'position:fixed;top:12px;right:14px;z-index:20;display:flex;gap:8px;font:600 13px system-ui';
  const render = () => {
    strip.replaceChildren();
    const pause = document.createElement('button');
    pause.textContent = onTitle ? '← Back to the Hall' : 'Pause · Esc';
    pause.style.cssText =
      'padding:9px 13px;border-radius:12px;border:1.5px solid #8a7a6a;background:#fffaf2';
    pause.onclick = () =>
      log(onTitle ? 'navigate hall' : `pause (items: ${items.map((i) => i.label).join(', ')})`);
    strip.append(pause);
    for (const item of items) {
      const run = document.createElement('button');
      run.textContent = item.label;
      run.dataset.testid = `pause-${item.id}`;
      run.style.cssText = pause.style.cssText;
      run.onclick = () => item.run();
      strip.append(run);
    }
  };
  render();
  const context: GameContext = {
    gameId: 'figurehead',
    settings: () => ({ ...DEFAULT_SETTINGS, bindings: {} }),
    appearance: () => appearance,
    onAppearanceChange: () => () => undefined,
    onSettingsChange: () => () => undefined,
    audio: createSynth({ getVolume: () => 0.35, isMuted: () => params.get('sound') !== '1' }),
    save: (options) => createSaveSlot({ storage, scope: 'figurehead', ...options }),
    daily: {
      number: () => dailyNumber(dateKey),
      seed: () => dailySeed('figurehead', dateKey),
      dateKey: () => dateKey,
    },
    reportResult(result: GameResult) {
      log(`result ${JSON.stringify(result)}`);
      return { xpGained: 42, packagesInstalled: [], rankChange: null, cronJobsCompleted: [] };
    },
    installPackage(id) {
      log(`package ${id}`);
      return true;
    },
    share: async (input) => {
      log(`share ${JSON.stringify(input)}`);
      return 'copied';
    },
    pauseMenuItems(next) {
      items = next;
      render();
    },
    onPause: (listener) => (pauseListeners.add(listener), () => pauseListeners.delete(listener)),
    onResume: (listener) => (resumeListeners.add(listener), () => resumeListeners.delete(listener)),
    setOnTitleScreen(value) {
      onTitle = value;
      render();
    },
    openSettings: () => log('open settings'),
    forgetData: async () => {
      log('forget data');
      return false;
    },
    navigate: (to) => log(`navigate ${to}`),
  };
  return { context, strip };
}
