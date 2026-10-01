import { h } from '../../ui/h';
import { type PlayerIconName, playerIcon } from './icons';
import type { Announcement, AnnouncementKind } from './receipt';

/**
 * XP toasts: one small card per result or achievement, stacked in the bottom-right corner and
 * announced politely to screen readers. They fade on their own and never block play.
 */

const TOAST_MS = 5_500;
const MAX_VISIBLE = 3;

const ICONS: Record<AnnouncementKind, PlayerIconName> = {
  xp: 'bolt',
  achievement: 'star',
  quest: 'flag',
  level: 'rank',
  rank: 'rank',
};

export interface Toasts {
  element: HTMLElement;
  show(items: readonly Announcement[]): void;
  destroy(): void;
}

export function createToasts(options: { persist: boolean }): Toasts {
  const element = h('div', {
    class: 'pl-toasts',
    role: 'status',
    'aria-live': 'polite',
    dataset: { testid: 'pl-toasts' },
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function dismiss(card: HTMLElement) {
    card.classList.add('is-leaving');
    const timer = setTimeout(() => card.remove(), 260);
    timers.add(timer);
  }

  return {
    element,
    show(items) {
      if (items.length === 0) return;
      const [lead, ...rest] = items;
      const card = h(
        'div',
        { class: ['pl-toast', `pl-toast--${lead?.kind ?? 'xp'}`] },
        h(
          'p',
          { class: 'pl-toast__lead' },
          playerIcon(ICONS[lead?.kind ?? 'xp'], 'pl-icon pl-toast__icon'),
          lead?.text ?? '',
        ),
        rest.length > 0
          ? h(
              'ul',
              { class: 'pl-toast__list' },
              rest.map((item) =>
                h(
                  'li',
                  { class: `pl-toast__item pl-toast__item--${item.kind}` },
                  playerIcon(ICONS[item.kind], 'pl-icon pl-toast__icon'),
                  item.text,
                ),
              ),
            )
          : null,
      );
      element.append(card);
      while (element.children.length > MAX_VISIBLE) element.firstElementChild?.remove();
      if (!options.persist) {
        const timer = setTimeout(() => dismiss(card), TOAST_MS);
        timers.add(timer);
      }
    },
    destroy() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      element.remove();
    },
  };
}
