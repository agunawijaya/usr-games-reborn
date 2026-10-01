import { THEME_IDS, THEMES, type ThemeId } from '@usr-games/kit';
import { rankProgress } from '@usr-games/kit/progression';
import { processRows, systemLine } from '../../core/home-model';
import { applyTheme, type ThemeState, tokensFor } from '../../core/palette';
import { playSound } from '../../core/sound';
import type { PreviewOptions, StyleDeps, StyleInstance } from '../../core/style-module';
import { HOME, type Route } from '../../router';
import type { HallSnapshot, HallStore } from '../../store/hall-store';
import { formatClock, formatNumber } from '../../ui/format';
import { h, mount } from '../../ui/h';
import { icon } from '../../ui/icons';
import { barMeter } from '../../ui/meter';
import { createAmbience, drawAmbienceStill } from './ambience/ambience';
import { aboutScreen } from './screens/about/about';
import { closetScreen } from './screens/closet/closet';
import { homeScreen } from './screens/home/home';
import { manPageScreen } from './screens/man/man-page';
import { profileScreen } from './screens/profile/profile';
import type { Screen, ScreenContext } from './screens/screen';
import { settingsScreen } from './screens/settings/settings';
import { createPreviewManager, type PreviewManager } from './ui/previews';
import { promptLine } from './ui/prompt';
import { createRankUpStage } from './ui/rank-up';

/**
 * The shell of the machine room: the console header with the prompt, the `top` line, the
 * ambience behind everything, and the screen for the current route. It re-renders the screen
 * when the route or the stored state changes, keeping focus and scroll where the player was.
 */

/** Screenshot scenes pin the ambience to a moment that shows each room at its best. */
const FROZEN_AMBIENCE_TIME = 41.7;

function machineRoomTheme(
  snapshot: HallSnapshot,
  theme: ThemeId = snapshot.settings.theme,
): ThemeState & { theme: ThemeId } {
  return {
    style: 'machine-room',
    theme,
    appearance: snapshot.appearance,
    colorBlindPalette: snapshot.settings.colorBlindPalette,
    reducedMotion: snapshot.reducedMotion,
  };
}

function screenFor(route: Route, context: ScreenContext): Screen {
  switch (route.name) {
    case 'home':
      return homeScreen(context);
    case 'man':
      return manPageScreen(context, route.id);
    case 'profile':
      return profileScreen(context);
    case 'settings':
      return settingsScreen(context);
    case 'about':
      return aboutScreen(context);
    case 'closet':
      return closetScreen(context);
    // The style host shows full-page screens for these routes; should one ever reach the room,
    // the process list is the safe place to land.
    case 'run':
    case 'login':
    case 'welcome':
      return homeScreen(context);
  }
}

/** How deep a route sits below the process list, so moving up sounds like going back. */
function depthOf(route: Route): number {
  switch (route.name) {
    case 'home':
      return route.dir ? 1 : 0;
    case 'closet':
      return 2;
    default:
      return 1;
  }
}

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
/** A focus move this soon after an arrow key was caused by it, and earns a key click. */
const ARROW_FOCUS_WINDOW_MS = 120;

function nextTheme(theme: ThemeId): ThemeId {
  return THEME_IDS[(THEME_IDS.indexOf(theme) + 1) % THEME_IDS.length] as ThemeId;
}

/** The room's floor: the ways into the machine's quieter corners. */
function roomFooter(): HTMLElement {
  const link = (href: string, path: string, label: string) =>
    h(
      'a',
      { class: 'room__footer-link', href, dataset: { focusKey: `footer:${href}` } },
      h('span', { class: 'room__footer-path', 'aria-hidden': 'true' }, path),
      h('span', { class: 'room__footer-label' }, label),
    );
  return h(
    'footer',
    { class: 'room__footer' },
    h(
      'nav',
      { class: 'room__footer-nav', 'aria-label': 'About the machine' },
      link('#/about', '/etc/motd', 'About'),
      link('#/settings', '~/.config/hall', 'Settings'),
      link('#/closet', '/var/closet', 'The server closet'),
    ),
    h(
      'p',
      { class: 'room__footer-note' },
      'Reborn from the BSD games. No tracking; everything stays in this browser.',
    ),
  );
}

function roomFrame(onSkip: () => void) {
  const header = h('header', { class: 'console' });
  const topline = h('div', { class: 'topline', role: 'status', 'aria-live': 'off' });
  const main = h('main', { id: 'screen', class: 'room__main', tabindex: '-1' });
  const skip = h(
    'button',
    { class: 'skip-link', type: 'button', onclick: onSkip },
    'Skip to content',
  );
  const room = h(
    'div',
    { class: 'room' },
    skip,
    h('div', { class: 'room__inner' }, header, topline, main, roomFooter()),
  );
  return { room, header, topline, main };
}

function renderHeader(
  header: HTMLElement,
  current: Screen,
  snapshot: HallSnapshot,
  theme: ThemeState & { theme: ThemeId },
  store: HallStore,
) {
  const progress = rankProgress(snapshot.progression.xp);
  const themeName = THEMES[theme.theme].name;
  const upcoming = THEMES[nextTheme(theme.theme)].name;
  const otherAppearance = theme.appearance === 'dark' ? 'light' : 'dark';
  mount(
    header,
    h(
      'a',
      {
        class: 'brand',
        href: '#/',
        'aria-label': '/usr/games Reborn: the process list',
        dataset: { focusKey: 'brand' },
      },
      icon('brand', 'icon brand__mark'),
      h(
        'span',
        { class: 'brand__name' },
        h('span', { class: 'brand__path' }, '/usr/games'),
        h('span', { class: 'brand__reborn' }, 'Reborn'),
      ),
    ),
    promptLine({ rank: progress.rank.id, cwd: current.cwd, command: current.command }),
    h(
      'nav',
      { class: 'console__tools', 'aria-label': 'Your account and the room' },
      h(
        'a',
        {
          class: 'rank-chip',
          href: '#/home',
          dataset: { focusKey: 'rank-chip' },
          'aria-label': `Your home directory. Rank ${progress.rank.id}, ${formatNumber(snapshot.progression.xp)} XP.`,
        },
        h('span', { class: 'rank-chip__rank' }, progress.rank.id),
        barMeter({
          fraction: progress.fraction,
          label: 'Progress to the next rank',
          valueText: `${Math.round(progress.fraction * 100)}%`,
          className: 'bar--chip',
        }),
        h('span', { class: 'rank-chip__xp' }, `${formatNumber(snapshot.progression.xp)} XP`),
      ),
      h(
        'button',
        {
          class: 'tool',
          type: 'button',
          dataset: { focusKey: 'tool-theme' },
          'aria-label': `Theme: ${themeName}. Switch to ${upcoming}.`,
          onclick: () => {
            playSound(store, 'select');
            store.settings.update({ theme: nextTheme(theme.theme) });
          },
        },
        h('span', { class: 'tool__swatch', 'aria-hidden': 'true' }),
        h('span', { class: 'tool__label' }, themeName),
      ),
      h(
        'button',
        {
          class: 'tool tool--icon',
          type: 'button',
          dataset: { focusKey: 'tool-appearance' },
          'aria-label': `Appearance: ${theme.appearance}. Switch to ${otherAppearance}.`,
          onclick: () => {
            playSound(store, 'select');
            store.settings.update({ appearance: otherAppearance });
          },
        },
        icon('appearance'),
      ),
      h(
        'a',
        {
          class: 'tool tool--icon',
          href: '#/settings',
          'aria-label': 'Settings',
          dataset: { focusKey: 'tool-settings' },
        },
        icon('settings'),
      ),
    ),
  );
}

function renderTopline(
  topline: HTMLElement,
  clock: HTMLElement,
  snapshot: HallSnapshot,
  store: HallStore,
) {
  const rows = processRows(store.catalog.listed(), snapshot.progression, snapshot.today);
  const line = systemLine(rows, snapshot.progression, snapshot.today);
  clock.textContent = formatClock(snapshot.now);
  mount(
    topline,
    h(
      'span',
      { class: 'topline__item' },
      clock,
      ` up ${line.uptimeDays} ${line.uptimeDays === 1 ? 'day' : 'days'}, 1 user`,
    ),
    h(
      'span',
      { class: 'topline__item' },
      `load average: ${line.loadAverage.map((n) => n.toFixed(2)).join(', ')}`,
    ),
    h(
      'span',
      { class: 'topline__item topline__tasks' },
      'Tasks: ',
      h('b', null, String(line.total)),
      ' total, ',
      h('b', { class: 'is-running' }, String(line.running)),
      ' running, ',
      h('b', null, String(line.arriving)),
      ' arriving, ',
      h('b', null, String(line.sleeping)),
      ' sleeping',
    ),
  );
}

export function startMachineRoom(root: HTMLElement, deps: StyleDeps): StyleInstance {
  const { store, router, frozen } = deps;
  const html = document.documentElement;
  let snapshot = store.snapshot();
  let theme = machineRoomTheme(snapshot);
  let route = router.current();
  let screen: Screen | null = null;

  applyTheme(html, theme);
  const ambience = createAmbience(document.body, {
    ...theme,
    tokens: tokensFor(theme),
    ...(frozen ? { frozenAt: FROZEN_AMBIENCE_TIME } : {}),
  });
  const previews: PreviewManager = createPreviewManager(() => theme);
  const { room, header, topline, main } = roomFrame(() => main.focus());
  mount(root, room);
  const clock = h('span', { class: 'topline__clock' });

  function render(reason: 'route' | 'state') {
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focusKey;
    const scrollY = window.scrollY;
    if (reason === 'state' && screen?.keepsItself) {
      renderHeader(header, screen, snapshot, theme, store);
      renderTopline(topline, clock, snapshot, store);
      restoreFocus(focusKey);
      return;
    }
    screen?.destroy?.();
    screen = screenFor(route, { store, router, route, snapshot, theme, previews, frozen });
    main.replaceChildren(screen.element);
    renderHeader(header, screen, snapshot, theme, store);
    renderTopline(topline, clock, snapshot, store);
    document.title =
      route.name === 'home' && !route.dir
        ? '/usr/games Reborn'
        : `${screen.title} · /usr/games Reborn`;
    if (reason === 'route') {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, scrollY);
      restoreFocus(focusKey);
    }
  }

  function restoreFocus(focusKey: string | undefined) {
    if (!focusKey) return;
    root
      .querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`)
      ?.focus({ preventScroll: true });
  }

  const stopRouting = router.subscribe((next) => {
    playSound(store, depthOf(next) < depthOf(route) ? 'back' : 'select');
    route = next;
    if (route.name === 'man') store.readManPage(route.id);
    snapshot = store.snapshot();
    render('route');
  });

  const stopWatching = store.subscribe((next, change) => {
    if (next.settings.style !== 'machine-room') return;
    const previous = theme;
    snapshot = next;
    theme = machineRoomTheme(next);
    applyTheme(html, theme, previous);
    ambience.update({
      ...theme,
      tokens: tokensFor(theme),
      ...(frozen ? { frozenAt: FROZEN_AMBIENCE_TIME } : {}),
    });
    render('state');
    if (change === 'progression') rankUp.check();
  });

  let lastArrowAt = -Infinity;
  const onArrow = (event: KeyboardEvent) => {
    if (ARROW_KEYS.has(event.key)) lastArrowAt = performance.now();
  };
  const onFocusMove = () => {
    if (performance.now() - lastArrowAt < ARROW_FOCUS_WINDOW_MS) playSound(store, 'keyClick');
  };
  root.addEventListener('keydown', onArrow);
  root.addEventListener('focusin', onFocusMove);

  const rankUp = createRankUpStage({ store, root, room, header, main, frozen });
  if (route.name === 'man') store.readManPage(route.id);
  snapshot = store.snapshot();
  render('route');
  rankUp.check();
  const ticker = frozen
    ? undefined
    : setInterval(() => (clock.textContent = formatClock(new Date())), 1000);

  return {
    destroy() {
      stopRouting();
      stopWatching();
      rankUp.destroy();
      root.removeEventListener('keydown', onArrow);
      root.removeEventListener('focusin', onFocusMove);
      clearInterval(ticker);
      screen?.destroy?.();
      previews.stopAll();
      ambience.destroy();
      root.replaceChildren();
    },
  };
}

/**
 * The Machine Room's Home, still and silent, for the style picker: the same shell and screen,
 * with the ambience painted once onto a canvas inside the frame instead of behind the page.
 */
export function previewMachineRoom(frame: HTMLElement, options: PreviewOptions): () => void {
  const snapshot = { ...options.store.snapshot(), appearance: options.appearance };
  const theme = machineRoomTheme(snapshot, options.theme ?? 'phosphor');
  applyTheme(frame, theme);
  const canvas = h('canvas', { class: 'ambience ambience--still', 'aria-hidden': 'true' });
  const previews: PreviewManager = { attach: () => {}, stopAll: () => {} };
  const route = HOME;
  const noRouting = { current: () => route, go: () => {}, subscribe: () => () => {} };
  const screen = homeScreen({
    store: options.store,
    router: noRouting,
    route,
    snapshot,
    theme,
    previews,
    frozen: true,
  });
  const { room, header, topline, main } = roomFrame(() => {});
  main.append(screen.element);
  renderHeader(header, screen, snapshot, theme, options.store);
  renderTopline(topline, h('span', { class: 'topline__clock' }), snapshot, options.store);
  mount(frame, canvas, room);
  drawAmbienceStill(canvas, { ...theme, tokens: tokensFor(theme) }, FROZEN_AMBIENCE_TIME);
  return () => frame.replaceChildren();
}
