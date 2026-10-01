import { applyTheme, type ThemeState } from '../../core/palette';
import { playSound } from '../../core/sound';
import type { PreviewOptions, StyleDeps, StyleInstance } from '../../core/style-module';
import { HOME, type Route, type Router } from '../../router';
import type { HallSnapshot } from '../../store/hall-store';
import { h, mount } from '../../ui/h';
import { aboutScreen } from './about';
import { albumScreen } from './album';
import { closetScreen } from './closet';
import {
  createPosterBag,
  type HoloContext,
  type HoloScreen,
  type HoloUiState,
  type PosterBag,
} from './context';
import { detailScreen } from './detail';
import { footer } from './footer';
import { header } from './header';
import { homeScreen } from './home';
import { createRankUpStage } from './rank-up';
import { settingsScreen } from './settings';
import { createTiltController, type TiltController } from './tilt';

/**
 * The Holo Collection shell: the header strip and the screen for the current route. It
 * re-renders on route and state changes, keeping focus and scroll where the player was, and
 * releases every poster and listener when the player switches style.
 */

function holoTheme(snapshot: HallSnapshot): ThemeState {
  return {
    style: 'holo',
    theme: 'holo',
    appearance: snapshot.appearance,
    colorBlindPalette: snapshot.settings.colorBlindPalette,
    reducedMotion: snapshot.reducedMotion,
  };
}

function screenFor(route: Route, context: HoloContext): HoloScreen {
  switch (route.name) {
    case 'home':
      return homeScreen(context);
    case 'man':
      return detailScreen(context, route.id);
    case 'profile':
      return albumScreen(context);
    case 'settings':
      return settingsScreen(context);
    case 'about':
      return aboutScreen(context);
    case 'closet':
      return closetScreen(context);
    case 'run':
    case 'login':
    case 'welcome':
      // Never reached: the style host shows the player, the login and the picker full-page.
      return homeScreen(context);
  }
}

/** Opening a card is a select, coming back to the collection is a back; the rest stay quiet. */
function routeSound(from: Route, to: Route): 'select' | 'back' | null {
  if (to.name === 'man') return 'select';
  if (from.name === 'man' && to.name === 'home') return 'back';
  return null;
}

/** The finish a player chose, when they have unlocked it; otherwise the default sheen. */
function finishClass(snapshot: HallSnapshot, unlocked: (id: string) => boolean): string {
  const finish = snapshot.settings.holoFinish;
  return finish !== 'default' && unlocked(finish) ? `hc-${finish}` : 'hc-finish-default';
}

export function startHolo(
  root: HTMLElement,
  deps: StyleDeps,
  unlocked: (id: string) => boolean,
): StyleInstance {
  const { store, router, frozen } = deps;
  const html = document.documentElement;
  const ui: HoloUiState = { albumSort: 'game', popover: null };
  let snapshot = store.snapshot();
  let theme = holoTheme(snapshot);
  let route = router.current();
  let screen: HoloScreen | null = null;
  let posters: PosterBag = createPosterBag({
    appearance: theme.appearance,
    reducedMotion: theme.reducedMotion,
    frozen,
  });
  let tilt: TiltController = createTiltController({ reducedMotion: theme.reducedMotion, frozen });

  applyTheme(html, theme);
  const headerSlot = h('div', { class: 'hc-top-slot' });
  const main = h('main', { id: 'screen', class: 'hc-main', tabindex: '-1' });
  const footerSlot = h('div', { class: 'hc-footer-slot' });
  const skip = h(
    'button',
    { class: 'skip-link', type: 'button', onclick: () => main.focus() },
    'Skip to content',
  );
  const app = h('div', { class: 'hc-app' }, skip, headerSlot, main, footerSlot);
  mount(root, app);
  const rankUp = createRankUpStage({
    store,
    host: app,
    frozen,
    reducedMotion: () => theme.reducedMotion,
  });

  const context = (): HoloContext => ({
    store,
    router,
    route,
    snapshot,
    theme,
    frozen,
    interactive: true,
    posters,
    tilt,
    ui,
    refresh: (scope = 'screen') => render('state', scope),
  });

  function restoreFocus(focusKey: string | undefined) {
    if (!focusKey) return;
    root
      .querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`)
      ?.focus({ preventScroll: true });
  }

  function render(reason: 'route' | 'state', scope: 'header' | 'screen' | 'chrome' = 'screen') {
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focusKey;
    const scrollY = window.scrollY;
    app.className = `hc-app ${finishClass(snapshot, unlocked)}`;
    if (scope === 'screen') {
      screen?.destroy?.();
      tilt.destroy();
      posters.destroy();
      posters = createPosterBag({
        appearance: theme.appearance,
        reducedMotion: theme.reducedMotion,
        frozen,
      });
      tilt = createTiltController({ reducedMotion: theme.reducedMotion, frozen });
      screen = screenFor(route, context());
      main.replaceChildren(screen.element);
      document.title =
        route.name === 'home' && !route.dir
          ? '/usr/games Reborn'
          : `${screen.title} · /usr/games Reborn`;
    }
    headerSlot.replaceChildren(header(context()));
    if (scope !== 'header') footerSlot.replaceChildren(footer(context()));
    if (reason === 'route') {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, scrollY);
      restoreFocus(focusKey);
    }
  }

  const closePopover = (refocus: boolean) => {
    const which = ui.popover;
    if (!which) return;
    ui.popover = null;
    render('state', 'header');
    if (refocus) restoreFocus(`popover:${which}`);
  };
  const onDocumentClick = (event: MouseEvent) => {
    if (ui.popover && !(event.target as Element | null)?.closest('.hc-anchor')) closePopover(false);
  };
  const onDocumentKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && ui.popover) {
      event.preventDefault();
      closePopover(true);
    }
  };
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKey);

  const stopRouting = router.subscribe((next) => {
    const sound = routeSound(route, next);
    if (sound) playSound(store, sound);
    route = next;
    ui.popover = null;
    if (route.name === 'man') store.readManPage(route.id);
    snapshot = store.snapshot();
    render('route');
  });
  const stopWatching = store.subscribe((next, change) => {
    if (next.settings.style !== 'holo') return;
    const previousTheme = theme;
    const previous = snapshot;
    snapshot = next;
    theme = holoTheme(next);
    applyTheme(html, theme, previousTheme);
    const keep = screen?.onStateChange?.(next, previous) === 'keep';
    render('state', keep ? 'chrome' : 'screen');
    if (change === 'progression') rankUp.check();
  });

  if (route.name === 'man') store.readManPage(route.id);
  snapshot = store.snapshot();
  render('route');
  rankUp.check();

  return {
    destroy() {
      stopRouting();
      stopWatching();
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKey);
      rankUp.destroy();
      screen?.destroy?.();
      tilt.destroy();
      posters.destroy();
      root.replaceChildren();
    },
  };
}

const NO_ROUTING: Router = { current: () => HOME, go: () => {}, subscribe: () => () => {} };

/** The real Home, still and silent, for the style picker. */
export function previewHolo(
  frame: HTMLElement,
  options: PreviewOptions,
  unlocked: (id: string) => boolean,
): () => void {
  const snapshot = { ...options.store.snapshot(), appearance: options.appearance };
  const theme: ThemeState = { ...holoTheme(snapshot), reducedMotion: true };
  applyTheme(frame, theme);
  const posters = createPosterBag({
    appearance: options.appearance,
    reducedMotion: true,
    frozen: true,
  });
  const context: HoloContext = {
    store: options.store,
    router: NO_ROUTING,
    route: HOME,
    snapshot,
    theme,
    frozen: true,
    interactive: false,
    posters,
    tilt: createTiltController({ reducedMotion: true, frozen: true }),
    ui: { albumSort: 'game', popover: null },
    refresh: () => {},
  };
  const app = h(
    'div',
    { class: `hc-app hc-app--preview ${finishClass(snapshot, unlocked)}`, inert: true },
    h('div', { class: 'hc-top-slot' }, header(context)),
    h('div', { class: 'hc-main' }, homeScreen(context).element),
  );
  mount(frame, app);
  return () => {
    posters.destroy();
    frame.replaceChildren();
  };
}
