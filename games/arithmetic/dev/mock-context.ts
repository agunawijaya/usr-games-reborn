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
 * A stand-in for the Hall, good enough to play Number Sprint on its own: saves (in memory with
 * `?fresh=1`), the daily numbers, the look from `?look=night`, and a log of what would reach the
 * Hall. It draws the Hall's pause button and its "Back to the Hall" corner where the player would.
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
    accent: '#14b8a6',
    reducedMotion,
  };
  const dateKey = params.get('date') ?? localDateKey();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  let items: PauseMenuItem[] = [];
  let onTitle = false;
  const strip = document.createElement('div');
  strip.style.cssText =
    'position:fixed;inset:10px 16px auto 16px;z-index:20;display:flex;pointer-events:none';
  const render = () => {
    strip.replaceChildren();
    const button = document.createElement('button');
    button.className = 'ns-hall-pill';
    button.style.cssText = `pointer-events:auto;${onTitle ? '' : 'margin-left:auto'};padding:8px 16px;border-radius:999px;border:1px solid rgba(255,255,255,0.7);background:rgba(255,255,255,0.85);color:#123446;font:600 16px/1.2 'Atkinson Hyperlegible Next',system-ui,sans-serif;cursor:pointer`;
    button.textContent = onTitle ? '← Back to the Hall' : 'Pause · Esc';
    button.onclick = () => (onTitle ? log('navigate hall') : pause());
    strip.append(button);
  };
  render();

  // A small pause menu in the Hall's order, so pausing and the game's items can be tried here.
  let menu: HTMLElement | null = null;
  const resume = () => {
    menu?.remove();
    menu = null;
    for (const listener of resumeListeners) listener();
  };
  const pause = () => {
    if (menu || onTitle) return;
    log('pause');
    for (const listener of pauseListeners) listener();
    menu = document.createElement('div');
    menu.dataset.testid = 'mock-pause';
    menu.style.cssText =
      'position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(0,0,0,0.45)';
    const card = document.createElement('div');
    card.style.cssText =
      "display:flex;flex-direction:column;gap:8px;padding:20px;border-radius:14px;background:#fff;font:600 17px 'Atkinson Hyperlegible Next',system-ui,sans-serif";
    const entries: [string, () => void][] = [
      ['Resume', resume],
      ...items.map((item): [string, () => void] => [item.label, () => (resume(), item.run())]),
      ['How to play', () => log('how to play')],
      ['Settings', () => log('open settings')],
      ['Game menu', () => (resume(), log('navigate game-menu'))],
      ['Back to the Hall', () => (resume(), log('navigate hall'))],
    ];
    for (const [label, run] of entries) {
      const entry = document.createElement('button');
      entry.textContent = label;
      entry.style.cssText = 'padding:8px 16px;font:inherit;cursor:pointer';
      entry.onclick = run;
      card.append(entry);
    }
    menu.append(card);
    document.body.append(menu);
    (card.firstElementChild as HTMLElement).focus();
  };
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (menu) resume();
      else if (onTitle) log('navigate hall');
      else pause();
    },
    true,
  );
  const installed = new Set<string>();
  const context: GameContext = {
    gameId: 'arithmetic',
    settings: () => ({ ...DEFAULT_SETTINGS, bindings: {} }),
    appearance: () => appearance,
    onAppearanceChange: () => () => undefined,
    onSettingsChange: () => () => undefined,
    audio: createSynth({ getVolume: () => 0.35, isMuted: () => params.get('sound') !== '1' }),
    save: (options) => createSaveSlot({ storage, scope: 'arithmetic', ...options }),
    daily: {
      number: () => dailyNumber(dateKey),
      seed: () => dailySeed('arithmetic', dateKey),
      dateKey: () => dateKey,
    },
    reportResult(result: GameResult) {
      log(`result ${JSON.stringify(result)}`);
      return { xpGained: 42, packagesInstalled: [], rankChange: null, cronJobsCompleted: [] };
    },
    installPackage(id) {
      if (installed.has(id)) return false;
      installed.add(id);
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
