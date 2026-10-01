import { CATEGORIES, type Category } from '@usr-games/kit/manifest';
import { type MountedPoster, mountPoster } from '../../core/art/art';
import type { ProcessRow } from '../../core/home-model';
import { CATEGORY_NAMES, gameHref } from '../../core/plain';
import { playSound } from '../../core/sound';
import { h } from '../../ui/h';
import { type ConsoleContext, goTo } from './context';
import { buildHeroLayer, crossFade, type HeroLayer } from './hero';
import { glyph } from './icons';
import { isPick, railModel, rememberSelection, selectedId } from './model';
import { topBar } from './top-bar';

/**
 * Console Home: the hero stage on top, category chips, and one rail of large tiles. Moving
 * along the rail (arrows, wheel, hover or focus) selects a game; the hero follows within a
 * blink. Enter on a tile, or More in the hero, opens the game's page.
 */

export interface ConsoleScreen {
  element: HTMLElement;
  title: string;
  /**
   * Screens that keep live state of their own (the settings panel, the closet's switches) take
   * new data here instead of being rebuilt, so focus and state survive a change.
   */
  update?(context: ConsoleContext): void;
  destroy(): void;
}

const HOVER_DELAY_MS = 90;
const WHEEL_STEP_MS = 140;

function chips(category: Category | null, total: number, ready: number): HTMLElement {
  const chip = (label: string, value: Category | null) =>
    h(
      'li',
      null,
      h(
        'a',
        {
          class: ['ch-chip', category === value && 'is-current'],
          href: value ? `#/games/${value}` : '#/',
          'aria-current': category === value ? 'page' : undefined,
          dataset: { focusKey: `ch-chip:${value ?? 'all'}` },
        },
        label,
      ),
    );
  return h(
    'nav',
    { class: 'ch-chips', 'aria-label': 'Categories' },
    h('ul', { class: 'ch-chips__list' }, [
      chip('All', null),
      ...CATEGORIES.map((c) => chip(CATEGORY_NAMES[c], c)),
    ]),
    h(
      'p',
      { class: 'ch-chips__count' },
      `${total} ${total === 1 ? 'game' : 'games'} · ${ready} ready to play`,
    ),
  );
}

function tileLabel(row: ProcessRow, pick: boolean): string {
  const status =
    row.state === 'R' ? 'Ready to play' : row.state === 'D' ? 'Arriving soon' : 'Coming soon';
  return `${row.entry.manifest.title}. ${pick ? 'Today’s pick. ' : ''}${status}.`;
}

export function homeScreen(context: ConsoleContext, category: Category | null): ConsoleScreen {
  const model = railModel(context.store, context.snapshot, category);
  let selected = selectedId(model);
  const tilePosters = new Map<string, MountedPoster>();
  const tiles = new Map<string, HTMLAnchorElement>();
  const cleanups: (() => void)[] = [];
  const animateTiles =
    context.interactive && !context.theme.reducedMotion && context.frozenAt === undefined;

  const heroLayers = h('div', { class: 'ch-hero__layers' });
  let hero: HeroLayer | null = null;
  const bleed = h('div', { class: 'ch-bleed', 'aria-hidden': 'true' });

  const list = h('ul', { class: 'ch-rail__list', role: 'list' });
  for (const row of model.rows) {
    const id = row.entry.manifest.id;
    const pick = isPick(model, row);
    const art = h('span', { class: 'ch-tile__art' });
    const tile = h(
      'a',
      {
        class: ['ch-tile', `ch-tile--${row.state === 'R' ? 'ready' : 'soon'}`],
        href: gameHref(id),
        tabindex: '-1',
        'aria-label': tileLabel(row, pick),
        dataset: { game: id, focusKey: `ch-tile:${id}` },
        style: { '--ch-accent-raw': row.entry.manifest.accent },
      },
      art,
      pick
        ? h('span', { class: 'ch-tile__badge ch-tile__badge--pick' }, 'Today’s pick')
        : row.state !== 'R'
          ? h(
              'span',
              { class: 'ch-tile__badge' },
              row.state === 'D' ? 'Arriving soon' : 'Coming soon',
            )
          : null,
      h('span', { class: 'ch-tile__title' }, row.entry.manifest.title),
    );
    tiles.set(id, tile);
    tilePosters.set(
      id,
      mountPoster(art, row.entry, {
        appearance: context.theme.appearance,
        animate: false,
        reducedMotion: context.theme.reducedMotion,
        className: 'ch-poster',
      }),
    );
    list.append(h('li', { class: 'ch-rail__item' }, tile));
  }

  const rowById = (id: string | null) =>
    model.rows.find((row) => row.entry.manifest.id === id) ?? null;
  const ids = model.rows.map((row) => row.entry.manifest.id);

  function select(id: string, options: { focus?: boolean; scroll?: boolean } = {}) {
    const row = rowById(id);
    if (!row) return;
    const previous = selected;
    selected = id;
    rememberSelection(id);
    for (const [tileId, tile] of tiles) {
      const on = tileId === id;
      tile.classList.toggle('is-selected', on);
      tile.tabIndex = on ? 0 : -1;
      if (on) tile.setAttribute('aria-current', 'true');
      else tile.removeAttribute('aria-current');
    }
    if (previous && previous !== id) tilePosters.get(previous)?.setAnimating(false);
    if (animateTiles) tilePosters.get(id)?.setAnimating(true);
    const tile = tiles.get(id);
    if (options.focus) tile?.focus({ preventScroll: true });
    if (options.scroll !== false) {
      tile?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: context.theme.reducedMotion ? 'auto' : 'smooth',
      });
    }
    bleed.style.setProperty('--ch-glow', row.entry.manifest.accent);
    if (previous === id && hero) return;
    const next = buildHeroLayer(row, isPick(model, row), context);
    crossFade(heroLayers, hero, next, !context.interactive || context.theme.reducedMotion);
    hero = next;
  }

  function step(delta: number, focus: boolean) {
    const index = Math.max(0, ids.indexOf(selected ?? ''));
    const target = ids[Math.min(ids.length - 1, Math.max(0, index + delta))];
    if (!target) return;
    // A soft click for every move along the rail, none when it is already at the end.
    if (target !== selected) playSound(context.store, 'keyClick');
    select(target, { focus });
  }

  const previousButton = h(
    'button',
    {
      class: 'ch-rail__nudge ch-rail__nudge--prev',
      type: 'button',
      'aria-label': 'Previous game',
      onclick: () => step(-1, false),
    },
    glyph('back'),
  );
  const nextButton = h(
    'button',
    {
      class: 'ch-rail__nudge ch-rail__nudge--next',
      type: 'button',
      'aria-label': 'Next game',
      onclick: () => step(1, false),
    },
    glyph('back', 'ch-icon ch-icon--flip'),
  );
  const rail = h(
    'section',
    {
      class: 'ch-rail',
      'aria-label': category ? `${CATEGORY_NAMES[category]} games` : 'All games',
    },
    previousButton,
    list,
    nextButton,
  );

  const ready = model.rows.filter((row) => row.state === 'R').length;
  const element = h(
    'div',
    { class: 'ch-home' },
    h('h1', { class: 'visually-hidden' }, 'Home'),
    h('section', { class: 'ch-stage', 'aria-label': 'Selected game' }, heroLayers, topBar(context)),
    h('div', { class: 'ch-lower' }, bleed, chips(category, model.rows.length, ready), rail),
  );

  if (context.interactive) {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      const inRail = list.contains(target);
      const idle = target === document.body || target.id === 'screen';
      if (!inRail && !idle) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1, true);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const target = event.key === 'Home' ? ids[0] : ids[ids.length - 1];
        if (target && target !== selected) playSound(context.store, 'keyClick');
        if (target) select(target, { focus: true });
      } else if (event.key === 'Enter' && idle && selected) {
        event.preventDefault();
        playSound(context.store, 'select');
        goTo(gameHref(selected));
      }
    };
    document.addEventListener('keydown', onKey);
    cleanups.push(() => document.removeEventListener('keydown', onKey));

    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    list.addEventListener('pointerover', (event) => {
      const tile = (event.target as HTMLElement).closest<HTMLElement>('.ch-tile');
      const id = tile?.dataset.game;
      if (!id || id === selected) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => select(id, { scroll: false }), HOVER_DELAY_MS);
    });
    list.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
    list.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.ch-tile')) playSound(context.store, 'select');
    });
    list.addEventListener('focusin', (event) => {
      const id = (event.target as HTMLElement).dataset.game;
      if (id && id !== selected) select(id);
    });

    let lastWheel = 0;
    rail.addEventListener(
      'wheel',
      (event) => {
        const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (delta === 0) return;
        event.preventDefault();
        const now = performance.now();
        if (now - lastWheel < WHEEL_STEP_MS) return;
        lastWheel = now;
        step(delta > 0 ? 1 : -1, false);
      },
      { passive: false },
    );
    cleanups.push(() => clearTimeout(hoverTimer));
  }

  if (selected) select(selected, { scroll: false });
  // Bring the selection into view once laid out, without animating the first paint.
  requestAnimationFrame(() => {
    const tile = selected ? tiles.get(selected) : undefined;
    if (tile) list.scrollLeft = Math.max(0, tile.offsetLeft - list.clientWidth * 0.08);
  });

  return {
    element,
    title: 'Home',
    destroy() {
      for (const cleanup of cleanups) cleanup();
      for (const poster of tilePosters.values()) poster.destroy();
      hero?.poster.destroy();
    },
  };
}
