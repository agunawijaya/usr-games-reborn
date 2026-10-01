import { addDays, dailyNumber, isoWeekKey, weekStartKey } from '@usr-games/kit';
import { CATEGORIES } from '@usr-games/kit/manifest';
import {
  type CronJob,
  freezesUsedInWeek,
  FREEZES_PER_WEEK,
  streakAsOf,
} from '@usr-games/kit/progression';
import { fortuneFor } from '../../../../content/fortunes';
import { formatRoute, SORT_MODES, type SortMode } from '../../../../router';
import { gameAccent } from '../../../../core/palette';
import { formatNumber, plural } from '../../../../ui/format';
import { h } from '../../../../ui/h';
import { emblem, icon } from '../../../../ui/icons';
import { cellMeter } from '../../../../ui/meter';
import type { Screen, ScreenContext } from '../screen';
import { dailyPick, type ProcessRow, processRows, shelves } from '../../../../core/home-model';
import { processTile } from './process-tile';

const SORT_LABELS: Record<SortMode, string> = {
  recommended: 'recommended',
  recent: 'recent',
  az: 'A–Z',
};
const SORT_FLAGS: Record<SortMode, string> = {
  recommended: '--sort=recommended',
  recent: '--sort=recent',
  az: '--sort=name',
};

function pickPanel(pick: ProcessRow | null, context: ScreenContext): HTMLElement {
  const { today } = context.snapshot;
  const label = h(
    'header',
    { class: 'panel__label' },
    h('span', null, 'today’s crontab'),
    h('span', null, `daily #${dailyNumber(today)}`),
  );
  if (!pick) {
    return h(
      'article',
      { class: 'panel today__pick today__pick--empty', 'aria-labelledby': 'pick-title' },
      label,
      h('h2', { id: 'pick-title', class: 'today__title' }, 'Nothing scheduled yet'),
      h(
        'p',
        { class: 'today__text' },
        'The first processes are still starting up. Browse the man pages while the machine warms.',
      ),
    );
  }
  const { manifest } = pick.entry;
  const note = manifest.daily ? 'Today’s daily challenge is ready.' : 'Picked for everyone today.';
  return h(
    'article',
    {
      class: 'panel today__pick',
      'aria-labelledby': 'pick-title',
      style: {
        '--game-accent': gameAccent(manifest.accent, context.theme),
        '--game-accent-raw': manifest.accent,
      },
    },
    label,
    h(
      'div',
      { class: 'today__pick-body' },
      h(
        'div',
        { class: 'monitor monitor--pick' },
        emblem(manifest.emblem, 'emblem monitor__emblem'),
      ),
      h(
        'div',
        { class: 'today__pick-copy' },
        h('p', { class: 'today__path' }, `${manifest.directory}/${manifest.id}`),
        h('h2', { id: 'pick-title', class: 'today__title' }, manifest.title),
        h('p', { class: 'today__text' }, manifest.tagline),
        h('p', { class: 'today__note' }, note),
        h(
          'div',
          { class: 'today__actions' },
          h(
            'a',
            {
              class: 'button button--primary',
              href: `#/run/${manifest.id}`,
              dataset: { focusKey: 'pick-run' },
            },
            icon('run'),
            h('span', null, `Run ${manifest.id}`),
          ),
          h(
            'a',
            {
              class: 'today__man',
              href: `#/man/${manifest.id}`,
              dataset: { focusKey: 'pick-man' },
            },
            `man ${manifest.id}`,
          ),
        ),
      ),
    ),
  );
}

function cronLine(job: CronJob): HTMLElement {
  return h(
    'li',
    { class: ['cron-job', job.done && 'cron-job--done'] },
    h('code', { class: 'cron-job__when' }, job.command.split(' ').slice(0, 5).join(' ')),
    h('span', { class: 'cron-job__label' }, job.label),
    h(
      'span',
      { class: 'cron-job__progress' },
      cellMeter({
        value: job.progress,
        max: job.target,
        label: `${job.label}: ${job.progress} of ${job.target}`,
        cells: Math.min(job.target, 8),
      }),
      h(
        'span',
        { class: 'cron-job__count' },
        job.done
          ? h('span', { class: 'cron-job__done' }, icon('check'), 'done')
          : `${job.progress}/${job.target}`,
      ),
    ),
  );
}

function cronPanel(context: ScreenContext): HTMLElement {
  const { progression, today } = context.snapshot;
  const jobs = progression.cron.jobs;
  const week = isoWeekKey(today).split('-W')[1];
  return h(
    'article',
    { class: 'panel today__cron', 'aria-labelledby': 'cron-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'cron-title' }, 'crontab -l'),
      h(
        'span',
        null,
        `week ${Number(week)} · ${jobs.filter((job) => job.done).length}/${jobs.length} done`,
      ),
    ),
    jobs.length > 0
      ? h('ol', { class: 'cron-list' }, jobs.map(cronLine))
      : h(
          'p',
          { class: 'today__text' },
          'No jobs this week yet. They appear as soon as the first games are running.',
        ),
    h('p', { class: 'today__foot' }, 'New jobs every Monday. Unfinished ones simply roll off.'),
  );
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week as seven cells: played, covered by a freeze, a day off, today or still to come. */
function weekStrip(context: ScreenContext): HTMLElement {
  const { progression, today } = context.snapshot;
  const monday = weekStartKey(today);
  const frozen = new Set(progression.streak.frozen);
  return h(
    'ol',
    { class: 'week', 'aria-label': 'This week' },
    WEEKDAYS.map((letter, index) => {
      const day = addDays(monday, index);
      const played = Object.keys(progression.days[day]?.sessions ?? {}).length > 0;
      const state =
        day > today ? 'future' : played ? 'played' : frozen.has(day) ? 'frozen' : 'quiet';
      const words = {
        future: 'still to come',
        played: 'played',
        frozen: 'covered by a freeze',
        quiet: 'a day off',
      }[state];
      return h(
        'li',
        {
          class: ['week__day', `week__day--${state}`, day === today && 'is-today'],
          'aria-label': `${day}: ${words}`,
        },
        h('span', { class: 'week__letter', 'aria-hidden': 'true' }, letter),
        h(
          'span',
          { class: 'week__mark', 'aria-hidden': 'true' },
          state === 'frozen' ? icon('snow', 'icon week__snow') : null,
        ),
      );
    }),
  );
}

function fortunePanel(context: ScreenContext, uptime: number): HTMLElement {
  const { progression, today } = context.snapshot;
  const freezesLeft = Math.max(0, FREEZES_PER_WEEK - freezesUsedInWeek(progression.streak, today));
  return h(
    'article',
    { class: 'panel today__fortune', 'aria-labelledby': 'fortune-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'fortune-title' }, '$ fortune'),
      h('span', null, today),
    ),
    h('blockquote', { class: 'fortune' }, h('p', null, fortuneFor(today))),
    h(
      'div',
      { class: 'uptime-block' },
      h(
        'dl',
        { class: 'uptime' },
        h('div', null, h('dt', null, 'uptime'), h('dd', null, plural(uptime, 'day'))),
        h(
          'div',
          null,
          h('dt', null, 'best'),
          h('dd', null, plural(progression.streak.best, 'day')),
        ),
        h(
          'div',
          null,
          h('dt', null, 'freezes'),
          h('dd', null, `${freezesLeft} of ${FREEZES_PER_WEEK} left`),
        ),
      ),
      weekStrip(context),
    ),
  );
}

function directoryNav(context: ScreenContext): HTMLElement {
  const route =
    context.route.name === 'home' ? context.route : { dir: null, sort: 'recommended' as SortMode };
  const link = (label: string, dir: (typeof CATEGORIES)[number] | null) =>
    h(
      'a',
      {
        class: ['dirs__link', route.dir === dir && 'is-current'],
        href: formatRoute({ name: 'home', dir, sort: route.sort }),
        'aria-current': route.dir === dir ? 'page' : undefined,
        dataset: { focusKey: `dir:${dir ?? 'all'}` },
      },
      label,
    );
  return h(
    'nav',
    { class: 'dirs', 'aria-label': 'Directories and sorting' },
    h(
      'div',
      { class: 'dirs__path' },
      h('span', { class: 'dirs__root', 'aria-hidden': 'true' }, '/usr/games/'),
      h(
        'ul',
        { class: 'dirs__list' },
        [link('all', null), ...CATEGORIES.map((category) => link(category, category))].map((item) =>
          h('li', null, item),
        ),
      ),
    ),
    h(
      'div',
      { class: 'dirs__sort' },
      h('span', { class: 'dirs__sort-label' }, 'sort'),
      h(
        'ul',
        { class: 'dirs__list' },
        SORT_MODES.map((sort) =>
          h(
            'li',
            null,
            h(
              'a',
              {
                class: ['dirs__link', route.sort === sort && 'is-current'],
                href: formatRoute({ name: 'home', dir: route.dir, sort }),
                'aria-current': route.sort === sort ? 'true' : undefined,
                dataset: { focusKey: `sort:${sort}` },
              },
              SORT_LABELS[sort],
            ),
          ),
        ),
      ),
    ),
  );
}

export function homeScreen(context: ScreenContext): Screen {
  const { snapshot, theme, previews } = context;
  const route =
    context.route.name === 'home'
      ? context.route
      : { name: 'home' as const, dir: null, sort: 'recommended' as SortMode };
  const rows = processRows(context.store.catalog.listed(), snapshot.progression, snapshot.today);
  const pick = dailyPick(rows, snapshot.today);
  const uptime = streakAsOf(snapshot.progression.streak, snapshot.today);
  const rack = shelves(rows, route.dir, route.sort, snapshot.today);

  const element = h(
    'div',
    { class: 'screen screen--home' },
    h('h1', { class: 'visually-hidden' }, 'The process list: every game in /usr/games'),
    h(
      'section',
      { class: 'today', 'aria-label': 'Today' },
      pickPanel(pick, context),
      cronPanel(context),
      fortunePanel(context, uptime),
    ),
    directoryNav(context),
    h(
      'div',
      { class: 'rack' },
      rack.map((shelf) =>
        h(
          'section',
          { class: 'shelf', 'aria-labelledby': `shelf-${shelf.key}` },
          h(
            'header',
            { class: 'shelf__label' },
            h('h2', { id: `shelf-${shelf.key}`, class: 'shelf__path' }, shelf.label),
            h(
              'span',
              { class: 'shelf__count' },
              `${plural(shelf.rows.length, 'process', 'processes')} · ${formatNumber(shelf.rows.filter((row) => row.state === 'R').length)} running`,
            ),
          ),
          h(
            'ul',
            { class: 'shelf__tiles' },
            shelf.rows.map((row) =>
              h(
                'li',
                null,
                processTile(row, theme, previews, { showDirectory: shelf.category === null }),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  return {
    element,
    title: route.dir ? `/usr/games/${route.dir}` : 'The Machine Room',
    cwd: route.dir ? `/usr/games/${route.dir}` : '~',
    command: `ps aux ${SORT_FLAGS[route.sort]}`,
    destroy: () => previews.stopAll(),
  };
}
