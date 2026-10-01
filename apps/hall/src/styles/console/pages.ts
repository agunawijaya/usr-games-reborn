import './pages.css';
import { aboutContent } from '../../core/screens/about/about-content';
import { closetRoom } from '../../core/screens/closet/closet';
import {
  ALL_SECTIONS,
  type SettingsSection,
  settingsPanel,
} from '../../core/screens/settings/settings-panel';
import { type Child, h } from '../../ui/h';
import type { ConsoleContext } from './context';
import type { ConsoleScreen } from './home';
import { glyph } from './icons';
import { escapeGoesTo } from './profile';
import { topBar } from './top-bar';

/**
 * Console Home's frames for the pages every style shares: Settings, About and the server
 * closet. The content comes from core/screens; these add the Console chrome around it, a way
 * back, and (in Settings) a list of sections to jump between.
 */

/** Screenshot scenes pin the closet's lights and fan to one moment. */
const FROZEN_CLOSET_TIME = 12.5;

const SECTION_NAMES: Record<SettingsSection, string> = {
  style: 'Style',
  palette: 'Colour',
  appearance: 'Day or night',
  sound: 'Sound',
  motion: 'Motion',
  accessibility: 'Accessibility',
  controls: 'Controls',
  language: 'Language',
  data: 'Your data',
};

function pageHead(options: {
  back: { href: string; label: string };
  eyebrow: string;
  title: string;
  lede?: string;
  id: string;
}): HTMLElement {
  return h(
    'header',
    { class: 'ch-page-head' },
    h(
      'a',
      { class: 'ch-back', href: options.back.href, dataset: { focusKey: 'ch-back' } },
      glyph('back'),
      h('span', null, options.back.label),
    ),
    h('p', { class: 'ch-eyebrow' }, options.eyebrow),
    h('h1', { id: options.id, class: 'ch-page-head__title' }, options.title),
    options.lede ? h('p', { class: 'ch-page-head__lede' }, options.lede) : null,
  );
}

/** Pages that manage their own content only need a fresh top bar when the player's data changes. */
function refreshTopBar(element: HTMLElement) {
  return (context: ConsoleContext) =>
    element.querySelector('.ch-topbar')?.replaceWith(topBar(context));
}

function page(context: ConsoleContext, className: string, labelledBy: string, ...body: Child[]) {
  return h(
    'div',
    { class: ['ch-page', className] },
    topBar(context),
    h('div', { class: 'ch-page__inner', 'aria-labelledby': labelledBy, role: 'region' }, body),
  );
}

/**
 * The shared panel lists skins by name; Console shows each one as a swatch of its own chrome,
 * the same swatch as on the profile, so players see the colour before they choose it.
 */
function paintSkinSwatches(panel: HTMLElement) {
  for (const input of panel.querySelectorAll<HTMLInputElement>(
    '.set-section--palette .set-radio',
  )) {
    const label = input.closest('.set-choice');
    if (!label || label.querySelector('.ch-swatch')) continue;
    label.insertBefore(
      h(
        'span',
        { class: 'ch-swatch', dataset: { skin: input.value }, 'aria-hidden': 'true' },
        h('span', { class: 'ch-swatch__ring' }),
        h('span', { class: 'ch-swatch__pill' }),
        h('span', { class: 'ch-swatch__chip' }),
      ),
      input.nextSibling,
    );
  }
}

/** Jump links to each settings section; the one in view is marked as it scrolls past. */
function sectionNav(panel: HTMLElement, reducedMotion: boolean) {
  const buttons = new Map<SettingsSection, HTMLButtonElement>();
  const nav = h(
    'nav',
    { class: 'ch-settings-nav', 'aria-label': 'Settings sections' },
    h(
      'ul',
      null,
      ALL_SECTIONS.map((key) => {
        const button = h(
          'button',
          {
            type: 'button',
            class: 'ch-settings-nav__link',
            dataset: { focusKey: `ch-set-nav:${key}` },
            onclick: () => {
              const target = panel.querySelector<HTMLElement>(`[data-section="${key}"]`);
              if (!target) return;
              target.tabIndex = -1;
              target.scrollIntoView({
                block: 'start',
                behavior: reducedMotion ? 'auto' : 'smooth',
              });
              target.focus({ preventScroll: true });
            },
          },
          SECTION_NAMES[key],
        );
        buttons.set(key, button);
        return h('li', null, button);
      }),
    ),
    h(
      'a',
      { class: 'ch-settings-nav__about', href: '#/about' },
      glyph('more'),
      h('span', null, 'About these games'),
    ),
  );

  const mark = (key: SettingsSection) => {
    for (const [section, button] of buttons) {
      button.classList.toggle('is-current', section === key);
      if (section === key) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  };
  mark('style');
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const key = (visible?.target as HTMLElement | undefined)?.dataset.section;
      if (key) mark(key as SettingsSection);
    },
    { rootMargin: '-20% 0px -60% 0px' },
  );
  const observe = () => {
    observer.disconnect();
    panel.querySelectorAll('[data-section]').forEach((section) => observer.observe(section));
  };
  const refresh = () => {
    observe();
    paintSkinSwatches(panel);
  };
  refresh();
  // The panel re-renders its sections when a setting changes; follow the new elements.
  const watcher = new MutationObserver(refresh);
  watcher.observe(panel, { childList: true });
  return {
    nav,
    destroy() {
      observer.disconnect();
      watcher.disconnect();
    },
  };
}

export function settingsScreen(context: ConsoleContext): ConsoleScreen {
  const panel = settingsPanel({ store: context.store, wording: 'plain' });
  const navigation = sectionNav(panel.element, context.theme.reducedMotion);
  const element = page(
    context,
    'ch-settings',
    'ch-settings-title',
    pageHead({
      back: { href: '#/', label: 'Home' },
      eyebrow: 'Settings',
      title: 'Make it yours',
      lede: 'Changes save as you go. Your level and achievements are the same in every style.',
      id: 'ch-settings-title',
    }),
    h('div', { class: 'ch-settings__layout' }, navigation.nav, panel.element),
  );
  const cleanups: (() => void)[] = [];
  // Escape inside Settings may be a key being remapped; the panel stops it before it gets here.
  if (context.interactive) cleanups.push(escapeGoesTo('#/', context));
  return {
    element,
    title: 'Settings',
    update: refreshTopBar(element),
    destroy() {
      for (const cleanup of cleanups) cleanup();
      navigation.destroy();
      panel.destroy();
    },
  };
}

export function aboutScreen(context: ConsoleContext): ConsoleScreen {
  const element = page(
    context,
    'ch-about',
    'ch-about-title',
    pageHead({
      back: { href: '#/', label: 'Home' },
      eyebrow: 'About',
      title: 'Old games, new life',
      lede: 'Where these games come from, how the Hall works, and the people who wrote the originals.',
      id: 'ch-about-title',
    }),
    h('div', { class: 'ch-about__body' }, aboutContent({ store: context.store, wording: 'plain' })),
  );
  const cleanups: (() => void)[] = [];
  if (context.interactive) cleanups.push(escapeGoesTo('#/', context));
  return {
    element,
    title: 'About',
    update: refreshTopBar(element),
    destroy: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

export function closetScreen(context: ConsoleContext): ConsoleScreen {
  const frozen = document.documentElement.dataset.frozen === 'true';
  const room = closetRoom({
    store: context.store,
    wording: 'plain',
    ...(frozen ? { frozenAt: FROZEN_CLOSET_TIME } : {}),
  });
  const element = page(
    context,
    'ch-closet',
    'ch-closet-title',
    pageHead({
      back: { href: '#/home', label: 'Your profile' },
      eyebrow: 'Behind the racks',
      title: 'The server closet',
      id: 'ch-closet-title',
    }),
    h('div', { class: 'ch-closet__room' }, room.element),
  );
  const cleanups: (() => void)[] = [];
  if (context.interactive) cleanups.push(escapeGoesTo('#/home', context));
  return {
    element,
    title: 'The server closet',
    update: refreshTopBar(element),
    destroy() {
      for (const cleanup of cleanups) cleanup();
      room.destroy();
    },
  };
}
