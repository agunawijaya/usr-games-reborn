import { describeCode, type PauseMenuItem } from '@usr-games/kit';
import type { CatalogEntry } from '../../catalog/catalog';
import type { HallStore } from '../../store/hall-store';
import { h } from '../../ui/h';
import { howToPlay } from '../plain';
import { type SettingsPanel, settingsPanel } from '../screens/settings/settings-panel';
import { keyCap, labelNodes } from './chrome';
import { type PlayerIconName, playerIcon } from './icons';
import { type PauseEntry, type PauseEntryKind, pauseEntries } from './menu';
import { trapFocus } from './overlays';
import type { Wording } from './wording';

/**
 * The pause sheet: the standard menu, plus How to play and Settings as views inside the same
 * dialog so the player never loses their place. A view opened straight from the game (the game
 * called `openSettings`) closes back to the game instead of to the menu.
 */

export type PauseView = 'menu' | 'how-to-play' | 'settings';

export interface PauseSheetOptions {
  entry: CatalogEntry;
  store: HallStore;
  wording: Wording;
  items: readonly PauseMenuItem[];
  view: PauseView;
  onChoose(entry: PauseEntry): void;
  onResume(): void;
}

export interface PauseSheet {
  element: HTMLElement;
  /** What Escape does: a view steps back to the menu, the menu resumes the game. */
  back(): void;
  /** Puts focus where it belongs for the current view; call once the sheet is on the page. */
  focus(): void;
  setItems(items: readonly PauseMenuItem[]): void;
  destroy(): void;
}

const ENTRY_ICONS: Partial<Record<PauseEntryKind, PlayerIconName>> = {
  resume: 'play',
  'how-to-play': 'book',
  settings: 'sliders',
  'game-menu': 'grid',
  hall: 'back',
};

const VIEW_TITLES: Record<PauseView, string> = {
  menu: 'Paused',
  'how-to-play': 'How to play',
  settings: 'Settings',
};

function kicker(entry: CatalogEntry, wording: Wording): string {
  const { id, title } = entry.manifest;
  return wording === 'unix' ? `[1]+  Stopped    ${id}` : title;
}

function controlsList(entry: CatalogEntry, store: HallStore): HTMLElement | null {
  const controls = entry.manifest.controls ?? [];
  if (controls.length === 0) return null;
  const overrides = store.settings.get().bindings[entry.manifest.id] ?? {};
  return h(
    'section',
    { class: 'pl-controls', 'aria-labelledby': 'pl-controls-title' },
    h('h3', { id: 'pl-controls-title', class: 'pl-sheet__subtitle' }, 'Controls'),
    h(
      'dl',
      { class: 'pl-controls__list' },
      controls.map((control) =>
        h(
          'div',
          { class: 'pl-controls__row' },
          h('dt', null, control.label),
          h(
            'dd',
            null,
            (overrides[control.action] ?? control.keys).map((code) => keyCap(describeCode(code))),
          ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'pl-sheet__note' },
      'Change these in Settings. ',
      keyCap('Esc'),
      ' pauses at any time.',
    ),
  );
}

export function pauseSheet(options: PauseSheetOptions): PauseSheet {
  const { entry, store, wording } = options;
  const openedDirectly = options.view !== 'menu';
  let view = options.view;
  let items = options.items;
  let panel: SettingsPanel | null = null;
  let returnTo: string | null = null;

  const title = h('h2', { id: 'pl-pause-title', class: 'pl-sheet__title' });
  // The way back sits in the header, so it stays in reach however far Settings scrolls.
  const backSlot = h('div', { class: 'pl-sheet__nav' });
  const body = h('div', { class: 'pl-sheet__body' });
  const sheet = h(
    'section',
    {
      class: 'pl-sheet pl-sheet--pause',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'pl-pause-title',
    },
    h(
      'header',
      { class: 'pl-sheet__head' },
      backSlot,
      h('p', { class: 'pl-sheet__kicker' }, kicker(entry, wording)),
      title,
    ),
    body,
  );
  const element = h('div', { class: 'pl-scrim', dataset: { testid: 'pl-pause' } }, sheet);
  const release = trapFocus(sheet);

  function menuView(): HTMLElement {
    return h(
      'ul',
      { class: 'pl-menu', role: 'list' },
      pauseEntries(items).map((item) =>
        h(
          'li',
          null,
          h(
            'button',
            {
              type: 'button',
              class: ['pl-menu__item', item.kind === 'resume' && 'pl-menu__item--primary'],
              dataset: { entry: item.id },
              onclick: () => choose(item),
            },
            ENTRY_ICONS[item.kind] ? playerIcon(ENTRY_ICONS[item.kind] as PlayerIconName) : null,
            h('span', { class: 'pl-menu__label' }, labelNodes(item.label)),
            item.shortcut ? keyCap(item.shortcut) : null,
          ),
        ),
      ),
    );
  }

  function backButton(): HTMLElement {
    return h(
      'button',
      {
        type: 'button',
        class: 'pl-button pl-button--quiet pl-sheet__back',
        dataset: { testid: 'pl-view-back' },
        onclick: back,
      },
      openedDirectly ? 'Done' : labelNodes('← Pause menu'),
    );
  }

  function howToPlayView(): HTMLElement {
    return h(
      'div',
      { class: 'pl-view' },
      h(
        'ul',
        { class: 'pl-howto' },
        howToPlay(entry).map((line) => h('li', null, line)),
      ),
      controlsList(entry, store),
    );
  }

  function settingsView(): HTMLElement {
    panel = settingsPanel({
      store,
      wording,
      sections: ['appearance', 'sound', 'motion', 'accessibility', 'controls'],
      gameId: entry.manifest.id,
    });
    return h('div', { class: 'pl-view pl-view--settings' }, panel.element);
  }

  function render(next: PauseView) {
    panel?.destroy();
    panel = null;
    view = next;
    title.textContent = VIEW_TITLES[next];
    sheet.dataset.view = next;
    backSlot.replaceChildren(next === 'menu' ? '' : backButton());
    backSlot.hidden = next === 'menu';
    body.replaceChildren(
      next === 'menu' ? menuView() : next === 'how-to-play' ? howToPlayView() : settingsView(),
    );
    focus();
  }

  function focus() {
    const target =
      view === 'menu'
        ? (returnTo && body.querySelector<HTMLElement>(`[data-entry="${returnTo}"]`)) ||
          body.querySelector<HTMLElement>('.pl-menu__item')
        : backSlot.querySelector<HTMLElement>('.pl-sheet__back');
    target?.focus({ preventScroll: true });
  }

  function choose(item: PauseEntry) {
    if (item.kind === 'how-to-play' || item.kind === 'settings') {
      returnTo = item.id;
      render(item.kind);
      return;
    }
    options.onChoose(item);
  }

  function back() {
    if (view !== 'menu' && !openedDirectly) render('menu');
    else options.onResume();
  }

  render(view);

  return {
    element,
    back,
    focus,
    setItems(next) {
      items = next;
      if (view === 'menu') render('menu');
    },
    destroy() {
      release();
      panel?.destroy();
      element.remove();
    },
  };
}
