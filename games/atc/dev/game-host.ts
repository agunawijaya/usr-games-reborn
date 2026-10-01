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
import { applyIntents, planSky } from '../src/engine/bot';
import { addPlane } from '../src/engine/world';
import type { PlaySession } from '../src/play/session';

declare global {
  interface Window {
    /** The live sky, set by the session in development builds. */
    __skyloom?: PlaySession;
    __skyloomAutopilot?: (ticks: number) => number;
    __skyloomCrowd?: (planes: number) => number;
  }
}

/**
 * The game on the workbench, outside the Hall: a small stand-in for the Hall's context, with
 * Escape pausing (or leaving from the title), so the whole game can be played on port 5273.
 * `?appearance=dark|light` forces a look; results and packages are written to the console.
 */

export function mountGame(host: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const forced = params.get('appearance');
  const media = matchMedia('(prefers-color-scheme: dark)');
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
      accent: '#c2337a',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  };
  const synth = createSynth({ getVolume: () => 0.35, isMuted: () => false });
  const appearanceListeners = new Set<(state: AppearanceState) => void>();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  let onTitle = false;
  let paused = false;
  let items: readonly PauseMenuItem[] = [];
  const pauseNote = document.createElement('div');
  pauseNote.style.cssText =
    'position:fixed;inset:auto 16px 16px auto;z-index:99;padding:10px 14px;border-radius:10px;background:#111;color:#fff;font:600 14px system-ui;display:none';
  document.body.append(pauseNote);
  media.addEventListener('change', () => appearanceListeners.forEach((l) => l(appearance())));

  const context: GameContext = {
    gameId: 'atc',
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
        scope: 'atc-workbench',
        key,
        version,
        defaults,
        migrations,
      }),
    daily: {
      number: () => dailyNumber(),
      seed: () => dailySeed('atc'),
      dateKey: () => localDateKey(),
    },
    reportResult(result) {
      console.warn('[workbench] result', JSON.stringify(result));
      return { xpGained: 0, packagesInstalled: [], rankChange: null, cronJobsCompleted: [] };
    },
    installPackage(id) {
      console.warn('[workbench] package', id);
      return true;
    },
    share: (input) => shareText(typeof input === 'string' ? input : input.title),
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
    },
    openSettings: () => console.warn('[workbench] Hall settings would open here'),
    forgetData: async () => true,
    navigate: (to) => console.warn('[workbench] navigate', to),
  };

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const typing = (event.target as HTMLElement | null)?.closest('input');
    if (typing) return;
    event.preventDefault();
    if (onTitle) {
      console.warn('[workbench] Escape on the title: back to the Hall');
      return;
    }
    paused = !paused;
    pauseNote.style.display = paused ? 'block' : 'none';
    pauseNote.textContent = `Paused · items: ${items.map((i) => i.label).join(', ') || 'none'} · Esc resumes`;
    (paused ? pauseListeners : resumeListeners).forEach((l) => l());
  });

  installAutopilot();
  void game.mount(host, context);
}

/**
 * For the browser tests: `__skyloomAutopilot(n)` lets the house controller give orders and move
 * the live sky on n ticks, so a test can reach the end of a shift without playing it by hand.
 */
function installAutopilot(): void {
  const page = window;
  page.__skyloomAutopilot = (ticks) => {
    const session = page.__skyloom;
    if (!session) return 0;
    let flown = 0;
    while (flown < ticks && !session.isEnded) {
      applyIntents(session.world, planSky(session.world, { horizon: 6 }));
      session.advance();
      flown += 1;
    }
    return flown;
  };
  // Fills the sky for the frame-time test, letting the house controller keep it apart meanwhile.
  page.__skyloomCrowd = (planes) => {
    const session = page.__skyloom;
    if (!session) return 0;
    for (
      let tries = 0;
      tries < 400 && session.world.air.length < planes && !session.isEnded;
      tries++
    ) {
      addPlane(session.world);
      applyIntents(session.world, planSky(session.world, { horizon: 4 }));
      session.advance();
    }
    return session.world.air.length;
  };
}
