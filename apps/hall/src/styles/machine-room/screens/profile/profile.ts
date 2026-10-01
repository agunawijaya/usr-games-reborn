import { addDays, type DateKey, packagePath, weekdayIndex } from '@usr-games/kit';
import {
  COSMETICS,
  type Cosmetic,
  cosmeticsForRank,
  HALL_PACKAGES,
  isUnlocked,
  RANKS,
  rankForXp,
  rankProgress,
  type ProgressionState,
  streakAsOf,
} from '@usr-games/kit/progression';
import { formatNumber, formatPlayTime, formatShortDate, plural } from '../../../../ui/format';
import { h } from '../../../../ui/h';
import { icon } from '../../../../ui/icons';
import { barMeter } from '../../../../ui/meter';
import type { Screen, ScreenContext } from '../screen';

/**
 * The player's home directory: who they are on this machine (`id`), their rank and exact XP,
 * the packages installed so far as a browsable tree, their processes, their uptime calendar
 * and every cosmetic they have unlocked, with where it came from.
 */

const GROUP_IDS: Record<string, number> = {
  guest: 65534,
  user: 100,
  staff: 50,
  wheel: 10,
  root: 0,
};

function idLine(username: string, state: ProgressionState): string {
  const rank = rankForXp(state.xp).id;
  const uid = rank === 'root' ? 0 : 1000 + ((username.length * 37) % 900);
  const groups = RANKS.slice(1, RANKS.findIndex((r) => r.id === rank) + 1)
    .reverse()
    .map((r) => `${GROUP_IDS[r.id]}(${r.id})`);
  return `uid=${uid}(${username}) gid=${GROUP_IDS[rank]}(${rank}) groups=${groups.length ? groups.join(',') : '65534(guest)'}`;
}

function banner(context: ScreenContext, username: string): HTMLElement {
  const { progression } = context.snapshot;
  const progress = rankProgress(progression.xp);
  const unlocked = (id: string) =>
    isUnlocked(COSMETICS.find((c) => c.id === id) as Cosmetic, progression);
  const bannerStyle = unlocked('banner-stripes') ? 'stripes' : 'plain';
  const valueText = progress.next
    ? `${formatNumber(progression.xp)} XP, ${formatNumber(progress.toNext)} to ${progress.next.id}`
    : `${formatNumber(progression.xp)} XP, the top rank`;
  return h(
    'header',
    { class: ['homedir__banner', `banner--${bannerStyle}`] },
    h(
      'div',
      { class: 'homedir__who' },
      h('p', { class: 'homedir__path' }, `/home/${username}`),
      h(
        'h1',
        { class: 'homedir__rank' },
        h('span', { class: 'visually-hidden' }, 'Rank: '),
        progress.rank.id,
      ),
      h('p', { class: 'homedir__flavour' }, progress.rank.flavour),
      h('code', { class: 'homedir__id' }, `$ id  →  ${idLine(username, progression)}`),
    ),
    h(
      'div',
      { class: 'homedir__xp' },
      h(
        'p',
        { class: 'xp-numbers' },
        h('span', { class: 'xp-numbers__value' }, formatNumber(progression.xp)),
        h('span', { class: 'xp-numbers__unit' }, ' XP'),
      ),
      barMeter({
        fraction: progress.fraction,
        label: 'Progress to the next rank',
        valueText,
        className: 'bar--xp',
      }),
      h(
        'p',
        { class: 'xp-caption' },
        progress.next
          ? [
              h('span', null, `${progress.rank.id} ${formatNumber(progress.rank.threshold)}`),
              h(
                'span',
                { class: 'xp-caption__to' },
                `${formatNumber(progress.toNext)} XP to ${progress.next.id}`,
              ),
              h('span', null, `${progress.next.id} ${formatNumber(progress.next.threshold)}`),
            ]
          : h('span', null, 'root: the whole machine is yours'),
      ),
      h(
        'ol',
        { class: 'rank-ladder', 'aria-label': 'Ranks' },
        RANKS.map((rank) =>
          h(
            'li',
            {
              class: [
                'rank-ladder__step',
                progression.xp >= rank.threshold && 'is-reached',
                rank.id === progress.rank.id && 'is-current',
              ],
            },
            rank.id,
          ),
        ),
      ),
    ),
  );
}

/** The last cosmetic is a room: its door is open for root, and worth a look before then. */
function closetLink(open: boolean): HTMLElement {
  return h(
    'a',
    {
      class: ['homedir__closet', open && 'is-open'],
      href: '#/closet',
      dataset: { focusKey: 'closet' },
    },
    icon(open ? 'folderOpen' : 'folder', 'icon homedir__closet-icon'),
    h('span', { class: 'homedir__closet-path' }, 'cd /var/closet'),
    h('span', { class: 'homedir__closet-note' }, open ? 'the rack is humming' : 'opens at root'),
  );
}

interface TreeFolder {
  scope: string;
  label: string;
  files: { id: string; title: string; installedOn: DateKey; xp: number; description: string }[];
}

function packageTree(context: ScreenContext): TreeFolder[] {
  const { progression } = context.snapshot;
  const folders = new Map<string, TreeFolder>();
  for (const [key, installed] of Object.entries(progression.packages)) {
    const [scope = '', id = ''] = key.split('/');
    const definition =
      scope === 'hall'
        ? HALL_PACKAGES.find((p) => p.id === id)
        : context.store.catalog.byId(scope)?.manifest.packages?.find((p) => p.id === id);
    const folder = folders.get(scope) ?? {
      scope,
      label: scope === 'hall' ? 'hall' : scope,
      files: [],
    };
    folder.files.push({
      id,
      title: definition?.title ?? id,
      installedOn: installed.installedOn,
      xp: installed.xp,
      description: definition?.description ?? '',
    });
    folders.set(scope, folder);
  }
  return [...folders.values()]
    .map((folder) => ({
      ...folder,
      files: folder.files.sort((a, b) => a.installedOn.localeCompare(b.installedOn)),
    }))
    .sort((a, b) =>
      a.scope === 'hall' ? -1 : b.scope === 'hall' ? 1 : a.scope.localeCompare(b.scope),
    );
}

function filesPanel(context: ScreenContext, username: string): HTMLElement {
  const folders = packageTree(context);
  const total = folders.reduce((sum, folder) => sum + folder.files.length, 0);
  return h(
    'section',
    { class: 'panel homedir__files', 'aria-labelledby': 'files-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'files-title' }, 'ls -R ~'),
      h('span', null, plural(total, 'package')),
    ),
    h('p', { class: 'tree__root' }, icon('folderOpen', 'icon tree__icon'), `/home/${username}/`),
    h(
      'ul',
      { class: 'tree' },
      folders.map((folder, folderIndex) =>
        h(
          'li',
          { class: ['tree__folder', folderIndex === folders.length - 1 && 'is-last'] },
          h(
            'details',
            { open: folderIndex < 3 },
            h(
              'summary',
              { class: 'tree__summary', dataset: { focusKey: `tree:${folder.scope}` } },
              icon('folder', 'icon tree__icon'),
              h('span', { class: 'tree__name' }, `${folder.label}/`),
              h('span', { class: 'tree__count' }, String(folder.files.length)),
            ),
            h(
              'ul',
              { class: 'tree__files' },
              folder.files.map((file, index) =>
                h(
                  'li',
                  {
                    class: ['tree__file', index === folder.files.length - 1 && 'is-last'],
                    title: packagePath(username, folder.scope, file.id),
                  },
                  icon('file', 'icon tree__icon'),
                  h('span', { class: 'tree__name' }, `${file.id}.pkg`),
                  h('span', { class: 'tree__title' }, file.title),
                  h('span', { class: 'tree__date' }, formatShortDate(file.installedOn)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function statsPanel(context: ScreenContext, username: string): HTMLElement {
  const { progression } = context.snapshot;
  const rows = Object.entries(progression.games)
    .map(([id, stats]) => ({
      id,
      stats,
      title: context.store.catalog.byId(id)?.manifest.title ?? id,
    }))
    .sort(
      (a, b) =>
        b.stats.lastPlayed.localeCompare(a.stats.lastPlayed) || b.stats.sessions - a.stats.sessions,
    );
  return h(
    'section',
    { class: 'panel homedir__stats', 'aria-labelledby': 'stats-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'stats-title' }, `ps -u ${username}`),
      h('span', null, plural(rows.length, 'game')),
    ),
    h(
      'table',
      { class: 'ps-table' },
      h('caption', { class: 'visually-hidden' }, 'Your games'),
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          ['game', 'runs', 'wins', 'best', 'time', 'last'].map((label) =>
            h('th', { scope: 'col' }, label),
          ),
        ),
      ),
      h(
        'tbody',
        null,
        rows.map(({ id, stats, title }) =>
          h(
            'tr',
            null,
            h('th', { scope: 'row' }, h('a', { href: `#/man/${id}` }, title)),
            h('td', null, formatNumber(stats.sessions)),
            h('td', null, formatNumber(stats.wins)),
            h('td', null, stats.bestScore === null ? '—' : formatNumber(stats.bestScore)),
            h('td', null, formatPlayTime(stats.totalSeconds)),
            h('td', null, formatShortDate(stats.lastPlayed)),
          ),
        ),
      ),
    ),
    rows.length === 0
      ? h(
          'p',
          { class: 'homedir__empty' },
          'No processes yet. Every game in ',
          h('a', { href: '#/' }, 'the process list'),
          ' is open to you; the first one you run appears here.',
        )
      : null,
  );
}

const CALENDAR_WEEKS = 6;
const DAY_STATE_WORDS = {
  future: 'still to come',
  played: 'played',
  frozen: 'covered by a freeze',
  quiet: 'a day off',
};

/**
 * The last six weeks, Monday first, like `cal` but rolling: a streak lives across month
 * boundaries, so a calendar that resets on the 1st would hide most of it.
 */
function calendarPanel(context: ScreenContext): HTMLElement {
  const { progression, today } = context.snapshot;
  const firstMonday = addDays(today, -weekdayIndex(today) - 7 * (CALENDAR_WEEKS - 1));
  const days = Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => addDays(firstMonday, i));
  const frozen = new Set(progression.streak.frozen);
  const uptime = streakAsOf(progression.streak, today);
  const range = `${formatShortDate(firstMonday)} – ${formatShortDate(days[days.length - 1] as DateKey)}`;
  return h(
    'section',
    { class: 'panel homedir__cal', 'aria-labelledby': 'cal-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'cal-title' }, 'cal -6w'),
      h('span', null, range),
    ),
    h(
      'div',
      { class: 'cal__head', 'aria-hidden': 'true' },
      ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => h('span', { class: 'cal__dow' }, d)),
    ),
    h(
      'ol',
      { class: 'cal', 'aria-label': `Days played, ${range}` },
      days.map((day) => {
        const played = Object.keys(progression.days[day]?.sessions ?? {}).length > 0;
        const state =
          day > today ? 'future' : played ? 'played' : frozen.has(day) ? 'frozen' : 'quiet';
        const label = `${formatShortDate(day)}: ${DAY_STATE_WORDS[state]}`;
        return h(
          'li',
          {
            class: ['cal__day', `cal__day--${state}`, day === today && 'is-today'],
            'aria-label': label,
            title: label,
          },
          state === 'frozen'
            ? icon('snow', 'icon cal__snow')
            : h('span', { 'aria-hidden': 'true' }, String(Number(day.slice(8)))),
        );
      }),
    ),
    h(
      'dl',
      { class: 'uptime uptime--wide' },
      h('div', null, h('dt', null, 'uptime'), h('dd', null, plural(uptime, 'day'))),
      h('div', null, h('dt', null, 'best'), h('dd', null, plural(progression.streak.best, 'day'))),
      h(
        'div',
        null,
        h('dt', null, 'cron jobs'),
        h('dd', null, `${formatNumber(progression.cron.completedTotal)} done`),
      ),
    ),
  );
}

function sourceLabel(cosmetic: Cosmetic): string {
  if ('rank' in cosmetic.source)
    return cosmetic.source.rank === 'guest' ? 'standard issue' : `rank ${cosmetic.source.rank}`;
  const id = cosmetic.source.package.split('/')[1];
  return `package ${HALL_PACKAGES.find((p) => p.id === id)?.title ?? id}`;
}

function cosmeticsPanel(context: ScreenContext): HTMLElement {
  const { progression } = context.snapshot;
  const unlocked = COSMETICS.filter((c) => isUnlocked(c, progression));
  const next = rankProgress(progression.xp).next;
  const upcoming = next ? cosmeticsForRank(next.id) : [];
  return h(
    'section',
    { class: 'panel homedir__cosmetics', 'aria-labelledby': 'cosmetics-title' },
    h(
      'header',
      { class: 'panel__label' },
      h('span', { id: 'cosmetics-title' }, 'ls ~/.config'),
      h('span', null, `${unlocked.length} of ${COSMETICS.length} unlocked`),
    ),
    h(
      'ul',
      { class: 'cosmetics' },
      unlocked.map((cosmetic) =>
        h(
          'li',
          { class: ['cosmetic', `cosmetic--${cosmetic.kind}`] },
          h('span', { class: 'cosmetic__kind' }, cosmetic.kind),
          h('span', { class: 'cosmetic__name' }, cosmetic.name),
          h('span', { class: 'cosmetic__source' }, sourceLabel(cosmetic)),
        ),
      ),
    ),
    next
      ? h(
          'p',
          { class: 'cosmetics__next' },
          h('span', { class: 'cosmetics__next-label' }, `at ${next.id}: `),
          upcoming.map((c) => c.name).join(' · '),
        )
      : null,
    closetLink(!next),
  );
}

export function profileScreen(context: ScreenContext): Screen {
  const username = context.snapshot.profile.username ?? 'guest';
  const element = h(
    'div',
    { class: 'screen screen--profile' },
    h(
      'div',
      { class: 'homedir' },
      banner(context, username),
      h(
        'div',
        { class: 'homedir__grid' },
        filesPanel(context, username),
        statsPanel(context, username),
        calendarPanel(context),
        cosmeticsPanel(context),
      ),
    ),
  );
  return { element, title: `/home/${username}`, cwd: '~', command: 'ls -la ~' };
}
