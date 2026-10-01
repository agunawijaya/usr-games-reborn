import { WORLDS } from '../../data/worlds';
import { EMERITUS_TITLE, RANKS } from '../../engine/params';
import type { App, Screen } from '../app';
import { STANDING_ORDERS } from '../copy';
import { button, h } from '../dom';
import { insignia } from './insignia';

/**
 * The keeper's service record: the six ranks and what each one adds, the career's numbers, the
 * gazetteer of all thirty-two worlds with what you did for each, and the last nights' watches.
 */
export function recordScreen(app: App): Screen {
  const career = app.saves.career.load();
  const gazetteer = app.saves.gazetteer.load();
  const nights = Object.entries(app.saves.nights.load().days)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7);

  const ladder = h(
    'ol',
    { class: 'lk-ladder', dataset: { testid: 'lk-ladder' } },
    ...RANKS.map((rank) => {
      const state =
        career.emeritus || rank.id < career.rank
          ? 'earned'
          : rank.id === career.rank
            ? 'current'
            : 'ahead';
      const best = career.bestByRank[rank.id];
      return h(
        'li',
        { dataset: { state } },
        insignia(rank.id),
        h(
          'div',
          {},
          h(
            'h3',
            {},
            rank.title,
            h('span', { class: 'lk-ladder__original' }, ` · ${rank.originalLevel} in 1976`),
          ),
          h('p', {}, STANDING_ORDERS[rank.id].added[0] ?? ''),
          best !== undefined
            ? h('p', { class: 'lk-ladder__best' }, `Best: ${best.toLocaleString('en')} points`)
            : null,
        ),
      );
    }),
    h(
      'li',
      { dataset: { state: career.emeritus ? 'earned' : 'ahead' } },
      insignia(6, true),
      h(
        'div',
        {},
        h('h3', {}, EMERITUS_TITLE),
        h('p', {}, 'The original’s rarest title: a clean promotion from the top rank.'),
      ),
    ),
  );

  const worlds = h(
    'ul',
    { class: 'lk-gazetteer', dataset: { testid: 'lk-gazetteer' } },
    ...WORLDS.map((world, index) => {
      const entry = gazetteer.worlds[index];
      const helped = entry ? entry.answered + entry.relit : 0;
      return h(
        'li',
        { dataset: { helped: String(helped > 0) } },
        h('span', { class: 'lk-gazetteer__light', 'aria-hidden': 'true' }),
        h('b', {}, world.name),
        h('span', { class: 'lk-gazetteer__note' }, world.note),
        h(
          'span',
          { class: 'lk-gazetteer__deeds' },
          entry
            ? [
                entry.answered ? `${entry.answered} answered` : '',
                entry.relit ? `${entry.relit} relit` : '',
                entry.lost ? `${entry.lost} lost` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : 'never called',
        ),
      );
    }),
  );
  const helpedCount = WORLDS.filter((_, i) => {
    const entry = gazetteer.worlds[i];
    return entry && entry.answered + entry.relit > 0;
  }).length;

  const element = h(
    'section',
    { class: 'lk-screen lk-record', dataset: { testid: 'lk-record' } },
    h(
      'div',
      { class: 'lk-page' },
      h(
        'header',
        { class: 'lk-page__head' },
        h('p', { class: 'lk-kicker' }, 'Service record'),
        h('h2', {}, career.emeritus ? EMERITUS_TITLE : RANKS[career.rank - 1]!.title),
      ),
      h(
        'dl',
        { class: 'lk-record__numbers' },
        h('div', {}, h('dt', {}, 'Watches'), h('dd', {}, String(career.watches))),
        h('div', {}, h('dt', {}, 'Kept'), h('dd', {}, String(career.wins))),
        h('div', {}, h('dt', {}, 'Promotions'), h('dd', {}, String(career.promotions.length))),
        h('div', {}, h('dt', {}, 'Worlds helped'), h('dd', {}, `${helpedCount} of 32`)),
      ),
      h('h3', { class: 'lk-page__section' }, 'Ranks'),
      ladder,
      h('h3', { class: 'lk-page__section' }, 'The gazetteer'),
      worlds,
      nights.length > 0 ? h('h3', { class: 'lk-page__section' }, 'Recent nights') : null,
      nights.length > 0
        ? h(
            'ul',
            { class: 'lk-nights' },
            ...nights.map(([date, night]) =>
              h(
                'li',
                {},
                h('span', {}, date),
                h('span', {}, night.outcome === 'won' ? 'kept' : 'ended'),
                h('span', {}, `${night.lights}/32 lights`),
                h('b', {}, `${night.score}`),
              ),
            ),
          )
        : null,
      h(
        'div',
        { class: 'lk-page__actions' },
        button('Game menu', {
          onClick: () => app.go.title(),
          variant: 'primary',
          testId: 'lk-record-back',
          autofocus: true,
        }),
      ),
    ),
  );

  return {
    element,
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
