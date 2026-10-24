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
 * game can be played on port 5297. `?appearance=dark|light` forces a look, `?reduced=1` asks
 * for reduced motion, `?date=` sets the Daily's date, `?fresh=1` starts with empty saves,
 * `?sample=1` fills the records for pictures; results, packages, shares and navigation go to the
 * console and to `window.__ftLog` for the browser tests, and `window.__ftPause` pauses as the
 * Hall would.
 */

declare global {
  interface Window {
    __ftLog?: { kind: string; value: unknown }[];
    __ftPause?: () => void;
    __ftItems?: () => readonly PauseMenuItem[];
    __ftAppearance?: (dark: boolean) => void;
  }
}

/** A lived-in save for documentation pictures: records, an album and a Daily already played. */
function seedSample(storage: ReturnType<typeof memoryStorage>, today: string): void {
  const slot = <T>(key: string, value: T) =>
    createSaveSlot({
      storage,
      scope: 'cribbage-workbench',
      key,
      version: 1,
      defaults: () => value,
    }).save(value);
  slot('records', {
    games: 23,
    wins: 13,
    byLevel: {
      beginner: { games: 6, wins: 5 },
      classic: { games: 12, wins: 6 },
      sharp: { games: 5, wins: 2 },
    },
    skunks: 3,
    thirtyOnes: 41,
    bestCount: 24,
    trainerRight: 37,
    trainerRounds: 4,
    bestSprint: 11,
  });
  const card = (text: string) => {
    const suits = 'cdhs';
    const rank = text.slice(0, -1);
    const value =
      rank === 'a' ? 1 : rank === 'j' ? 11 : rank === 'q' ? 12 : rank === 'k' ? 13 : Number(rank);
    return suits.indexOf(text.slice(-1)) * 13 + value - 1;
  };
  const entry = (
    hand: string,
    starter: string,
    total: number,
    isCrib: boolean,
    date: string,
    opponent: string,
  ) => ({
    hand: hand.split(' ').map(card),
    starter: card(starter),
    isCrib,
    total,
    date,
    opponent,
  });
  slot('album', [
    entry('4h 5h 6h 4c', '6d', 24, false, '2026-10-19', 'classic'),
    entry('7c 8d 7h 8s', '9c', 24, true, '2026-10-21', 'sharp'),
    entry('3c 3d 3h 9s', '3s', 20, false, '2026-10-22', 'classic'),
    entry('5d jh qs kc', '5c', 17, false, '2026-10-23', 'beginner'),
    entry('2c 3d 4h 4s', 'ac', 16, false, '2026-10-18', 'classic'),
    entry('9c 6d 5h 4s', '4d', 14, true, '2026-10-20', 'sharp'),
  ]);
  slot('daily', {
    [today]: { number: 54, thrown: [card('kd'), card('2s')], percent: 94, place: 3 },
    '2026-10-22': { number: 52, thrown: [card('5c'), card('5h')], percent: 100, place: 1 },
  });
}

export function mountGame(host: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  let forced = params.get('appearance');
  const media = matchMedia('(prefers-color-scheme: dark)');
  const log: { kind: string; value: unknown }[] = [];
  window.__ftLog = log;
  const storage =
    params.get('fresh') === '1' || params.get('sample') === '1'
      ? memoryStorage()
      : browserStorage();
  if (params.get('sample') === '1')
    seedSample(storage as ReturnType<typeof memoryStorage>, params.get('date') ?? localDateKey());
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
      accent: '#d9a441',
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
  window.__ftItems = () => items;
  window.__ftAppearance = (dark) => {
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
  window.__ftPause = togglePause;

  const context: GameContext = {
    gameId: 'cribbage',
    settings: () => DEFAULT_SETTINGS,
    appearance,
    onAppearanceChange(listener) {
      appearanceListeners.add(listener);
      return () => appearanceListeners.delete(listener);
    },
    onSettingsChange: () => () => {},
    audio: synth,
    save: ({ key, version, defaults, migrations }) =>
      createSaveSlot({ storage, scope: 'cribbage-workbench', key, version, defaults, migrations }),
    daily: {
      number: () => dailyNumber(params.get('date') ?? undefined),
      seed: () => dailySeed('cribbage', params.get('date') ?? undefined),
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
