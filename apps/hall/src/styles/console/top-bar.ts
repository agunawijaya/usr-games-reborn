import { addDays, type Appearance, weekStartKey } from '@usr-games/kit';
import {
  freezesUsedInWeek,
  FREEZES_PER_WEEK,
  levelForXp,
  RANK_TOOLTIP,
  streakAsOf,
} from '@usr-games/kit/progression';
import { formatNumber } from '../../ui/format';
import { h } from '../../ui/h';
import type { ConsoleContext } from './context';
import { glyph } from './icons';
import { openQuests } from './quests';
import { openStyleMenu } from './style-menu';

/**
 * The slim bar that floats over the hero: the brand, the player's level, their streak, the
 * weekly quests, the style switch and Settings. Every control says what it is in plain words.
 */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_WORDS = {
  played: 'played',
  frozen: 'kept by a streak freeze',
  quiet: 'a day off',
  future: 'still to come',
} as const;
export type DayState = keyof typeof DAY_WORDS;

export interface StreakWeek {
  days: number;
  freezesLeft: number;
  week: { letter: string; state: DayState; today: boolean }[];
  /** The whole week in words, for screen readers. */
  summary: string;
}

/** This week, Monday to Sunday: which days were played, kept by a freeze or still to come. */
export function streakWeek(context: ConsoleContext): StreakWeek {
  const { progression, today } = context.snapshot;
  const monday = weekStartKey(today);
  const frozen = new Set(progression.streak.frozen);
  const week = WEEKDAYS.map((letter, index) => {
    const day = addDays(monday, index);
    const played = Object.keys(progression.days[day]?.sessions ?? {}).length > 0;
    const state: DayState =
      day > today ? 'future' : played ? 'played' : frozen.has(day) ? 'frozen' : 'quiet';
    return { letter, state, today: day === today };
  });
  return {
    days: streakAsOf(progression.streak, today),
    freezesLeft: Math.max(0, FREEZES_PER_WEEK - freezesUsedInWeek(progression.streak, today)),
    week,
    summary: week.map((d, i) => `${WEEKDAY_NAMES[i]} ${DAY_WORDS[d.state]}`).join(', '),
  };
}

function levelBadge(context: ConsoleContext): HTMLElement {
  const { xp } = context.snapshot.progression;
  const level = levelForXp(xp);
  const toNext = level.nextLevelAt === null ? 0 : level.nextLevelAt - xp;
  const tipId = 'ch-rank-tip';
  return h(
    'a',
    {
      class: 'ch-level',
      href: '#/home',
      'aria-label': `Level ${level.level}, rank ${level.rank}. ${formatNumber(toNext)} XP to the next level. Open your profile.`,
      'aria-describedby': tipId,
    },
    h(
      'span',
      { class: 'ch-level__ring', style: { '--ch-level-fraction': level.fraction.toFixed(3) } },
      h('span', { class: 'ch-level__number' }, String(level.level)),
    ),
    h(
      'span',
      { class: 'ch-level__text' },
      h(
        'span',
        { class: 'ch-level__title' },
        `Level ${level.level}`,
        h('span', { class: 'ch-level__rank' }, level.rank),
      ),
      h(
        'span',
        { class: 'ch-level__xp' },
        level.nextLevelAt === null
          ? 'Top level'
          : `${formatNumber(toNext)} XP to level ${level.level + 1}`,
      ),
    ),
    h('span', { class: 'ch-tip', id: tipId, role: 'tooltip' }, RANK_TOOLTIP),
  );
}

/** The seven days as dots with their initials; decorative, the summary says it in words. */
export function weekDots(week: StreakWeek['week'], className = 'ch-streak__week'): HTMLElement {
  return h(
    'span',
    { class: className, 'aria-hidden': 'true' },
    week.map((d) =>
      h(
        'span',
        { class: ['ch-streak__day', `ch-streak__day--${d.state}`, d.today && 'is-today'] },
        h('span', { class: 'ch-streak__dot' }),
        h('span', { class: 'ch-streak__letter' }, d.letter),
      ),
    ),
  );
}

function streakPill(context: ConsoleContext): HTMLElement {
  const { days, freezesLeft, week, summary } = streakWeek(context);
  return h(
    'div',
    {
      class: 'ch-streak',
      role: 'group',
      'aria-label': `Streak: ${days} ${days === 1 ? 'day' : 'days'}. ${freezesLeft} streak freezes left this week. This week: ${summary}.`,
    },
    h(
      'span',
      { class: ['ch-streak__flame', days > 0 && 'is-lit'], 'aria-hidden': 'true' },
      glyph('flame'),
    ),
    h(
      'span',
      { class: 'ch-streak__count', 'aria-hidden': 'true' },
      h('b', null, String(days)),
      h('span', null, days === 1 ? 'day' : 'days'),
    ),
    weekDots(week),
  );
}

function questsButton(context: ConsoleContext): HTMLElement {
  const jobs = context.snapshot.progression.cron.jobs;
  const done = jobs.filter((job) => job.done).length;
  return h(
    'button',
    {
      class: 'ch-pill ch-pill--quests',
      type: 'button',
      'aria-haspopup': 'dialog',
      dataset: { focusKey: 'ch-quests' },
      onclick: (event: MouseEvent) => {
        if (context.interactive) openQuests(context, event.currentTarget as HTMLElement);
      },
    },
    glyph('quests'),
    h('span', null, 'Weekly quests'),
    h(
      'span',
      { class: 'ch-pill__count', 'aria-label': `${done} of ${jobs.length} done` },
      `${done}/${jobs.length}`,
    ),
  );
}

function appearanceIcon(appearance: Appearance) {
  return glyph(appearance === 'dark' ? 'moon' : 'sun');
}

export function topBar(context: ConsoleContext): HTMLElement {
  return h(
    'header',
    { class: 'ch-topbar' },
    h(
      'a',
      {
        class: 'ch-brand',
        href: '#/',
        'aria-label': '/usr/games Reborn, Home',
        dataset: { focusKey: 'ch-brand' },
      },
      h(
        'span',
        { class: 'ch-brand__mark', 'aria-hidden': 'true' },
        glyph('play', 'ch-brand__icon'),
      ),
      h('span', { class: 'ch-brand__name' }, h('span', null, '/usr/games'), h('b', null, 'Reborn')),
    ),
    h(
      'nav',
      { class: 'ch-topbar__tools', 'aria-label': 'Your progress and settings' },
      levelBadge(context),
      streakPill(context),
      questsButton(context),
      h(
        'button',
        {
          class: 'ch-round',
          type: 'button',
          'aria-haspopup': 'menu',
          'aria-label': 'Style and appearance',
          dataset: { focusKey: 'ch-style' },
          onclick: (event: MouseEvent) => {
            if (context.interactive) openStyleMenu(context, event.currentTarget as HTMLElement);
          },
        },
        appearanceIcon(context.theme.appearance),
      ),
      h(
        'a',
        {
          class: 'ch-round',
          href: '#/settings',
          'aria-label': 'Settings',
          dataset: { focusKey: 'ch-settings' },
        },
        glyph('settings'),
      ),
    ),
  );
}
