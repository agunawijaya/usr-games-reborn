import { COSMETICS, isUnlocked } from '@usr-games/kit/progression';
import { applyTheme, type ThemeState } from '../../core/palette';
import { rankUpMoment } from '../../core/rank-up';
import type { PreviewOptions, StyleDeps, StyleInstance } from '../../core/style-module';
import { HOME, type Route } from '../../router';
import type { HallSnapshot } from '../../store/hall-store';
import { h, mount } from '../../ui/h';
import type { ConsoleContext } from './context';
import { detailScreen } from './detail';
import { type ConsoleScreen, homeScreen } from './home';
import { closeOverlay } from './overlay';
import { aboutScreen, closetScreen, settingsScreen } from './pages';
import { profileScreen } from './profile';
import { playRankUp } from './rank-up';

/**
 * Console Home's shell: applies the console palette, renders the screen for the route and
 * re-renders when the player's data or settings change, keeping focus and scroll in place.
 */

/** Screenshot scenes hold the hero art at a moment that shows it off. */
const FROZEN_ART_TIME = 6.4;

function consoleTheme(snapshot: HallSnapshot, appearance = snapshot.appearance): ThemeState {
  return {
    style: 'console',
    theme: 'console',
    appearance,
    colorBlindPalette: snapshot.settings.colorBlindPalette,
    reducedMotion: snapshot.reducedMotion,
  };
}

/** The accent skin, applied only once the player has unlocked it. */
function skinOf(snapshot: HallSnapshot): string {
  const choice = snapshot.settings.consoleSkin;
  const cosmetic = COSMETICS.find((c) => c.id === choice && c.kind === 'skin');
  return cosmetic && isUnlocked(cosmetic, snapshot.progression) ? choice : 'default';
}

function screenFor(route: Route, context: ConsoleContext): ConsoleScreen {
  switch (route.name) {
    case 'home':
      return homeScreen(context, route.dir);
    case 'man':
      return detailScreen(context, route.id);
    case 'profile':
      return profileScreen(context);
    case 'settings':
      return settingsScreen(context);
    case 'about':
      return aboutScreen(context);
    case 'closet':
      return closetScreen(context);
    // The style host shows its own full-page screens for these; Console Home never gets them.
    case 'run':
    case 'login':
    case 'welcome':
      return homeScreen(context, null);
  }
}

export function startConsole(root: HTMLElement, deps: StyleDeps): StyleInstance {
  const { store, router, frozen } = deps;
  const html = document.documentElement;
  let snapshot = store.snapshot();
  let theme = consoleTheme(snapshot);
  let route = router.current();
  let screen: ConsoleScreen | null = null;

  applyTheme(html, theme);
  const main = h('main', { id: 'screen', class: 'ch-main', tabindex: '-1' });
  const overlays = h('div', { class: 'ch-overlays' });
  const announcer = h('div', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const app = h(
    'div',
    { class: 'ch-app', dataset: { skin: skinOf(snapshot) } },
    h(
      'button',
      { class: 'skip-link', type: 'button', onclick: () => main.focus() },
      'Skip to content',
    ),
    main,
    overlays,
    announcer,
  );
  mount(root, app);

  const context = (): ConsoleContext => ({
    store,
    router,
    snapshot,
    theme,
    frozenAt: frozen ? FROZEN_ART_TIME : undefined,
    interactive: true,
    overlays,
  });

  function render(reason: 'route' | 'state') {
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focusKey;
    const restoreFocus = () => {
      if (focusKey && !document.activeElement?.closest('.ch-app'))
        root
          .querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`)
          ?.focus({ preventScroll: true });
    };
    if (reason === 'state' && screen?.update) {
      screen.update(context());
      app.dataset.skin = skinOf(snapshot);
      restoreFocus();
      return;
    }
    const scrollY = window.scrollY;
    closeOverlay();
    screen?.destroy();
    screen = screenFor(route, context());
    main.replaceChildren(screen.element);
    app.dataset.skin = skinOf(snapshot);
    document.title =
      screen.title === 'Home' ? '/usr/games Reborn' : `${screen.title} · /usr/games Reborn`;
    if (reason === 'route') {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, scrollY);
      restoreFocus();
    }
  }

  let stopMoment = () => {};
  function celebrateIfDue() {
    // Acknowledging a moment is itself a progression change; the card it leaves must stay.
    if (!rankUpMoment(store)) return;
    stopMoment();
    stopMoment = playRankUp(store, {
      layer: overlays,
      announcer,
      frozen,
      reducedMotion: theme.reducedMotion,
    });
  }

  const stopRouting = router.subscribe((next) => {
    route = next;
    if (route.name === 'man') store.readManPage(route.id);
    snapshot = store.snapshot();
    render('route');
  });

  const stopWatching = store.subscribe((next) => {
    if (next.settings.style !== 'console') return;
    const previous = theme;
    snapshot = next;
    theme = consoleTheme(next);
    applyTheme(html, theme, previous);
    render('state');
  });
  const stopRankUps = store.subscribe((next, change) => {
    if (change === 'progression' && next.settings.style === 'console') celebrateIfDue();
  });

  if (route.name === 'man') store.readManPage(route.id);
  snapshot = store.snapshot();
  render('route');
  // Let the page paint first, so the moment rises over the player's own Home.
  const firstMoment = requestAnimationFrame(celebrateIfDue);

  return {
    destroy() {
      cancelAnimationFrame(firstMoment);
      stopRouting();
      stopWatching();
      stopRankUps();
      stopMoment();
      closeOverlay();
      screen?.destroy();
      root.replaceChildren();
    },
  };
}

/** Console Home's Home, still and silent, for the style picker. */
export function previewConsole(frame: HTMLElement, options: PreviewOptions): () => void {
  const snapshot = options.store.snapshot();
  const theme = consoleTheme(snapshot, options.appearance);
  applyTheme(frame, theme);
  const overlays = h('div', { class: 'ch-overlays' });
  const noRouting = { current: () => HOME, go: () => {}, subscribe: () => () => {} };
  const screen = homeScreen(
    {
      store: options.store,
      router: noRouting,
      snapshot: { ...snapshot, appearance: options.appearance },
      theme,
      frozenAt: FROZEN_ART_TIME,
      interactive: false,
      overlays,
    },
    null,
  );
  const app = h(
    'div',
    {
      class: 'ch-app ch-app--preview',
      dataset: { skin: 'default' },
      inert: true,
      'aria-hidden': 'true',
    },
    h('div', { class: 'ch-main' }, screen.element),
  );
  mount(frame, app);
  return () => {
    screen.destroy();
    frame.replaceChildren();
  };
}
