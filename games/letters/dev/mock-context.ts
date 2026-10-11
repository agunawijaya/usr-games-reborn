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
 * A stand-in for the Hall, good enough to play Chain Letter on its own: saves (in memory with
 * `?fresh=1`), the daily numbers (`?date=`), the look (`?look=arcade`), and a log of what would
 * reach the Hall. It draws a pause pill where the Hall's sits; while paused it lists the game's
 * pause items, so tests can reach them.
 */
export function mockContext(
  params: URLSearchParams,
  log: (line: string) => void,
): { context: GameContext; strip: HTMLElement } {
  const dark = params.get('look') === 'arcade';
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
    accent: '#ff6a5c',
    reducedMotion,
  };
  const dateKey = params.get('date') ?? localDateKey();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  let items: PauseMenuItem[] = [];
  let onTitle = false;
  let paused = false;
  const strip = document.createElement('div');
  strip.style.cssText =
    'position:fixed;top:10px;right:16px;z-index:20;display:flex;flex-direction:column;align-items:flex-end;gap:6px';
  const pillStyle =
    "padding:8px 16px;border-radius:999px;border:1px solid rgba(0,0,0,0.2);background:rgba(255,255,255,0.9);color:#222;font:600 15px/1.2 'Atkinson Hyperlegible Next',system-ui,sans-serif;cursor:pointer";
  const setPaused = (value: boolean) => {
    paused = value;
    for (const listener of value ? pauseListeners : resumeListeners) listener();
    render();
  };
  const render = () => {
    strip.replaceChildren();
    const pill = document.createElement('button');
    pill.style.cssText = pillStyle;
    pill.dataset.testid = 'mock-pill';
    pill.textContent = onTitle ? '← Back to the Hall' : paused ? 'Resume' : 'Pause · Esc';
    pill.onclick = () => (onTitle ? log('navigate hall') : setPaused(!paused));
    strip.append(pill);
    if (paused) {
      for (const item of items) {
        const button = document.createElement('button');
        button.style.cssText = pillStyle;
        button.dataset.testid = `mock-item-${item.id}`;
        button.textContent = item.label;
        button.onclick = () => {
          setPaused(false);
          item.run();
        };
        strip.append(button);
      }
    }
  };
  render();
  const context: GameContext = {
    gameId: 'letters',
    settings: () => ({ ...DEFAULT_SETTINGS, bindings: {} }),
    appearance: () => appearance,
    onAppearanceChange: () => () => undefined,
    onSettingsChange: () => () => undefined,
    audio: createSynth({ getVolume: () => 0.35, isMuted: () => params.get('sound') !== '1' }),
    save: (options) => createSaveSlot({ storage, scope: 'letters', ...options }),
    daily: {
      number: () => dailyNumber(dateKey),
      seed: () => dailySeed('letters', dateKey),
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
      log(`share ${typeof input === 'string' ? input : JSON.stringify(input)}`);
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
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !onTitle) setPaused(!paused);
  });
  return { context, strip };
}
