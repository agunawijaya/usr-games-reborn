import type { AppearancePreference, StyleId } from '@usr-games/kit';
import { playSound } from '../../core/sound';
import { STYLE_COPY } from '../../core/style-module';
import { h } from '../../ui/h';
import { type ConsoleContext, goTo } from './context';
import { glyph } from './icons';
import { openOverlay } from './overlay';

/**
 * The style and appearance menu: switch to another Hall style or between Day and Night, with
 * a way on to the full Settings and to About. A real menu: arrow keys move, Enter or Space
 * chooses, Escape closes.
 */

const STYLES: StyleId[] = ['console', 'holo', 'machine-room'];
const APPEARANCES: {
  value: AppearancePreference;
  label: string;
  icon: 'sun' | 'moon' | 'device';
}[] = [
  { value: 'light', label: 'Day', icon: 'sun' },
  { value: 'dark', label: 'Night', icon: 'moon' },
  { value: 'system', label: 'Match my device', icon: 'device' },
];

function item(
  label: string,
  checked: boolean,
  onChoose: () => void,
  icon?: HTMLElement | SVGElement,
) {
  return h(
    'button',
    {
      class: ['ch-menu__item', checked && 'is-checked'],
      type: 'button',
      role: 'menuitemradio',
      'aria-checked': checked ? 'true' : 'false',
      onclick: onChoose,
    },
    icon ?? null,
    h('span', null, label),
    checked ? glyph('check', 'ch-icon ch-menu__check') : null,
  );
}

function link(label: string, hash: string, onChoose: () => void, icon: HTMLElement | SVGElement) {
  return h(
    'button',
    {
      class: 'ch-menu__item',
      type: 'button',
      role: 'menuitem',
      onclick: () => {
        onChoose();
        goTo(hash);
      },
    },
    icon,
    h('span', null, label),
  );
}

export function openStyleMenu(context: ConsoleContext, trigger: HTMLElement): void {
  const { store } = context;
  const settings = store.settings.get();
  let close = () => {};
  playSound(store, 'select');
  const menu = h(
    'div',
    { class: 'ch-menu', role: 'menu', 'aria-label': 'Style and appearance' },
    h('p', { class: 'ch-menu__heading', 'aria-hidden': 'true' }, 'Style'),
    STYLES.map((style) =>
      item(STYLE_COPY[style].name, style === settings.style, () => {
        close();
        playSound(store, 'select');
        if (style !== settings.style) store.chooseStyle(style);
      }),
    ),
    h('p', { class: 'ch-menu__heading', 'aria-hidden': 'true' }, 'Appearance'),
    APPEARANCES.map((option) =>
      item(
        option.label,
        option.value === settings.appearance,
        () => {
          close();
          playSound(store, 'select');
          store.settings.update({ appearance: option.value });
        },
        glyph(option.icon),
      ),
    ),
    h('hr', { class: 'ch-menu__rule', 'aria-hidden': 'true' }),
    link('All settings', '#/settings', () => close(), glyph('settings')),
    link('About these games', '#/about', () => close(), glyph('more')),
  );
  const rect = trigger.getBoundingClientRect();
  menu.style.top = `${Math.round(rect.bottom + 10)}px`;
  menu.style.right = `${Math.round(window.innerWidth - rect.right)}px`;

  const items = () => [
    ...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]'),
  ];
  close = openOverlay(context.overlays, trigger, menu, {
    initialFocus: () => menu.querySelector<HTMLElement>('.is-checked') ?? items()[0] ?? null,
    onKey(event) {
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const move = (to: number) => {
        event.preventDefault();
        list[(to + list.length) % list.length]?.focus();
      };
      if (event.key === 'ArrowDown') move(index + 1);
      else if (event.key === 'ArrowUp') move(index - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(list.length - 1);
      else if (event.key === 'Tab') close();
    },
  });
}
