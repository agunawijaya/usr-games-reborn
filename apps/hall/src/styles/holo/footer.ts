import { firstLevelOfRank } from '@usr-games/kit/progression';
import { h } from '../../ui/h';
import type { HoloContext } from './context';
import { holoIcon } from './icons';
import { hasReached } from './level-card';

/**
 * The quiet end of every page: the story of the collection, the settings, and the door to the
 * server closet, which says plainly when it opens.
 */

export function footer(context: HoloContext): HTMLElement {
  const open = hasReached(context.snapshot.progression.xp, 'root');
  const link = (href: string, key: string, ...children: (Node | string)[]) =>
    h('a', { class: 'hc-footer__link', href, dataset: { focusKey: `footer:${key}` } }, ...children);
  return h(
    'footer',
    { class: 'hc-footer' },
    h(
      'nav',
      { class: 'hc-footer__nav', 'aria-label': 'More' },
      link('#/about', 'about', holoIcon('info', 'hc-icon hc-icon--small'), 'About these games'),
      link('#/settings', 'settings', holoIcon('settings', 'hc-icon hc-icon--small'), 'Settings'),
      link(
        '#/closet',
        'closet',
        holoIcon(open ? 'door' : 'lock', 'hc-icon hc-icon--small'),
        'The server closet',
        h(
          'span',
          { class: ['hc-footer__badge', open && 'is-open'] },
          open ? 'Open' : `Level ${firstLevelOfRank('root')}`,
        ),
      ),
    ),
    h(
      'p',
      { class: 'hc-footer__note' },
      'Every game is reborn from the classic BSD collection and credited to the people who wrote it. Your cards live only in this browser.',
    ),
  );
}
