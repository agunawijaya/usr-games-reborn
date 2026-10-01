import type { AppearancePreference, StyleId } from '@usr-games/kit';
import {
  FREEZES_PER_WEEK,
  freezesUsedInWeek,
  levelForXp,
  questLabel,
  RANK_TOOLTIP,
  streakAsOf,
} from '@usr-games/kit/progression';
import { STYLE_COPY } from '../../core/style-module';
import { formatNumber, plural } from '../../ui/format';
import { h } from '../../ui/h';
import type { HoloContext, Popover } from './context';
import { holoIcon } from './icons';
import { weekDays } from './model';

/**
 * The header strip: where you are in the collection, who you are (level, streak) and the
 * week's quests, plus the look of the Hall. Popovers are plain disclosure buttons, so they
 * work the same with a mouse, a keyboard or a screen reader.
 */

function levelBadge(context: HoloContext): HTMLElement {
  const { xp } = context.snapshot.progression;
  const level = levelForXp(xp);
  const toNext = level.nextLevelAt === null ? 0 : level.nextLevelAt - xp;
  return h(
    'a',
    {
      class: 'hc-level',
      href: '#/home',
      dataset: { focusKey: 'level' },
      'aria-describedby': 'hc-rank-tip',
      'aria-label': `Level ${level.level}, rank ${level.rank}. ${formatNumber(toNext)} XP to the next level. Open your album.`,
    },
    h('span', { class: 'hc-level__medal', 'aria-hidden': 'true' }, String(level.level)),
    h(
      'span',
      { class: 'hc-level__text', 'aria-hidden': 'true' },
      h(
        'span',
        { class: 'hc-level__line' },
        h('span', { class: 'hc-level__label' }, `Level ${level.level}`),
        h('span', { class: 'hc-level__rank', title: RANK_TOOLTIP }, level.rank),
      ),
      h(
        'span',
        { class: 'hc-bar' },
        h('span', {
          class: 'hc-bar__fill',
          style: { width: `${(level.fraction * 100).toFixed(1)}%` },
        }),
      ),
      h(
        'span',
        { class: 'hc-level__xp' },
        level.nextLevelAt === null
          ? 'Top level'
          : `${formatNumber(toNext)} XP to level ${level.level + 1}`,
      ),
    ),
    h('span', { id: 'hc-rank-tip', class: 'visually-hidden' }, RANK_TOOLTIP),
  );
}

function streak(context: HoloContext): HTMLElement {
  const { progression, today } = context.snapshot;
  const days = streakAsOf(progression.streak, today);
  const freezesLeft = Math.max(0, FREEZES_PER_WEEK - freezesUsedInWeek(progression.streak, today));
  const week = weekDays(progression, today);
  return h(
    'div',
    {
      class: 'hc-streak',
      title: `Missed days are covered automatically, twice a week. ${freezesLeft} of ${FREEZES_PER_WEEK} left this week.`,
    },
    holoIcon('flame', 'hc-icon hc-streak__flame'),
    h(
      'span',
      { class: 'hc-streak__text' },
      h('span', { class: 'hc-streak__days' }, plural(days, 'day')),
      h('span', { class: 'hc-streak__label' }, 'Streak'),
    ),
    h(
      'ol',
      { class: 'hc-week', 'aria-label': 'This week' },
      week.map((day) =>
        h(
          'li',
          {
            class: ['hc-week__day', `hc-week__day--${day.mark}`, day.today && 'is-today'],
            'aria-label': `${day.day}: ${{ played: 'played', frozen: 'covered by a freeze', quiet: 'a day off', future: 'still to come' }[day.mark]}`,
          },
          h('span', { 'aria-hidden': 'true' }, day.letter),
        ),
      ),
    ),
  );
}

function questsPanel(context: HoloContext): HTMLElement {
  const jobs = context.snapshot.progression.cron.jobs;
  return h(
    'div',
    {
      id: 'hc-quests',
      class: 'hc-popover hc-popover--quests',
      role: 'region',
      'aria-label': 'Weekly quests',
    },
    h('p', { class: 'hc-popover__title' }, 'Weekly quests'),
    jobs.length === 0
      ? h(
          'p',
          { class: 'hc-popover__note' },
          'New quests appear as soon as the first games are ready.',
        )
      : h(
          'ol',
          { class: 'hc-quests' },
          jobs.map((job) =>
            h(
              'li',
              { class: ['hc-quest', job.done && 'is-done'] },
              h('span', { class: 'hc-quest__icon' }, holoIcon(job.done ? 'check' : 'quest')),
              h('span', { class: 'hc-quest__label' }, questLabel(job)),
              h(
                'span',
                {
                  class: 'hc-bar hc-bar--quest',
                  role: 'progressbar',
                  'aria-label': questLabel(job),
                  'aria-valuemin': '0',
                  'aria-valuemax': String(job.target),
                  'aria-valuenow': String(job.progress),
                },
                h('span', {
                  class: 'hc-bar__fill',
                  style: { width: `${(Math.min(1, job.progress / job.target) * 100).toFixed(1)}%` },
                }),
              ),
              h(
                'span',
                { class: 'hc-quest__count' },
                job.done ? 'Done' : `${job.progress} / ${job.target}`,
              ),
            ),
          ),
        ),
    h(
      'p',
      { class: 'hc-popover__note' },
      'New quests every Monday. Unfinished ones simply roll off.',
    ),
  );
}

const APPEARANCE_CHOICES: { value: AppearancePreference; label: string }[] = [
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'Auto' },
];

function lookPanel(context: HoloContext): HTMLElement {
  const { settings } = context.snapshot;
  const styles: StyleId[] = ['console', 'holo', 'machine-room'];
  return h(
    'div',
    {
      id: 'hc-look',
      class: 'hc-popover hc-popover--look',
      role: 'region',
      'aria-label': 'Look of the Hall',
    },
    h('p', { class: 'hc-popover__title' }, 'Hall style'),
    h(
      'div',
      { class: 'hc-choices hc-choices--styles' },
      styles.map((style) =>
        h(
          'button',
          {
            class: ['hc-choice', settings.style === style && 'is-current'],
            type: 'button',
            'aria-pressed': String(settings.style === style),
            dataset: { focusKey: `style:${style}` },
            onclick: () => context.store.chooseStyle(style),
          },
          h('span', {
            class: `hc-choice__swatch hc-choice__swatch--${style}`,
            'aria-hidden': 'true',
          }),
          h('span', { class: 'hc-choice__name' }, STYLE_COPY[style].name),
        ),
      ),
    ),
    h('p', { class: 'hc-popover__title' }, 'Appearance'),
    h(
      'div',
      { class: 'hc-choices hc-choices--appearance' },
      APPEARANCE_CHOICES.map(({ value, label }) =>
        h(
          'button',
          {
            class: ['hc-choice hc-choice--small', settings.appearance === value && 'is-current'],
            type: 'button',
            'aria-pressed': String(settings.appearance === value),
            dataset: { focusKey: `appearance:${value}` },
            onclick: () => context.store.settings.update({ appearance: value }),
          },
          holoIcon(
            value === 'light' ? 'sun' : value === 'dark' ? 'moon' : 'clock',
            'hc-icon hc-icon--small',
          ),
          label,
        ),
      ),
    ),
  );
}

function popoverButton(
  context: HoloContext,
  which: Exclude<Popover, null>,
  ...children: (Node | string)[]
): HTMLElement {
  const open = context.ui.popover === which;
  return h(
    'button',
    {
      class: ['hc-pill', open && 'is-open'],
      type: 'button',
      'aria-expanded': String(open),
      'aria-controls': `hc-${which}`,
      'aria-label': which === 'quests' ? 'Weekly quests' : 'Style and appearance',
      dataset: { focusKey: `popover:${which}` },
      onclick: () => {
        context.ui.popover = open ? null : which;
        context.refresh('header');
      },
    },
    ...children,
  );
}

export function header(context: HoloContext): HTMLElement {
  const jobs = context.snapshot.progression.cron.jobs;
  const done = jobs.filter((job) => job.done).length;
  const onAlbum = context.route.name === 'profile';
  const popover = context.ui.popover;
  return h(
    'header',
    { class: 'hc-top' },
    h(
      'a',
      {
        class: 'hc-brand',
        href: '#/',
        dataset: { focusKey: 'brand' },
        'aria-label': '/usr/games Reborn: the collection',
      },
      h(
        'span',
        { class: 'hc-brand__mark', 'aria-hidden': 'true' },
        h('span'),
        h('span'),
        h('span'),
      ),
      h('span', { class: 'hc-brand__name' }, h('span', null, '/usr/games'), h('b', null, 'Reborn')),
    ),
    h(
      'nav',
      { class: 'hc-tabs', 'aria-label': 'Collection' },
      h(
        'a',
        {
          class: ['hc-tab', !onAlbum && 'is-current'],
          href: '#/',
          'aria-current': onAlbum ? undefined : 'page',
          dataset: { focusKey: 'tab:collection' },
        },
        holoIcon('cards'),
        'Collection',
      ),
      h(
        'a',
        {
          class: ['hc-tab', onAlbum && 'is-current'],
          href: '#/home',
          'aria-current': onAlbum ? 'page' : undefined,
          dataset: { focusKey: 'tab:album' },
        },
        holoIcon('trophy'),
        'Your album',
      ),
    ),
    h(
      'div',
      { class: 'hc-top__player' },
      levelBadge(context),
      streak(context),
      h(
        'div',
        { class: 'hc-top__menus' },
        h(
          'div',
          { class: 'hc-anchor' },
          popoverButton(
            context,
            'quests',
            holoIcon('quest'),
            h('span', { class: 'hc-pill__label' }, 'Weekly quests'),
            h('span', { class: 'hc-pill__count' }, `${done}/${jobs.length || 3}`),
          ),
          popover === 'quests' ? questsPanel(context) : null,
        ),
        h(
          'div',
          { class: 'hc-anchor' },
          popoverButton(
            context,
            'look',
            holoIcon('palette'),
            h('span', { class: 'hc-pill__label' }, 'Style'),
          ),
          popover === 'look' ? lookPanel(context) : null,
        ),
        h(
          'a',
          {
            class: 'hc-pill hc-pill--icon',
            href: '#/settings',
            'aria-label': 'Settings',
            dataset: { focusKey: 'settings' },
          },
          holoIcon('settings'),
        ),
      ),
    ),
  );
}
