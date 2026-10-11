import { type EventSpec, eventCount, MODE_NAMES, sieveLevel } from '../engine/events';
import type { ModeId } from '../engine/levels';
import type { Layout } from '../render/layout';
import { h } from './dom';
import { icon } from './icons';

/**
 * The game menu: the title, today's Daily up front, the campaign's twelve chapters, free play in
 * each mode, and the album and tutor. Built from plain data so the hero frames and the live
 * screen draw the same thing.
 */

export interface DailyEventCard {
  readonly mode: ModeId;
  readonly name: string;
  readonly detail: string;
}

export interface MenuData {
  readonly daily: {
    readonly number: number;
    readonly dateLabel: string;
    readonly events: readonly DailyEventCard[];
    /** Set once today's Daily is played. */
    readonly played: { readonly score: string } | null;
  };
  readonly campaign: {
    readonly chapters: readonly {
      readonly stars: number;
      readonly state: 'done' | 'next' | 'later';
    }[];
    readonly nextTitle: string;
    readonly nextNumber: number;
    readonly totalStars: number;
  };
  readonly album: number;
  readonly training: number;
}

export interface MenuActions {
  daily(): void;
  campaign(): void;
  mode(mode: ModeId): void;
  album(): void;
  training(): void;
  help(): void;
  settings(): void;
}

/** A Daily event as its card shows it: short enough to sit in a quarter of the card. */
export function dailyEvent(spec: EventSpec): DailyEventCard {
  const count = eventCount(spec);
  const detail =
    spec.mode === 'sums'
      ? `${count} sums`
      : spec.mode === 'split'
        ? `${count} numbers`
        : spec.mode === 'sieve'
          ? `${sieveLevel(spec.level).first.toLocaleString('en-US')} to ${sieveLevel(spec.level).last.toLocaleString('en-US')}`
          : `${count} numbers`;
  return { mode: spec.mode, name: MODE_NAMES[spec.mode], detail };
}

const MODES: readonly { id: ModeId; name: string; from: string }[] = [
  { id: 'sums', name: 'Quick Sums', from: 'arithmetic' },
  { id: 'split', name: 'Split', from: 'factor' },
  { id: 'sieve', name: 'Sieve', from: 'primes' },
  { id: 'spell', name: 'Spell It', from: 'number' },
];

function stars(count: number): HTMLElement {
  return h(
    'span',
    { class: 'ns-stars', 'aria-label': `${count} of 3 stars` },
    ...[0, 1, 2].map((i) =>
      h(
        'span',
        { class: i < count ? 'ns-star' : 'ns-star ns-star--off', 'aria-hidden': 'true' },
        '★',
      ),
    ),
  );
}

export function menuView(layout: Layout, data: MenuData, actions: MenuActions): HTMLElement {
  const { s } = layout;
  const column = h('div', { class: 'ns-menu__column' });
  column.style.left = `${Math.round(96 * s)}px`;
  column.style.top = `${Math.round(Math.max(88, 92 * s))}px`;
  column.style.width = `${Math.round(Math.min(layout.width * 0.56, 900 * s))}px`;

  const title = h(
    'header',
    { class: 'ns-card ns-menu__title-plate' },
    h('span', { class: 'ns-menu__eyebrow' }, 'arithmetic · factor · primes · number'),
    h(
      'h1',
      { class: 'ns-menu__title' },
      'Number ',
      h('span', { class: 'ns-menu__title-mark' }, 'Sprint'),
    ),
    h('p', { class: 'ns-menu__tagline' }, 'Fast sums. Prime splits. Beat your own time.'),
  );

  const daily = data.daily;
  const dailyCard = h(
    'section',
    { class: 'ns-card ns-card--daily', 'aria-label': `Daily number ${daily.number}` },
    h(
      'div',
      { class: 'ns-card__head' },
      h('h2', { class: 'ns-card__title' }, `Daily #${daily.number}`),
      h('span', { class: 'ns-muted' }, daily.dateLabel),
    ),
    h(
      'div',
      { class: 'ns-card__body' },
      h(
        'div',
        { class: 'ns-events' },
        ...daily.events.map((event) =>
          h(
            'div',
            { class: 'ns-event' },
            icon(event.mode, 'ns-event__icon'),
            h('span', { class: 'ns-event__name' }, event.name),
            h('span', { class: 'ns-event__detail' }, event.detail),
          ),
        ),
      ),
      h(
        'button',
        {
          class: 'ns-button ns-button--primary ns-start',
          type: 'button',
          onclick: actions.daily,
          'data-testid': 'ns-menu-daily',
        },
        daily.played ? 'Results' : 'Start',
        h('small', {}, daily.played ? daily.played.score : 'Rush · 4 events'),
      ),
    ),
  );

  const campaign = data.campaign;
  const campaignCard = h(
    'section',
    { class: 'ns-card', 'aria-label': 'Campaign' },
    h(
      'div',
      { class: 'ns-card__head' },
      h('h2', { class: 'ns-card__title' }, `Chapter ${campaign.nextNumber}: ${campaign.nextTitle}`),
      h('span', { class: 'ns-muted' }, `${campaign.totalStars} of 36 ★`),
    ),
    h(
      'div',
      { class: 'ns-card__body' },
      h(
        'ol',
        { class: 'ns-chapters', 'aria-label': 'Chapters' },
        ...campaign.chapters.map((chapter, i) =>
          h(
            'li',
            { class: `ns-chapter ns-chapter--${chapter.state}` },
            h('span', { class: 'ns-chapter__dot' }, String(i + 1)),
            chapter.state === 'done'
              ? stars(chapter.stars)
              : h('span', { class: 'ns-stars', 'aria-hidden': 'true' }, ' '),
          ),
        ),
      ),
      h(
        'button',
        {
          class: 'ns-button',
          type: 'button',
          onclick: actions.campaign,
          'data-testid': 'ns-menu-campaign',
        },
        'Continue',
      ),
    ),
  );

  const modes = h(
    'nav',
    { class: 'ns-modes', 'aria-label': 'Free play' },
    ...MODES.map((mode) =>
      h(
        'button',
        {
          class: 'ns-card ns-mode ns-button',
          type: 'button',
          onclick: () => actions.mode(mode.id),
          'data-testid': `ns-menu-${mode.id}`,
        },
        icon(mode.id, 'ns-mode__icon'),
        h('span', { class: 'ns-mode__name' }, mode.name),
        h('span', { class: 'ns-mode__from' }, mode.from),
      ),
    ),
  );

  const links = h(
    'div',
    { class: 'ns-links' },
    h(
      'button',
      { class: 'ns-button ns-link', type: 'button', onclick: actions.album },
      icon('album', 'ns-mode__icon'),
      'Prime album',
      h('span', { class: 'ns-link__count' }, String(data.album)),
    ),
    h(
      'button',
      { class: 'ns-button ns-link', type: 'button', onclick: actions.training },
      icon('training', 'ns-mode__icon'),
      'In training',
      h('span', { class: 'ns-link__count' }, String(data.training)),
    ),
    h(
      'button',
      { class: 'ns-button ns-link', type: 'button', onclick: actions.help },
      'How to play',
    ),
    h(
      'button',
      { class: 'ns-button ns-link', type: 'button', onclick: actions.settings },
      'Settings',
    ),
  );

  column.append(title, dailyCard, campaignCard, modes, links);
  return h('div', { class: 'ns-menu' }, column);
}
