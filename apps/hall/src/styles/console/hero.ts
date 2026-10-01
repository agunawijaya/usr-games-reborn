import { dailyNumber } from '@usr-games/kit';
import { type MountedPoster, mountPoster } from '../../core/art/art';
import type { ProcessRow } from '../../core/home-model';
import { achievementCount, CATEGORY_NAMES, callToAction, gameHref } from '../../core/plain';
import { didYouKnowFor } from '../../content/fortunes';
import { formatMinutes, formatNumber } from '../../ui/format';
import { h } from '../../ui/h';
import type { ConsoleContext } from './context';
import { glyph } from './icons';
import { displayTitle } from './text';

/**
 * The hero: the selected game's living key art filling the stage, with its title, tagline and
 * one obvious action over a soft scrim. Each selection builds a new layer that fades in over
 * the old one, so art and words change together.
 */

export interface HeroLayer {
  element: HTMLElement;
  poster: MountedPoster;
}

const CROSS_FADE_MS = 280;

function eyebrow(row: ProcessRow, isPick: boolean, context: ConsoleContext): HTMLElement {
  const { manifest } = row.entry;
  if (isPick) {
    return h(
      'p',
      { class: 'ch-eyebrow ch-eyebrow--pick' },
      h('span', { class: 'ch-eyebrow__spark', 'aria-hidden': 'true' }, glyph('spark')),
      h('span', null, `Today’s pick · Daily #${dailyNumber(context.snapshot.today)}`),
    );
  }
  const status =
    row.state === 'R' ? 'Ready to play' : row.state === 'D' ? 'Arriving soon' : 'Coming soon';
  return h(
    'p',
    { class: 'ch-eyebrow' },
    h('span', { class: 'ch-eyebrow__category' }, CATEGORY_NAMES[manifest.category]),
    h('span', { class: 'ch-eyebrow__dot', 'aria-hidden': 'true' }, '·'),
    h('span', null, status),
  );
}

function stats(row: ProcessRow, context: ConsoleContext): HTMLElement {
  const count = achievementCount(row.entry, context.snapshot.progression);
  const items: HTMLElement[] = [
    h(
      'li',
      { class: 'ch-stat' },
      glyph('clock'),
      h('span', null, formatMinutes(row.entry.manifest.sessionMinutes)),
    ),
  ];
  if (row.bestScore !== null) {
    items.unshift(
      h(
        'li',
        { class: 'ch-stat' },
        h('span', { class: 'ch-stat__label' }, 'Best'),
        h('b', null, formatNumber(row.bestScore)),
      ),
    );
  }
  if (count.total > 0) {
    items.push(
      h(
        'li',
        { class: 'ch-stat ch-stat--achievements' },
        glyph('trophy'),
        h('span', null, h('b', null, `${count.earned} / ${count.total}`), ' achievements'),
        h(
          'span',
          { class: 'ch-mini-bar', 'aria-hidden': 'true' },
          h('span', { style: { width: `${((count.earned / count.total) * 100).toFixed(1)}%` } }),
        ),
      ),
    );
  } else if (row.state !== 'R') {
    items.push(
      h(
        'li',
        { class: 'ch-stat' },
        glyph('trophy'),
        h('span', null, 'Achievements arrive with the game'),
      ),
    );
  }
  return h('ul', { class: 'ch-stats', 'aria-label': 'About this game' }, items);
}

export function heroContent(
  row: ProcessRow,
  isPick: boolean,
  context: ConsoleContext,
): HTMLElement {
  const { manifest } = row.entry;
  const action = callToAction(row, context.snapshot.today);
  return h(
    'div',
    { class: 'ch-hero__content' },
    eyebrow(row, isPick, context),
    h('h2', { class: 'ch-hero__title' }, displayTitle(manifest.title)),
    h('p', { class: 'ch-hero__tagline' }, manifest.tagline),
    h(
      'div',
      { class: 'ch-hero__actions' },
      action.href
        ? h(
            'a',
            {
              class: 'ch-button ch-button--primary',
              href: action.href,
              dataset: { focusKey: 'ch-hero-play' },
            },
            glyph('play'),
            h('span', null, action.label),
          )
        : h(
            'span',
            { class: 'ch-button ch-button--soon', role: 'note' },
            glyph('clock'),
            h('span', null, action.label),
          ),
      h(
        'a',
        {
          class: 'ch-button ch-button--glass',
          href: gameHref(manifest.id),
          'aria-label': `More about ${manifest.title}`,
          dataset: { focusKey: 'ch-hero-more' },
        },
        glyph('more'),
        h('span', null, 'More'),
      ),
    ),
    stats(row, context),
    isPick
      ? h(
          'p',
          { class: 'ch-dyk' },
          h('b', null, 'Did you know? '),
          didYouKnowFor(context.snapshot.today),
        )
      : null,
  );
}

export function buildHeroLayer(
  row: ProcessRow,
  isPick: boolean,
  context: ConsoleContext,
): HeroLayer {
  const art = h('div', { class: 'ch-hero__art' });
  const element = h(
    'div',
    { class: 'ch-hero__layer', style: { '--ch-accent-raw': row.entry.manifest.accent } },
    art,
    h('div', { class: 'ch-hero__scrim', 'aria-hidden': 'true' }),
    heroContent(row, isPick, context),
  );
  const poster = mountPoster(art, row.entry, {
    appearance: context.theme.appearance,
    animate: context.interactive,
    reducedMotion: context.theme.reducedMotion,
    ...(context.frozenAt === undefined ? {} : { frozenAt: context.frozenAt }),
    className: 'ch-poster',
  });
  return { element, poster };
}

/** Lays `next` over `current` and fades it in; the old layer is removed once hidden. */
export function crossFade(
  container: HTMLElement,
  current: HeroLayer | null,
  next: HeroLayer,
  instant: boolean,
): void {
  container.append(next.element);
  if (!current) return;
  if (instant) {
    current.poster.destroy();
    current.element.remove();
    return;
  }
  next.element.classList.add('is-entering');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => next.element.classList.remove('is-entering')),
  );
  current.element.classList.add('is-leaving');
  setTimeout(() => {
    current.poster.destroy();
    current.element.remove();
  }, CROSS_FADE_MS + 60);
}
