import { h } from './dom';

/**
 * The game menu over the living beach: the title written in the wet sand, and the ways to
 * play on a glassy card.
 */
export interface MenuEntry {
  id: string;
  label: string;
  detail: string;
  badge?: string;
  primary?: boolean;
}

export function titleMenu(
  entries: readonly MenuEntry[],
  onPick?: (id: string) => void,
): HTMLElement {
  const list = h('ul', { class: 'bt-menu__list' });
  for (const entry of entries) {
    list.append(
      h(
        'li',
        {},
        h(
          'button',
          {
            class: `bt-menu__item${entry.primary ? ' bt-menu__item--primary' : ''}`,
            type: 'button',
            'data-mode': entry.id,
            onclick: () => onPick?.(entry.id),
          },
          h(
            'span',
            { class: 'bt-menu__label' },
            entry.label,
            entry.badge ? h('span', { class: 'bt-menu__badge' }, entry.badge) : null,
          ),
          h('span', { class: 'bt-menu__detail' }, entry.detail),
        ),
      ),
    );
  }
  const link = (id: string, label: string) =>
    h(
      'button',
      { class: 'bt-link', type: 'button', 'data-mode': id, onclick: () => onPick?.(id) },
      label,
    );
  return h(
    'nav',
    { class: 'bt-menu', 'aria-label': 'Game menu', 'data-testid': 'bt-menu' },
    list,
    h(
      'p',
      { class: 'bt-menu__more' },
      link('records', 'Records'),
      link('help', 'How to play'),
      link('settings', 'Settings'),
    ),
  );
}

export function titleInSand(x: number, y: number): HTMLElement {
  return h(
    'header',
    { class: 'bt-title', style: `left:${x}px;top:${y}px` },
    h('h1', { class: 'bt-title__name' }, 'Before the Tide'),
    h('p', { class: 'bt-title__tagline' }, 'Guess the word before the sea does.'),
  );
}
