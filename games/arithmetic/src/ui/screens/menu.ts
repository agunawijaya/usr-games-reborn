import { CHAPTERS } from '../../engine/chapters';
import { dailyPlan } from '../../engine/daily';
import { factorize, powerText } from '../../engine/factor';
import { trainingRows } from '../../engine/penalties';
import { splitNumber } from '../../engine/levels';
import { splitLevel } from '../../engine/events';
import { totalStars } from '../../game/records';
import { createRng } from '@usr-games/kit';
import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import { fitBoardText, place } from '../hud';
import { dailyEvent, type MenuData, menuView } from '../menu-view';

/**
 * The game menu, live: today's Daily, where the campaign stands, free play, the album and the
 * tutor. Escape here goes back to the Hall.
 */

/** A chapter opens once the one before it has a star in either tempo. */
export function chapterOpen(
  stars: Readonly<Record<string, { rush: number; calm: number }>>,
  index: number,
): boolean {
  if (index === 0) return true;
  const before = stars[CHAPTERS[index - 1]!.id];
  return before !== undefined && Math.max(before.rush, before.calm) > 0;
}

export function nextChapterIndex(
  stars: Readonly<Record<string, { rush: number; calm: number }>>,
): number {
  const index = CHAPTERS.findIndex((chapter) => {
    const best = stars[chapter.id];
    return !best || Math.max(best.rush, best.calm) === 0;
  });
  return index === -1 ? CHAPTERS.length - 1 : index;
}

/** The number of the day: one of the Daily's own splits, the same for everyone. */
export function numberOfTheDay(seed: string): number {
  return splitNumber(splitLevel('hundreds'), createRng(`${seed}:featured`));
}

export function menuData(app: App): MenuData {
  const records = app.saves.records.load();
  const dateKey = app.context.daily.dateKey();
  const plan = dailyPlan(app.context.daily.seed());
  const played = records.daily.days[dateKey];
  const next = nextChapterIndex(records.chapters);
  return {
    daily: {
      number: app.context.daily.number(),
      dateLabel: new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      events: plan.events.map(dailyEvent),
      played: played ? { score: `${played.score.toLocaleString('en-US')} points` } : null,
    },
    campaign: {
      chapters: CHAPTERS.map((chapter, i) => {
        const best = records.chapters[chapter.id];
        const stars = best ? Math.max(best.rush, best.calm) : 0;
        return {
          stars,
          state:
            stars > 0 ? ('done' as const) : i === next ? ('next' as const) : ('later' as const),
        };
      }),
      nextTitle: CHAPTERS[next]!.title,
      nextNumber: next + 1,
      totalStars: totalStars(records),
    },
    album: app.saves.album.load().primes.length,
    training: trainingRows(app.saves.tutor.load().book).length,
  };
}

export const menuScreen: ScreenFactory = (app: App): Screen => {
  const data = menuData(app);
  const view = menuView(app.layout, data, {
    daily: () => app.go.daily(),
    campaign: () => app.go.campaign(),
    mode: (mode) => app.go.freePlay(mode),
    album: () => app.go.album(),
    training: () => app.go.training(),
    help: () => app.go.help(),
    settings: () => app.go.settings(),
  });
  const featured = numberOfTheDay(app.context.daily.seed());
  const records = app.saves.records.load();
  const best = records.daily.best;
  const board = h(
    'div',
    { class: 'ns-board', 'aria-hidden': 'true' },
    h('div', { class: 'ns-board__top' }, best ? 'Your best Daily' : `Daily #${data.daily.number}`),
    h('div', { class: 'ns-board__problem' }, best ? best.score.toLocaleString('en-US') : 'Ready'),
    h(
      'div',
      { class: 'ns-board__rule' },
      best
        ? best.line.split(' · ').slice(2).join(' · ')
        : 'Four events, one run, the same for everyone today',
    ),
  );
  const caption = h(
    'div',
    { class: 'ns-caption', 'aria-hidden': 'true' },
    h('div', { class: 'ns-caption__small' }, 'Number of the day'),
    h('div', { class: 'ns-caption__big' }, `${featured} = ${powerText(factorize(featured))}`),
  );
  const root = h('div', { class: 'ns-menu' }, view, board, caption);
  app.setScene({ kind: 'menu', featured, daily: data.daily.number });

  function layout() {
    const l = app.layout;
    const sprint = app.look.theme === 'sprint';
    board.hidden = !sprint;
    caption.hidden = sprint;
    place(board, l.board);
    fitBoardText(board);
    const { chamber } = l;
    caption.style.left = `${chamber.x - chamber.r * 1.2}px`;
    caption.style.width = `${chamber.r * 2.4}px`;
    caption.style.top = `${chamber.y + chamber.r * 1.02}px`;
    const column = view.querySelector<HTMLElement>('.ns-menu__column');
    if (column) {
      column.style.left = `${Math.round(96 * l.s)}px`;
      column.style.top = `${Math.round(Math.max(88, 92 * l.s))}px`;
      column.style.width = `${Math.round(Math.min(l.width * 0.56, 900 * l.s))}px`;
    }
  }

  return {
    element: root,
    layout: 'menu',
    onTitle: true,
    onLayout: layout,
    focus: () =>
      root
        .querySelector<HTMLElement>('[data-testid="ns-menu-daily"]')
        ?.focus({ preventScroll: true }),
  };
};
