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

/**
 * The game on the workbench, outside the Hall: a small stand-in for the Hall's context, with
 * Escape pausing (or leaving from the game menu) the way the Hall's player does, so the whole
 * game can be played on port 5295. `?appearance=dark|light` forces a look, `?reduced=1` asks
 * for reduced motion, `?date=` sets the Daily's date, `?fresh=1` starts with empty saves;
 * results, packages, shares and navigation go to the console and to `window.__gfLog` for the
 * browser tests, and `window.__gfPause` pauses as the Hall would.
 */

declare global {
  interface Window {
    __gfLog?: { kind: string; value: unknown }[];
    __gfPause?: () => void;
    __gfItems?: () => readonly PauseMenuItem[];
    __gfAppearance?: (dark: boolean) => void;
  }
}

/**
 * A lived-in pond for documentation pictures: eight species in the album (two of them golden),
 * a Tournament two rounds in, a Daily day fished, and some records.
 */
function seedSample(storage: ReturnType<typeof memoryStorage>, today: string): void {
  const slot = <T>(key: string, value: T) =>
    createSaveSlot({
      storage,
      scope: 'fish-workbench',
      key,
      version: 1,
      defaults: () => value,
    }).save(value);
  const caught = [1, 3, 5, 7, 8, 11, 12, 13];
  slot(
    'album',
    Array.from({ length: 13 }, (_, i) => {
      const seen = caught.includes(i + 1);
      const golden = i + 1 === 7 || i + 1 === 13;
      return {
        first: seen ? '2026-10-0' + ((i % 9) + 1) : null,
        caught: seen ? 1 + (i % 4) : 0,
        goldenFirst: golden ? '2026-10-12' : null,
        golden: golden ? 1 : 0,
      };
    }),
  );
  slot('records', {
    games: 14,
    wins: 6,
    draws: 1,
    books: 43,
    goldens: 2,
    beaten: { otto: 5, hazel: 3, miso: 1 },
    bestBooks: 7,
    tournamentsWon: 0,
  });
  slot('tournament', { seed: 'sample-cup', results: ['win', 'loss'] });
  slot('daily', {
    [today]: {
      number: 45,
      books: [
        { rank: 4, golden: false },
        { rank: 9, golden: false },
        { rank: 13, golden: true },
        { rank: 2, golden: false },
      ],
      notebookUsed: false,
      outcome: 'win',
    },
  });
}

export function mountGame(host: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  let forced = params.get('appearance');
  const media = matchMedia('(prefers-color-scheme: dark)');
  const log: { kind: string; value: unknown }[] = [];
  window.__gfLog = log;
  const storage = params.get('fresh') === '1' ? memoryStorage() : browserStorage();
  if (params.get('sample') === '1') seedSample(storage, params.get('date') ?? localDateKey());
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
      accent: '#3fb6e8',
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
  window.__gfItems = () => items;
  window.__gfAppearance = (dark) => {
    forced = dark ? 'dark' : 'light';
    appearanceListeners.forEach((listener) => listener(appearance()));
  };
  const pauseNote = document.createElement('div');
  pauseNote.dataset.testid = 'workbench-pause';
  pauseNote.style.cssText =
    'position:fixed;inset:auto 16px 16px auto;z-index:99;padding:10px 14px;border-radius:10px;background:#111;color:#fff;font:600 14px system-ui;display:none';
  document.body.append(pauseNote);
  // Where the Hall puts its own buttons, so the layout can be judged as it will be seen.
  const chromeStyle =
    'position:fixed;top:10px;z-index:98;padding:9px 14px;border-radius:999px;border:1px solid #8888;background:#fffc;color:#111;font:600 14px system-ui;cursor:pointer';
  const corner = document.createElement('button');
  corner.textContent = '← Back to the Hall  Esc';
  corner.style.cssText = `${chromeStyle};left:16px`;
  const pauseButton = document.createElement('button');
  pauseButton.textContent = 'Pause  Esc';
  pauseButton.dataset.testid = 'workbench-pause-button';
  pauseButton.style.cssText = `${chromeStyle};right:16px`;
  pauseButton.addEventListener('click', () => togglePause());
  if (params.get('chrome') !== '0') document.body.append(corner, pauseButton);
  media.addEventListener('change', () => appearanceListeners.forEach((l) => l(appearance())));

  const togglePause = () => {
    paused = !paused;
    pauseNote.style.display = paused ? 'block' : 'none';
    pauseNote.textContent = `Paused · items: ${items.map((i) => i.label).join(', ') || 'none'} · Esc resumes`;
    (paused ? pauseListeners : resumeListeners).forEach((l) => l());
  };
  window.__gfPause = togglePause;

  const context: GameContext = {
    gameId: 'fish',
    settings: () => DEFAULT_SETTINGS,
    appearance,
    onAppearanceChange(listener) {
      appearanceListeners.add(listener);
      return () => appearanceListeners.delete(listener);
    },
    onSettingsChange: () => () => {},
    audio: synth,
    save: ({ key, version, defaults, migrations }) =>
      createSaveSlot({ storage, scope: 'fish-workbench', key, version, defaults, migrations }),
    daily: {
      number: () => dailyNumber(params.get('date') ?? undefined),
      seed: () => dailySeed('fish', params.get('date') ?? undefined),
      dateKey: () => params.get('date') ?? localDateKey(),
    },
    reportResult(result) {
      log.push({ kind: 'result', value: result });
      console.warn('[workbench] result', JSON.stringify(result));
      return { xpGained: 24, packagesInstalled: [], rankChange: null, cronJobsCompleted: [] };
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
  // play and leaves from the game menu; the game's own pages catch it first on their element.
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
