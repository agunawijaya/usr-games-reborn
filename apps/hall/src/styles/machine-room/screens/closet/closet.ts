import { rankForXp } from '@usr-games/kit/progression';
import { closetRoom } from '../../../../core/screens/closet/closet';
import { h } from '../../../../ui/h';
import { icon } from '../../../../ui/icons';
import type { Screen, ScreenContext } from '../screen';

/**
 * `cd /var/closet`: the reward room behind the racks. Root walks in; everyone else meets the
 * door and a friendly Permission denied that says how far away it is.
 */

/** A moment when the rack's lights and the credits screen both look their best. */
const FROZEN_CLOSET_TIME = 12.5;

/** `Oct  1 21:42`, the way `ls -l` stamps a file. */
function lsStamp(now: Date): string {
  const month = now.toLocaleString('en-US', { month: 'short' });
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${month} ${String(now.getDate()).padStart(2, ' ')} ${hours}:${minutes}`;
}

/** Beside the locked door: the directory's permissions, read out in plain words. */
function permissionsPanel(now: Date): HTMLElement {
  const bit = (mode: string, meaning: string) =>
    h('div', { class: 'perms__row' }, h('dt', null, mode), h('dd', null, meaning));
  return h(
    'aside',
    { class: 'panel closet__perms', 'aria-labelledby': 'perms-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'perms-title' }, 'ls -ld /var/closet'),
      h('span', null, 'mode 700'),
    ),
    h(
      'pre',
      { class: 'perms__listing' },
      `drwx------ 2 root wheel 4096 ${lsStamp(now)} /var/closet`,
    ),
    h(
      'dl',
      { class: 'perms__legend' },
      bit('d', 'a directory, and a room'),
      bit('rwx', 'root may look inside, move things and walk in'),
      bit('------', 'everyone else waits at the door, wheel included'),
    ),
    h(
      'p',
      { class: 'perms__note' },
      'Every game you finish and every weekly cron job brings root a little closer.',
    ),
  );
}

export function closetScreen(context: ScreenContext): Screen {
  const { store, frozen } = context;
  const open = rankForXp(context.snapshot.progression.xp).id === 'root';
  const room = closetRoom({
    store,
    wording: 'unix',
    ...(frozen ? { frozenAt: FROZEN_CLOSET_TIME } : {}),
  });
  const element = h(
    'div',
    { class: ['screen', 'screen--closet', open ? 'is-open' : 'is-locked'] },
    h(
      'header',
      { class: 'page-head' },
      h('p', { class: 'page-head__path' }, '/var/closet'),
      h('h1', { class: 'page-head__title' }, 'The server closet'),
      h(
        'p',
        { class: 'page-head__shell', 'aria-hidden': 'true' },
        h('span', { class: 'page-head__cmd' }, '$ cd /var/closet'),
        open ? null : h('span', { class: 'page-head__err' }, 'cd: /var/closet: Permission denied'),
      ),
    ),
    open
      ? h('div', { class: 'panel closet' }, room.element)
      : h(
          'div',
          { class: 'closet-locked' },
          h('div', { class: 'panel closet' }, room.element),
          permissionsPanel(context.snapshot.now),
        ),
    h(
      'p',
      { class: 'closet__back' },
      h('a', { class: 'link-back', href: '#/home' }, icon('back'), 'Back to your home directory'),
    ),
  );
  return {
    element,
    title: 'The server closet',
    cwd: '/var',
    command: 'cd /var/closet',
    // The open room's canvas reads the palette every frame; rebuilding it would restart the fan.
    keepsItself: open,
    destroy: () => room.destroy(),
  };
}
