import type { CatalogEntry } from '../../catalog/catalog';
import type { HallStore } from '../../store/hall-store';
import { h } from '../../ui/h';
import { type MountedPoster, mountPoster, STILL_MOMENT } from '../art/art';
import { gameHref } from '../plain';
import { hallLink } from './chrome';
import type { Session } from './native-session';
import type { Wording } from './wording';

/**
 * What `#/run/<id>` shows when there is nothing to run: an unknown id, a game still coming,
 * or one on its way in. A still poster, one honest sentence and the two ways onward.
 */

export interface NotLaunchableOptions {
  id: string;
  entry: CatalogEntry | undefined;
  store: HallStore;
  wording: Wording;
  leave(): void;
}

interface Copy {
  kicker: string;
  title: string;
  body: string;
}

function copyFor(id: string, entry: CatalogEntry | undefined, wording: Wording): Copy {
  const unix = wording === 'unix';
  if (!entry) {
    return {
      kicker: unix ? `$ ${id}` : 'Not found',
      title: unix ? `${id}: command not found` : 'There is no game by that name',
      body: 'It may have been renamed, or the link has a typo. Every game is in the Hall.',
    };
  }
  const { title, status } = entry.manifest;
  if (status === 'coming-soon') {
    return {
      kicker: unix ? `$ ${entry.manifest.id}` : title,
      title: unix ? 'Not installed yet' : 'Coming soon',
      body: `${title} is still being rebuilt. Its page tells the story of the original while you wait.`,
    };
  }
  return {
    kicker: unix ? `$ ${entry.manifest.id}` : title,
    title: unix ? 'Still installing' : 'Arriving soon',
    body: `${title} is on its way into the collection and cannot be played just yet.`,
  };
}

export function showNotLaunchable(options: NotLaunchableOptions): Session {
  const { id, entry, store, wording } = options;
  const copy = copyFor(id, entry, wording);
  const backdrop = h('div', { class: 'pl-closed__art', 'aria-hidden': 'true' });
  const gameLink = entry
    ? h(
        'a',
        {
          class: 'pl-button pl-button--primary',
          href: wording === 'unix' ? `#/man/${entry.manifest.id}` : gameHref(entry.manifest.id),
        },
        wording === 'unix' ? `man ${entry.manifest.id}` : 'About this game',
      )
    : null;
  const element = h(
    'main',
    { id: 'screen', class: 'pl-page pl-page--closed', dataset: { testid: 'pl-closed' } },
    backdrop,
    h(
      'section',
      { class: 'pl-sheet pl-closed', 'aria-labelledby': 'pl-closed-title' },
      h('p', { class: 'pl-sheet__kicker' }, copy.kicker),
      h('h1', { id: 'pl-closed-title', class: 'pl-sheet__title' }, copy.title),
      h('p', { class: 'pl-closed__body' }, copy.body),
      h(
        'div',
        { class: 'pl-closed__actions' },
        gameLink,
        hallLink(gameLink ? 'pl-button--quiet' : 'pl-button--primary', () => options.leave()),
      ),
    ),
  );

  let poster: MountedPoster | null = null;
  if (entry) {
    const snapshot = store.snapshot();
    // Drawn once the page is laid out, so the canvas knows its size.
    requestAnimationFrame(() => {
      if (!element.isConnected) return;
      poster = mountPoster(backdrop, entry, {
        appearance: snapshot.appearance,
        animate: false,
        reducedMotion: true,
        frozenAt: STILL_MOMENT,
        className: 'pl-closed__poster',
      });
    });
  }
  const stop = store.subscribe((snapshot, change) => {
    if (change === 'settings') poster?.setAppearance(snapshot.appearance);
  });

  return {
    element,
    destroy() {
      stop();
      poster?.destroy();
      element.remove();
    },
  };
}
