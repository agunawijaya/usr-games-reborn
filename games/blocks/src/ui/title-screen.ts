import type { LookId } from '../render/look';
import { TankView } from '../render/view';
import { h } from './dom';

/**
 * The game menu: the sea fills the screen with the house diver playing in the tank, and the menu
 * sits on the left over a soft veil of water. Arrow keys move through the menu; Enter chooses.
 */

/** On a wide screen the tank stands to the right of the menu, where the veil leaves it clear. */
const TITLE_LAYOUT = { topShare: 0.09, floorShare: 0.08, shiftShare: 0.17, maxCell: 50 };

export interface MenuEntry {
  label: string;
  meta: string;
  primary?: boolean;
  run: () => void;
}

export interface TitleScreen {
  root: HTMLElement;
  view: TankView;
  setLook(look: LookId): void;
  fit(): void;
  focus(): void;
}

export function createTitleScreen(
  host: HTMLElement,
  look: LookId,
  entries: readonly MenuEntry[],
  options: { hallChrome?: boolean } = {},
): TitleScreen {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const menu = h(
    'ol',
    { class: 'snk-menu', 'aria-label': 'Game menu' },
    ...entries.map((entry) =>
      h(
        'li',
        { class: entry.primary ? 'is-primary' : undefined },
        h(
          'button',
          { type: 'button', onclick: entry.run },
          h('span', { class: 'snk-menu__label' }, entry.label),
          h('small', {}, entry.meta),
        ),
      ),
    ),
  );
  const column = h(
    'div',
    { class: 'snk-titlescreen__column' },
    h('h1', { class: 'snk-titlescreen__mark' }, 'Sinkers'),
    h('p', { class: 'snk-titlescreen__tagline' }, 'Drop deep. Fill the row. Ride the bubbles.'),
    menu,
    h(
      'p',
      { class: 'snk-titlescreen__credit' },
      'Inspired by the 1992 Berkeley falling-blocks game, born in the 1989 Obfuscated C contest.',
    ),
  );
  const root = h(
    'section',
    {
      class: `snk-titlescreen${options.hallChrome ? ' is-in-hall' : ''}`,
      'data-look': look,
      'aria-label': 'Sinkers',
    },
    canvas,
    h('div', { class: 'snk-titlescreen__veil' }),
    column,
  );
  host.append(root);
  const view = new TankView(canvas, TITLE_LAYOUT);
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('button')];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
  });
  return {
    root,
    view,
    setLook(next) {
      root.dataset.look = next;
    },
    fit() {
      const box = root.getBoundingClientRect();
      const wide = box.width >= 1100;
      view.resize(
        box.width,
        box.height,
        window.devicePixelRatio || 1,
        wide ? TITLE_LAYOUT : { topShare: 0.1, floorShare: 0.08 },
      );
    },
    focus() {
      menu.querySelector('button')?.focus();
    },
  };
}
