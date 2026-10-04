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
 * A stand-in for the Hall, good enough to play Double Cross on its own: saves (in memory with
 * `?fresh=1`), the daily numbers, the look from `?look=neon`, and a log of what would reach the
 * Hall. It draws the Hall's pause button and its "Back to the Hall" corner where the player would.
 */
export function mockContext(
  params: URLSearchParams,
  log: (line: string) => void,
): { context: GameContext; strip: HTMLElement } {
  const dark = params.get('look') === 'neon';
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
    accent: '#e0457b',
    reducedMotion,
  };
  const dateKey = params.get('date') ?? localDateKey();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  let items: PauseMenuItem[] = [];
  let onTitle = false;
  const strip = document.createElement('div');
  strip.style.cssText =
    'position:fixed;inset:18px 24px auto 24px;z-index:20;display:flex;pointer-events:none';
  const render = () => {
    strip.replaceChildren();
    const button = document.createElement('button');
    button.className = 'dx-btn';
    button.style.cssText = `pointer-events:auto;${onTitle ? '' : 'margin-left:auto'}`;
    button.textContent = onTitle ? '← Back to the Hall' : 'Pause · Esc';
    button.onclick = () =>
      log(onTitle ? 'navigate hall' : `pause (items: ${items.map((i) => i.label).join(', ')})`);
    strip.append(button);
  };
  render();
  const context: GameContext = {
    gameId: 'dab',
    settings: () => ({ ...DEFAULT_SETTINGS, bindings: {} }),
    appearance: () => appearance,
    onAppearanceChange: () => () => undefined,
    onSettingsChange: () => () => undefined,
    audio: createSynth({ getVolume: () => 0.35, isMuted: () => params.get('sound') !== '1' }),
    save: (options) => createSaveSlot({ storage, scope: 'dab', ...options }),
    daily: {
      number: () => dailyNumber(dateKey),
      seed: () => dailySeed('dab', dateKey),
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
  return { context, strip };
}
