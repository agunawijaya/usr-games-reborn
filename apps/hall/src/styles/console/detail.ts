import { packageKey, packageWording, packageXp } from '@usr-games/kit';
import type { CatalogEntry } from '../../catalog/catalog';
import { type MountedPoster, mountPoster } from '../../core/art/art';
import { processRows } from '../../core/home-model';
import {
  achievementCount,
  CATEGORY_NAMES,
  callToAction,
  gameHref,
  howToPlay,
  shortHistory,
} from '../../core/plain';
import { gameAccent } from '../../core/palette';
import { playSound } from '../../core/sound';
import { formatMinutes, formatNumber, formatShortDate } from '../../ui/format';
import { h } from '../../ui/h';
import { type ConsoleContext, goTo } from './context';
import { glyph } from './icons';
import { displayTitle } from './text';
import type { ConsoleScreen } from './home';
import { topBar } from './top-bar';

/**
 * A game's page: big living art on top, then everything a new player wants to know in plain
 * words: what it is, how to play in three steps, the achievements as cards, where it came
 * from, and a few related games. Escape goes back to Home, where the rail remembers the game.
 */

function achievementCards(context: ConsoleContext, gameId: string): HTMLElement {
  const entry = context.store.catalog.byId(gameId);
  const packages = entry?.manifest.packages ?? [];
  if (!entry || packages.length === 0) {
    return h(
      'p',
      { class: 'ch-detail__note' },
      'This game’s achievements arrive with the game itself.',
    );
  }
  const installed = context.snapshot.progression.packages;
  return h(
    'ul',
    { class: 'ch-achievements' },
    packages.map((definition) => {
      const earned = installed[packageKey(gameId, definition.id)];
      const wording = packageWording(definition, true);
      const secret = definition.hidden && !earned;
      return h(
        'li',
        {
          class: [
            'ch-achievement',
            earned ? 'is-earned' : 'is-locked',
            `ch-achievement--${definition.tier}`,
          ],
        },
        h(
          'span',
          { class: 'ch-achievement__icon', 'aria-hidden': 'true' },
          glyph(earned ? 'trophy' : 'lock'),
        ),
        h('span', { class: 'ch-achievement__title' }, secret ? 'A secret' : wording.title),
        h(
          'span',
          { class: 'ch-achievement__text' },
          secret ? 'Revealed once you earn it.' : wording.description,
        ),
        h(
          'span',
          { class: 'ch-achievement__meta' },
          earned ? `Earned ${formatShortDate(earned.installedOn)}` : `+${packageXp(definition)} XP`,
        ),
      );
    }),
  );
}

export function detailScreen(context: ConsoleContext, id: string): ConsoleScreen {
  const entry = context.store.catalog.byId(id);
  const posters: MountedPoster[] = [];
  if (!entry) {
    const element = h(
      'div',
      { class: 'ch-page' },
      topBar(context),
      h(
        'main',
        { class: 'ch-panel ch-panel--center' },
        h('h1', { class: 'ch-panel__title' }, 'We could not find that game'),
        h(
          'a',
          { class: 'ch-button ch-button--primary', href: '#/' },
          glyph('back'),
          h('span', null, 'Back to Home'),
        ),
      ),
    );
    return { element, title: 'Game not found', destroy: () => {} };
  }

  const { manifest } = entry;
  const row = processRows([entry], context.snapshot.progression, context.snapshot.today)[0];
  if (!row) throw new Error(`No row for ${id}`);
  const action = callToAction(row, context.snapshot.today);
  const count = achievementCount(entry, context.snapshot.progression);
  const art = h('div', { class: 'ch-detail__art' });
  posters.push(
    mountPoster(art, entry, {
      appearance: context.theme.appearance,
      animate: context.interactive,
      reducedMotion: context.theme.reducedMotion,
      ...(context.frozenAt === undefined ? {} : { frozenAt: context.frozenAt }),
      className: 'ch-poster',
    }),
  );

  const related = manifest.manPage.seeAlso
    .map((relatedId) => context.store.catalog.byId(relatedId))
    .filter(
      (relatedEntry): relatedEntry is CatalogEntry =>
        relatedEntry !== undefined && relatedEntry.manifest.status !== 'unlisted',
    );

  const relatedTiles = related.map((relatedEntry) => {
    const holder = h('span', { class: 'ch-related__art' });
    posters.push(
      mountPoster(holder, relatedEntry, {
        appearance: context.theme.appearance,
        animate: false,
        reducedMotion: context.theme.reducedMotion,
        className: 'ch-poster',
      }),
    );
    return h(
      'li',
      null,
      h(
        'a',
        {
          class: 'ch-related',
          href: gameHref(relatedEntry.manifest.id),
          style: { '--ch-accent-raw': relatedEntry.manifest.accent },
        },
        holder,
        h('span', { class: 'ch-related__title' }, relatedEntry.manifest.title),
        h(
          'span',
          { class: 'ch-related__category' },
          CATEGORY_NAMES[relatedEntry.manifest.category],
        ),
      ),
    );
  });

  const status =
    row.state === 'R' ? 'Ready to play' : row.state === 'D' ? 'Arriving soon' : 'Coming soon';
  const element = h(
    'div',
    {
      class: 'ch-detail',
      style: {
        '--ch-accent-raw': manifest.accent,
        '--ch-accent': gameAccent(manifest.accent, context.theme),
      },
    },
    h(
      'section',
      { class: 'ch-detail__stage', 'aria-labelledby': 'ch-detail-title' },
      art,
      h('div', { class: 'ch-detail__scrim', 'aria-hidden': 'true' }),
      topBar(context),
      h(
        'div',
        { class: 'ch-detail__head' },
        h(
          'a',
          { class: 'ch-back', href: '#/', dataset: { focusKey: 'ch-back' } },
          glyph('back'),
          h('span', null, 'Home'),
        ),
        h(
          'p',
          { class: 'ch-eyebrow' },
          h('span', { class: 'ch-eyebrow__category' }, CATEGORY_NAMES[manifest.category]),
          h('span', { class: 'ch-eyebrow__dot', 'aria-hidden': 'true' }, '·'),
          h('span', null, status),
        ),
        h(
          'h1',
          { id: 'ch-detail-title', class: 'ch-hero__title ch-detail__title' },
          displayTitle(manifest.title),
        ),
        h('p', { class: 'ch-hero__tagline' }, manifest.tagline),
        h(
          'div',
          { class: 'ch-hero__actions' },
          action.href
            ? h(
                'a',
                {
                  class: 'ch-button ch-button--primary ch-button--large',
                  href: action.href,
                  dataset: { focusKey: 'ch-detail-play' },
                },
                glyph('play'),
                h('span', null, action.label),
              )
            : h(
                'span',
                { class: 'ch-button ch-button--soon ch-button--large', role: 'note' },
                glyph('clock'),
                h('span', null, action.label),
              ),
          h(
            'ul',
            { class: 'ch-facts', 'aria-label': 'At a glance' },
            h('li', null, glyph('clock'), formatMinutes(manifest.sessionMinutes)),
            h(
              'li',
              null,
              manifest.players.max === 1
                ? 'One player'
                : `${manifest.players.min}–${manifest.players.max} players`,
            ),
            manifest.daily ? h('li', null, 'New daily challenge every day') : null,
            row.bestScore !== null ? h('li', null, `Best ${formatNumber(row.bestScore)}`) : null,
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'ch-detail__body' },
      h(
        'section',
        { class: 'ch-detail__about', 'aria-labelledby': 'ch-about-title' },
        h('h2', { id: 'ch-about-title', class: 'ch-section-title' }, 'About'),
        h('p', { class: 'ch-detail__lede' }, manifest.teaser),
      ),
      h(
        'section',
        { class: 'ch-detail__how', 'aria-labelledby': 'ch-how-title' },
        h('h2', { id: 'ch-how-title', class: 'ch-section-title' }, 'How to play'),
        h(
          'ol',
          { class: 'ch-steps' },
          howToPlay(entry).map((step, index) =>
            h(
              'li',
              { class: 'ch-step' },
              h('span', { class: 'ch-step__number', 'aria-hidden': 'true' }, String(index + 1)),
              h('span', null, step),
            ),
          ),
        ),
      ),
      h(
        'section',
        { class: 'ch-detail__achievements', 'aria-labelledby': 'ch-achievements-title' },
        h(
          'h2',
          { id: 'ch-achievements-title', class: 'ch-section-title' },
          'Achievements',
          count.total > 0
            ? h(
                'span',
                { class: 'ch-section-title__count' },
                `${count.earned} of ${count.total} earned`,
              )
            : null,
        ),
        achievementCards(context, manifest.id),
      ),
      h(
        'section',
        { class: 'ch-detail__history', 'aria-labelledby': 'ch-history-title' },
        h('h2', { id: 'ch-history-title', class: 'ch-section-title' }, 'The original'),
        h('p', null, shortHistory(entry)),
      ),
      relatedTiles.length > 0
        ? h(
            'section',
            { class: 'ch-detail__related', 'aria-labelledby': 'ch-related-title' },
            h('h2', { id: 'ch-related-title', class: 'ch-section-title' }, 'You might also like'),
            h('ul', { class: 'ch-related-list' }, relatedTiles),
          )
        : null,
    ),
  );

  const cleanups: (() => void)[] = [];
  if (context.interactive) {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      playSound(context.store, 'back');
      goTo('#/');
    };
    document.addEventListener('keydown', onKey);
    cleanups.push(() => document.removeEventListener('keydown', onKey));
  }

  return {
    element,
    title: manifest.title,
    destroy() {
      for (const cleanup of cleanups) cleanup();
      for (const poster of posters) poster.destroy();
    },
  };
}
