import './profile.css';
import { levelForXp, RANK_TOOLTIP } from '@usr-games/kit/progression';
import { type MountedPoster, mountPoster } from '../../core/art/art';
import { gameAccent } from '../../core/palette';
import { CATEGORY_NAMES, gameHref } from '../../core/plain';
import { playSound } from '../../core/sound';
import {
  formatLongDate,
  formatNumber,
  formatPlayTime,
  formatShortDate,
  plural,
} from '../../ui/format';
import { type Child, h } from '../../ui/h';
import { type ConsoleContext, goTo } from './context';
import type { ConsoleScreen } from './home';
import { glyph } from './icons';
import { railModel } from './model';
import {
  type AchievementGroup,
  type AchievementItem,
  achievementGroups,
  closetDistance,
  type GameRow,
  gamesPlayed,
  otherLooks,
  recentlyEarned,
  skinChoices,
  upNext,
} from './profile-model';
import { questsPanel } from './quests';
import { levelRing } from './ring';
import { streakWeek, topBar, weekDots } from './top-bar';

/**
 * The player's profile in Console Home: a big level ring and their name up top, then this
 * week's quests and streak, achievements (recent, up next, and every set game by game), the
 * games they have played, the accent skins they can wear, and the door to the server closet.
 * A first-day player sees the same page with friendly invitations where the numbers will be.
 */

const RECENT_COUNT = 5;
const NEXT_COUNT = 5;

function sectionTitle(id: string, title: string, ...extra: Child[]): HTMLElement {
  return h('h2', { id, class: 'ch-section-title' }, title, extra);
}

function hero(context: ConsoleContext, groups: AchievementGroup[], games: GameRow[]) {
  const { profile, progression } = context.snapshot;
  const level = levelForXp(progression.xp);
  const toNext = level.nextLevelAt === null ? 0 : level.nextLevelAt - progression.xp;
  const earned = groups.reduce((sum, g) => sum + g.earned, 0);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const seconds = games.reduce((sum, row) => sum + row.stats.totalSeconds, 0);
  const listed = context.store.catalog.listed().length;
  const name = profile.username ?? 'Guest';
  const since =
    profile.createdOn === null || profile.createdOn === context.snapshot.today
      ? 'Joined today. Welcome in.'
      : `Playing since ${formatLongDate(profile.createdOn)}`;
  const tile = (icon: Parameters<typeof glyph>[0], value: string, label: string) =>
    h(
      'li',
      { class: 'ch-profile-stat' },
      h('span', { class: 'ch-profile-stat__icon', 'aria-hidden': 'true' }, glyph(icon)),
      h('span', { class: 'ch-profile-stat__value' }, value),
      h('span', { class: 'ch-profile-stat__label' }, label),
    );
  return h(
    'section',
    { class: 'ch-profile-hero', 'aria-labelledby': 'ch-profile-name' },
    h('div', { class: 'ch-profile-hero__glow', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'ch-profile-hero__ring' },
      levelRing(level.fraction, 'ch-ring ch-ring--profile'),
      h(
        'span',
        { class: 'ch-profile-hero__level', 'aria-hidden': 'true' },
        h('span', { class: 'ch-profile-hero__level-word' }, 'Level'),
        h('b', null, String(level.level)),
      ),
    ),
    h(
      'div',
      { class: 'ch-profile-hero__who' },
      h('p', { class: 'ch-eyebrow' }, 'Your profile'),
      h('h1', { id: 'ch-profile-name', class: 'ch-profile-hero__name' }, name),
      h(
        'p',
        { class: 'ch-profile-hero__rank' },
        h('span', { class: 'ch-profile-hero__level-text' }, `Level ${level.level}`),
        h(
          'span',
          {
            class: 'ch-rank-chip',
            tabindex: '0',
            'aria-describedby': 'ch-profile-rank-tip',
            'aria-label': `Rank: ${level.rank}`,
          },
          level.rank,
          h('span', { class: 'ch-tip', id: 'ch-profile-rank-tip', role: 'tooltip' }, RANK_TOOLTIP),
        ),
      ),
      h(
        'div',
        {
          class: 'ch-xp-bar',
          role: 'progressbar',
          'aria-label': `Progress to level ${level.level + 1}`,
          'aria-valuemin': '0',
          'aria-valuemax': '100',
          'aria-valuenow': String(Math.round(level.fraction * 100)),
          'aria-valuetext':
            level.nextLevelAt === null
              ? 'Top level reached'
              : `${formatNumber(toNext)} XP to level ${level.level + 1}`,
        },
        h('span', {
          class: 'ch-xp-bar__fill',
          style: { width: `${(level.fraction * 100).toFixed(1)}%` },
        }),
      ),
      h(
        'p',
        { class: 'ch-profile-hero__xp' },
        h('b', null, `${formatNumber(progression.xp)} XP`),
        level.nextLevelAt === null
          ? ' · top level reached'
          : ` · ${formatNumber(toNext)} XP to level ${level.level + 1}`,
      ),
      h(
        'p',
        { class: 'ch-profile-hero__since' },
        since,
        profile.guest ? ' Playing as a guest; your progress still saves in this browser.' : '',
      ),
    ),
    h(
      'ul',
      { class: 'ch-profile-hero__stats', 'aria-label': 'At a glance' },
      tile('trophy', `${earned} / ${total}`, 'Achievements'),
      tile('play', `${games.length} of ${listed}`, 'Games played'),
      tile('clock', seconds > 0 ? formatPlayTime(seconds) : '0m', 'Time played'),
      tile('flame', plural(progression.streak.best, 'day'), 'Best streak'),
    ),
  );
}

function streakCard(context: ConsoleContext): HTMLElement {
  const { days, freezesLeft, week, summary } = streakWeek(context);
  const message =
    days === 0
      ? 'Play any game today and your streak begins.'
      : days === 1
        ? 'Day one. Come back tomorrow to keep it going.'
        : 'Nicely kept. Any game counts, even a short one.';
  return h(
    'section',
    { class: 'ch-card ch-streak-card', 'aria-labelledby': 'ch-streak-title' },
    h('h3', { id: 'ch-streak-title', class: 'ch-card__title' }, 'Streak'),
    h(
      'p',
      { class: 'ch-streak-card__count' },
      h(
        'span',
        { class: ['ch-streak__flame', days > 0 && 'is-lit'], 'aria-hidden': 'true' },
        glyph('flame'),
      ),
      h('b', null, String(days)),
      h('span', null, days === 1 ? 'day' : 'days'),
    ),
    h('p', { class: 'visually-hidden' }, `This week: ${summary}.`),
    weekDots(week, 'ch-streak__week ch-streak__week--large'),
    h('p', { class: 'ch-card__text' }, message),
    h(
      'p',
      { class: 'ch-card__note' },
      `Days off are fine: ${plural(freezesLeft, 'streak freeze')} ${freezesLeft === 1 ? 'is' : 'are'} left this week to cover them.`,
    ),
  );
}

function thisWeek(context: ConsoleContext): HTMLElement {
  return h(
    'section',
    { class: 'ch-profile-section ch-profile-week', 'aria-labelledby': 'ch-week-title' },
    sectionTitle('ch-week-title', 'This week'),
    h(
      'div',
      { class: 'ch-profile-week__grid' },
      h(
        'section',
        { class: 'ch-card ch-quests-card', 'aria-labelledby': 'ch-quests-card-title' },
        h('h3', { id: 'ch-quests-card-title', class: 'ch-card__title' }, 'Weekly quests'),
        questsPanel(context),
      ),
      streakCard(context),
    ),
  );
}

/** A game's own colour on its achievements, made legible for this palette; the Hall's use the chrome. */
function accentStyle(context: ConsoleContext, group: AchievementGroup): Record<string, string> {
  if (!group.entry) return {};
  const accent = group.entry.manifest.accent;
  return { '--ch-accent-raw': accent, '--ch-accent': gameAccent(accent, context.theme) };
}

function achievementCard(
  context: ConsoleContext,
  item: AchievementItem,
  group: AchievementGroup,
): HTMLElement {
  const earned = item.earnedOn !== null;
  return h(
    'li',
    {
      class: ['ch-achievement', earned ? 'is-earned' : 'is-locked', `ch-achievement--${item.tier}`],
      style: accentStyle(context, group),
    },
    h(
      'span',
      { class: 'ch-achievement__icon', 'aria-hidden': 'true' },
      glyph(earned ? 'trophy' : 'lock'),
    ),
    h('span', { class: 'ch-achievement__from' }, group.title),
    h('span', { class: 'ch-achievement__title' }, item.title),
    h('span', { class: 'ch-achievement__text' }, item.description),
    h(
      'span',
      { class: 'ch-achievement__meta' },
      earned ? `Earned ${formatShortDate(item.earnedOn!)}` : `+${item.xp} XP`,
    ),
  );
}

function groupDetails(context: ConsoleContext, group: AchievementGroup): HTMLElement {
  const fraction = group.items.length ? group.earned / group.items.length : 0;
  return h(
    'details',
    {
      class: ['ch-set', group.earned === group.items.length && 'is-complete'],
      style: accentStyle(context, group),
    },
    h(
      'summary',
      { class: 'ch-set__summary' },
      h('span', { class: 'ch-set__title' }, group.title),
      h(
        'span',
        { class: 'ch-set__count' },
        `${group.earned} of ${group.items.length}`,
        h('span', { class: 'visually-hidden' }, ' earned'),
      ),
      h(
        'span',
        { class: 'ch-set__bar', 'aria-hidden': 'true' },
        h('span', { style: { width: `${(fraction * 100).toFixed(1)}%` } }),
      ),
      glyph('chevron', 'ch-icon ch-set__chevron'),
    ),
    h(
      'ul',
      { class: 'ch-set__list' },
      group.items.map((item) =>
        h(
          'li',
          { class: ['ch-set__item', item.earnedOn ? 'is-earned' : 'is-locked'] },
          h(
            'span',
            { class: 'ch-set__mark', 'aria-hidden': 'true' },
            glyph(item.earnedOn ? 'check' : 'lock'),
          ),
          h(
            'span',
            { class: 'ch-set__text' },
            h('b', null, item.title),
            h('span', null, item.description),
          ),
          h(
            'span',
            { class: 'ch-set__meta' },
            item.earnedOn ? `Earned ${formatShortDate(item.earnedOn)}` : `To find · +${item.xp} XP`,
          ),
        ),
      ),
    ),
    group.entry
      ? h(
          'a',
          { class: 'ch-set__link', href: gameHref(group.entry.manifest.id) },
          `Open ${group.entry.manifest.title}`,
        )
      : null,
  );
}

function achievements(context: ConsoleContext, groups: AchievementGroup[]): HTMLElement {
  const earned = groups.reduce((sum, g) => sum + g.earned, 0);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const recent = recentlyEarned(groups, RECENT_COUNT);
  const next = upNext(groups, context.snapshot.progression, NEXT_COUNT);
  return h(
    'section',
    { class: 'ch-profile-section', 'aria-labelledby': 'ch-achievements-title' },
    sectionTitle(
      'ch-achievements-title',
      'Achievements',
      h('span', { class: 'ch-section-title__count' }, `${earned} of ${total} earned`),
    ),
    recent.length > 0
      ? [
          h('h3', { class: 'ch-subtitle' }, 'Recently earned'),
          h(
            'ul',
            { class: 'ch-achievements' },
            recent.map(({ item, group }) => achievementCard(context, item, group)),
          ),
        ]
      : h(
          'p',
          { class: 'ch-profile-empty' },
          'Your first achievement is waiting in whichever game you open first.',
        ),
    next.length > 0
      ? [
          h('h3', { class: 'ch-subtitle' }, 'Up next'),
          h(
            'ul',
            { class: 'ch-achievements ch-achievements--next' },
            next.map(({ item, group }) => achievementCard(context, item, group)),
          ),
        ]
      : null,
    h('h3', { class: 'ch-subtitle' }, 'Every set'),
    h(
      'div',
      { class: 'ch-sets' },
      groups.map((group) => groupDetails(context, group)),
    ),
  );
}

function gamesSection(
  context: ConsoleContext,
  games: GameRow[],
  posters: MountedPoster[],
): HTMLElement {
  const title = sectionTitle(
    'ch-games-title',
    'Your games',
    games.length > 0
      ? h('span', { class: 'ch-section-title__count' }, plural(games.length, 'game'))
      : null,
  );
  if (games.length === 0) {
    const pick = railModel(context.store, context.snapshot, null).pick;
    return h(
      'section',
      { class: 'ch-profile-section', 'aria-labelledby': 'ch-games-title' },
      title,
      h(
        'div',
        { class: 'ch-card ch-profile-invite' },
        h(
          'p',
          { class: 'ch-profile-invite__text' },
          'Every game you try lands here, with your best score, your wins and the time you have spent in it.',
        ),
        pick
          ? h(
              'a',
              {
                class: 'ch-button ch-button--primary',
                href: gameHref(pick.entry.manifest.id),
                dataset: { focusKey: 'ch-profile-pick' },
              },
              glyph('play'),
              h('span', null, `Start with Today’s pick: ${pick.entry.manifest.title}`),
            )
          : h('a', { class: 'ch-button ch-button--primary', href: '#/' }, 'Browse the games'),
      ),
    );
  }
  const rows = games.map(({ entry, stats }) => {
    const art = h('span', { class: 'ch-games__art' });
    posters.push(
      mountPoster(art, entry, {
        appearance: context.theme.appearance,
        animate: false,
        reducedMotion: context.theme.reducedMotion,
        className: 'ch-poster',
      }),
    );
    const decided = stats.wins + stats.losses + stats.draws;
    return h(
      'tr',
      { style: { '--ch-accent-raw': entry.manifest.accent } },
      h(
        'th',
        { scope: 'row' },
        h(
          'a',
          { class: 'ch-games__game', href: gameHref(entry.manifest.id) },
          art,
          h(
            'span',
            { class: 'ch-games__name' },
            h('b', null, entry.manifest.title),
            h('span', null, CATEGORY_NAMES[entry.manifest.category]),
          ),
        ),
      ),
      h('td', null, formatNumber(stats.sessions)),
      h('td', null, stats.bestScore === null ? '–' : formatNumber(stats.bestScore)),
      h('td', null, decided > 0 ? `${formatNumber(stats.wins)} of ${formatNumber(decided)}` : '–'),
      h('td', null, formatPlayTime(stats.totalSeconds)),
      h('td', null, formatShortDate(stats.lastPlayed)),
    );
  });
  return h(
    'section',
    { class: 'ch-profile-section', 'aria-labelledby': 'ch-games-title' },
    title,
    h(
      'div',
      { class: 'ch-card ch-games-card' },
      h(
        'table',
        { class: 'ch-games', 'aria-labelledby': 'ch-games-title' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { scope: 'col' }, 'Game'),
            h('th', { scope: 'col' }, 'Sessions'),
            h('th', { scope: 'col' }, 'Best'),
            h('th', { scope: 'col' }, 'Wins'),
            h('th', { scope: 'col' }, 'Time'),
            h('th', { scope: 'col' }, 'Last played'),
          ),
        ),
        h('tbody', null, rows),
      ),
    ),
  );
}

function looksSection(context: ConsoleContext): HTMLElement {
  const { progression, settings } = context.snapshot;
  const skins = skinChoices(progression);
  const current = skins.some((s) => s.id === settings.consoleSkin && s.unlocked)
    ? settings.consoleSkin
    : 'default';
  const next = skins.find((s) => !s.unlocked);
  const others = otherLooks(progression);
  const otherWords = [
    others.finishes > 0
      ? plural(others.finishes, 'foil finish', 'foil finishes') + ' in Holo Collection'
      : '',
    others.machineRoom > 0 ? plural(others.machineRoom, 'extra') + ' in the Machine Room' : '',
  ].filter(Boolean);
  return h(
    'section',
    { class: 'ch-profile-section', 'aria-labelledby': 'ch-looks-title' },
    sectionTitle(
      'ch-looks-title',
      'Your looks',
      h(
        'span',
        { class: 'ch-section-title__count' },
        `${skins.filter((s) => s.unlocked).length} of ${skins.length} skins`,
      ),
    ),
    h(
      'ul',
      { class: 'ch-skins' },
      skins.map((skin) =>
        h(
          'li',
          {
            class: [
              'ch-skin',
              skin.unlocked ? 'is-unlocked' : 'is-locked',
              skin.id === current && 'is-current',
            ],
          },
          h(
            'span',
            { class: 'ch-swatch', dataset: { skin: skin.id }, 'aria-hidden': 'true' },
            h('span', { class: 'ch-swatch__ring' }),
            h('span', { class: 'ch-swatch__pill' }),
            h('span', { class: 'ch-swatch__chip' }),
          ),
          h('span', { class: 'ch-skin__name' }, skin.name),
          h('span', { class: 'ch-skin__text' }, skin.description),
          skin.unlocked
            ? h(
                'button',
                {
                  class: ['ch-skin__use', skin.id === current && 'is-current'],
                  type: 'button',
                  'aria-pressed': String(skin.id === current),
                  'aria-label': `Wear the ${skin.name} skin`,
                  dataset: { focusKey: `ch-skin:${skin.id}` },
                  onclick: () => {
                    playSound(context.store, 'select');
                    context.store.settings.update({ consoleSkin: skin.id });
                  },
                },
                skin.id === current ? [glyph('check'), h('span', null, 'Wearing')] : 'Wear',
              )
            : h(
                'span',
                { class: 'ch-skin__lock' },
                glyph('lock'),
                h('span', null, `Unlocks at Level ${skin.level}`),
              ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'ch-card__note' },
      next ? `Next up: the ${next.name} skin at Level ${next.level}. ` : 'Every skin is yours. ',
      otherWords.length > 0 ? `You have also unlocked ${otherWords.join(' and ')}.` : '',
    ),
  );
}

function closetDoor(context: ConsoleContext): HTMLElement {
  const closet = closetDistance(context.snapshot.progression);
  return h(
    'a',
    {
      class: ['ch-card', 'ch-door', closet.open && 'is-open'],
      href: '#/closet',
      dataset: { focusKey: 'ch-closet' },
    },
    h(
      'span',
      { class: 'ch-door__frame', 'aria-hidden': 'true' },
      h('span', { class: 'ch-door__panel' }, h('span', { class: 'ch-door__knob' })),
      h('span', { class: 'ch-door__light' }),
    ),
    h(
      'span',
      { class: 'ch-door__copy' },
      h(
        'span',
        { class: 'ch-door__title' },
        closet.open ? 'The server closet is open' : 'A hidden room',
      ),
      h(
        'span',
        { class: 'ch-door__text' },
        closet.open
          ? 'You made it to the top. The rack inside hums for the people who wrote the original games.'
          : `It opens at Level ${closet.openingLevel}. You are Level ${closet.level}, ${formatNumber(closet.xpToGo)} XP away.`,
      ),
      closet.open
        ? null
        : h(
            'span',
            { class: 'ch-door__bar', 'aria-hidden': 'true' },
            h('span', { style: { width: `${(closet.fraction * 100).toFixed(1)}%` } }),
          ),
      h(
        'span',
        { class: 'ch-door__action' },
        closet.open ? 'Step inside' : 'Take a peek at the door',
        glyph('back', 'ch-icon ch-icon--flip'),
      ),
    ),
  );
}

export function profileScreen(context: ConsoleContext): ConsoleScreen {
  const listed = context.store.catalog.listed();
  const groups = achievementGroups(listed, context.snapshot.progression);
  const games = gamesPlayed(listed, context.snapshot.progression);
  const posters: MountedPoster[] = [];
  const element = h(
    'div',
    { class: 'ch-page ch-profile' },
    topBar(context),
    h(
      'div',
      { class: 'ch-page__inner' },
      h(
        'a',
        { class: 'ch-back', href: '#/', dataset: { focusKey: 'ch-back' } },
        glyph('back'),
        h('span', null, 'Home'),
      ),
      hero(context, groups, games),
      thisWeek(context),
      achievements(context, groups),
      gamesSection(context, games, posters),
      looksSection(context),
      h(
        'section',
        { class: 'ch-profile-section', 'aria-labelledby': 'ch-closet-title' },
        sectionTitle('ch-closet-title', 'Behind the racks'),
        closetDoor(context),
      ),
      h(
        'p',
        { class: 'ch-page__footer' },
        h('a', { href: '#/settings' }, 'Settings'),
        h('span', { 'aria-hidden': 'true' }, '·'),
        h('a', { href: '#/about' }, 'About these games'),
      ),
    ),
  );

  const cleanups: (() => void)[] = [];
  if (context.interactive) cleanups.push(escapeGoesTo('#/', context));

  return {
    element,
    title: 'Your profile',
    destroy() {
      for (const cleanup of cleanups) cleanup();
      for (const poster of posters) poster.destroy();
    },
  };
}

/**
 * Escape leaves a page for the one above it, the way the game page returns Home. Open dialogs
 * (Forget my data) and key capture in Settings handle their own Escape first.
 */
export function escapeGoesTo(hash: string, context: ConsoleContext): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    playSound(context.store, 'back');
    goTo(hash);
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
